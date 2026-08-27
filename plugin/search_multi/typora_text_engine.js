/**
 * A universal text-matching and DOM-mapping infrastructure for Typora.
 *
 * [DESIGN RATIONALE]
 * Typora utilizes a highly fragmented hybrid rendering architecture:
 *   - Native DOM for standard text
 *   - CodeMirror for code/math blocks, and lazy-loaded asynchronous nodes ("FutureCM").
 *
 * This engine abstracts away the underlying topological complexities and provides
 * a unified, declarative IoC (Inversion of Control) interface. It decouples the
 * "Text/Spatial Validation" from "Side-Effect Injection" (e.g., highlighting),
 * allowing business logic to remain completely agnostic of Typora's core quirks.
 *
 * [WORKING PRINCIPLES]
 * 1. Topology Walker (DocWalker):
 *    Safely iterates through Typora's mixed AST, normalizing node fragmentations
 *    and compensating for hidden offset distortions (e.g., Heading '#' markers).
 * 2. Zero-Overhead Probe (Lazy Evaluation):
 *    Evaluates RegExp against raw text first. Expensive spatial calculations
 *    (DOM `Range` instantiation via Rangy) are lazily computed ONLY upon strict
 *    textual hits.
 * 3. Anti-Greedy Controller (IoC Flow):
 *    Injects a state-machine controller (`skip()`, `stop()`) into lifecycle hooks.
 *    Failed spatial validations gracefully trigger localized regex rewinds via `skip()`,
 *    eliminating greedy-swallow regressions without relying on magic return strings.
 * 4. CodeMirror Sandbox (State Isolation):
 *    CodeMirror overlay tokenizers are sandboxed within the engine instance.
 *    This prevents global variable pollution and allows multiple rendering plugins
 *    to coexist safely without intercepting native Typora behaviors.
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
          : (options.caseSensitive ? matchText === cond.rawPattern : matchText.toLowerCase() === cond.rawPattern.toLowerCase())
      })

      const control = {
        _stopped: false,
        _skipped: false,
        stop() {
          this._stopped = true
        },
        skip() {
          this._skipped = true
        },
        // Provide caller with a localized rewind action to combat Greedy Swallowing
        rewind() {
          this._skipped = true
          pattern.lastIndex = start + 1
        },
      }

      if (!validConditions.length) {
        control.rewind()
        continue
      }

      onMatch({ text: matchText, start, end, conditions: validConditions, control })
      if (control._stopped) break
      if (!control._skipped) hasMatch = true
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

  walkNode(cid, handlers) {
    this._polyfill()
    this._handlers = handlers
    const node = File.editor.nodeMap.get(cid)
    if (node) {
      this._visitNode(node)
    }
  }

  walk(handlers) {
    this._polyfill()
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

  _polyfill = () => {
    if (!global.NodeDef) global.NodeDef = global.Node
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

const DEFAULT_HOOKS = {
  shouldContinue: () => true,
  validateMatch: () => true,
  onDOMHit: () => undefined,
  onCMHit: () => undefined,
  onFutureCMHit: () => undefined,
  getCMHighlightClass: () => null,
  onCMReady: () => undefined,
}

class TextEngine {
  cmOverlays = new Map()

  constructor(utils) {
    this.walker = new DocWalker(utils)
    this.handlers = {
      shouldContinue: () => true,
      onStandardNode: this._processStandardNode,
      onCodeMirror: this._processCodeMirror,
      onFutureCodeMirror: this._processFutureCodeMirror,
      onFutureCodeMirrorReady: this._processFutureCodeMirrorReady,
    }
  }

  scanNode(cid, { conditions, options, pattern, hooks }) {
    if (!cid || !conditions?.length) return
    this.ctx = { conditions, options, pattern, hooks: { ...DEFAULT_HOOKS, ...hooks } }
    this.walker.walkNode(cid, { shouldContinue: this.ctx.hooks.shouldContinue, ...this.handlers })
  }

  scanAll({ conditions, options, pattern, hooks }) {
    this.clearAll()
    if (!conditions?.length) return
    this.ctx = { conditions, options, pattern, hooks: { ...DEFAULT_HOOKS, ...hooks } }
    this.walker.walk({ shouldContinue: this.ctx.hooks.shouldContinue, ...this.handlers })
  }

  clearAll() {
    this.walker.cancel()
    for (const [cm, overlay] of this.cmOverlays.entries()) {
      cm.removeOverlay(overlay)
    }
    this.cmOverlays.clear()
  }

  removeFutureCid(cid) {
    this.walker.removePendingFutureCid(cid)
  }

  _scan = (text, onMatch) => {
    return ScannerEngine.scan({ text, pattern: this.ctx.pattern, conditions: this.ctx.conditions, options: this.ctx.options, onMatch })
  }

  _processStandardNode = ({ cid, node, text, offset }) => {
    this._scan(text, ({ start: rawStart, end: rawEnd, conditions, control }) => {
      const start = Math.max(0, rawStart - offset)
      const end = rawEnd - offset
      if (start >= end) {
        return control.rewind()
      }

      const hitContext = { cid, containerNode: node, start, end }
      const range = File.editor.selection.rangy.createRange()
      range.moveToBookmark(hitContext)

      if (node.classList?.contains("md-htmlblock-container") && range.commonAncestorContainer.nodeType !== document.TEXT_NODE) {
        return control.skip()
      }

      const ctxContainer = range.commonAncestorContainer
      const contextNode = ctxContainer?.nodeType === document.TEXT_NODE ? ctxContainer.parentNode : ctxContainer
      const rule = conditions.find(cond => this.ctx.hooks.validateMatch(cond, contextNode))
      if (!rule) {
        return control.rewind()
      }
      this.ctx.hooks.onDOMHit({ rule, range, contextNode, hitContext, control })
    })
  }

  _processCodeMirror = ({ cid, cm, wrapper }) => {
    const oldOverlay = this.cmOverlays.get(cm)
    if (oldOverlay) cm.removeOverlay(oldOverlay)

    const matched = this._scan(cm.getValue(), ({ start, end, conditions, control }) => {
      const rule = conditions.find(cond => this.ctx.hooks.validateMatch(cond, wrapper))
      if (!rule) {
        return control.rewind()
      }
      this.ctx.hooks.onCMHit({ rule, cm, cid, start, end, control })
    })

    if (matched) this._applyCodeMirrorOverlay(cm, wrapper)
  }

  _processFutureCodeMirror = ({ cid, node, text }) => {
    this._scan(text, ({ start, end, conditions, control }) => {
      const rule = conditions.find(cond => this.ctx.hooks.validateMatch(cond, node))
      if (!rule) {
        return control.rewind()
      }
      this.ctx.hooks.onFutureCMHit({ rule, cid, containerNode: node, start, end, control })
    })
  }

  _processFutureCodeMirrorReady = ({ cid, cm, wrapper }) => {
    this._applyCodeMirrorOverlay(cm, wrapper)
    this.ctx.hooks.onCMReady(cid, cm)
  }

  _applyCodeMirrorOverlay(cm, wrapper) {
    const overlayRegexp = new RegExp(this.ctx.pattern.source, this.ctx.pattern.flags)
    const overlay = {
      token: (cmState) => {
        overlayRegexp.lastIndex = cmState.pos
        const match = overlayRegexp.exec(cmState.string)
        if (match && match.index === cmState.pos) {
          const matchText = match[0]
          const validRule = this.ctx.conditions
            .filter(cond => {
              return cond.isRegex
                ? cond.strictReg.test(matchText)
                : (this.ctx.options.caseSensitive ? matchText === cond.rawPattern : matchText.toLowerCase() === cond.rawPattern.toLowerCase())
            })
            .find(cond => this.ctx.hooks.validateMatch(cond, wrapper))

          if (validRule) {
            cmState.pos += matchText.length || 1
            return this.ctx.hooks.getCMHighlightClass(validRule)
          } else {
            cmState.pos += 1
            return null
          }
        }
        if (match) cmState.pos = match.index
        else cmState.skipToEnd()
        return null
      },
    }
    cm.addOverlay(overlay)
    this.cmOverlays.set(cm, overlay)
  }
}

module.exports = {
  ScannerEngine,
  DocWalker,
  TextEngine,
}
