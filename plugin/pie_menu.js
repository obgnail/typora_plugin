class pieMenu extends BasePlugin {
    styleTemplate = () => true

    htmlTemplate = () => {
        const items = this.config.BUTTONS.map(({ICON, CALLBACK}) => ({
            class_: "plugin-pie-menu-menu-item",
            "data-callback": CALLBACK,
            children: [{class_: `plugin-pie-menu-menu-item-text ${ICON}`}]
        }))
        const children = [{class_: "plugin-pie-menu-label"}, {class_: "plugin-pie-menu-menu", children: items}];
        return [{class_: "plugin-pie-menu plugin-common-hidden", children}]
    }

    init = () => {
        this.entities = {
            content: document.querySelector("content"),
            menu: document.querySelector(".plugin-pie-menu"),
            items: document.querySelector(".plugin-pie-menu-menu"),
            // label: document.querySelector(".plugin-pie-menu-label"),
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
    hideMenu = () => this.utils.hide(this.entities.menu);
    toggleMenu = () => this.utils.toggleVisible(this.entities.menu)

    process = () => {
        this.entities.content.addEventListener("contextmenu", ev => {
            if (this.utils.metaKeyPressed(ev)) {
                ev.stopPropagation();
                ev.preventDefault();
                this.showMenu(ev.clientX, ev.clientY);
            }
        }, true)

        this.entities.content.addEventListener("click", ev => {
            if (this.isMenuShown() && !ev.target.closest(".plugin-pie-menu")) {
                this.hideMenu();
            }
        })

        this.entities.items.addEventListener("click", ev => {
            const target = ev.target.closest(".plugin-pie-menu-menu-item[data-callback]");
            const callback = target && target.dataset.callback;
            if (callback) {
                const [fixedName, callArg] = callback.split(".");
                this.utils.generateDynamicCallArgs(fixedName);
                const plugin = this.utils.getPlugin(fixedName);
                plugin && plugin.call && this.utils.withMeta(meta => plugin.call(callArg, meta));
                this.hideMenu();
            }
        })
    }

    call = () => this.toggleMenu();
}

module.exports = {
    plugin: pieMenu
};
