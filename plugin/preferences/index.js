class PreferencesPlugin extends BasePlugin {
    hotkey = () => [{ hotkey: this.config.HOTKEY, callback: this.call }]

    styleTemplate = () => true

    html = () => `
        <div class="plugin-preferences-dialog plugin-common-hidden">
            <div class="plugin-preferences-content">
                <div class="plugin-preferences-left">
                    <div class="plugin-preferences-search"><input type="text" placeholder="${this.i18n.t("search")}"></div>
                    <div class="plugin-preferences-menu"></div>
                </div>
                <div class="plugin-preferences-right">
                    <div class="plugin-preferences-title"></div>
                    <div class="plugin-preferences-close ion-close-round"></div>
                    <div class="plugin-preferences-main">
                        <fast-form class="plugin-preferences-form" data-plugin="global"></fast-form>
                    </div>
                </div>
            </div>
        </div>`

    init = () => {
        this.fallbackMenu = "global"
        this.menuStorage = this.utils.getStorage(`${this.fixedName}.menu`)
        this.entities = {
            dialog: document.querySelector(".plugin-preferences-dialog"),
            menu: document.querySelector(".plugin-preferences-menu"),
            title: document.querySelector(".plugin-preferences-title"),
            form: document.querySelector(".plugin-preferences-form"),
            main: document.querySelector(".plugin-preferences-main"),
            searchInput: document.querySelector(".plugin-preferences-search input"),
            closeButton: document.querySelector(".plugin-preferences-close"),
        }
        this.SCHEMAS = require("./schemas.js")
        this.WATCHERS = require("./watchers.js")
        this.RULES = require("./rules.js")
        this.ACTIONS = require("./actions.js")(this)
        this.PREPROCESSORS = require("./preprocessors.js")(this)
        this.META = this._getMeta()
        this.applyOptions = this._getHook()
    }

    process = () => {
        const dragAndMove = () => {
            const { dialog, title } = this.entities
            this.utils.dragElement({
                targetEle: title,
                moveEle: dialog,
                onMouseDown: () => {
                    const { transform } = window.getComputedStyle(dialog)
                    if (transform !== "none") {
                        const { left, top } = dialog.getBoundingClientRect()
                        dialog.style.left = `${left}px`
                        dialog.style.top = `${top}px`
                        dialog.style.transform = "none"
                    }
                }
            })
        }
        const searchInDialog = () => {
            let allow = true
            const search = () => {
                if (!allow) return
                const query = this.entities.searchInput.value.trim().toLowerCase()
                this.entities.menu.querySelectorAll(".plugin-preferences-menu-item").forEach((el) => {
                    let fn = "show"
                    if (query) {
                        const hitShowName = el.textContent.toLowerCase().includes(query)
                        const hitFixedName = this.config.SEARCH_PLUGIN_FIXEDNAME && el.dataset.plugin.toLowerCase().includes(query)
                        if (!hitShowName && !hitFixedName) {
                            fn = "hide"
                        }
                    }
                    this.utils[fn](el)
                })
                if (!query) {
                    this.entities.menu.querySelector(".plugin-preferences-menu-item.active")?.scrollIntoView({ block: "center" })
                }
            }
            this.entities.searchInput.addEventListener("input", search)
            this.entities.searchInput.addEventListener("compositionstart", () => allow = false)
            this.entities.searchInput.addEventListener("compositionend", () => {
                allow = true
                search()
            })
        }
        const onEvents = () => {
            this.entities.closeButton.addEventListener("click", () => this.call())
            this.entities.menu.addEventListener("click", async ev => {
                const menu = ev.target.closest(".plugin-preferences-menu-item")?.dataset.plugin
                if (menu) await this.switchMenu(menu)
            })
            this.entities.form.addEventListener("form-crud", async ev => {
                const { key, value, type } = ev.detail
                const handleProperty = this.utils.nestedPropertyHelpers[type]
                if (!handleProperty) return

                const fixedName = this._getCurrentPlugin()
                const settings = await this._getSettings(fixedName)
                handleProperty(settings, key, value)
                await this.utils.settings.handleSettings(fixedName, (_, allSettings) => allSettings[fixedName] = settings)

                this._setDialogState(true)
            })
        }

        dragAndMove()
        searchInDialog()
        onEvents()
    }

    call = async () => {
        const isShow = this.utils.isShow(this.entities.dialog)
        if (isShow) {
            this.entities.searchInput.value = ""
            this.utils.hide(this.entities.dialog)
            if (this._hasDialogChanged()) {
                this._setDialogState(false)
                this.utils.notification.show(this.i18n.t("takesEffectAfterRestart"))
            }
        } else {
            const menu = (this.config.DEFAULT_MENU === "__LAST__") ? this.menuStorage.get() : this.config.DEFAULT_MENU
            await this.showDialog(menu)
            this.utils.show(this.entities.dialog)
        }
    }

    showDialog = async (fixedName) => {
        const plugins = this._getAllPlugins()
        const menus = Object.entries(plugins)
            .filter(([name]) => !this.config.HIDE_MENUS.includes(name))
            .map(([name, pluginName]) => {
                const showName = this.utils.escape(pluginName)
                return `<div class="plugin-preferences-menu-item" data-plugin="${name}">${showName}</div>`
            })
        this.entities.menu.innerHTML = menus.join("")

        const menu = plugins.hasOwnProperty(fixedName) ? fixedName : this.fallbackMenu
        await this.switchMenu(menu)
        requestAnimationFrame(() => this.entities.menu.querySelector(".plugin-preferences-menu-item.active").scrollIntoView({ block: "center" }))
    }

    switchMenu = async (fixedName) => {
        if (this.config.HIDE_MENUS.includes(fixedName)) {
            fixedName = this.fallbackMenu
        }

        const options = await this._getFormOptions(fixedName)
        if (!options) return

        this.entities.form.dataset.plugin = fixedName
        this.entities.form.render(options)
        this.entities.menu.querySelectorAll(".active").forEach(e => e.classList.remove("active"))
        const menuItem = this.entities.menu.querySelector(`.plugin-preferences-menu-item[data-plugin="${fixedName}"]`)
        menuItem.classList.add("active")
        this.entities.title.textContent = menuItem.textContent
        $(this.entities.main).animate({ scrollTop: 0 }, 300)

        this.menuStorage.set(fixedName)
    }

    _getFormOptions = async (fixedName) => {
        const schema = this.SCHEMAS[fixedName]
        if (!schema) return

        const data = await this._preprocess(fixedName)
        return this.applyOptions({
            schema,
            data,
            actions: this.ACTIONS,
            meta: this.META,
            rules: this.RULES[fixedName] || {},
            watchers: this.WATCHERS[fixedName] || {},
            controlOptions: { object: { format: this.config.OBJECT_SETTINGS_FORMAT } },
            fieldDependencyUnmetAction: this.config.DEPENDENCIES_FAILURE_BEHAVIOR,
            boxDependencyUnmetAction: this.config.DEPENDENCIES_FAILURE_BEHAVIOR,
        }, fixedName)
    }

    _getAllPlugins = () => {
        const basePlugins = Object.keys(this.utils.getAllBasePluginSettings())
        const customPlugins = Object.keys(this.utils.getAllCustomPluginSettings())
        const plugins = ["global", ...basePlugins, ...customPlugins]
            .filter(name => this.SCHEMAS.hasOwnProperty(name))
            .map(name => {
                const pluginName = this.utils.tryGetPlugin(name)?.pluginName ?? this.i18n._t(name, "pluginName")
                return [name, pluginName]
            })
        return Object.fromEntries(plugins)
    }

    _getSettings = async (fixedName) => {
        const isBase = this.utils.getBasePluginSetting(fixedName)
        const fn = isBase ? "readBasePluginSettings" : "readCustomPluginSettings"
        const settings = await this.utils.settings[fn]()
        return settings[fixedName]
    }

    _preprocess = async (fixedName) => {
        const data = await this._getSettings(fixedName)
        const pp = this.PREPROCESSORS[fixedName]
        const promises = this.SCHEMAS[fixedName].flatMap(box => {
            return box.fields
                .filter(field => field.key && pp?.[field.key])
                .map(async field => await pp[field.key](field, data, box))
        })
        await Promise.all(promises)
        return data
    }

    _getHook = () => {
        const hook = this.utils.safeEval(this.config.FORM_RENDERING_HOOK)
        return (typeof hook === "function") ? hook : this.utils.identity
    }

    _getMeta = () => ({
        $isBetaTypora: () => this.utils.isBetaVersion,
    })

    _setDialogState = (changed = true) => this.entities.dialog.toggleAttribute("has-changed", changed)
    _hasDialogChanged = () => this.entities.dialog.hasAttribute("has-changed")
    _getCurrentPlugin = () => this.entities.form.dataset.plugin
}

module.exports = {
    plugin: PreferencesPlugin
}
