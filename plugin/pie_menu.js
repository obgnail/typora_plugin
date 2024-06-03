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
            menu: document.querySelector(".plugin-pie-menu"),
            label: document.querySelector(".plugin-pie-menu-label"),
        }
    }

    showMenu = ev => {
        const {clientX, clientY} = ev;
        this.utils.show(this.entities.menu);
        const {width, height} = this.entities.menu.getBoundingClientRect();
        const position = {left: clientX - width / 2 + "px", top: clientY - height / 2 + "px"};
        Object.assign(this.entities.menu.style, position);
    }

    hideMenu = () => {
        this.utils.hide(this.entities.menu);
    }

    _onClick = ev => {
        ev.stopPropagation();
        ev.preventDefault();
        const target = ev.target.closest(".plugin-pie-menu-menu-item[data-callback]");
        const callback = target && target.dataset.callback;
        if (callback) {
            const [fixedName, callArg] = callback.split(".");
            this.utils.generateDynamicCallArgs(fixedName);
            const plugin = this.utils.getPlugin(fixedName);
            plugin && plugin.call && this.utils.withMeta(meta => plugin.call(callArg, meta));
        }
        this.hideMenu();
        document.removeEventListener("click", this._onClick, true);
    }

    process = () => {
        document.querySelector("content").addEventListener("contextmenu", ev => {
            if (!this.utils.metaKeyPressed(ev)) return;
            ev.stopPropagation();
            ev.preventDefault();
            this.showMenu(ev);
            document.addEventListener("click", this._onClick, true);
        }, true)
    }
}

module.exports = {
    plugin: pieMenu
};
