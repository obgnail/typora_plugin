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
 *    centralized scanner that exposes a `rewind` pointer.
 *
 * 3. Two-Phase Lazy Validation (Zero-Overhead Probe)
 *    DOM mapping via Rangy is extremely expensive. We decouple validation into
 *    Text Domain and Spatial Domain (`_isAnchorMatch`).
 *    The engine naturally short-circuits via Control Flow: it checks text limits
 *    first, and ONLY computes the DOM Range if the text strictly matches.
 * ============================================================================
 */

class ScannerEngine {
  static scan({ text, pattern, conditions, options, onMatch }) {
    pattern.lastIndex = 0
    let match, hasMatch = false

    while ((match = pattern.exec(text)) !== null) {
      const start = match.index
      const end = start + match[0].length

      // Prevent infinite loops on empty matches
      if (start === end) {
        pattern.lastIndex = start + 1
        continue
      }

      const matchText = match[0]
      const validConditions = conditions.filter(cond => {
        return cond.isRegex
          ? cond.strictReg.test(matchText)
          : options.caseSensitive ? matchText === cond.rawPattern : matchText.toLowerCase() === cond.rawPattern.toLowerCase()
      })

      // Provide caller with a localized rewind action to combat Greedy Swallowing
      const rewind = () => pattern.lastIndex = start + 1

      if (!validConditions.length) {
        rewind()
        continue
      }

      const status = onMatch({ text: matchText, start, end, conditions: validConditions, rewind })
      if (status === "break") break
      if (status) hasMatch = true
    }

    return hasMatch
  }
}

class DocWalker {
  _isCancelled = false
  _handlers = {}
  _pendingFutureCids = new Set()

  constructor(utils) {
    this.utils = utils
  }

  walk(handlers) {
    if (!global.NodeDef) global.NodeDef = global.Node  // Polyfill

    this.cancel() // Enforce single active session
    this._isCancelled = false
    this._handlers = handlers

    this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.afterAddCodeBlock, this._onAsyncCMReady, 999)

    if (File.editor.sourceView.inSourceMode) {
      const cm = File.editor.sourceView.cm
      this._handlers.onCodeMirror?.({ cid: "source", cm, wrapper: cm.getWrapperElement?.() })
      return
    }

