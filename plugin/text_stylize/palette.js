class Palette {
  constructor({ toolbarEl, paletteEl, colorTools, utils }) {
    this.toolbarEl = toolbarEl
    this.paletteEl = paletteEl
    this.colorTools = colorTools
    this.utils = utils
  }

  static html = colorTable => {
    const trs = colorTable
      .map(colors => colors.map(c => `<td style="background-color: ${c}" data-color="${c}"></td>`).join(""))
      .map(tds => `<tr>${tds}</tr>`)
      .join("")
    return `<table class="stylize-palette plugin-common-hidden"><tbody>${trs}</tbody></table>`
  }

  paintIndicators = values => {
    for (const [name, color] of values) {
      this.toolbarEl.querySelector(`[data-tool="${name}"] svg .color-indicator`)?.setAttribute("fill", color)
    }
  }

  focus = name => this.utils.toggleInvisible(this.paletteEl, !this.colorTools.has(name))

  listen = onPickColor => {
    this.paletteEl.addEventListener("mousedown", ev => {
      ev.preventDefault()
      ev.stopPropagation()
      const td = ev.target.closest("td")
      if (!td) return
      const selected = this.toolbarEl.querySelector(":scope > .select")
      if (!selected) return
      const name = selected.dataset.tool
      if (!name || !this.colorTools.has(name)) return
      const color = td.dataset.color
      selected.querySelector("svg .color-indicator")?.setAttribute("fill", color)
      onPickColor(name, color)
    }, true)
  }
}

module.exports = Palette
