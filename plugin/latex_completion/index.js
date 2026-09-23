const commands = require("./commands.json")
const { extractPrefix, findCandidates, getCursorIndex, availablePackages, placeMenu } = require("./core")
const BlockCompletion = require("./block")

class LatexCompletionPlugin extends BasePlugin {
  commandByKey = new Map(commands.map(command => [command.key, command]))
  handler = {
    type: "latex_completion",
    search: input => this._find(`\\${String(input || "").replace(/^\\/, "")}`).map(command => command.key),
    render: (key, isActive) => {
      const command = this.commandByKey.get(key)
      if (!command) return ""
      const hint = this._hint(command)
      const preview = command.snippet.replace(/\s*\n\s*/g, " ↵ ").trim().slice(0, 64)
      const active = isActive ? " active" : ""
      return `<li class="plugin-latex-completion${active}" data-content="${this.utils.escape(key)}"><div class="plugin-latex-completion-key">${this.utils.escape(key)}</div><div class="plugin-latex-completion-hint">${this.utils.escape(hint)}</div><div class="plugin-latex-completion-preview">${this.utils.escape(preview)}</div></li>`
    },
    beforeApply: key => {
      this._menu()?.classList.remove("plugin-latex-completion-menu")
      const command = this.commandByKey.get(key)
      if (!command) return ""
      const { anchor } = File.editor.autoComplete.state
      setTimeout(() => {
        anchor?.containerNode?.normalize()
        this._refresh()
        this._moveCursor(command)
      }, 100)
      return command.snippet
    },
  }

  style = () => `.auto-suggest-container.plugin-latex-completion-menu { z-index: 30; max-width: calc(100vw - 16px); color: var(--text-color); }
.auto-suggest-container li.plugin-latex-completion { min-width: 260px; max-width: 360px; box-sizing: border-box; padding: 2px 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.plugin-latex-completion-key, .plugin-latex-completion-hint, .plugin-latex-completion-preview { display: inline; }
.plugin-latex-completion-key { font-weight: 600; }
.plugin-latex-completion-hint { opacity: .88; margin-left: 8px; }
.plugin-latex-completion-preview { opacity: .72; margin-left: 10px; font-family: monospace; font-size: .9em; }
@media (max-width: 800px) { .plugin-latex-completion-preview { display: none; } }
.plugin-latex-block-menu { position: fixed; z-index: 30; width: 320px; max-width: calc(100vw - 16px); max-height: 240px; overflow-y: auto; background: var(--bg-color); color: var(--text-color); border-radius: 6px; box-shadow: rgba(15,15,15,.14) 0 4px 14px; padding: 4px 0; }
.plugin-latex-block-row { padding: 4px 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer; }
.plugin-latex-block-row.active, .plugin-latex-block-row:hover { background: var(--item-hover-bg-color); }`

  process = () => {
    this.utils.decorator.afterCall(() => File?.editor?.brush, "triggerAutoComplete", this._onEdit, { priority: -10 })
    document.addEventListener("keydown", this._onInlineKeyDown, true)
    window.addEventListener("resize", this._positionInline)
    document.addEventListener("scroll", this._positionInline, true)
    const preview = document.querySelector("#math-inline-preview")
    if (preview) {
      new MutationObserver(this._positionInline).observe(preview, { attributes: true, childList: true, subtree: true })
      if (typeof ResizeObserver !== "undefined") new ResizeObserver(this._positionInline).observe(preview)
    }
    if (this.config.ENABLE_BLOCK) {
      this.block = new BlockCompletion(this)
      this.utils.decorator.afterCall(() => File?.editor?.mathBlock, "startEditing", result => Promise.resolve(result).then(this.block.bindCurrent, () => this.block.detach()))
      this.utils.decorator.afterCall(() => File?.editor?.mathBlock, "stopEditing", () => this.block.detach())
      this.block.bindCurrent()
    }
  }

  _menu = () => document.querySelector?.("#ty-auto-suggest")