    let node = File.editor.nodeMap.getFirst()
    while (node && !this._isCancelled) {
      if (this._handlers.shouldContinue && !this._handlers.shouldContinue()) break
      this._visitNode(node)
      node = node.get("after")
    }
  }

  cancel() {
    this._isCancelled = true
    this._pendingFutureCids.clear()
    this._handlers = {}
    this.utils.eventHub.removeEventListener(this.utils.eventHub.eventType.afterAddCodeBlock, this._onAsyncCMReady)
  }

  removePendingFutureCid(cid) {
    this._pendingFutureCids.delete(cid)
  }

  _onAsyncCMReady = (cid, cm) => {
    if (this._isCancelled || !this._pendingFutureCids.has(cid)) return
    this._pendingFutureCids.delete(cid)
    this._handlers.onFutureCodeMirrorReady?.({ cid, cm, wrapper: cm.getWrapperElement?.() })
  }

  _visitNode(node) {
    if (this._isCancelled || (this._handlers.shouldContinue && !this._handlers.shouldContinue())) return

    const children = node.get("children")
    if (children.length) {
      children.sortedForEach(child => this._visitNode(child))
      return
    }

    const TYPE = global.NodeDef.TYPE
    const $node = File.editor.findElemById(node.cid)
    const containerNode = $node[0]

    if (!containerNode) return

    if (global.NodeDef.isType(node, TYPE.fences)) {
      const cm = File.editor.fences.queue[node.cid]
      if (cm) {
        this._handlers.onCodeMirror?.({ cid: node.cid, cm, wrapper: cm.getWrapperElement?.() })
      } else {
        try {
          const text = node.getText().replace(/\r?\n/g, File.useCRLF ? "\r\n" : "\n")
          this._pendingFutureCids.add(node.cid)
          this._handlers.onFutureCodeMirror?.({ cid: node.cid, node: containerNode, text })
        } catch (err) {
          console.error("Failed to parse future fence node:", err)
        }
      }
    } else if (global.NodeDef.isType(node, TYPE.math_block)) {
      const cm = File.editor.mathBlock.currentCm
      if (cm?.cid === node.cid) {
        this._handlers.onCodeMirror?.({ cid: node.cid, cm, wrapper: cm.getWrapperElement?.() })
      }
    } else if (global.NodeDef.isType(node, TYPE.html_block)) {
      const cm = File.editor.mathBlock.currentCm // Typora renders HTML via CM sometimes
      if (cm?.cid === node.cid) {
        this._handlers.onCodeMirror?.({ cid: node.cid, cm, wrapper: cm.getWrapperElement?.() })
      } else {
        const htmlContainer = containerNode.querySelector(".md-htmlblock-container")
        if (htmlContainer) {
          this._handlers.onStandardNode?.({ cid: node.cid, node: htmlContainer, text: htmlContainer.textContent, offset: 0 })
        }
      }
    } else if (!global.NodeDef.isType(node, TYPE.toc, TYPE.hr)) {
      let text = $node.rawText()
      let offset = 0
      if (global.NodeDef.isType(node, TYPE.heading)) {
        const prefix = "#".repeat(node.get("depth") || 1) + " "
        text = prefix + text
        offset = prefix.length
      }
      this._handlers.onStandardNode?.({ cid: node.cid, node: containerNode, text, offset })
    }
  }
}

class Highlighter {
  constructor({ utils, config }) {
    this.utils = utils
    this.options = {
      caseSensitive: config.CASE_SENSITIVE,
      maxHighlights: config.MAX_HIGHLIGHTS,
      matchAnchor: config.HIGHLIGHTS_MATCH_ANCHOR,
    }
    this.walker = new DocWalker(utils)
    this.searchStatus = this._createInitialStatus()
  }

  process = () => {
    document.querySelector(".plugin-search-highlights").addEventListener("mousedown", ev => {
      const target = ev.target.closest(".plugin-hl-item")
      if (!target) return
      const className = [...target.classList.values()].find(c => c.startsWith("cm-sm-hit"))
      if (!className) return

      if (this.isClosed()) {
        this.doSearch()
      }

      const hitGroup = this.searchStatus.hitGroups[className]
      if (!hitGroup?.hits?.length) return

      const curPos = this.highlightNext(className, parseInt(target.dataset.pos), ev.button === 0)
      target.dataset.pos = curPos
      target.querySelector(".sm-hl-count").textContent = `${curPos + 1} / ${hitGroup.hits.length}`
    })
  }

  doSearch = (conditions = this.searchStatus.conditions) => {
    this.clearSearch()
    if (!conditions?.length) {
      return this.searchStatus.hitGroups
    }

    this._initializeSearchStatus(conditions)

    this.walker.walk({
      shouldContinue: () => this.searchStatus.hits.length <= this.options.maxHighlights,
      onStandardNode: this._processStandardNode,
      onCodeMirror: this._processCodeMirror,
      onFutureCodeMirror: this._processFutureCodeMirror,
      onFutureCodeMirrorReady: this._processFutureCodeMirrorReady,
    })

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

    // JIT init for lazy CodeMirror elements
    if (targetHit.isFutureCm) {
      const cm = File.editor.fences.addCodeBlock(targetHit.cid)
      this.walker.removePendingFutureCid(targetHit.cid)
      this.searchStatus.hits.filter(h => h.cid === targetHit.cid).forEach(h => {
        h.isCm = cm
        h.isFutureCm = false
      })
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
      this.utils.scrollTo(targetHit)
      this._showHighlightMarker(targetHit)
    }
    return currentPos
  }

