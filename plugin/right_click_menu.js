// The plugin name is introduced through the setting file. To avoid XSS injection, innerHTML cannot be used
class rightClickMenuPlugin extends BasePlugin {
    styleTemplate = () => {
        const { MENU_MIN_WIDTH, HIDE_OTHER_OPTIONS } = this.config;
        const map = { "default": "", "auto": "inherit" };
        const width = map[MENU_MIN_WIDTH] || MENU_MIN_WIDTH;
        const display = HIDE_OTHER_OPTIONS ? "none" : "";
        if (width || display) {
            return { menu_min_width: width, menu_option_display: display }
        }
    }

    init = () => {
        this.groupName = "typora-plugin"
        this.noExtraMenuGroupName = "typora-plugin-no-extra"
        this.dividerValue = "---"
        this.unavailableActName = "不可点击"
        this.unavailableActValue = "__not_available__"
        this.defaultDisableHint = "功能于此时不可用"
        this.supportShortcut = Boolean(document.querySelector(".ty-menu-shortcut"))
    }

    process = () => {
        this.utils.runtime.autoSaveConfig(this)
        this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.allPluginsHadInjected, this.appendMenu)
    }

    appendMenu = () => {
        setTimeout(() => {
            this.appendFirst()  // The first level menus group all plugins
            this.appendSecond() // The second level menus display grouped plugins
            this.appendThird()  // The three level menus display the actions of the plugin
            this.listen()
        }, 500)
    }

    appendFirst = () => {
        const items = this.config.MENUS.map(({ NAME, LIST = [] }, idx) => {
            const item = [{ ele: "span", "data-lg": "Menu", text: NAME }]
            const children = [{ ele: "a", role: "menuitem", children: item }]
            const noExtraMenu = LIST && LIST.length === 1
            if (noExtraMenu) {
                return { ele: "li", "data-key": this.noExtraMenuGroupName, "data-value": LIST[0], idx, children }
            }
            item.push(this.caret())
            return { ele: "li", class_: "has-extra-menu", "data-key": this.groupName, idx, children }
        })
        const templates = [this.divider(), ...items]
        const menu = document.querySelector("#context-menu")
        this.utils.htmlTemplater.appendElements(menu, templates)
    }

    appendSecond = () => {
        this.findLostPluginIfNeed()
        const templates = this.config.MENUS.map(({ LIST = [] }, idx) => {
            const children = LIST.map(item => {
                if (item === this.dividerValue) {
                    return this.divider()
                }
                const [fixedName, action] = item.split(".")
                const plugin = this.utils.getPlugin(fixedName)
                if (plugin) {
                    return action ? this.secondComposeLiTemplate(plugin, action) : this.secondLiTemplate(plugin)
                }
            }).filter(Boolean)
            return this.ulTemplate({ class_: ["plugin-menu-second"], idx, children })
        })
        this.utils.htmlTemplater.appendElements(this.utils.entities.eContent, templates)
    }

    appendThird = () => {
        const templates = this.config.MENUS.flatMap(({ LIST = [] }, idx) => {
            return LIST
                .filter(item => item !== this.dividerValue)
                .map(item => this.utils.getPlugin(item))
                .filter(plugin => plugin && (plugin.staticActions || plugin.getDynamicActions))
                .map(plugin => {
                    const children = (plugin.staticActions || []).map(act => this.thirdLiTemplate(act))
                    return { class_: ["plugin-menu-third"], "data-plugin": plugin.fixedName, idx, children }
                })
                .map(this.ulTemplate)
        })
        this.utils.htmlTemplater.appendElements(this.utils.entities.eContent, templates)
    }

    secondComposeLiTemplate = (plugin, action) => {
        const target = plugin.staticActions.find(act => act.act_value === action)
        const name = target ? target.act_name : plugin.config.NAME
        const children = [{ ele: "a", role: "menuitem", "data-lg": "Menu", text: name }]
        return { ele: "li", class_: "plugin-menu-item", "data-key": plugin.fixedName, "data-value": action, children }
    }

    secondLiTemplate = plugin => {
        const hasAction = plugin.staticActions || plugin.getDynamicActions
        const clickable = hasAction || plugin.hasOwnProperty("call")
        const extra = {
            class_: `plugin-menu-item ${hasAction ? "has-extra-menu" : ""}`,
            style: clickable ? undefined : { color: "#c4c6cc", pointerEvents: "none" },
        }
        return this._liTemplate(plugin.fixedName, plugin.config.NAME, plugin.config.HOTKEY, hasAction, null, extra)
    }

    thirdLiTemplate = (act, dynamic) => {
        if (act.act_disabled && !act.act_hint) {
            act.act_hint = this.defaultDisableHint
        }
        const class_ = []
        if (dynamic) {
            class_.push("plugin-dynamic-act")
        }
        if (act.act_hidden) {
            class_.push("plugin-common-hidden")
        }
        if (act.act_disabled) {
            class_.push("disabled")
        }
        const extra = { "ty-hint": act.act_hint || undefined, class_ }
        const state = (this.config.SHOW_ACTION_OPTIONS_ICON && act.act_state === undefined)
            ? "state-run"
            : Boolean(act.act_state)
                ? "state-on"
                : "state-off"
        return this._liTemplate(act.act_value, act.act_name, act.act_hotkey, false, state, extra)
    }

    _liTemplate = (key, showName, shortcut, hasExtraMenu, class_, extra) => {
        if (Array.isArray(shortcut)) {
            shortcut = shortcut[0]
        }
        if (shortcut && typeof shortcut === "string") {
            shortcut = shortcut.split("+").map(e => e[0].toUpperCase() + e.slice(1).toLowerCase()).join("+")
        }
        const hasShortcut = this.supportShortcut && this.config.SHOW_PLUGIN_HOTKEY && shortcut;
        const attr = hasExtraMenu
            ? { children: [{ ele: "span", "data-lg": "Menu", text: showName, children: [this.caret()] }] }
            : hasShortcut
                ? { children: [{ ele: "span", text: showName }, { ele: "span", class_: "ty-menu-shortcut", text: shortcut }] }
                : { text: showName }
        const children = [{ ele: "a", role: "menuitem", class_, "data-lg": "Menu", ...attr }];
        return { ele: "li", "data-key": key, children, ...extra }
    }

    ulTemplate = extra => {
        extra.class_.push("dropdown-menu", "context-menu", "ext-context-menu");
        return { ele: "ul", role: "menu", ...extra }
    }

    divider = () => ({ ele: "li", class_: "divider" })
    caret = () => ({ ele: "i", class_: "fa fa-caret-right" })

    findLostPluginIfNeed = () => {
        if (!this.config.FIND_LOST_PLUGIN) return

        const { MENUS } = this.config
        const plugins = new Map(Object.entries(this.utils.getAllPlugins()))
        MENUS.forEach(menu => menu.LIST.forEach(p => plugins.delete(p)))
        const lostPlugins = [...plugins.values()].map(p => p.fixedName)
        MENUS[MENUS.length - 1].LIST.push(...lostPlugins)
    }

    showMenuItem = (after, before) => {
        const margin = 6
        const { left, top, width, height } = before.getBoundingClientRect()
        let afterTop = top - height
        let afterLeft = left + width + margin

        const footer = document.querySelector("footer")
        const footerHeight = footer ? footer.getBoundingClientRect().height : 0

        after.classList.add("show")
        const { height: afterHeight, width: afterWidth } = after.getBoundingClientRect()
        afterTop = Math.min(afterTop, window.innerHeight - afterHeight - footerHeight)
        afterLeft = afterLeft + afterWidth < window.innerWidth ? afterLeft : Math.max(0, left - afterWidth - margin)
        after.style.top = afterTop + "px"
        after.style.left = afterLeft + "px"
    }

    appendThirdLi = (menu, dynamicActions) => {
        const templates = dynamicActions.map(act => this.thirdLiTemplate(act, true))
        this.utils.htmlTemplater.appendElements(menu, templates)
    }

    listen = () => {
        const that = this;
        const removeShow = ele => ele.classList.remove("show");
        const removeActive = ele => ele.classList.remove("active");

        // 点击一级菜单
        $("#context-menu").on("click", `[data-key="${this.noExtraMenuGroupName}"]`, function () {
            const value = this.dataset.value
            if (!value) {
                return false
            }
            const [fixedName, action] = value.split(".")
            if (!fixedName || !action) {
                return false
            }
            that.utils.updatePluginDynamicActions(fixedName)
            that.callPluginDynamicAction(fixedName, action)
            that.hideMenuIfNeed()
            // 展示二级菜单
        }).on("mouseenter", "[data-key]", function () {
            if (that.groupName === this.dataset.key) {
                const idx = this.getAttribute("idx")
                if (document.querySelector(".plugin-menu-second.show")) {
                    document.querySelectorAll(`.plugin-menu-third:not([idx="${idx}"])`).forEach(removeShow)
                }
                document.querySelectorAll(`.plugin-menu-second:not([idx="${idx}"]) .plugin-menu-item.active`).forEach(removeActive)
                document.querySelectorAll(`.plugin-menu-second:not([idx="${idx}"])`).forEach(removeShow)
                that.showMenuItem(document.querySelector(`.plugin-menu-second[idx="${idx}"]`), this)
                this.classList.add("active")
            } else {
                document.querySelectorAll(`#context-menu li[data-key="${that.groupName}"]`).forEach(removeActive)
                document.querySelectorAll(".plugin-menu-second, .plugin-menu-third").forEach(removeShow)
            }
        })

        // 展示三级菜单
        $(".plugin-menu-second").on("mouseenter", "[data-key]", function () {
            document.querySelectorAll(".plugin-menu-third").forEach(removeShow)
            document.querySelectorAll(".plugin-dynamic-act").forEach(ele => ele.parentElement.removeChild(ele))
            const fixedName = this.dataset.key
            const third = document.querySelector(`.plugin-menu-third[data-plugin="${fixedName}"]`)
            const noStaticActions = third && third.children.length === 0
            let dynamicActions = that.utils.updatePluginDynamicActions(fixedName)
            if (!dynamicActions && noStaticActions) {
                dynamicActions = [{ act_name: this.unavailableActName, act_value: this.unavailableActValue, act_disabled: true }]
            }
            if (dynamicActions) {
                that.appendThirdLi(third, dynamicActions)
            }
            if (this.querySelector('span[data-lg="Menu"]')) {
                that.showMenuItem(third, this)
            } else {
                removeActive(document.querySelector(".plugin-menu-second .has-extra-menu"))
            }
            // 在二级菜单中调用插件
        }).on("click", "[data-key]", function () {
            const fixedName = this.dataset.key
            const action = this.dataset.value
            if (action) {
                that.callPluginDynamicAction(fixedName, action)
            } else {
                const plugin = that.utils.getPlugin(fixedName)
                // 拥有三级菜单的，不允许点击二级菜单
                if (!plugin || plugin.staticActions || plugin.getDynamicActions) {
                    return false
                }
                if (plugin.call) {
                    plugin.call()
                }
            }
            that.hideMenuIfNeed()
        })

        // 在三级菜单中调用插件
        $(".plugin-menu-third").on("click", "[data-key]", function () {
            // 点击禁用的选项
            if (this.classList.contains("disabled")) {
                return false
            }
            const action = this.dataset.key
            const fixedName = this.parentElement.dataset.plugin
            that.callPluginDynamicAction(fixedName, action)
            that.hideMenuIfNeed(fixedName)
        })
    }

    callPluginDynamicAction = (fixedName, action) => {
        if (action !== this.unavailableActValue) {
            this.utils.callPluginDynamicAction(fixedName, action)
        }
    }

    hideMenuIfNeed = key => {
        if (!this.config.DO_NOT_HIDE) {
            File.editor.contextMenu.hide();
            return;
        }
        if (key) {
            $(`.plugin-menu-item[data-key="${key}"]`).trigger("mouseenter");  // refresh third menu
        }
    }

    toggleHotkey = () => {
        this.config.SHOW_PLUGIN_HOTKEY = !this.config.SHOW_PLUGIN_HOTKEY
        const toggle = e => e.classList.toggle("plugin-common-hidden", !this.config.SHOW_PLUGIN_HOTKEY)
        document.querySelectorAll(".plugin-menu-second .ty-menu-shortcut, .plugin-menu-third .ty-menu-shortcut").forEach(toggle)
    }

    getDynamicActions = () => [
        { act_name: "启用功能：保持显示", act_value: "do_not_hide", act_state: this.config.DO_NOT_HIDE, act_hint: "右键菜单点击后不会自动消失" },
        { act_name: "启用功能：显示快捷键", act_value: "toggle_hotkey", act_state: this.config.SHOW_PLUGIN_HOTKEY, act_hidden: !this.supportShortcut },
        { act_name: "启用功能：隐藏除插件外的选项", act_value: "hide_other_options", act_state: this.config.HIDE_OTHER_OPTIONS },
    ]

    call = async action => {
        if (action === "do_not_hide") {
            this.config.DO_NOT_HIDE = !this.config.DO_NOT_HIDE
        } else if (action === "hide_other_options") {
            this.config.HIDE_OTHER_OPTIONS = !this.config.HIDE_OTHER_OPTIONS
            await this.utils.styleTemplater.reset(this.fixedName, this.styleTemplate())
        } else if (action === "toggle_hotkey") {
            this.toggleHotkey()
        }
    }
}

module.exports = {
    plugin: rightClickMenuPlugin
}
