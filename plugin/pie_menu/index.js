class PieMenuPlugin extends BasePlugin {
  pinMenuClass = "pin-menu"
  expandMenuClass = "expand-menu"
  modifierKey = this.utils.modifierKey(this.config.MODIFIER_KEY)

  style = () => true

  html = () => {
    const { BUTTONS } = this.config
    const ring = (type, items) => {
      const children = items.map(({ ICON, CALLBACK }, i) =>
        `<div class="plugin-pie-menu-item" style="--i:${i}" data-callback="${CALLBACK}"></div>` +
        `<div class="plugin-pie-menu-icon ${ICON}" style="--i:${i}"></div>`,
      ).join("")
      return `<div class="plugin-pie-menu-circle plugin-pie-menu-${type}" style="--n:${items.length}">${children}</div>`
    }
    const solid = `<div class="plugin-pie-menu-circle plugin-pie-menu-solid"><div class="plugin-pie-menu-hint"></div></div>`
    const rings = [ring("inner", BUTTONS.slice(0, 8)), ring("outer", BUTTONS.slice(8, 16))].join("")
    return `<div class="plugin-pie-menu plugin-common-hidden">${solid}${rings}</div>`
  }

  hotkey = () => [{ hotkey: this.config.HOTKEY, callback: this.call }]

  init = () => {
    this.entities = {
      content: this.utils.entities.eContent,
      menu: document.querySelector(".plugin-pie-menu"),
      hint: document.querySelector(".plugin-pie-menu-hint"),
    }
  }

  showMenu = (x, y) => {
    if (!x && !y) {
      x = (window.innerWidth || document.documentElement.clientWidth) / 2
      y = (window.innerHeight || document.documentElement.clientHeight) / 2
    }
    this.utils.show(this.entities.menu)
    const { width, height } = this.entities.menu.getBoundingClientRect()
    Object.assign(this.entities.menu.style, { left: x - width / 2 + "px", top: y - height / 2 + "px" })
  }

  isMenuShown = () => this.utils.isShown(this.entities.menu)
  hideMenu = () => this.utils.hide(this.entities.menu)
  toggleMenu = () => this.utils.toggleInvisible(this.entities.menu)
  isMenuPinned = () => this.entities.menu.classList.contains(this.pinMenuClass)
  togglePinMenu = () => this.entities.menu.classList.toggle(this.pinMenuClass)
  toggleExpandMenu = () => this.entities.menu.classList.toggle(this.expandMenuClass)

  _actionName = callback => {
    const [fixedName, action] = callback.split(".")
    const plugin = this.utils.getPlugin(fixedName)
    if (!plugin) return action || fixedName
    if (!action) return plugin.pluginName
    const hit = (plugin.staticActions || []).find(a => a.act_value === action)
      || (this.utils.updatePluginDynamicActions(fixedName) || []).find(a => a.act_value === action)
    return hit ? hit.act_name : action
  }

  process = () => {
    this.entities.content.addEventListener("contextmenu", ev => {
      if (this.modifierKey(ev)) {
        ev.stopPropagation()
        ev.preventDefault()
        this.showMenu(ev.clientX, ev.clientY)
      }
    }, true)

    this.entities.content.addEventListener("click", ev => {
      if (this.isMenuShown() && !this.isMenuPinned() && !ev.target.closest(".plugin-pie-menu")) this.hideMenu()
    })

    this.entities.menu.addEventListener("mouseover", ev => {
      const item = ev.target.closest(".plugin-pie-menu-item")
      if (!item) return
      const { name, callback } = item.dataset
      if (!name) item.dataset.name = this._actionName(callback)
      this.entities.hint.textContent = name
    })
    this.entities.menu.addEventListener("mouseleave", () => this.entities.hint.textContent = "")
    this.entities.menu.addEventListener("mousedown", ev => {
      if (ev.target.closest(".plugin-pie-menu-solid")) {
        if (ev.button === 0) {
          this.togglePinMenu()
        } else if (ev.button === 2) {
          this.toggleExpandMenu()
        }
        return
      }
      if (ev.button !== 0) return
      const cb = ev.target.closest(".plugin-pie-menu-item[data-callback]")?.dataset.callback
      if (cb) {
        const [fixedName, action] = cb.split(".")
        this.utils.callPluginDynamicAction(fixedName, action)
        if (!this.isMenuPinned()) this.hideMenu()
      }
    })
  }

  call = () => setTimeout(this.toggleMenu)
}

module.exports = {
  plugin: PieMenuPlugin,
}