  clearSearch = () => {
    if (this.isClosed()) return

    this.walker.cancel()
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

    this.searchStatus = this._createInitialStatus(true)
  }

  isClosed = () => this.searchStatus.regexp === null

  _scan = (text, onMatch) => {
    const ops = { text, onMatch, pattern: this.searchStatus.regexp, conditions: this.searchStatus.conditions, options: this.options }
    return ScannerEngine.scan(ops)
  }

  _processStandardNode = ({ cid, node, text, offset }) => {
    this._scan(text, ({ start: rawStart, end: rawEnd, conditions, rewind }) => {
      const start = Math.max(0, rawStart - offset)
      const end = rawEnd - offset
      if (start >= end) {
        rewind()
        return false
      }

      const hit = { cid, containerNode: node, start, end }
      const range = File.editor.selection.rangy.createRange()
      range.moveToBookmark(hit)

      if (node.classList?.contains("md-htmlblock-container") && range.commonAncestorContainer.nodeType !== document.TEXT_NODE) {
        return false
      }

      const ctxContainer = range.commonAncestorContainer
      const ctxNode = ctxContainer?.nodeType === document.TEXT_NODE ? ctxContainer.parentNode : ctxContainer
      const matchedCond = conditions.find(c => this._isAnchorMatch(c, ctxNode))
      if (!matchedCond) {
        rewind()
        return false
      }

      hit.highlightCls = `cm-sm-hit-${matchedCond.id}`
      const highlight = File.editor.EditHelper.markRange(range, hit.highlightCls)
      this._expandInlineParents(highlight)

      return this._pushHit(highlight, hit.highlightCls) ? true : "break"
    })
  }

  _processCodeMirror = ({ cid, cm, wrapper }) => {
    this._removeCodeMirrorOverlay(cm)

    const matched = this._scan(cm.getValue(), ({ start, end, conditions, rewind }) => {
      const matchedCond = conditions.find(c => this._isAnchorMatch(c, wrapper))
      if (!matchedCond) {
        rewind()
        return false
      }
      const hitCls = `cm-sm-hit-${matchedCond.id}`
      return this._pushHit({ isCm: cm, cid, start, end, highlightCls: hitCls }, hitCls) ? true : "break"
    })

    if (matched) {
      this._applyCodeMirrorOverlay(cid, cm)
    }
  }

  _processFutureCodeMirror = ({ cid, node, text }) => {
    this._scan(text, ({ start, end, conditions, rewind }) => {
      const matchedCond = conditions.find(c => this._isAnchorMatch(c, node))
      if (!matchedCond) {
        rewind()
        return false
      }
      const hitCls = `cm-sm-hit-${matchedCond.id}`
      const hit = { cid, containerNode: node, start, end, highlightCls: hitCls, isFutureCm: true }
      return this._pushHit(hit, hitCls) ? true : "break"
    })
  }

  _processFutureCodeMirrorReady = ({ cid, cm }) => {
    this._applyCodeMirrorOverlay(cid, cm)
    this.searchStatus.hits.filter(h => h.cid === cid).forEach(h => {
      h.isCm = cm
      h.isFutureCm = false
    })
  }

  _applyCodeMirrorOverlay = (cid, cm) => {
    this._removeCodeMirrorOverlay(cm)

    const fences = File.editor.fences
    fences.searchStatus = fences.searchStatus || {}
    fences.searchStatus.overlay = fences.searchStatus.overlay || {}
    fences.searchStatus.queue = fences.searchStatus.queue || []

    const editorId = cid || "source"
    const overlay = { searchExpression: this.searchStatus.regexp, token: this._createOverlayToken(cm) }
    fences.searchStatus.overlay[editorId] = overlay
    cm.addOverlay(overlay)
    fences.searchStatus.queue.push(cm)
  }

