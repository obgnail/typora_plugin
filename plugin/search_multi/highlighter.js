/**
 * ============================================================================
 * ARCHITECTURAL CONTEXT: THE HIGHLIGHTER ENGINE
 * ============================================================================
 *
 * 1. The Monkey Patch Base
 *    Relies on `this.searchStatus` mimicking Typora's native search object
 *    to leverage the official `clearSearch`/`unmarkSpan` cleanup routines.
 *
 * 2. The Sliding Window Scanner (Anti-Greedy-Swallow)
 *    Instead of complex capture groups, we compile a flat, non-capturing
 *    Mega-RegExp (`(?:pat1)|(?:pat2)`). To prevent the regex engine from
 *    swallowing valid sub-matches when spatial/DOM validation fails, we use a
 *    centralized scanner (`_scanMatches`) that exposes a `rewind` pointer.
 *
 * 3. Two-Phase Lazy Validation (Zero-Overhead Probe)
 *    DOM mapping via Rangy is extremely expensive. We decouple validation into
 *    Text Domain (`_isTextMatch`) and Spatial Domain (`_isAnchorMatch`).
 *    The engine naturally short-circuits via Control Flow: it checks text limits
 *    first, and ONLY computes the DOM Range if the text strictly matches.
 * ============================================================================
 */
class Highlighter {
  constructor({ utils, config }) {
    this.utils = utils
    this.options = { caseSensitive: config.CASE_SENSITIVE, maxHighlights: config.MAX_HIGHLIGHTS, matchAnchor: config.HIGHLIGHTS_MATCH_ANCHOR }
    this.searchStatus = { conditions: [] }
    this._resetStatus()
  }

  process = () => {
    this._polyfill()

    this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.afterAddCodeBlock, (cid, cm) => this.searchStatus.futureCM.has(cid) && this._searchOnCM(cm), 999)

