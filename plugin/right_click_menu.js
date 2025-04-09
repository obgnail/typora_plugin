class rightClickMenuPlugin extends BasePlugin {
    styleTemplate = () => ({
        menu_min_width: this.config.MENU_MIN_WIDTH,
        menu_option_display: this.config.HIDE_OTHER_OPTIONS ? "none" : ""
    })

    init = () => {
        this.groupName = "typora-plugin"
        this.noExtraMenuGroupName = "typora-plugin-no-extra"
        this.dividerValue = "---"
        this.unavailableActValue = "__not_available__"
        this.unavailableActName = this.i18n.t("act.disabled")
        this.defaultDisableHint = this.i18n.t("achHint.disabled")
        this.supportShortcut = Boolean(document.querySelector(".ty-menu-shortcut"))
    }

    process = () => {
        this.utils.settings.autoSaveSettings(this)
        this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.allPluginsHadInjected, this.appendMenu)
    }

    appendMenu = () => {
        setTimeout(() => {
            this.appendFirst()  // The 1st level menus group all plugins
            this.appendSecond() // The 2nd level menus display grouped plugins
            this.appendThird()  // The 3rd level menus display the actions of the plugin
            this.listen()
        }, 500)
    }

    appendFirst = () => {
        const items = this.config.MENUS.map(({ NAME, LIST = [] }, idx) => {
            if (LIST.length === 0) {
                return ""
            }
            const name = this.i18n._t("settings", NAME)
            const noExtraMenu = LIST.length === 1
            const caret = noExtraMenu ? "" : '<i class="fa fa-caret-right"></i>'
            const a = `<a role="menuitem"><span data-lg="Menu">${name}</span>${caret}</a>`
            return noExtraMenu
                ? `<li data-key="${this.noExtraMenuGroupName}" data-value="${LIST[0]}" idx="${idx}">${a}</li>`
                : `<li class="has-extra-menu" data-key="${this.groupName}" idx="${idx}">${a}</li>`
        })
        const html = '<li class="divider"></li>' + items.join("")
        document.querySelector("#context-menu").insertAdjacentHTML("beforeend", html)
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
            return this.ulTemplate({ className: "plugin-menu-second", idx, children })
        })
        this.utils.entities.eContent.append(...this._createElement(templates))
    }

    appendThird = () => {
        const templates = this.config.MENUS.flatMap(({ LIST = [] }, idx) => {
            return LIST
                .filter(item => item !== this.dividerValue)
                .map(item => this.utils.getPlugin(item))
                .filter(plugin => plugin && (plugin.staticActions || plugin.getDynamicActions))
                .map(plugin => {
                    const children = (plugin.staticActions || []).map(act => this.thirdLiTemplate(act))
                    return { className: "plugin-menu-third", "data-plugin": plugin.fixedName, idx, children }
                })
                .map(this.ulTemplate)
        })
        this.utils.entities.eContent.append(...this._createElement(templates))
    }

    secondComposeLiTemplate = (plugin, action) => {
        const target = plugin.staticActions.find(act => act.act_value === action)
        const name = target ? target.act_name : plugin.pluginName
        const children = [{ ele: "a", role: "menuitem", "data-lg": "Menu", text: name }]
        return { ele: "li", className: "plugin-menu-item", "data-key": plugin.fixedName, "data-value": action, children }
    }

    secondLiTemplate = plugin => {
        const hasAction = plugin.staticActions || plugin.getDynamicActions
        const clickable = hasAction || plugin.hasOwnProperty("call")
        const extra = {
            className: `plugin-menu-item ${hasAction ? "has-extra-menu" : ""}`,
            style: clickable ? undefined : { color: "#C4C6CC", pointerEvents: "none" },
        }
        return this._liTemplate(plugin.fixedName, plugin.pluginName, plugin.config.HOTKEY, hasAction, null, extra)
    }

    thirdLiTemplate = (act, dynamic) => {
        if (act.act_disabled && !act.act_hint) {
            act.act_hint = this.defaultDisableHint
        }
        const classList = ["plugin-menu-item"]
        if (dynamic) {
            classList.push("plugin-dynamic-act")
        }
        if (act.act_hidden) {
            classList.push("plugin-common-hidden")
        }
        if (act.act_disabled) {
            classList.push("disabled")
        }
        const extra = { "ty-hint": act.act_hint || undefined, className: classList.join(" ") }
        const state = (this.config.SHOW_ACTION_OPTIONS_ICON && act.act_state === undefined)
            ? "state-run"
            : Boolean(act.act_state)
                ? "state-on"
                : "state-off"
        return this._liTemplate(act.act_value, act.act_name, act.act_hotkey, false, state, extra)
    }

    _liTemplate = (key, showName, shortcut, hasExtraMenu, className, extra) => {
        shortcut = this._cleanShortcut(shortcut)
        const hasShortcut = this.supportShortcut && this.config.SHOW_PLUGIN_HOTKEY && shortcut
        const attr = hasExtraMenu
            ? { children: [{ ele: "span", "data-lg": "Menu", text: showName, children: [this.caret()] }] }
            : hasShortcut
                ? { children: [{ ele: "span", text: showName }, { ele: "span", className: "ty-menu-shortcut", text: shortcut }] }
                : { text: showName }
        const children = [{ ele: "a", role: "menuitem", className, "data-lg": "Menu", ...attr }]
        return { ele: "li", "data-key": key, children, ...extra }
    }

    _cleanShortcut = shortcut => {
        if (Array.isArray(shortcut)) {
            shortcut = shortcut[0]
        }
        if (shortcut && typeof shortcut === "string") {
            shortcut = shortcut.split("+").map(e => e[0].toUpperCase() + e.slice(1).toLowerCase()).join("+")
        }
        return shortcut
    }

    ulTemplate = extra => {
        extra.className += " dropdown-menu context-menu ext-context-menu"
        return { ele: "ul", role: "menu", ...extra }
    }

    divider = () => ({ ele: "li", className: "divider" })
    caret = () => ({ ele: "i", className: "fa fa-caret-right" })

    _createElement = templates => {
        return templates.filter(Boolean).map(tpl => {
            const el = document.createElement(tpl.ele || "div")
            for (const [prop, value] of Object.entries(tpl)) {
                if (value == null) continue
                switch (prop) {
                    case "ele":
                        break
                    case "className":
                        el.classList.add(...value.trim().split(/\s+/g))
                        break
                    case "text":
                        el.textContent = value
                        break
                    case "style":
                        Object.assign(el.style, value)
                        break
                    case "children":
                        el.append(...this._createElement(value))
                        break
                    default:
                        el.setAttribute(prop, value)
                }
            }
            return el
        })
    }

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
        menu.append(...this._createElement(templates))
    }

    listen = () => {
        const that = this
        const removeShow = ele => ele.classList.remove("show")
        const removeActive = ele => ele.classList.remove("active")

        // click on the first level menu
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
            // display the second level menu
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

        // Display the third level menu
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
            // call plugins in the second level menu
        }).on("click", "[data-key]", function () {
            const fixedName = this.dataset.key
            const action = this.dataset.value
            if (action) {
                that.callPluginDynamicAction(fixedName, action)
            } else {
                const plugin = that.utils.getPlugin(fixedName)
                // If there is a third level menu, clicking the second level menu is not allowed.
                if (!plugin || plugin.staticActions || plugin.getDynamicActions) {
                    return false
                }
                if (plugin.call) {
                    plugin.call()
                }
            }
            that.hideMenuIfNeed()
        })

        // call plugins in the third level menu
        $(".plugin-menu-third").on("click", "[data-key]", function () {
            // click on the disabled option
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
            File.editor.contextMenu.hide()
            return
        }
        if (key) {
            // refresh third menu
            $(`.plugin-menu-item[data-key="${key}"]`).trigger("mouseenter")
        }
    }

    getDynamicActions = () => this.i18n.fillActions([
        { act_value: "do_not_hide", act_state: this.config.DO_NOT_HIDE, act_hint: this.i18n.t("actHint.do_not_hide") },
        { act_value: "toggle_hotkey", act_state: this.config.SHOW_PLUGIN_HOTKEY, act_hidden: !this.supportShortcut },
        { act_value: "show_action_icon", act_state: this.config.SHOW_ACTION_OPTIONS_ICON },
        { act_value: "find_lost_plugin", act_state: this.config.FIND_LOST_PLUGIN },
        { act_value: "hide_other_options", act_state: this.config.HIDE_OTHER_OPTIONS },
    ])

    call = async action => {
        const callMap = {
            do_not_hide: () => this.config.DO_NOT_HIDE = !this.config.DO_NOT_HIDE,
            hide_other_options: async () => {
                this.config.HIDE_OTHER_OPTIONS = !this.config.HIDE_OTHER_OPTIONS
                await this.utils.styleTemplater.reset(this.fixedName, this.styleTemplate())
            },
            toggle_hotkey: () => {
                this.config.SHOW_PLUGIN_HOTKEY = !this.config.SHOW_PLUGIN_HOTKEY
                const toggle = e => e.classList.toggle("plugin-common-hidden", !this.config.SHOW_PLUGIN_HOTKEY)
                document.querySelectorAll(".plugin-menu-second .ty-menu-shortcut, .plugin-menu-third .ty-menu-shortcut").forEach(toggle)
            },
            find_lost_plugin: async () => {
                this.config.FIND_LOST_PLUGIN = !this.config.FIND_LOST_PLUGIN
                await this.utils.showRestartMessageBox({ title: this.pluginName })
            },
            show_action_icon: async () => {
                this.config.SHOW_ACTION_OPTIONS_ICON = !this.config.SHOW_ACTION_OPTIONS_ICON
                await this.utils.showRestartMessageBox({ title: this.pluginName })
            },
        }
        const fn = callMap[action]
        if (fn) {
            await fn()
        }
    }
}

module.exports = {
    plugin: rightClickMenuPlugin
}
