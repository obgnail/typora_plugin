class ActionButtonsPlugin extends BasePlugin {
  buttons = new Map()

  style = () => `
.ty-footer { z-index: 9999 !important; }
#plugin-action-buttons {
  --grid-cols: 2;
  --grid-rows: 3;
  position: fixed;
  display: grid;
  z-index: 9991;
  text-align: center;
  pointer-events: none;
  grid-template-columns: repeat(var(--grid-cols), 1fr);
  grid-template-rows: repeat(var(--grid-rows), 1fr);
  gap: ${this.config.BUTTON_GAP};
  right: ${this.config.POSITION_RIGHT};
  bottom: ${this.config.POSITION_BOTTOM};
}
#plugin-action-buttons .action-item {
  cursor: pointer;
  color: var(--text-color);
  background-color: initial;
  transition: all 50ms ease-in 0s;
  pointer-events: auto;
  width: ${this.config.BUTTON_SIZE};
  height: ${this.config.BUTTON_SIZE};
  line-height: ${this.config.BUTTON_SIZE};
  font-size: ${this.config.BUTTON_ICON_SIZE};
  box-shadow: ${this.config.BUTTON_BOX_SHADOW};
  border-radius: ${this.config.BUTTON_BORDER_RADIUS};
}
#plugin-action-buttons .action-item:hover { transform: translateY(-2px); box-shadow: ${this.config.BUTTON_BOX_SHADOW_ON_HOVER}; }
#plugin-action-buttons .action-item:active { transform: scale(0.95); }
#plugin-action-buttons .action-item i { opacity: 0.8; }
#plugin-action-buttons .plu-hidden, #plugin-action-buttons .plu-unused { visibility: hidden; }`

  html = () => `<div id="plugin-action-buttons"></div>`

  hotkey = () => [{ hotkey: this.config.HOTKEY, callback: this.call }]

  init = () => {
    this.buttonGroup = document.querySelector("#plugin-action-buttons")
  }

  call = () => this.toggle()

  process = () => {
    this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.toggleSettingPage, this.toggle)
    this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.allPluginsHadInjected, () => {
      const buttons = this._registerButtons()
      if (buttons.size === 0) return
      const maxX = Math.max(-1, ...[...buttons.values()].map(c => c.x))
      const maxY = Math.max(-1, ...[...buttons.values()].map(c => c.y))
      this.buttonGroup.style.setProperty("--grid-cols", maxY + 1)
      this.buttonGroup.style.setProperty("--grid-rows", maxX + 1)
      this.buttonGroup.append(...this._genButtons(maxX, maxY))
    })
    this.buttonGroup.addEventListener("mousedown", ev => {
      const target = ev.target.closest(".action-item")
      if (!target) return
      ev.stopPropagation()
      ev.preventDefault()
      if (ev.button === 2 && this.config.SUPPORT_RIGHT_CLICK) {
        [...this.buttonGroup.children]
          .filter(e => e !== target)
          .forEach(e => e.classList.toggle("plu-hidden"))
      } else if (ev.button === 0) {
        const action = target.getAttribute("action")
        const button = this.buttons.get(action)
        if (action && button) {
          button.callback(ev, target)
        }
      }
    })
  }

  toggle = force => this.utils.toggleInvisible(this.buttonGroup, force)

  _registerButtons = () => {
    this.config.BUTTONS.forEach((btn = {}, idx) => {
      const { enable, coordinate = [], hint, icon, size, color, bgColor, callback = "", evil } = btn
      if (!enable) return

      const [x, y] = coordinate
      const cb = evil
        ? eval(evil)
        : this.utils.getPluginFn(...callback.split("."))
      if (typeof cb === "function" && x >= 0 && y >= 0) {
        const action = `__${idx}`
        const btn = { x, y, action, hint, icon, size, color, bgColor, callback: cb }
        this.buttons.set(action, btn)
      }
    })
    return this.buttons
  }

  _genButtons = (maxX, maxY) => {
    const btnMap = new Map([...this.buttons.values()].map(btn => [`${btn.x}-${btn.y}`, btn]))
    const buttons = []
    for (let x = 0; x <= maxX; x++) {
      for (let y = 0; y <= maxY; y++) {
        const coordinate = `${maxX - x}-${maxY - y}`
        const btn = btnMap.get(coordinate)
        const item = document.createElement("div")
        item.classList.add("action-item")
        if (btn) {
          item.setAttribute("action", btn.action)
          if (btn.icon) {
            const i = document.createElement("i")
            i.className = btn.icon
            item.appendChild(i)
          }
          if (btn.hint) item.setAttribute("ty-hint", btn.hint)
          if (btn.size) item.style.fontSize = btn.size
          if (btn.color) item.style.color = btn.color
          if (btn.bgColor) item.style.backgroundColor = btn.bgColor
        } else {
          item.classList.add("plu-unused")
        }
        buttons.push(item)
      }
    }
    return buttons
  }
}

module.exports = {
  plugin: ActionButtonsPlugin,
}
