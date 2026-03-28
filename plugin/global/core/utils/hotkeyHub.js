class HotkeyHub {
    constructor() {
        this.map = new Map()
    }

    normalize = hotkeyString => {
        const modifier = ["ctrl", "shift", "alt"]
        const keyList = hotkeyString.toLowerCase().split("+").map(k => k.trim())
        const modifierKeys = modifier.filter(k => keyList.includes(k))
        const mainKey = keyList.find(k => !modifier.includes(k)) || (hotkeyString.includes("++") ? "+" : " ")
        return [...modifierKeys, mainKey].join("+")
    }

    registerSingle = (hotkey, callback) => {
        if (typeof hotkey === "string" && hotkey.length) {
            this.map.set(this.normalize(hotkey), callback)
        } else if (Array.isArray(hotkey)) {
            for (const hk of hotkey) {
                this.registerSingle(hk, callback)
            }
        }
    }

    register = hotkeys => {
        if (!hotkeys) return

        for (const item of hotkeys) {
            if (Array.isArray(item)) {
                this.register(item)
            } else {
                this.registerSingle(item.hotkey, item.callback)
            }
        }
    }

    unregister = hotkey => this.map.delete(this.normalize(hotkey))

    process = () => {
        window.addEventListener("keydown", ev => {
            if (ev.key === undefined) return
            let combo = ""
            if (ev.ctrlKey || ev.metaKey) combo += "ctrl+"
            if (ev.shiftKey) combo += "shift+"
            if (ev.altKey) combo += "alt+"
            combo += ev.key.toLowerCase()
            const callback = this.map.get(combo)
            if (callback) {
                callback()
                ev.preventDefault()
                ev.stopPropagation()
            }
        }, true)
    }
}

module.exports = HotkeyHub
