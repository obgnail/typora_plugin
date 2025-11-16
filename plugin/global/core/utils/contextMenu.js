/**
 * Dynamically register context menu.
 */
class ContextMenu {
    constructor(utils) {
        this.utils = utils
        this.menuSet = new WeakSet()
        this._callback = null
    }

    process = async () => {
        await this.utils.styleTemplater.register("plugin-common-menu")
        this.utils.insertElement(`<div class="plugin-common-menu"></div>`)

        this.menuEl = document.querySelector(".plugin-common-menu")
        this.menuEl.addEventListener("mousedown", ev => {
            if (!this._callback || ev.button !== 0) return
            const target = ev.target.closest(".menu-item")
            if (target) {
                this._callback(ev, target.dataset.key)
                this._hideMenu()
            }
        })
    }

    /**
     * @param {Element} el: At which location right click will pop up the menu
     * @param {function(ev): {key: value}} getMenuItems: Generates an object composed of context menu options
     * @param {function(ev, key): null} onClickMenuItem: on click callback; the key parameter is the clicked option
     */
    register = (el, getMenuItems, onClickMenuItem) => {
        if (el && !this.menuSet.has(el)) {
            el.__getMenuItems = getMenuItems
            el.__onClickMenuItem = onClickMenuItem
            el.addEventListener("mousedown", this._handler)
            this.menuSet.add(el)
        }
    }

    unregister = el => {
        if (this.menuSet.has(el)) {
            el.__getMenuItems = undefined
            el.__onClickMenuItem = undefined
            el.removeEventListener("mousedown", this._handler)
            this.menuSet.delete(el)
        }
    }

    _handler = ev => {
        if (this._callback) {
            this._hideMenu()
        }

        if (ev.button !== 2) return

        const { __getMenuItems, __onClickMenuItem } = ev.currentTarget
        if (!__getMenuItems || !__onClickMenuItem) return

        ev.preventDefault()
        ev.stopPropagation()

        const menuItems = __getMenuItems(ev)
        if (!menuItems || !this.utils.isObject(menuItems) || Object.keys(menuItems).length === 0) return

        this.menuEl.innerHTML = Object.entries(menuItems).map(([key, text]) => `<div class="menu-item" data-key="${key}">${text}</div>`).join("")
        this._callback = __onClickMenuItem
        this._showMenu(ev)

        document.addEventListener("mousedown", this._hideMenu, { once: true })
    }

    _hideMenu = () => {
        this.menuEl.classList.remove("show")
        this._callback = null
    }

    _showMenu = ev => {
        const $menu = $(this.menuEl)
        $menu.addClass("show");
        const { innerWidth, innerHeight } = window;
        const { clientX, clientY } = ev;
        let width = $menu.width() + 20;
        width = Math.min(clientX, innerWidth - width);
        width = Math.max(0, width);
        let height = $menu.height() + 48;
        height = clientY > innerHeight - height
            ? innerHeight - height
            : clientY - $("#top-titlebar").height() + 8;
        height = Math.max(0, height);
        $menu.css({ top: height + "px", left: width + "px" });
    }
}

module.exports = ContextMenu
