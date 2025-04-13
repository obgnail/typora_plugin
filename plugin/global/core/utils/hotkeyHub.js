/**
 * Dynamically register and unregister hotkeys.
 */
class hotkeyHub {
    constructor(utils) {
        this.utils = utils;
        this.map = new Map();
    }

    normalize = hotkeyString => {
        const modifier = ["ctrl", "shift", "alt"];
        const keyList = hotkeyString.toLowerCase().split("+").map(k => k.trim());
        const modifierKeys = modifier.filter(k => keyList.includes(k));
        const mainKey = keyList.find(k => !modifier.includes(k)) || (hotkeyString.includes("++") ? "+" : " ");
        return [...modifierKeys, mainKey].join("+");
    }

    /**
     * @param {string} hotkey: e.g. "ctrl+shift+c"
     * @param {function} callback: callback function on hotkey
     */
    registerSingle = (hotkey, callback) => {
        if (typeof hotkey === "string" && hotkey.length) {
            this.map.set(this.normalize(hotkey), callback)
        } else if (Array.isArray(hotkey)) {
            for (const hk of hotkey) {
                this.registerSingle(hk, callback)
            }
        }
    }

    /**
     * @param {[{string, function}]} hotkeys
     */
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

    /**
     * @param {string} hotkey: e.g. "ctrl+shift+c"
     */
    unregister = hotkey => this.map.delete(this.normalize(hotkey))

    process = () => {
        window.addEventListener("keydown", ev => {
            if (ev.key === undefined) return;
            const arr = [];
            this.utils.metaKeyPressed(ev) && arr.push("ctrl");
            this.utils.shiftKeyPressed(ev) && arr.push("shift");
            this.utils.altKeyPressed(ev) && arr.push("alt");
            arr.push(ev.key.toLowerCase());
            const key = arr.join("+");
            const callback = this.map.get(key);
            if (callback) {
                callback();
                ev.preventDefault();
                ev.stopPropagation();
            }
        }, true)
    }
}

module.exports = {
    hotkeyHub
}
