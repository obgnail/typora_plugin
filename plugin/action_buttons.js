class ActionButtonsPlugin extends BasePlugin {
    html = () => '<div id="plugin-action-buttons"></div>'

    hotkey = () => [{ hotkey: this.config.HOTKEY, callback: this.call }]

    init = () => {
        this.buttons = new Map()
        this.buttonGroup = document.querySelector("#plugin-action-buttons")
    }

    call = () => this.toggle()

    process = () => {
        this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.toggleSettingPage, this.toggle)
        this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.allPluginsHadInjected, async () => {
            const buttons = this.registerButtons()
            if (buttons.size) {
                const maxX = Math.max(-1, ...[...buttons.values()].map(c => c.x))
                const maxY = Math.max(-1, ...[...buttons.values()].map(c => c.y))
                await this.utils.styleTemplater.register(this.fixedName, {
                    rowCount: maxX + 1,
                    colCount: maxY + 1,
                    this: this,
                    buttonColor: "var(--text-color)",
                    buttonBgColor: "initial",
                })
                this.buttonGroup.append(...this.genButtons(maxX, maxY))
            }
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

    registerButtons = () => {
        this.config.BUTTONS.forEach((btn = {}, idx) => {
            const { enable, coordinate = [], hint, icon, size, color, bgColor, callback = "", evil } = btn
            if (!enable) return

            const [x, y] = coordinate
            const cb = evil
                ? eval(evil)
                : this.utils.getPluginFunction(...callback.split("."))
            if (typeof cb === "function" && x >= 0 && y >= 0) {
                const action = `__${idx}`
                const btn = { x, y, action, hint, icon, size, color, bgColor, callback: cb }
                this.buttons.set(action, btn)
            }
        })
        return this.buttons
    }

    genButtons = (maxX, maxY) => {
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
                    if (!this.config.HIDE_BUTTON_HINT && btn.hint) {
                        item.setAttribute("ty-hint", btn.hint)
                    }
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

    toggle = force => this.utils.toggleInvisible(this.buttonGroup, force)
}

module.exports = {
    plugin: ActionButtonsPlugin
}
