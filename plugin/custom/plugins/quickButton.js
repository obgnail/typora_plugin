class quickButtonPlugin extends BaseCustomPlugin {
    hotkey = () => [this.config.hotkey]

    beforeProcess = () => {
        this.buttons = new Map();
        this.isHidden = false;
    }

    callback = anchorNode => this.toggle()

    process = () => {
        this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.allPluginsHadInjected, async () => {
            this.registerConfigButtons();

            if (this.buttons.size === 0) return;

            const { maxX, maxY } = this.getMax();
            await this.utils.styleTemplater.register("quickButton", { rowCount: maxX + 1, colCount: maxY + 1, this: this });
            this.utils.htmlTemplater.insert(this.genHTML(maxX, maxY));

            const group = document.querySelector("#plugin-quick-button");
            group.addEventListener("mousedown", ev => {
                const target = ev.target.closest(".action-item");
                if (!target) return;
                if (ev.button === 2 && this.config.support_right_click) {
                    const buttons = Array.from(group.children);
                    this.isHidden = !buttons.some(ele => ele.classList.contains("plu-hidden"));
                    buttons.forEach(ele => (ele !== target) && ele.classList.toggle("plu-hidden"));
                } else if (ev.button === 0) {
                    this.flashScale(target);
                    const action = target.getAttribute("action");
                    const button = this.buttons.get(action);
                    if (action && button) {
                        button.callback(ev, target);
                    }
                }
            })

            this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.toggleSettingPage, this.toggle);
        })
    }

    registerConfigButtons = () => {
        this.config.buttons.forEach(btn => {
            const { coordinate, hint, icon, size, color, bgColor, disable, callback = "", evil } = btn || {};
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
                if (size) style.fontSize = size;
                if (color) style.color = color;
                if (bgColor) style.backgroundColor = bgColor;
                const action = this.utils.randomString();
                this.register(action, coordinate, hint, icon, style, cb);
            }
        })
    }

    register = (action, coordinate, hint, iconClass, style, callback) => {
        const [x, y] = coordinate;
        if (x < 0 || y < 0 || !(callback instanceof Function)) return;
        this.buttons.set(action, { coordinate, action, hint, iconClass, style, callback });
    }

    unregister = action => this.buttons.delete(action)

    genHTML = (maxX, maxY) => {
        const list = Array.from(this.buttons.values(), button => [`${button.coordinate[0]}-${button.coordinate[1]}`, button]);
        const mapCoordToBtn = new Map(list);

        const children = [];
        for (let x = 0; x <= maxX; x++) {
            for (let y = 0; y <= maxY; y++) {
                const btn = mapCoordToBtn.get(`${maxX - x}-${maxY - y}`);
                const ele = !btn
                    ? { class_: "action-item plu-unused" }
                    : { class_: `action-item ${btn.iconClass}`, action: btn.action, style: btn.style }
                if (btn && !this.config.hide_button_hint) {
                    ele["ty-hint"] = btn.hint;
                }
                children.push(ele);
            }
        }
        return [{ id: "plugin-quick-button", children }]
    }

    getMax = () => {
        const coords = Array.from(this.buttons.values(), e => e.coordinate);
        const maxX = Math.max(-1, ...coords.map(e => e[0]));
        const maxY = Math.max(-1, ...coords.map(e => e[1]));
        return { maxX, maxY };
    }

    toggle = force => this.utils.toggleVisible(document.querySelector("#plugin-quick-button"), force);

    flashScale = (ele, scale = 0.95, timeout = 80) => {
        ele.style.transform = `scale(${scale})`;
        setTimeout(() => ele.style.removeProperty("transform"), timeout);
    }
}

module.exports = {
    plugin: quickButtonPlugin
};