    document.querySelector(".plugin-search-highlights").addEventListener("mousedown", ev => {
      const target = ev.target.closest(".plugin-hl-item")
      if (!target) return
      const className = [...target.classList.values()].find(c => c.startsWith("cm-sm-hit"))
      if (!className) return

      if (this.isClosed()) {
        this.doSearch()
      }

      const hitGroup = this.searchStatus.hitGroups[className]
      if (!hitGroup || !hitGroup.hits || hitGroup.hits.length === 0) return

      const curPos = this.highlightNext(className, parseInt(target.dataset.pos), ev.button === 0)
      target.dataset.pos = curPos
      const countNode = target.querySelector(".sm-hl-count")
      countNode.textContent = `${curPos + 1} / ${hitGroup.hits.length}`
    })
  }

  doSearch = (conditions = this.searchStatus.conditions) => {
    this.clearSearch()
    if (!conditions || conditions.length === 0) {
      return this.searchStatus.hitGroups
    }

    const pattern = conditions.map(c => `(?:${c.pattern})`).join("|")
    const ignoreCase = !this.options.caseSensitive || conditions.some(c => c.isRegex && c.flags.toLowerCase().includes("i"))

    this.searchStatus.conditions = conditions
    this.searchStatus.regexp = new RegExp(pattern, ignoreCase ? "gi" : "g")
    this.searchStatus.hitGroups = Object.fromEntries(conditions.map(c => [`cm-sm-hit-${c.id}`, { name: c.name, hits: [] }]))

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
    document.querySelectorAll(".plugin-hl-outline").forEach(el => el.classList.remove("plugin-hl-outline"))
    marker.classList.add("plugin-hl-outline")

    const writeRect = this.utils.entities.eWrite.getBoundingClientRect()
    const markerRect = marker.getBoundingClientRect()
    const bar = document.createElement("div")
    bar.className = "plugin-hl-bar"
    bar.style.height = markerRect.height + "px"
    bar.style.width = writeRect.width + "px"
    marker.appendChild(bar)
    setTimeout(() => bar?.remove(), 3000)
  }

  clearSearch = () => {
    if (this.isClosed()) return

    this.utils.entities.querySelectorAllInWrite(".plugin-hl-bar").forEach(el => el.remove())
    if (File.editor.sourceView.inSourceMode) {
      if (this.searchStatus?.hits.length) {
        File.editor.fences.clearSearchAll()
        File.editor.sourceView.cm.focus()
      }
    } else {
      File.editor.mathInline.renderAll(false)
      File.editor.searchPanel.searchStatus = this.searchStatus
      File.editor.searchPanel.clearSearch()
      File.editor.fences.clearSearchAll()
      this.utils.entities.querySelectorAllInWrite(`[class*="cm-sm-hit"]`).forEach(e => File.editor.EditHelper.unmarkSpan(e))
    }
    this._resetStatus()
  }

  isClosed = () => this.searchStatus.regexp == null
  _resetStatus = () => this.searchStatus = { ...this.searchStatus, regexp: null, hits: [], hitGroups: {}, futureCM: new Set() }

  _pushHit = (hit, highlightCls) => {
    this.searchStatus.hits.push(hit)
    this.searchStatus.hitGroups[highlightCls].hits.push(hit)
    return this._checkHits()
  }

  _isTextMatch = (cond, matchString) => {
    if (cond.isRegex) {
      return cond.strictReg.test(matchString)
    }
    return this.options.caseSensitive
      ? matchString === cond.rawPattern
      : matchString.toLowerCase() === cond.rawPattern.toLowerCase()
  }

  _isAnchorMatch = (cond, contextNode) => {
    if (!this.options.matchAnchor) return true
    if (!cond.anchor) return true
    if (typeof contextNode?.closest !== "function") {
      return cond.anchor === "#write"
    }
    if (!contextNode.closest(cond.anchor)) {
      return cond.anchor === "#write" && contextNode.closest("#typora-source")
    }
    return true
  }

  _getSatisfiedCondition = (matchString, contextNode) => {
    return this.searchStatus.conditions.find(cond => this._isTextMatch(cond, matchString) && this._isAnchorMatch(cond, contextNode)) || null
  }

  _scanMatches = (text, callback) => {
    this.searchStatus.regexp.lastIndex = 0
    let match
    let hasMatch = false
    while ((match = this.searchStatus.regexp.exec(text)) !== null) {
      const start = match.index
      const end = start + match[0].length
      if (start === end) {
        this.searchStatus.regexp.lastIndex = start + 1
        continue
      }

      // Provide caller with a localized rewind action to combat Greedy Swallowing
      const rewind = () => this.searchStatus.regexp.lastIndex = start + 1
      const status = callback(match[0], start, end, rewind)
      if (status === "break") break
      if (status) hasMatch = true
    }
    return hasMatch
  }

  _handleNode = node => {
    if (!this._checkHits()) return
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
    const wrapper = cm.getWrapperElement?.() ?? null
    const hasMatch = this._scanMatches(cm.getValue(), (matchString, start, end, rewind) => {
      const satisfiedCond = this._getSatisfiedCondition(matchString, wrapper)
      if (!satisfiedCond) {
        rewind()
        return false
      }
      const highlightCls = `cm-sm-hit-${satisfiedCond.id}`
      const hit = { isCm: cm, cid: cm.cid, start, end, highlightCls }
      return this._pushHit(hit, highlightCls) ? true : "break"
    })

    if (hasMatch) this._searchOnCM(cm)
  }

  _handleOtherNode = (node, isFutureCm = false) => {
    const $node = File.editor.findElemById(node.cid)
    if (!$node[0]) return

    let textToSearch
    let offsetAdjust = 0
    if (isFutureCm) {
      textToSearch = node.getText().replace(/\r?\n/g, File.useCRLF ? "\r\n" : "\n")
    } else {
      textToSearch = $node.rawText()
      if (NodeDef.isType(node, NodeDef.TYPE.heading)) {
        const prefix = "#".repeat(node.get("depth") || 1) + " "
        textToSearch = prefix + textToSearch
        offsetAdjust = prefix.length
      }
    }

    this._scanMatches(textToSearch, (matchString, rawStart, rawEnd, rewind) => {
      const validTextConds = this.searchStatus.conditions.filter(cond => this._isTextMatch(cond, matchString))
      if (validTextConds.length === 0) {
        rewind()
        return false
      }
      const start = Math.max(0, rawStart - offsetAdjust)
      const end = rawEnd - offsetAdjust
      if (start >= end) {
        rewind()
        return false
      }
      const hit = { cid: node.cid, containerNode: $node[0], start, end }
      const { range, contextNode } = isFutureCm ? { range: null, contextNode: $node[0] } : this._getRangeContext(hit)
      const satisfiedCond = validTextConds.find(cond => this._isAnchorMatch(cond, contextNode))
      if (!satisfiedCond) {
        rewind()
        return false
      }
      hit.highlightCls = `cm-sm-hit-${satisfiedCond.id}`
      if (isFutureCm) {
        this.searchStatus.futureCM.add(node.cid)
        if (!this._pushHit(hit, hit.highlightCls)) return "break"
      } else {
        const highlight = this._markRange(range, hit.highlightCls)
        this._expandInlineParents(highlight)
        if (!this._pushHit(highlight, hit.highlightCls)) return "break"
      }
      return true
    })
  }

  _handleHTMLBlock = node => {
    const currentCm = File.editor.mathBlock.currentCm
    if (currentCm?.cid === node.cid) {
      this._clearSearchOnCM(currentCm)
      this._handleCodeBlock(currentCm)
      return
    }

    const nodeElement = File.editor.findElemById(node.cid)[0]?.querySelector(".md-htmlblock-container")
    if (!nodeElement) return

    this._scanMatches(nodeElement.textContent, (matchString, start, end, rewind) => {
      const satisfiedCond = this._getSatisfiedCondition(matchString, nodeElement)
      if (!satisfiedCond) {
        rewind()
        return false
      }
      const highlightCls = `cm-sm-hit-${satisfiedCond.id}`
      const hit = { cid: node.cid, containerNode: nodeElement, start, end, highlightCls }
      const range = File.editor.selection.rangy.createRange()
      range.moveToBookmark(hit)
      if (range.commonAncestorContainer.nodeType === document.TEXT_NODE) {
        const highlight = this._markRange(range, highlightCls)
        if (!this._pushHit(highlight, highlightCls)) return "break"
      }
      return true
    })
  }

  _handleFences = node => {
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
    const currentCm = File.editor.mathBlock.currentCm
    if (currentCm?.cid === node.cid) {
      this._clearSearchOnCM(currentCm)
      this._handleCodeBlock(currentCm)
    }
  }

  _getRangeContext = (bookmark) => {
    const range = File.editor.selection.rangy.createRange()
    range.moveToBookmark(bookmark)
    const container = range.commonAncestorContainer
    const contextNode = container?.nodeType === document.TEXT_NODE ? container.parentNode : container
    return { range, contextNode }
  }

  _expandInlineParents = highlight => {
    const isMetaContent = highlight.closest(".md-meta, .md-content, script")
    if (isMetaContent) {
      highlight.closest("[md-inline]")?.classList.add("md-search-expand")
    } else {
      highlight.querySelectorAll(".md-meta, .md-content, script").forEach(el => el.closest("[md-inline]")?.classList.add("md-search-expand"))
    }
  }

  _markRange = (range, cls = "cm-sm-hit-0") => File.editor.EditHelper.markRange(range, cls)

  _getOverlayToken = (cm) => {
    const wrapper = cm.getWrapperElement?.() ?? null
    return (state) => {
      const regexp = this.searchStatus.regexp
      regexp.lastIndex = state.pos
      const match = regexp.exec(state.string)
      if (match && match.index === state.pos) {
        const satisfiedCond = this._getSatisfiedCondition(match[0], wrapper)
        if (satisfiedCond) {
          state.pos += match[0].length || 1
          return `sm-hit-${satisfiedCond.id}`
        } else {
          // Anti-greedy swallow for tokenizer
          state.pos += 1
          return null
        }
      }
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
    const overlay = { searchExpression: this.searchStatus.regexp, token: this._getOverlayToken(cm) }
    fences.searchStatus.overlay[editorId] = overlay
    cm.addOverlay(overlay)
    fences.searchStatus.queue.push(cm)
  }

  _clearSearchOnCM = cm => {
    const fence = File.editor.fences
    if (fence.searchStatus?.overlay) {
      const cid = cm.cid || "source"
      const overlay = fence.searchStatus.overlay[cid]
      if (overlay) cm.removeOverlay(overlay)
      fence.searchStatus.queue?.remove(cm)
    }
  }

  _checkHits = () => this.searchStatus.hits.length <= this.options.maxHighlights

  _polyfill = () => {
    if (!global.NodeDef) {
      global.NodeDef = global.Node
    }
  }
}

module.exports = Highlighter
