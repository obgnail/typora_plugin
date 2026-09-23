const { extractPrefix, placeMenu, replaceInCodeMirror, replaceInTextarea } = require("./core")

class BlockCompletion {
  constructor(plugin) {
    this.plugin = plugin
    this.active = null
    this.binding = null
    this.composing = false
    this.menu = document.createElement("div")
    this.menu.className = "plugin-latex-block-menu"
    this.menu.setAttribute("role", "listbox")
    this.menu.style.display = "none"
    document.body.appendChild(this.menu)
    this._onKeyDown = this._onKeyDown.bind(this)
    this._onFocusIn = this._onFocusIn.bind(this)
    document.addEventListener("focusin", this._onFocusIn)
    window.addEventListener("resize", () => this.position())
    document.addEventListener("scroll", () => this.position(), true)
    if (typeof MutationObserver !== "undefined") {
      const reposition = () => requestAnimationFrame(() => this.position())
      const observer = new MutationObserver(reposition)
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style"] })
      observer.observe(document.body, { attributes: true, attributeFilter: ["class", "style"] })
      observer.observe(document.head, { attributes: true, childList: true, subtree: true, attributeFilter: ["href", "media", "disabled"] })
    }
  }

  bindCurrent = () => {
    if (!this.plugin.config.ENABLE_BLOCK || File.editor.sourceView?.inSourceMode) return
    const cm = File.editor.mathBlock?.currentCm
    if (cm?.getWrapperElement) this.bindCodeMirror(cm)
  }

  bindCodeMirror = cm => {
    if (this.binding?.cm === cm) return
    this.detach()
    const wrapper = cm.getWrapperElement()
    if (!wrapper) return
    const refresh = () => this.updateCodeMirror(cm)
    const hide = () => this.hide()
    const compositionStart = () => { this.composing = true; this.hide() }
    const compositionEnd = () => { this.composing = false; refresh() }
    cm.on("changes", refresh)
    cm.on("cursorActivity", refresh)
    cm.on("blur", hide)
    wrapper.addEventListener("keydown", this._onKeyDown, true)
    wrapper.addEventListener("compositionstart", compositionStart)
    wrapper.addEventListener("compositionend", compositionEnd)
    this.binding = { type: "cm", cm, wrapper, refresh, hide, compositionStart, compositionEnd }
    refresh()
  }

  _onFocusIn = event => {
    if (!this.plugin.config.ENABLE_BLOCK || File.editor.sourceView?.inSourceMode) return
    const input = event.target
    if (input.tagName !== "TEXTAREA" || !input.closest(".md-math-block") || File.editor.mathBlock?.currentCm) return
    if (this.binding?.input === input) return
    this.detach()
    const handler = this.plugin.utils.createSmartInputHandler(input, () => this.updateTextarea(input), { trimWhitespace: false, caseSensitive: true, onCompositionStart: () => this.hide() })
    const refresh = () => this.updateTextarea(input)
    const hide = () => this.hide()
    input.addEventListener("click", refresh)
    input.addEventListener("keyup", refresh)
    input.addEventListener("blur", hide)
    input.addEventListener("keydown", this._onKeyDown, true)
    this.binding = { type: "textarea", input, handler, refresh, hide }
    refresh()
  }

  updateCodeMirror = cm => {
    if (this.composing || this.binding?.cm !== cm || File.editor.mathBlock?.currentCm !== cm || File.editor.sourceView?.inSourceMode) return this.hide()
    const cursor = cm.getCursor()
    if (cm.somethingSelected?.()) return this.hide()
    const prefix = extractPrefix(cm.getLine(cursor.line).slice(0, cursor.ch))
    this.show(prefix, { type: "cm", cm })
  }

  updateTextarea = input => {
    if (this.binding?.input !== input || this.binding.handler.isComposing() || document.activeElement !== input || input.selectionStart !== input.selectionEnd) return this.hide()
    const prefix = extractPrefix(input.value.slice(0, input.selectionStart))
    this.show(prefix, { type: "textarea", input })
  }

  show = (prefix, source) => {
    const candidates = prefix && this.plugin._find(prefix)
    if (!candidates?.length) return this.hide()
    const previous = this.active
    this.active = { ...source, prefix, candidates, index: previous?.prefix === prefix ? previous.index : 0 }
    this.render()
    this.menu.style.display = "block"
    this.position()
  }

