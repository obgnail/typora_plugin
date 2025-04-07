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

    _register = (hotkey, call) => {
        if (typeof hotkey === "string" && hotkey.length) {
            this.map.set(this.normalize(hotkey), call);
            // A callback may correspond to multiple hotkeys.
        } else if (hotkey instanceof Array) {
            for (const hk of hotkey) {
                this._register(hk, call);
            }
        }
    }

    /**
     * Does not validate the legality of hotkeyString. The caller needs to ensure that the hotkey is not occupied and has no typos.
     * @param {[{string, function}]} hotkeyList: [ { hotkey: "ctrl+shift+c", callback: () => console.log("ctrl+shift+c pressed") }, ]
     */
    register = hotkeyList => {
        if (!hotkeyList) return;
        for (const item of hotkeyList) {
            if (item instanceof Array) {
                this.register(item);
            } else {
                this._register(item.hotkey, item.callback);
            }
        }
    }

    /**
     * @param {string} hotkeyString: "ctrl+shift+c"
     */
    unregister = hotkeyString => this.map.delete(this.normalize(hotkeyString))

    registerSingle = (hotkeyString, callback) => this._register(hotkeyString, callback)

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
