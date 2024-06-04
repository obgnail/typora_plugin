class pieMenu extends BasePlugin {
    styleTemplate = () => true

    htmlTemplate = () => {
        const genCircle = (type, items = []) => {
            const children = items.map(({ICON, CALLBACK}) => ({
                class_: "plugin-pie-menu-item",
                "data-callback": CALLBACK,
                children: [{class_: `plugin-pie-menu-item-text-${type} ${ICON}`}]
            }))
            return {class_: `plugin-pie-menu-circle plugin-pie-menu-${type}`, children}
        }

        const {BUTTONS} = this.config;
        const [_inner, _outer] = [BUTTONS.slice(0, 8), BUTTONS.slice(8, 16)];
        const children = [genCircle("solid"), genCircle("inner", _inner)];
        if (_outer && _outer.length) {
            children.push(genCircle("outer", _outer));
        }

        return [{class_: "plugin-pie-menu plugin-common-hidden", children}]
    }

    hotkey = () => [{hotkey: this.config.HOTKEY, callback: this.call}]

    init = () => {
        this.modifierKey = this.utils.modifierKey(this.config.MODIFIER_KEY);
        this.entities = {
            content: document.querySelector("content"),
            menu: document.querySelector(".plugin-pie-menu"),
        }
    }

    showMenu = (x, y) => {
        if (!x && !y) {
            x = (window.innerWidth || document.documentElement.clientWidth) / 2;
            y = (window.innerHeight || document.documentElement.clientHeight) / 2;
        }
        this.utils.show(this.entities.menu);
        const {width, height} = this.entities.menu.getBoundingClientRect();
        const position = {left: x - width / 2 + "px", top: y - height / 2 + "px"};
        Object.assign(this.entities.menu.style, position);
    }

    isMenuShown = () => this.utils.isShow(this.entities.menu)
    hideMenu = () => this.utils.hide(this.entities.menu)
    toggleMenu = () => this.utils.toggleVisible(this.entities.menu)
    isMenuPinned = () => this.entities.menu.classList.contains("pin-menu")
    togglePinMenu = () => this.entities.menu.classList.toggle("pin-menu")
    toggleExpandMenu = () => this.entities.menu.classList.toggle("expand-menu")
    isMenuExpanded = () => this.entities.menu.classList.toggle("expand-menu")

    process = () => {
        this.entities.content.addEventListener("contextmenu", ev => {
            if (this.modifierKey(ev)) {
                ev.stopPropagation();
                ev.preventDefault();
                this.showMenu(ev.clientX, ev.clientY);
            }
        }, true)

        this.entities.content.addEventListener("click", ev => {
            if (this.isMenuShown() && !this.isMenuPinned() && !ev.target.closest(".plugin-pie-menu")) {
                this.hideMenu();
            }
        })

        this.entities.menu.addEventListener("mousedown", ev => {
            if (ev.target.closest(".plugin-pie-menu-solid")) {
                if (ev.button === 0) {
                    this.togglePinMenu();
                } else if (ev.button === 2) {
                    this.toggleExpandMenu();
                }
                return;
            }

            if (ev.button === 0) {
                const target = ev.target.closest(".plugin-pie-menu-item[data-callback]");
                const callback = target && target.dataset.callback;
                if (callback) {
                    const [fixedName, callArg] = callback.split(".");
                    this.utils.generateDynamicCallArgs(fixedName);
                    const plugin = this.utils.getPlugin(fixedName);
                    plugin && plugin.call && this.utils.withMeta(meta => plugin.call(callArg, meta));
                    !this.isMenuPinned() && this.hideMenu();
                }
            }
        })

        this.entities.menu.addEventListener("wheel", ev => {
            ev.preventDefault();
            const step = 22.5;
            const rotate = window.getComputedStyle(this.entities.menu).getPropertyValue('--menu-rotate') || 0;
            const rotateValue = parseFloat(rotate) + (ev.deltaY > 0 ? step : -step);
            this.entities.menu.style.setProperty('--menu-rotate', `${rotateValue}deg`);
        }, {passive: false});
    }

    call = () => setTimeout(this.toggleMenu);
}

module.exports = {
    plugin: pieMenu
};
