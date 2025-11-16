class QuickButtonPlugin extends BaseCustomPlugin {
    html = () => '<div id="plugin-quick-button"></div>'

    hotkey = () => [this.config.hotkey]

    init = () => {
        this.buttons = new Map()
        this.buttonGroup = document.querySelector("#plugin-quick-button")
    }

    callback = anchorNode => this.toggle()

    process = () => {
        this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.toggleSettingPage, this.toggle)
        this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.allPluginsHadInjected, async () => {
            const buttons = this.registerButtons()
            if (buttons.size) {
                const maxX = Math.max(-1, ...[...buttons.values()].map(c => c.x))
                const maxY = Math.max(-1, ...[...buttons.values()].map(c => c.y))
                await this.utils.styleTemplater.register(this.fixedName, { rowCount: maxX + 1, colCount: maxY + 1, this: this })
                this.buttonGroup.append(...this.genButtons(maxX, maxY))
            }
        })
        this.buttonGroup.addEventListener("mousedown", ev => {
            const target = ev.target.closest(".action-item")
            if (!target) return
            if (ev.button === 2 && this.config.support_right_click) {
                [...this.buttonGroup.children]
                    .filter(e => e !== target)
                    .forEach(e => e.classList.toggle("plu-hidden"))
            } else if (ev.button === 0) {
                target.classList.add("plu-click")
                setTimeout(() => target.classList.remove("plu-click"), 80)

                const action = target.getAttribute("action")
                const button = this.buttons.get(action)
                if (action && button) {
                    button.callback(ev, target)
                }
            }
        })
    }

    registerButtons = () => {
        this.config.buttons.forEach((btn = {}, idx) => {
            const { disable = true, coordinate = [], hint, icon, size, color, bgColor, callback = "", evil } = btn
            if (disable) return

            const [x, y] = coordinate
            const cb = evil
                ? eval(evil)
                : this.utils.getPluginFunction(...callback.split("."))
            if (cb instanceof Function && x >= 0 && y >= 0) {
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
                const div = document.createElement("div")
                div.classList.add("action-item")
                if (btn) {
                    div.setAttribute("action", btn.action)
                    if (btn.icon) {
                        div.classList.add(...btn.icon.split(" "))
                    }
                    if (!this.config.hide_button_hint && btn.hint) {
                        div.setAttribute("ty-hint", btn.hint)
                    }
                    if (btn.size) {
                        div.style.fontSize = btn.size
                    }
                    if (btn.color) {
                        div.style.color = btn.color
                    }
                    if (btn.bgColor) {
                        div.style.backgroundColor = btn.bgColor
                    }
                } else {
                    div.classList.add("plu-unused")
                }
                buttons.push(div)
            }
        }
        return buttons
    }

    toggle = force => this.utils.toggleInvisible(this.buttonGroup, force)
}

module.exports = {
    plugin: QuickButtonPlugin
}
