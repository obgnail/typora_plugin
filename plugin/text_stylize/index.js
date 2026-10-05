const createStylizer = require("./stylizer.js")
const defineTools = require("./tools.js")
const Toolbox = require("./toolbox.js")
const Palette = require("./palette.js")

const BLANK = "blank"

class TextStylizePlugin extends BasePlugin {
  toolbox = new Toolbox({
    stylizer: createStylizer(this.utils),
    tools: defineTools(this.config),
  })

  style = () => true

  html = () => {
    const names = this.config.TOOLS.filter(name => this.toolbox.get(name) || name === BLANK)
    const hints = this.i18n.entries(names, "$option.TOOLS.")
    const els = names.map(name =>
      name === BLANK
        ? `<div data-tool="${name}" style="visibility: hidden"></div>`
        : `<div data-tool="${name}" ty-hint="${hints[name]}">${this.toolbox.get(name).icon}</div>`,
    )
    return `
      <fast-window id="plugin-text-stylize" hidden window-resize="none" window-title="${this.pluginName}" window-buttons="close|fa-times">
        <div class="stylize-tools">${els.join("")}</div>
        ${Palette.html(this.config.COLOR_TABLE)}
      </fast-window>`
  }

  hotkey = () => [
    { hotkey: this.config.HOTKEY, callback: this.call },
    ...this.config.ACTION_HOTKEYS
      .filter(hk => this.toolbox.get(hk.action))
      .map(hk => ({ hotkey: hk.hotkey, callback: () => this.toolbox.invoke(hk.action) })),
  ]

  init = () => {
    this.entities = {
      panel: document.querySelector("#plugin-text-stylize"),
      toolbar: document.querySelector("#plugin-text-stylize .stylize-tools"),
      palette: document.querySelector("#plugin-text-stylize .stylize-palette"),
    }
    this.palette = new Palette({
      toolbarEl: this.entities.toolbar,
      paletteEl: this.entities.palette,
      colorTools: this.toolbox.valuedToolNames(),
      utils: this.utils,
    })
  }

  process = () => {
    this.utils.eventHub.on(this.utils.eventHub.eventType.toggleSettingPage, hide => hide && this.entities.panel.hide())

    this.entities.panel.addEventListener("btn-click", ev => {
      if (ev.detail.action === "close") this.entities.panel.hide()
    })
    this.entities.toolbar.addEventListener("mouseover", ev => {
      const target = ev.target.closest("[data-tool]")
      if (!target || target.contains(ev.relatedTarget)) return
      this.entities.toolbar.querySelectorAll(":scope > [data-tool]").forEach(el => el.classList.toggle("select", el === target))
      this.palette.focus(target.dataset.tool)
    })
    this.entities.toolbar.addEventListener("mousedown", ev => {
      ev.preventDefault()
      ev.stopPropagation()
      const name = ev.target.closest("[data-tool]")?.dataset.tool
      if (name) this.toolbox.invoke(name)
    }, true)

    this.palette.paintIndicators(this.toolbox.readAll())
    this.palette.listen((name, color) => {
      this.toolbox.write(name, color)
      this.toolbox.invoke(name)
    })
  }

  call = () => this.entities.panel.toggle()
}

module.exports = {
  plugin: TextStylizePlugin,
}
