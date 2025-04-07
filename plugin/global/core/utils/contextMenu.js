/**
 * Dynamically register context menu.
 */
class contextMenu {
    constructor(utils) {
        this.utils = utils;
        this.className = "plugin-common-menu";
        this.menus = new Map();
        this.callback = null;
    }

    process = async () => {
        await this.utils.styleTemplater.register(this.className);
        this.utils.insertElement(`<div class="${this.className}"></div>`);

        this.menu = document.querySelector("." + this.className);
        this.menu.addEventListener("click", ev => {
            if (!this.callback) return;
            const target = ev.target.closest(".menu-item");
            if (!target) return;
            ev.preventDefault();
            ev.stopPropagation();
            this.callback({ ev, key: target.getAttribute("key") });
            this.callback = null;
            this.menu.classList.remove("show");
        })
        // content ELEMENT internal only
        this.utils.entities.eContent.addEventListener("mousedown", ev => {
            if (!ev.target.closest(".menu-item")) {
                this.menu.classList.remove("show")
            }
            if (ev.button !== 2) return;
            for (const menu of this.menus.values()) {
                const target = ev.target.closest(menu.selector);
                if (!target) continue;
                ev.preventDefault();
                ev.stopPropagation();
                const menus = menu.generator({ ev, target });
                this.render(menus);
                this.show(ev);
                this.callback = menu.callback;
            }
        }, true)
    }

    /**
     * @param {string} name: Give it a name
     * @param {string} selector: At which location right click will pop up the menu
     * @param {function({ev, target}): {key: value}} generator: Generates an object composed of context menu options; the target parameter is the element corresponding to the above selector
     * @param {function({ev, key}): null} callback: on click callback; the key parameter is the clicked option
     */
    register = (name, selector, generator, callback) => this.menus.set(name, { selector, generator, callback })
    unregister = name => this.menus.delete(name)
    exist = name => this.menus.has(name)

    render = menus => {
        const entries = Object.entries(menus);
        let child = this.menu.firstElementChild;
        for (let idx = 0; idx < entries.length; idx++) {
            const [key, text] = entries[idx];
            if (child) {
                child.setAttribute("key", key);
                child.innerText = text;
            } else {
                const menuList = entries.slice(idx).map(([key, text]) => ({ class_: "menu-item", key, text }));
                this.utils.htmlTemplater.appendElements(this.menu, menuList);
                break;
            }
            child = child.nextElementSibling;
        }
        while (child) {
            const next = child.nextElementSibling;
            this.menu.removeChild(child);
            child = next;
        }
    }

    show = ev => {
        const $menu = $(this.menu);
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

module.exports = {
    contextMenu
}