  _hint = command => {
    const key = `hint.${command.key.slice(1)}`
    const translated = this.i18n.t(key)
    return translated === key ? `${this.i18n.t(`category.${command.category}`)} · ${command.glyph || command.key.slice(1)}` : translated
  }

  _onInlineKeyDown = event => {
    if (event.key !== "Tab" || event.isComposing) return
    const autoComplete = File?.editor?.autoComplete
    if (autoComplete?.state.type !== "latex_completion" || !autoComplete.isShown() || !autoComplete.state.match.length) return
    event.preventDefault()
    event.stopPropagation()
    autoComplete.apply(autoComplete.state.match[Math.max(0, autoComplete.state.index)])
  }

  _positionInline = () => {
    const menu = this._menu()
    if (!menu?.classList.contains("plugin-latex-completion-menu") || !File?.editor?.autoComplete?.isShown()) return
    const selection = window.getSelection()
    const anchor = selection?.rangeCount && selection.getRangeAt(0).getClientRects()[0]
    if (!anchor) return
    const preview = document.querySelector("#math-inline-preview")
    const previewRect = preview && getComputedStyle(preview).display !== "none" ? preview.getBoundingClientRect() : null
    const placement = placeMenu(anchor, menu.getBoundingClientRect(), previewRect, { width: window.innerWidth, height: window.innerHeight })
    menu.style.left = `${placement.left}px`
    menu.style.top = `${placement.top}px`
  }

  hasCandidate = prefix => this._find(prefix, 1).length > 0

  _find = (prefix, limit = this.config.MAX_RESULTS) => {
    const max = Math.max(1, Math.min(50, Number(limit) || 10))
    const packages = availablePackages(typeof window === "undefined" ? null : window.MathJax)
    return findCandidates(prefix, commands.filter(command => command.package === "base" || packages.includes(command.package)), max)
  }

  _onEdit = () => {
    this._menu()?.classList.remove("plugin-latex-completion-menu")
    if (File.editor.sourceView?.inSourceMode || document.activeElement?.tagName === "TEXTAREA") return

    const range = File.editor.selection.getRangy()
    if (!range?.collapsed) return
    const container = $(range.startContainer).closest('[type="math/tex"]')[0]
    if (!container || container.tagName !== "SCRIPT") return

    const bookmark = range.getBookmark(container)
    const probe = range.cloneRange()
    probe.setStartBefore(container)
    const textBefore = probe.toString()

    const prefix = extractPrefix(textBefore)
    if (!prefix || !this.hasCandidate(prefix)) return

    bookmark.start -= prefix.length
    const autoComplete = File.editor.autoComplete
    if (autoComplete.state?.type !== "latex_completion") {
      autoComplete.hide()
      autoComplete.initState()
    }
    autoComplete.attachToRange()
    autoComplete.show([], bookmark, prefix.slice(1), this.handler)
    if (autoComplete.state.match.length) {
      autoComplete.state.index = 0
      autoComplete.updateActive(0)
    }
    this._menu()?.classList.add("plugin-latex-completion-menu")
    this._positionInline()
  }

  _refresh = () => {
    const { node } = this.utils.getRangy()
    if (!node) return
    const parsedNode = File.editor.simpleParse(node, true)
    if (!parsedNode) return

    parsedNode[0].undo[0] = File.editor.lastCursor
    setTimeout(() => {
      parsedNode[0].redo.push(File.editor.selection.buildUndo())
      File.editor.findElemById(parsedNode[2]).replaceWith(parsedNode[1])
      File.editor.undo.register(parsedNode[0], true)
      File.editor.quickRefresh()
      File.editor.selection.scrollAdjust()
      File.editor.undo.exeCommand(parsedNode[0].redo.last())
    }, 50)
  }

  _moveCursor = command => {
    const offset = getCursorIndex(command.snippet, command.cursorOffset) - command.snippet.length
    if (!offset) return
    const { range, bookmark } = this.utils.getRangy()
    if (!range || !bookmark) return
    bookmark.start += offset
    bookmark.end += offset
    range.moveToBookmark(bookmark)
    range.select()
  }
}

module.exports = { plugin: LatexCompletionPlugin }
