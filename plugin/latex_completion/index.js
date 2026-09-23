const commands = require("./commands.json")
const { extractPrefix, findCandidates, getCursorIndex, availablePackages } = require("./core")

class LatexCompletionPlugin extends BasePlugin {
  commandByKey = new Map(commands.map(command => [command.key, command]))
  handler = {
    search: input => this._find(`\\${String(input || "").replace(/^\\/, "")}`).map(command => command.key),
    render: (key, isActive) => {
      const command = this.commandByKey.get(key)
      if (!command) return ""
      const translated = this.i18n.t(`hint.${key.slice(1)}`)
      const hint = translated === `hint.${key.slice(1)}` ? `${this.i18n.t(`category.${command.category}`)} · ${command.glyph || key.slice(1)}` : translated
      const preview = command.snippet.replace(/\s*\n\s*/g, " ↵ ").trim().slice(0, 64)
      const active = isActive ? " active" : ""
      return `<li class="plugin-latex-completion${active}" data-content="${this.utils.escape(key)}"><div class="plugin-latex-completion-key">${this.utils.escape(key)}</div><div class="plugin-latex-completion-hint">${this.utils.escape(hint)}</div><div class="plugin-latex-completion-preview">${this.utils.escape(preview)}</div></li>`
    },
    beforeApply: key => {
      document.querySelector?.(".auto-suggest-container")?.classList.remove("plugin-latex-completion-menu")
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

  style = () => `.auto-suggest-container.plugin-latex-completion-menu { z-index: 100000 !important; }
.auto-suggest-container li.plugin-latex-completion { min-width: 280px; max-width: 400px; box-sizing: border-box; padding: 3px 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.plugin-latex-completion-key, .plugin-latex-completion-hint, .plugin-latex-completion-preview { display: inline; }
.plugin-latex-completion-key { font-weight: 600; }
.plugin-latex-completion-hint { opacity: .75; margin-left: 8px; }
.plugin-latex-completion-preview { opacity: .55; margin-left: 10px; font-family: monospace; font-size: .9em; }`

  process = () => {
    this.utils.decorator.afterCall(() => File?.editor?.brush, "triggerAutoComplete", this._onEdit, { priority: -10 })
  }

  hasCandidate = prefix => this._find(prefix, 1).length > 0

  _find = (prefix, limit = this.config.MAX_RESULTS) => {
    const max = Math.max(1, Math.min(50, Number(limit) || 10))
    const packages = availablePackages(typeof window === "undefined" ? null : window.MathJax)
    return findCandidates(prefix, commands.filter(command => command.package === "base" || packages.includes(command.package)), max)
  }

  _onEdit = () => {
    document.querySelector?.(".auto-suggest-container")?.classList.remove("plugin-latex-completion-menu")
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
    File.editor.autoComplete.attachToRange()
    File.editor.autoComplete.show([], bookmark, prefix.slice(1), this.handler)
    document.querySelector?.(".auto-suggest-container")?.classList.add("plugin-latex-completion-menu")
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
