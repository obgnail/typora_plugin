class quickButtonPlugin extends BaseCustomPlugin {
    hotkey = () => [this.config.hotkey]

    beforeProcess = () => {
        this.buttons = new Map();
        this.isHidden = false;
    }

    callback = anchorNode => this.toggle(document.querySelector("#plugin-quick-button").style.visibility !== "hidden")

    process = () => {
        this.utils.addEventListener(this.utils.eventType.everythingReady, async () => {
            this.registerConfigButtons();

            if (this.buttons.size === 0) return;

            const [maxX, maxY] = this.getMax();
            await this.utils.registerStyleTemplate("quickButton", {rowCount: maxX + 1, colCount: maxY + 1, this: this});
            this.utils.insertHtmlTemplate(this.genHTML(maxX, maxY));

            const buttonGroup = document.querySelector("#plugin-quick-button");
            buttonGroup.addEventListener("mousedown", ev => {
                const target = ev.target.closest(".action-item");
                if (!target) return;
                ev.stopPropagation();
                ev.preventDefault();
                if (ev.button === 2 && this.config.support_right_click) {
                    const buttons = Array.from(buttonGroup.children);
                    this.isHidden = !buttons.some(ele => ele.classList.contains("plu-hidden"));
                    buttons.forEach(ele => (ele !== target) && ele.classList.toggle("plu-hidden"));
                } else if (ev.button === 0) {
                    this.flashScaleButton(target);
                    const action = target.getAttribute("action");
                    const button = this.buttons.get(action);
                    if (action && button) {
                        button.callback(ev, target);
                    }
                }
            })
            this.utils.addEventListener(this.utils.eventType.toggleSettingPage, this.toggle);
        })
    }

    registerConfigButtons = () => {
        this.config.buttons.forEach(btn => {
            const {coordinate, hint, icon, size, color, bgColor, disable, callback = "", evil} = btn || {};
            if (disable) return;

            let cb;
            if (evil) {
                cb = eval(evil);
            } else {
                const [fixedName, func] = callback.split(".");
                if (fixedName && func) {
                    cb = this.utils.getPluginFunction(fixedName, func);
                }
            }
            if (cb instanceof Function) {
                const style = {};
                size && (style["fontSize"] = size);
                color && (style["color"] = color);
                bgColor && (style["backgroundColor"] = bgColor);
                const action = this.utils.randomString();
                this.register(action, coordinate, hint, icon, style, cb);
            }
        })
    }

    register = (action, coordinate, hint, iconClass, style, callback) => {
        const [x, y] = coordinate;
        if (x < 0 || y < 0 || !(callback instanceof Function)) return;
        this.buttons.set(action, {coordinate, action, hint, iconClass, style, callback});
    }

    unregister = action => this.buttons.delete(action)

    genHTML = (maxX, maxY) => {
        const list = Array.from(this.buttons.values(), button => [`${button.coordinate[0]}-${button.coordinate[1]}`, button]);
        const mapCoordToBtn = new Map(list);

        const children = [];
        for (let x = 0; x <= maxX; x++) {
            for (let y = 0; y <= maxY; y++) {
                const button = mapCoordToBtn.get(`${maxX - x}-${maxY - y}`);
                const ele = !button
                    ? {class_: "action-item unused"}
                    : {
                        class_: "action-item",
                        action: button.action,
                        style: button.style || {},
                        children: [{ele: "i", class_: button.iconClass}]
                    }
                if (button && !this.config.hide_button_hint) {
                    ele["ty-hint"] = button.hint;
                }
                children.push(ele);
            }
        }
        return [{id: "plugin-quick-button", children: children}]
    }

    getMax = () => {
        let maxX = -1;
        let maxY = -1;
        for (const {coordinate: [x, y]} of this.buttons.values()) {
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
        }
        return [maxX, maxY]
    }

    toggle = hide => {
        const buttonGroup = document.querySelector("#plugin-quick-button");
        if (buttonGroup) {
            buttonGroup.style.visibility = hide ? "hidden" : "initial";
        }
    }

    flashScaleButton = (button, scale = 0.95, timeout = 80) => {
        button.style.transform = `scale(${scale})`;
        setTimeout(() => button.style.removeProperty("transform"), timeout);
    }
}

module.exports = {
    plugin: quickButtonPlugin
};