class pieMenuPlugin extends BasePlugin {
    styleTemplate = () => true

    html = () => {
        const { BUTTONS } = this.config;
        const innerItems = BUTTONS.slice(0, 8);
        const outerItems = BUTTONS.slice(8, 16);

        const genCircle = (type, items = []) => {
            const item = items.map(({ ICON, CALLBACK }) => `<div class="plugin-pie-menu-item" data-callback="${CALLBACK}"><div class="plugin-pie-menu-item-text-${type} ${ICON}"></div></div>`)
            return `<div class="plugin-pie-menu-circle plugin-pie-menu-${type}">${item.join("")}</div>`
        };

        const circles = [
            genCircle("solid", []),
            genCircle("inner", innerItems),
            outerItems.length ? genCircle("outer", outerItems) : ""
        ];
        return `<div class="plugin-pie-menu plugin-common-hidden">${circles.join("")}</div>`
    }

    hotkey = () => [{ hotkey: this.config.HOTKEY, callback: this.call }]

    init = () => {
        this.pinMenuClass = "pin-menu";
        this.expandMenuClass = "expand-menu";
        this.modifierKey = this.utils.modifierKey(this.config.MODIFIER_KEY);
        this.entities = {
            content: this.utils.entities.eContent,
            menu: document.querySelector(".plugin-pie-menu"),
        }
    }

    showMenu = (x, y) => {
        if (!x && !y) {
            x = (window.innerWidth || document.documentElement.clientWidth) / 2;
            y = (window.innerHeight || document.documentElement.clientHeight) / 2;
        }
        this.utils.show(this.entities.menu);
        const { width, height } = this.entities.menu.getBoundingClientRect();
        const position = { left: x - width / 2 + "px", top: y - height / 2 + "px" };
        Object.assign(this.entities.menu.style, position);
    }

    isMenuShown = () => this.utils.isShow(this.entities.menu)
    hideMenu = () => this.utils.hide(this.entities.menu)
    toggleMenu = () => this.utils.toggleVisible(this.entities.menu)
    isMenuPinned = () => this.entities.menu.classList.contains(this.pinMenuClass)
    togglePinMenu = () => this.entities.menu.classList.toggle(this.pinMenuClass)
    toggleExpandMenu = () => this.entities.menu.classList.toggle(this.expandMenuClass)
    isMenuExpanded = () => this.entities.menu.classList.contains(this.expandMenuClass)

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
                    let [fixedName, action] = callback.split(".");
                    if (this.utils.getCustomPlugin(fixedName)) {
                        action = fixedName;
                        fixedName = "custom";
                    }
                    this.utils.updateAndCallPluginDynamicAction(fixedName, action)
                    if (!this.isMenuPinned()) {
                        this.hideMenu()
                    }
                }
            }
        })

        this.entities.menu.addEventListener("wheel", ev => {
            ev.preventDefault();
            const step = 22.5;
            const rotate = window.getComputedStyle(this.entities.menu).getPropertyValue('--menu-rotate') || 0;
            const rotateValue = parseFloat(rotate) + (ev.deltaY > 0 ? step : -step);
            this.entities.menu.style.setProperty('--menu-rotate', `${rotateValue}deg`);
        }, { passive: false });
    }

    call = () => setTimeout(this.toggleMenu);
}

module.exports = {
    plugin: pieMenuPlugin
};
