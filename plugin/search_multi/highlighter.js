class Highlighter {
    constructor(plugin) {
        this.plugin = plugin
        this.utils = plugin.utils
        this.config = plugin.config
        this._resetStatus()
    }

    process = () => {
        this._polyfill()

        this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.afterAddCodeBlock, (cid, fence) => {
            if (this.searchStatus.futureCM.has(cid)) {
                this._searchOnCM(fence)
            }
        }, 999)

        this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.otherFileOpened, this.utils.debounce(() => {
            const isShow = this.utils.isShow(this.plugin.entities.modal)
            if (isShow) {
                this.plugin.highlightMultiByAST()
            }
        }, 1000))

        this.utils.entities.eContent.addEventListener("mousedown", ev => {
            const shouldClear = this.searchStatus.hits.length && !ev.target.closest("#plugin-search-multi")
            if (shouldClear) {
                this.clearSearch()
            }
        }, true)

        document.querySelector(".plugin-highlight-multi-result").addEventListener("mousedown", ev => {
            const target = ev.target.closest(".plugin-highlight-multi-result-item")
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
            target.innerText = `${name} (${currentPos + 1}/${hits.length})`
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
            while (node) {
                this._handleNode(node)
                node = node.get("after")
                const ok = this._checkHits()
                if (!ok) break
            }
        }
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

    _highlightMarker = marker => {
        document.querySelectorAll(".plugin-highlight-multi-outline").forEach(ele => ele.classList.remove("plugin-highlight-multi-outline"))
        marker.classList.add("plugin-highlight-multi-outline")

        const writeRect = this.utils.entities.eWrite.getBoundingClientRect()
        const markerRect = marker.getBoundingClientRect()
        const bar = document.createElement("div")
        bar.className = "plugin-highlight-multi-bar"
        bar.style.height = markerRect.height + "px"
        bar.style.width = writeRect.width + "px"
        marker.appendChild(bar)
        setTimeout(() => this.utils.removeElement(bar), 3000)
    }

    clearSearch = () => {
        if (this.isClosed()) return

        console.debug("clear search")
        this.utils.entities.querySelectorAllInWrite(".plugin-highlight-multi-bar").forEach(e => this.utils.removeElement(e))
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
            this._pushHit(hit, highlightCls)
            const ok = this._checkHits()
            if (!ok) break
        }

        if (hasMatch) {
            this._searchOnCM(cm)
        }
    }

    _handleOtherNode = (node, isFutureCm = false) => {
        this._resetRegexpLastIndex()
        const nodeElement = File.editor.findElemById(node.cid)[0]
        if (!nodeElement) {
            console.error(`Cannot find element for [${node.get("type")}] from [${node.get("parent").get("type")}]`)
            return
        }

        let offsetAdjust = 0
        let rawText = $(nodeElement).rawText()
        const fullText = node.getText().replace(/\r?\n/g, File.useCRLF ? "\r\n" : "\n")
        if (NodeDef.isType(node, NodeDef.TYPE.heading)) {
            const headingPrefix = "#".repeat(node.get("depth") || 1) + " "
            rawText = headingPrefix + rawText
            offsetAdjust = headingPrefix.length
        }

        const matches = [...(isFutureCm ? fullText : rawText).matchAll(this.searchStatus.regexp)]
        for (const match of matches) {
            const hit = {
                cid: node.cid,
                containerNode: nodeElement,
                start: Math.max(0, match.index - offsetAdjust),
                end: match.index + match[0].length - offsetAdjust,
                highlightCls: this._getHighlightClass(match),
            }

            if (hit.start === hit.end) continue

            if (isFutureCm) {
                this._pushHit(hit, hit.highlightCls)
                this.searchStatus.futureCM.add(node.cid)
            } else {
                const range = File.editor.selection.rangy.createRange()
                range.moveToBookmark(hit)
                const highlight = this._markRange(range, hit.highlightCls)
                const $highlight = $(highlight)
                const isMetaContent = $highlight.closest(".md-meta, .md-content, script").length
                    || $highlight.hasClass("md-meta")
                    || $highlight.hasClass("md-content")
                    || ($highlight[0] && $highlight[0].tagName === "script")
                if (isMetaContent) {
                    this._expandInlineElement($highlight)
                } else {
                    highlight.querySelectorAll(".md-meta, .md-content, script").forEach(e => this._expandInlineElement($(e)))
                }
                this._pushHit(highlight, hit.highlightCls)
            }
            const ok = this._checkHits()
            if (!ok) break
        }
    }

    _expandInlineElement = e => e.closest("[md-inline]").addClass("md-search-expand")

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
                this._pushHit(highlight, hit.highlightCls)
                const ok = this._checkHits()
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

module.exports = {
    Highlighter
}