  _removeCodeMirrorOverlay = (cm) => {
    const fence = File.editor.fences
    if (fence.searchStatus?.overlay) {
      const cid = cm.cid || "source"
      const overlay = fence.searchStatus.overlay[cid]
      if (overlay) cm.removeOverlay(overlay)
      fence.searchStatus.queue?.remove(cm)
    }
  }

  _createOverlayToken = (cm) => {
    const wrapper = cm.getWrapperElement?.()
    const overlayRegexp = new RegExp(this.searchStatus.regexp.source, this.searchStatus.regexp.flags)
    return (cmState) => {
      overlayRegexp.lastIndex = cmState.pos
      const match = overlayRegexp.exec(cmState.string)
      if (match && match.index === cmState.pos) {
        const matchText = match[0]
        const matchedCond = this.searchStatus.conditions
          .filter(cond => {
            return cond.isRegex
              ? cond.strictReg.test(matchText)
              : this.options.caseSensitive ? matchText === cond.rawPattern : matchText.toLowerCase() === cond.rawPattern.toLowerCase()
          })
          .find(cond => this._isAnchorMatch(cond, wrapper))

        if (matchedCond) {
          cmState.pos += matchText.length || 1
          return `sm-hit-${matchedCond.id}`
        } else {
          cmState.pos += 1
          return null
        }
      }

      if (match) cmState.pos = match.index
      else cmState.skipToEnd()

      return null
    }
  }

  _createInitialStatus = (keepConditions = false) => ({
    regexp: null,
    conditions: keepConditions ? (this.searchStatus?.conditions || []) : [],
    hits: [],
    hitGroups: {},
    curSelection: null,
  })

  _initializeSearchStatus = (conditions) => {
    const pattern = conditions.map(c => `(?:${c.pattern})`).join("|")
    const ignoreCase = !this.options.caseSensitive || conditions.some(c => c.isRegex && c.flags.toLowerCase().includes("i"))

    this.searchStatus.conditions = conditions
    this.searchStatus.regexp = new RegExp(pattern, ignoreCase ? "gi" : "g")
    this.searchStatus.hitGroups = Object.fromEntries(conditions.map(c => [`cm-sm-hit-${c.id}`, { name: c.name, hits: [] }]))
  }

  _pushHit = (hit, highlightCls) => {
    this.searchStatus.hits.push(hit)
    this.searchStatus.hitGroups[highlightCls].hits.push(hit)
    return this.searchStatus.hits.length <= this.options.maxHighlights
  }

  _isAnchorMatch(cond, contextNode) {
    if (!this.options.matchAnchor || !cond.anchor) return true
    if (typeof contextNode?.closest !== "function") return cond.anchor === "#write"
    if (!contextNode.closest(cond.anchor)) return cond.anchor === "#write" && contextNode.closest("#typora-source") !== null
    return true
  }

  _expandInlineParents = (highlight) => {
    const isMetaContent = highlight.closest(".md-meta, .md-content, script")
    if (isMetaContent) {
      highlight.closest("[md-inline]")?.classList.add("md-search-expand")
    } else {
      highlight.querySelectorAll(".md-meta, .md-content, script").forEach(el => el.closest("[md-inline]")?.classList.add("md-search-expand"))
    }
  }

  _showHighlightMarker = (marker) => {
    document.querySelectorAll(".plugin-hl-outline").forEach(el => el.classList.remove("plugin-hl-outline"))
    marker.classList.add("plugin-hl-outline")

    const writeRect = this.utils.entities.eWrite.getBoundingClientRect()
    const markerRect = marker.getBoundingClientRect()
    const bar = document.createElement("div")

    bar.className = "plugin-hl-bar"
    bar.style.height = `${markerRect.height}px`
    bar.style.width = `${writeRect.width}px`

    marker.appendChild(bar)
    setTimeout(() => bar?.remove(), 3000)
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
}

module.exports = Highlighter
