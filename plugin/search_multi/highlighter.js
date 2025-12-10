class Highlighter {
    constructor(plugin) {
        this.plugin = plugin
        this.utils = plugin.utils
        this.config = plugin.config
        this._resetStatus()
    }

    process = () => {
        this._polyfill()

        this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.afterAddCodeBlock, (cid, cm) => {
            const needSearch = this.searchStatus.futureCM.has(cid)
            if (needSearch) this._searchOnCM(cm)
        }, 999)

        this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.fileContentLoaded, () => {
            const isShown = !this.plugin.entities.window.hidden
            if (isShown) this.plugin.highlightByAST()
        })

        document.querySelector(".plugin-search-highlights").addEventListener("mousedown", ev => {
            const target = ev.target.closest(".plugin-highlight-item")
            if (!target) return
            const className = [...target.classList.values()].find(e => e.startsWith("cm-plugin-highlight-hit"))
            if (!className) return

            if (this.isClosed()) {
                this.doSearch()
            }

            const { name, hits } = this.searchStatus.hitGroups[className]
            if (hits.length === 0) return

            const beforePos = parseInt(target.dataset.pos)
            const currentPos = this.highlightNext(className, beforePos, ev.button === 0)
            target.dataset.pos = currentPos
            target.textContent = `${name} (${currentPos + 1}/${hits.length})`
        })
    }

    doSearch = (searchGroup = this.searchStatus.searchGroup, caseSensitive = this.config.CASE_SENSITIVE) => {
        this.clearSearch()
        if (!searchGroup || searchGroup.length === 0) {
            return this.searchStatus.hitGroups
        }

        this.searchStatus.searchGroup = searchGroup
        this.searchStatus.regexp = this._createRegExp(searchGroup, caseSensitive)
        this.searchStatus.hitGroups = Object.fromEntries(searchGroup.map((name, idx) => [`cm-plugin-highlight-hit-${idx}`, { name, hits: [] }]))
        this.searchStatus.fenceOverlay = { searchExpression: this.searchStatus.regexp, token: this._overlayToken }

        const inSourceMode = File.editor.sourceView.inSourceMode
        if (inSourceMode) {
            this._handleCodeBlock(File.editor.sourceView.cm)
        } else {
            let node = File.editor.nodeMap.getFirst()
            while (node && this._checkHits()) {
                this._handleNode(node)
                node = node.get("after")
            }
        }
        this._registerAutoClearSearch()
        return this.searchStatus.hitGroups
    }

    highlightNext = (cls, beforePos, increment) => {
        const { hits } = this.searchStatus.hitGroups[cls]
        const beforeHit = this.searchStatus.curSelection || hits[0]
        let currentPos = increment ? beforePos + 1 : beforePos - 1
        if (isNaN(+currentPos) || currentPos >= hits.length) {
            currentPos = 0
        } else if (currentPos < 0) {
            currentPos = hits.length - 1
        }
        let targetHit = hits[currentPos]

        if (beforeHit.isCm) {
            beforeHit.isCm.execCommand(increment ? "goDocStart" : "goDocEnd")
        }

        $(".md-focus").removeClass("md-focus")

        const isFutureCM = targetHit.cid && this.searchStatus.futureCM.has(targetHit.cid)
        if (isFutureCM) {
            const cm = File.editor.fences.addCodeBlock(targetHit.cid)
            this.searchStatus.hits.filter(hit => hit.cid === targetHit.cid).forEach(hit => hit.isCm = cm)
            this.searchStatus.futureCM.delete(targetHit.cid)
        }

        this.searchStatus.curSelection = targetHit
        if (targetHit.isCm) {
            const cm = targetHit.isCm
            cm.doc.setSelection(cm.posFromIndex(targetHit.start), cm.posFromIndex(targetHit.end))
            const scroller = cm.getScrollerElement()
            if (scroller) {
                targetHit = scroller.querySelector(".CodeMirror-selectedtext")
                $(scroller).closest("[cid]").addClass("md-focus")
            }
        } else {
            $(targetHit).closest("[cid]").addClass("md-focus")
        }
        if (targetHit) {
            this.utils.scroll(targetHit)
            this._highlightMarker(targetHit)
        }
        return currentPos
    }

    _registerAutoClearSearch = () => {
        document.addEventListener("mousedown", ev => {
            if (this.searchStatus.hits.length === 0) return
            if (ev.target.closest("#plugin-search-multi")) {
                this._registerAutoClearSearch()
            } else {
                this.clearSearch()
            }
        }, { capture: true, once: true })
    }

    _highlightMarker = marker => {
        document.querySelectorAll(".plugin-highlight-outline").forEach(ele => ele.classList.remove("plugin-highlight-outline"))
        marker.classList.add("plugin-highlight-outline")

        const writeRect = this.utils.entities.eWrite.getBoundingClientRect()
        const markerRect = marker.getBoundingClientRect()
        const bar = document.createElement("div")
        bar.className = "plugin-highlight-bar"
        bar.style.height = markerRect.height + "px"
        bar.style.width = writeRect.width + "px"
        marker.appendChild(bar)
        setTimeout(() => this.utils.removeElement(bar), 3000)
    }

    clearSearch = () => {
        if (this.isClosed()) return

        this.utils.entities.querySelectorAllInWrite(".plugin-highlight-bar").forEach(e => this.utils.removeElement(e))
        if (File.editor.sourceView.inSourceMode) {
            if (this.searchStatus && this.searchStatus.hits.length) {
                File.editor.fences.clearSearchAll()
                File.editor.sourceView.cm.focus()
            }
        } else {
            File.editor.mathInline.renderAll(false)
            File.editor.searchPanel.searchStatus = this.searchStatus
            File.editor.searchPanel.clearSearch()
            File.editor.fences.clearSearchAll()
            this.utils.entities.querySelectorAllInWrite('[class*="cm-plugin-highlight-hit"]').forEach(e => File.editor.EditHelper.unmarkSpan(e))
        }
        this._resetStatus()
    }

    isClosed = () => this.searchStatus.regexp == null
    _resetStatus = () => this.searchStatus = { ...this.searchStatus, regexp: null, hits: [], hitGroups: {}, futureCM: new Set() }
    _resetRegexpLastIndex = (lastIndex = 0) => this.searchStatus.regexp.lastIndex = lastIndex

    _pushHit = (hit, highlightCls) => {
        this.searchStatus.hits.push(hit)
        this.searchStatus.hitGroups[highlightCls].hits.push(hit)
        return this._checkHits()
    }

    _handleNode = node => {
        const children = node.get("children")
        if (children.length) {
            children.sortedForEach(child => this._handleNode(child))
        } else if (NodeDef.isType(node, NodeDef.TYPE.fences)) {
            this._handleFences(node)
        } else if (NodeDef.isType(node, NodeDef.TYPE.math_block)) {
            this._handleMathBlock(node)
        } else if (NodeDef.isType(node, NodeDef.TYPE.html_block)) {
            this._handleHTMLBlock(node)
        } else if (NodeDef.isType(node, NodeDef.TYPE.toc, NodeDef.TYPE.hr)) {

        } else {
            this._handleOtherNode(node)
        }
    }

    _handleCodeBlock = cm => {
        this._resetRegexpLastIndex()

        let hasMatch = false
        const value = cm.getValue()
        const matches = value.matchAll(this.searchStatus.regexp)
        for (const match of matches) {
            hasMatch = true
            const matchString = match[0]
            const start = match.index
            const end = start + matchString.length
            const highlightCls = this._getHighlightClass(match)

            if (start === end) continue

            const hit = { isCm: cm, cid: cm.cid, start, end, highlightCls }
            const ok = this._pushHit(hit, highlightCls)
            if (!ok) break
        }

        if (hasMatch) {
            this._searchOnCM(cm)
        }
    }

    _handleOtherNode = (node, isFutureCm = false) => {
        this._resetRegexpLastIndex()
        const $node = File.editor.findElemById(node.cid)
        if (!$node[0]) return

        let offsetAdjust = 0
        let rawText = $node.rawText()
        const fullText = node.getText().replace(/\r?\n/g, File.useCRLF ? "\r\n" : "\n")
        if (NodeDef.isType(node, NodeDef.TYPE.heading)) {
            const depth = node.get("depth") || 1
            const headingPrefix = "#".repeat(depth) + " "
            rawText = headingPrefix + rawText
            offsetAdjust = headingPrefix.length
        }

        const matches = (isFutureCm ? fullText : rawText).matchAll(this.searchStatus.regexp)
        for (const match of matches) {
            const hit = {
                cid: node.cid,
                containerNode: $node[0],
                start: Math.max(0, match.index - offsetAdjust),
                end: match.index + match[0].length - offsetAdjust,
                highlightCls: this._getHighlightClass(match),
            }
            if (hit.start === hit.end) continue

            let highlight = hit
            if (isFutureCm) {
                this.searchStatus.futureCM.add(node.cid)
            } else {
                const range = File.editor.selection.rangy.createRange()
                range.moveToBookmark(hit)
                highlight = this._markRange(range, hit.highlightCls)
                const isMetaContent = highlight.closest(".md-meta, .md-content, script")
                if (isMetaContent) {
                    this._expandInlineEl(highlight)
                } else {
                    highlight.querySelectorAll(".md-meta, .md-content, script").forEach(el => this._expandInlineEl(el))
                }
            }
            const ok = this._pushHit(highlight, hit.highlightCls)
            if (!ok) break
        }
    }

    _expandInlineEl = el => el.closest("[md-inline]")?.classList.add("md-search-expand")

    _handleFences = node => {
        this._resetRegexpLastIndex()
        const cm = File.editor.fences.queue[node.cid]
        if (cm) {
            this._handleCodeBlock(cm)
            return
        }
        try {
            this._handleOtherNode(node, true)
        } catch (error) {
            console.error(error)
        }
    }

    _handleMathBlock = node => {
        this._resetRegexpLastIndex()
        const currentCm = File.editor.mathBlock.currentCm
        const mathBlockCM = (currentCm || {}).cid === node.cid
        if (mathBlockCM) {
            this._clearSearchOnCM(currentCm)
            this._handleCodeBlock(currentCm)
        }
    }

    _handleHTMLBlock = node => {
        this._resetRegexpLastIndex()
        const currentCm = File.editor.mathBlock.currentCm
        const htmlBlockCM = (currentCm || {}).cid === node.cid
        if (htmlBlockCM) {
            this._clearSearchOnCM(currentCm)
            this._handleCodeBlock(currentCm)
            return
        }

        const nodeElement = File.editor.findElemById(node.cid)[0].querySelector(".md-htmlblock-container")
        const textContent = nodeElement.textContent
        const matches = textContent.matchAll(this.searchStatus.regexp)
        for (const match of matches) {
            const hit = {
                cid: node.cid,
                containerNode: nodeElement,
                start: match.index,
                end: match.index + match[0].length,
                highlightCls: this._getHighlightClass(match),
            }

            if (hit.start === hit.end) continue

            const range = File.editor.selection.rangy.createRange()
            range.moveToBookmark(hit)
            if (range.commonAncestorContainer.nodeType === document.TEXT_NODE) {
                const highlight = this._markRange(range, hit.highlightCls)
                const ok = this._pushHit(highlight, hit.highlightCls)
                if (!ok) break
            }
        }
    }

    _createRegExp = (group, caseSensitive) => {
        if (!caseSensitive) {
            group = group.map(e => e.toLowerCase())
        }
        const pattern = group.map((r, idx) => `(?<m_${idx}>${r})`).join("|")
        const flag = caseSensitive ? "g" : "gi"
        return new RegExp(pattern, flag)
    }

    _getHighlightClass = (match, prefix = true) => {
        const groupNamePrefixLength = 2 // m_
        const matchGroup = Object.entries(match.groups).find(([_, value]) => value)
        const idx = matchGroup[0].slice(groupNamePrefixLength)
        const prefix_ = prefix ? "cm-" : ""
        return `${prefix_}plugin-highlight-hit-${idx}`
    }

    _markRange = (range, cls = "cm-plugin-highlight-hit-0") => File.editor.EditHelper.markRange(range, cls)

    _overlayToken = state => {
        const regexp = this.searchStatus.regexp
        regexp.lastIndex = state.pos
        const match = regexp.exec(state.string)
        if (match && match.index === state.pos) {
            state.pos += match[0].length || 1
            return this._getHighlightClass(match, false)
        } else {
            if (match) {
                state.pos = match.index
            } else {
                state.skipToEnd()
            }
            return null
        }
    }

    _searchOnCM = cm => {
        const fences = File.editor.fences
        fences.searchStatus = fences.searchStatus || {}
        fences.searchStatus.overlay = fences.searchStatus.overlay || {}
        fences.searchStatus.queue = fences.searchStatus.queue || []

        const editorId = cm.cid || "source"
        fences.searchStatus.overlay[editorId] = this.searchStatus.fenceOverlay
        cm.addOverlay(fences.searchStatus.overlay[editorId])
        fences.searchStatus.queue.push(cm)
    }

    _clearSearchOnCM = cm => {
        const fence = File.editor.fences
        if (fence.searchStatus) {
            const cid = cm.cid || "source"
            cm.removeOverlay(this.searchStatus.overlay[cid])
            fence.searchStatus.queue.remove(cm)
        }
    }

    _checkHits = () => this.searchStatus.hits.length <= this.config.MAX_HITS

    _polyfill = () => {
        if (!global.NodeDef) {
            global.NodeDef = global.Node
        }
    }
}

module.exports = Highlighter