  render = () => {
    this.menu.replaceChildren()
    for (let index = 0; index < this.active.candidates.length; index++) {
      const command = this.active.candidates[index]
      const row = document.createElement("div")
      row.className = `plugin-latex-block-row${index === this.active.index ? " active" : ""}`
      row.setAttribute("role", "option")
      row.setAttribute("aria-selected", String(index === this.active.index))
      const key = document.createElement("div")
      key.className = "plugin-latex-completion-key"
      key.textContent = command.key
      const hint = document.createElement("div")
      hint.className = "plugin-latex-completion-hint"
      hint.textContent = this.plugin._hint(command)
      const preview = document.createElement("div")
      preview.className = "plugin-latex-completion-preview"
      preview.textContent = command.snippet.replace(/\s*\n\s*/g, " ↵ ").trim().slice(0, 64)
      row.append(key, hint, preview)
      row.addEventListener("mousedown", event => { event.preventDefault(); this.apply(index) })
      this.menu.appendChild(row)
    }
  }

  _onKeyDown = event => {
    if (!this.active || this.composing || event.isComposing) return
    const key = event.key
    if (key === "ArrowDown" || key === "ArrowUp") {
      event.preventDefault()
      event.stopPropagation()
      const length = this.active.candidates.length
      this.active.index = (this.active.index + (key === "ArrowDown" ? 1 : length - 1)) % length
      this.render()
    } else if (key === "Enter" || key === "Tab") {
      event.preventDefault()
      event.stopPropagation()
      this.apply(this.active.index)
    } else if (key === "Escape") {
      event.preventDefault()
      event.stopPropagation()
      this.hide()
    }
  }

  apply = index => {
    const active = this.active
    if (!active) return
    const command = active.candidates[index]
    this.hide()
    if (active.type === "cm") replaceInCodeMirror(active.cm, active.prefix, command)
    else replaceInTextarea(active.input, active.prefix, command)
  }

  _textareaCursorRect = input => {
    const rect = input.getBoundingClientRect()
    const style = getComputedStyle(input)
    const mirror = document.createElement("div")
    const caret = document.createElement("div")
    mirror.style.cssText = `position:fixed;visibility:hidden;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;box-sizing:${style.boxSizing};padding:${style.padding};border:${style.border};font:${style.font};line-height:${style.lineHeight};white-space:pre-wrap;overflow-wrap:break-word;`
    mirror.textContent = input.value.slice(0, input.selectionStart)
    caret.style.display = "inline-block"
    caret.textContent = "\u200b"
    mirror.appendChild(caret)
    document.body.appendChild(mirror)
    const point = caret.getBoundingClientRect()
    mirror.remove()
    return { left: point.left - input.scrollLeft, top: point.top - input.scrollTop, bottom: point.bottom - input.scrollTop }
  }

  position = () => {
    if (!this.active || this.menu.style.display === "none") return
    const active = this.active
    const anchor = active.type === "cm" ? active.cm.cursorCoords(active.cm.getCursor(), "window") : this._textareaCursorRect(active.input)
    const wrapper = active.type === "cm" ? active.cm.getWrapperElement() : active.input
    const preview = wrapper.closest(".md-math-block")?.querySelector(".md-mathjax-preview")
    const menuRect = this.menu.getBoundingClientRect()
    const previewRect = preview?.getBoundingClientRect()
    const placement = placeMenu(anchor, menuRect, previewRect, { width: window.innerWidth, height: window.innerHeight })
    this.menu.style.left = `${placement.left}px`
    this.menu.style.top = `${placement.top}px`
  }

  hide = () => {
    this.active = null
    this.menu.style.display = "none"
  }

  detach = () => {
    this.hide()
    const binding = this.binding
    if (!binding) return
    if (binding.type === "cm") {
      binding.cm.off("changes", binding.refresh)
      binding.cm.off("cursorActivity", binding.refresh)
      binding.cm.off("blur", binding.hide)
      binding.wrapper.removeEventListener("keydown", this._onKeyDown, true)
      binding.wrapper.removeEventListener("compositionstart", binding.compositionStart)
      binding.wrapper.removeEventListener("compositionend", binding.compositionEnd)
    } else {
      binding.handler.clean()
      binding.input.removeEventListener("click", binding.refresh)
      binding.input.removeEventListener("keyup", binding.refresh)
      binding.input.removeEventListener("blur", binding.hide)
      binding.input.removeEventListener("keydown", this._onKeyDown, true)
    }
    this.binding = null
  }
}

module.exports = BlockCompletion
