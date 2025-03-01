class quickButtonPlugin extends BaseCustomPlugin {
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
            this.registerButtons()
            if (this.buttons.size) {
                const { maxX, maxY } = this.getMax()
                await this.utils.styleTemplater.register(this.fixedName, { rowCount: maxX + 1, colCount: maxY + 1, this: this })
                this.utils.htmlTemplater.appendElements(this.buttonGroup, this.genButtonHTML(maxX, maxY))
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
                this.flashScale(target)
                const action = target.getAttribute("action")
                const button = this.buttons.get(action)
                if (action && button) {
                    button.callback(ev, target)
                }
            }
        })
    }

    registerButtons = () => {
        this.config.buttons.forEach((btn, idx) => {
            const { coordinate, hint, icon, size, color, bgColor, disable, callback = "", evil } = btn || {}
            if (disable) return

            const cb = evil ? eval(evil) : this.utils.getPluginFunction(...callback.split("."))
            if (cb instanceof Function) {
                const style = {}
                if (size) style.fontSize = size
                if (color) style.color = color
                if (bgColor) style.backgroundColor = bgColor
                const action = `__${idx}`
                this.register(action, coordinate, hint, icon, style, cb)
            }
        })
    }

    register = (action, coordinate, hint, iconClass, style, callback) => {
        const [x, y] = coordinate
        if (x >= 0 && y >= 0 && callback instanceof Function) {
            const btn = { coordinate, action, hint, iconClass, style, callback }
            this.buttons.set(action, btn)
        }
    }

    unregister = action => this.buttons.delete(action)

    genButtonHTML = (maxX, maxY) => {
        const unused = { class_: "action-item plu-unused" }
        const buttonsMap = new Map(
            [...this.buttons.values()].map(btn => [`${btn.coordinate[0]}-${btn.coordinate[1]}`, btn])
        )
        const buttons = []
        for (let x = 0; x <= maxX; x++) {
            for (let y = 0; y <= maxY; y++) {
                const coordinate = `${maxX - x}-${maxY - y}`
                const btn = buttonsMap.get(coordinate)
                const ele = btn
                    ? { class_: `action-item ${btn.iconClass}`, action: btn.action, style: btn.style }
                    : unused
                if (btn && !this.config.hide_button_hint) {
                    ele["ty-hint"] = btn.hint
                }
                buttons.push(ele)
            }
        }
        return buttons
    }

    getMax = () => {
        const coords = [...this.buttons.values()].map(e => e.coordinate)
        const xList = coords.map(c => c[0])
        const yList = coords.map(c => c[1])
        const maxX = Math.max(-1, ...xList)
        const maxY = Math.max(-1, ...yList)
        return { maxX, maxY }
    }

    toggle = force => this.utils.toggleVisible(this.buttonGroup, force)

    flashScale = (ele, scale = 0.95, timeout = 80) => {
        ele.style.transform = `scale(${scale})`
        setTimeout(() => ele.style.removeProperty("transform"), timeout)
    }
}

module.exports = {
    plugin: quickButtonPlugin
}
