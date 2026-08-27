const { TextEngine } = require("./typora_text_engine.js")

/**
 * The Monkey Patch Base
 * Relies on `this.searchStatus` mimicking Typora's native search object
 * to leverage the official `clearSearch`/`unmarkSpan` cleanup routines.
 */
class Highlighter {
  constructor({ utils, config }) {
    this.utils = utils
    this.engine = new TextEngine(utils)
    this.options = { caseSensitive: config.CASE_SENSITIVE, maxHighlights: config.MAX_HIGHLIGHTS, matchAnchor: config.HIGHLIGHTS_MATCH_ANCHOR }
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

    this.engine.scanAll({
      options: this.options,
      conditions: this.searchStatus.conditions,
      pattern: this.searchStatus.regexp,
      hooks: {
        shouldContinue: () => this.searchStatus.hits.length <= this.options.maxHighlights,
        validateMatch: (rule, contextNode) => this._isAnchorMatched(rule, contextNode),
        onDOMHit: ({ rule, range, hitContext, control }) => {
          hitContext.highlightCls = `cm-sm-hit-${rule.id}`
          const hit = File.editor.EditHelper.markRange(range, hitContext.highlightCls)
          this._expandInlineParents(hit)
          this._pushHit(hit, hitContext.highlightCls, control)
        },
        getCMHighlightClass: (rule) => `sm-hit-${rule.id}`,
        onCMHit: ({ rule, cm, cid, start, end, control }) => {
          const hitCls = `cm-sm-hit-${rule.id}`
          this._pushHit({ isCm: cm, cid, start, end, highlightCls: hitCls }, hitCls, control)
        },
        onFutureCMHit: ({ rule, cid, containerNode, start, end, control }) => {
          const hitCls = `cm-sm-hit-${rule.id}`
          this._pushHit({ cid, containerNode, start, end, highlightCls: hitCls, isFutureCm: true }, hitCls, control)
        },
        onCMReady: (cid, cm) => {
          this.searchStatus.hits.filter(h => h.cid === cid).forEach(h => {
            h.isCm = cm
            h.isFutureCm = false
          })
        },
      },
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
      this.engine.removeFutureCid(targetHit.cid)
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

    this.engine.clearAll()
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

  _createInitialStatus = (keepConditions = false) => ({
    regexp: null,
    hits: [],
    hitGroups: {},
    curSelection: null,
    conditions: keepConditions ? (this.searchStatus?.conditions || []) : [],
  })

  _initializeSearchStatus = (conditions) => {
    this.searchStatus.conditions = conditions
    this.searchStatus.hitGroups = Object.fromEntries(conditions.map(c => [`cm-sm-hit-${c.id}`, { name: c.name, hits: [] }]))
    this.searchStatus.regexp = new RegExp(
      conditions.map(c => `(?:${c.pattern})`).join("|"),
      (!this.options.caseSensitive || conditions.some(c => c.isRegex && c.flags.toLowerCase().includes("i"))) ? "gi" : "g",
    )
  }

  _pushHit = (hit, highlightCls, control) => {
    this.searchStatus.hits.push(hit)
    this.searchStatus.hitGroups[highlightCls].hits.push(hit)
    if (this.searchStatus.hits.length > this.options.maxHighlights) {
      control.stop()
    }
  }

  _isAnchorMatched(cond, contextNode) {
    if (!this.options.matchAnchor || !cond.anchor) return true
    if (typeof contextNode?.closest !== "function") return cond.anchor === "#write"
    if (!contextNode.closest(cond.anchor)) return cond.anchor === "#write" && contextNode.closest("#typora-source") !== null
    return true
  }

  _expandInlineParents = (hit) => {
    const isMetaContent = hit.closest(".md-meta, .md-content, script")
    if (isMetaContent) {
      hit.closest("[md-inline]")?.classList.add("md-search-expand")
    } else {
      hit.querySelectorAll(".md-meta, .md-content, script").forEach(el => el.closest("[md-inline]")?.classList.add("md-search-expand"))
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
