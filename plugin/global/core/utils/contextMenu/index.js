class ContextMenu {
  providers = new WeakMap()
  _currentActions = []
  _menuEl = null

  constructor(utils) {
    this.utils = utils
  }

  process = async () => {
    this.utils.insertStyleFile("common-menu", "./plugin/global/core/utils/contextMenu/index.css")
    this.utils.insertElements(`<div class="plugin-common-menu"></div>`)
    this._menuEl = document.querySelector(".plugin-common-menu")
    this._menuEl.addEventListener("click", (ev) => {
      const target = ev.target.closest(".menu-item")
      if (!target || target.classList.contains("disabled")) return
      const idx = parseInt(target.dataset.idx, 10)
      try {
        this._currentActions[idx]?.(ev)
      } finally {
        this._hideMenu()
      }
    })
  }

  register = (el, spec) => {
    if (!el || this.providers.has(el)) return
    this.providers.set(el, spec)
    el.addEventListener("contextmenu", this._onContextMenu)
  }

  unregister = (el) => {
    if (!el || !this.providers.has(el)) return
    el.removeEventListener("contextmenu", this._onContextMenu)
    this.providers.delete(el)
  }

  _onContextMenu = (ev) => {
    const spec = this.providers.get(ev.currentTarget)
    if (!spec) return

    const menuItems = this._resolveItems(spec, ev)
    if (!menuItems || !Array.isArray(menuItems) || menuItems.length === 0) return

    ev.preventDefault()
    ev.stopPropagation()

    if (this._menuEl.classList.contains("show")) this._hideMenu()
    this._renderAndShow(menuItems, ev)
  }

  _resolveItems = (spec, ev) => {
    if (typeof spec === "function") return spec(ev)
    for (const [selector, provider] of Object.entries(spec)) {
      if (selector === "default") continue
      const hit = ev.target.closest(selector)
      if (hit) return provider?.(hit, ev)
    }
    return spec.default?.(ev.target, ev)
  }

  _renderAndShow = (menuItems, ev) => {
    this._currentActions = []
    this._menuEl.innerHTML = menuItems.map(item => {
      if (item.separator) {
        return `<div class="menu-separator"></div>`
      }
      const label = this.utils.escape(item.label)
      if (item.disabled) {
        return `<div class="menu-item disabled">${label}</div>`
      }
      const idx = this._currentActions.push(item.action) - 1
      return `<div class="menu-item" data-idx="${idx}">${label}</div>`
    }).join("")

    this._menuEl.classList.add("show")

    const margin = 8
    const { innerWidth, innerHeight } = window
    const { offsetWidth: menuWidth, offsetHeight: menuHeight } = this._menuEl
    const titlebarHeight = document.getElementById("top-titlebar")?.offsetHeight ?? 0

    let left = ev.clientX
    let top = ev.clientY

    if (left + menuWidth + 20 > innerWidth) left = innerWidth - menuWidth - 20
    left = Math.max(0, left)

    if (top + menuHeight + 48 > innerHeight) top = innerHeight - menuHeight
    top = Math.max(titlebarHeight + margin, top)

    this._menuEl.style.left = `${left}px`
    this._menuEl.style.top = `${top}px`

    document.addEventListener("mousedown", this._onOutsideClick, true)
  }

  _onOutsideClick = (ev) => {
    if (!this._menuEl.contains(ev.target)) this._hideMenu()
  }

  _hideMenu = () => {
    this._menuEl.classList.remove("show")
    this._currentActions = []
    document.removeEventListener("mousedown", this._onOutsideClick, true)
  }
}

module.exports = ContextMenu
