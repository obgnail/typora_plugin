class preferencesPlugin extends BasePlugin {
    hotkey = () => [{ hotkey: this.config.HOTKEY, callback: this.call }]

    styleTemplate = () => true

    html = () => `
        <div id="plugin-preferences-dialog" class="plugin-common-hidden">
            <div id="plugin-preferences-dialog-content">
                <div id="plugin-preferences-dialog-left">
                    <div id="plugin-preferences-menu-search">
                        <input type="text" placeholder="${this.i18n._t("global", "search")}">
                    </div>
                    <div id="plugin-preferences-menu"></div>
                </div>
                <div id="plugin-preferences-dialog-right">
                    <div id="plugin-preferences-dialog-title"></div>
                    <div id="plugin-preferences-dialog-close" class="ion-close-round"></div>
                    <div id="plugin-preferences-dialog-main">
                        <dialog-form id="plugin-preferences-dialog-form" data-plugin="global"></dialog-form>
                    </div>
                </div>
            </div>
        </div>
    `

    init = () => {
        this.entities = {
            dialog: document.querySelector("#plugin-preferences-dialog"),
            menu: document.querySelector("#plugin-preferences-menu"),
            title: document.querySelector("#plugin-preferences-dialog-title"),
            form: document.querySelector("#plugin-preferences-dialog-form"),
            main: document.querySelector("#plugin-preferences-dialog-main"),
            searchInput: document.querySelector("#plugin-preferences-menu-search input"),
            closeButton: document.querySelector("#plugin-preferences-dialog-close"),
        }

        this.SETTING_OPERATORS = {
            has: (setting, key) => {
                if (key === undefined) {
                    return false
                }
                const emptyObj = Object.create(null)
                const result = key.split(".").reduce((obj, attr) => Object.hasOwn(obj, attr) ? obj[attr] : emptyObj, setting)
                return result !== emptyObj
            },
            handle: (setting, key, handler) => {
                if (key === undefined) return
                const attrs = key.split(".")
                const last = attrs.pop()
                const obj = attrs.length === 0
                    ? setting
                    : attrs.reduce((obj, attr) => obj[attr], setting)
                handler(obj, last, key)
            },
            get: (setting, key) => key === undefined ? undefined : key.split(".").reduce((obj, attr) => obj[attr], setting),
            set: (setting, key, newValue) => this.SETTING_OPERATORS.handle(setting, key, (obj, last) => obj[last] = newValue),
            push: (setting, key, pushValue) => this.SETTING_OPERATORS.handle(setting, key, (obj, last) => obj[last].push(pushValue)),
            remove: (setting, key, removeValue) => this.SETTING_OPERATORS.handle(setting, key, (obj, last) => {
                const idx = obj[last].indexOf(removeValue)
                if (idx !== -1) {
                    obj[last].splice(idx, 1)
                }
            }),
        }
        // Callback functions for type="action" options in schema
        this.SETTING_ACTIONS = {
            visitRepo: () => this.utils.openUrl("https://github.com/obgnail/typora_plugin"),
            backupSettings: async () => this.utils.settings.backupSettingFile(),
            openSettingsFolder: async () => this.utils.settings.openSettingFolder(),
            articleUploaderReadme: async () => this.utils.showInFinder(this.utils.joinPath("./plugin/article_uploader/README.md")),
            restoreSettings: async () => {
                const fixedName = this.entities.form.dataset.plugin
                await this.utils.settings.clearSettings(fixedName)
                await this.switchMenu(fixedName)
                this.utils.notification.show(this.i18n.t("notification.settingsRestored"))
            },
            restoreAllSettings: async () => {
                const fixedName = this.entities.form.dataset.plugin
                await this.utils.settings.clearAllSettings()
                await this.switchMenu(fixedName)
                this.utils.notification.show(this.i18n.t("notification.allSettingsRestored"))
            },
            updatePlugin: async () => {
                const updater = this.utils.getPlugin("updater")
                if (!updater) {
                    const plugin = this.i18n._t("updater", "pluginName")
                    const msg = this.i18n._t("global", "error.pluginDisabled", { plugin })
                    this.utils.notification.show(msg, "error")
                } else {
                    await updater.call()
                }
            },
        }
        // External value for some options in schema
        this.SETTING_VALUES = {
            pluginVersion: async () => this.utils.getPluginVersion(),
        }

        this._initSchemas()
        this._initForm()
    }

    process = () => {
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
                    const active = this.entities.menu.querySelector(".plugin-preferences-menu-item.active")
                    if (active) {
                        active.scrollIntoView({ block: "center" })
                    }
                }
            }
            this.entities.searchInput.addEventListener("input", search)
            this.entities.searchInput.addEventListener("compositionstart", () => allow = false)
            this.entities.searchInput.addEventListener("compositionend", () => {
                allow = true
                search()
            })
        }
        const domEvents = () => {
            // this.utils.dragFixedModal(this.entities.title, this.entities.dialog, false)
            this.entities.closeButton.addEventListener("click", () => {
                this.call()
                this.utils.notification.show(this.i18n._t("global", "takesEffectAfterRestart"))
            })
            this.entities.menu.addEventListener("click", async ev => {
                const target = ev.target.closest(".plugin-preferences-menu-item")
                if (target) {
                    const fixedName = target.dataset.plugin
                    await this.switchMenu(fixedName)
                }
            })
        }
        const formEvents = () => {
            this.entities.form.addEventListener("form-event", async ev => {
                const { key, value, type = "set" } = ev.detail
                if (this.SETTING_OPERATORS.hasOwnProperty(type)) {
                    const fixedName = this.entities.form.dataset.plugin
                    const settings = await this._getSettings(fixedName)
                    this.SETTING_OPERATORS[type](settings, key, value)
                    await this.utils.settings.saveSettings(fixedName, settings)
                } else if (type === "action" && this.SETTING_ACTIONS.hasOwnProperty(key)) {
                    const fn = this.SETTING_ACTIONS[key]
                    if (fn) {
                        await fn()
                    }
                }
            })
        }

        searchInDialog()
        domEvents()
        formEvents()
    }

    call = async () => {
        const isShow = this.utils.isShow(this.entities.dialog)
        if (isShow) {
            this.utils.hide(this.entities.dialog)
        } else {
            await this.showDialog(this.config.DEFAULT_MENU)
            this.utils.show(this.entities.dialog)
        }
    }

    showDialog = async (showMenu) => {
        const names = [
            "global",
            ...Object.keys(this.utils.getAllPluginSettings()),
            ...Object.keys(this.utils.getAllCustomPluginSettings())
        ]
        const menus = names
            .filter(name => this.SETTING_SCHEMAS.hasOwnProperty(name))
            .map(name => {
                const p = this.utils.tryGetPlugin(name)
                const pluginName = p ? p.pluginName : this.i18n._t(name, "pluginName")
                const showName = this.utils.escape(pluginName)
                return `<div class="plugin-preferences-menu-item" data-plugin="${name}">${showName}</div>`
            })
        this.entities.menu.innerHTML = menus.join("")

        showMenu = names.includes(showMenu) ? showMenu : "global"
        await this.switchMenu(showMenu)
        setTimeout(() => {
            const active = this.entities.menu.querySelector(".plugin-preferences-menu-item.active")
            active.scrollIntoView({ block: "center" })
        }, 50)
    }

    switchMenu = async (fixedName) => {
        const settings = await this._getSettings(fixedName)
        const values = await this._getSettingsValues(fixedName, settings)
        this.entities.form.dataset.plugin = fixedName
        this.entities.form.render(this.SETTING_SCHEMAS[fixedName], values)
        this.entities.title.textContent = this.i18n._t(fixedName, "pluginName")
        this.entities.menu.querySelectorAll(".plugin-preferences-menu-item").forEach(e => e.classList.remove("active"))
        this.entities.menu.querySelector(`.plugin-preferences-menu-item[data-plugin="${fixedName}"]`).classList.add("active")
        $(this.entities.main).animate({ scrollTop: 0 }, 300)
    }

    _getSettings = async (fixedName) => {
        const isBase = this.utils.getPluginSetting(fixedName)
        const fn = isBase ? "readBasePluginSettings" : "readCustomPluginSettings"
        const settings = await this.utils.settings[fn]()
        return settings[fixedName]
    }

    _getSettingsValues = async (fixedName, settings) => {
        const keys = this.SETTING_SCHEMAS[fixedName].flatMap(box => {
            return box.fields.filter(item => Boolean(item.key)).map(item => item.key)
        })
        const promises = keys.map(async key => {
            let val = await this.SETTING_OPERATORS.get(settings, key)
            if (val == null && this.SETTING_VALUES.hasOwnProperty(key)) {
                val = await this.SETTING_VALUES[key](key, settings)
            }
            return [key, val]
        })
        const entries = await Promise.all(promises)
        return Object.fromEntries(entries)
    }

    _initForm = () => this.entities.form.init(this.utils, { objectFormat: this.config.OBJECT_SETTINGS_FORMAT })

    _initSchemas = () => {
        this.SETTING_SCHEMAS = require("./schemas.js")
        const i18nData = this.i18n.noConflict.data
        const properties = ["label", "tooltip", "placeholder"]
        const common = Object.fromEntries(
            [...properties, "title", "unit"].map(prop => {
                const value = this.utils.pickBy(i18nData.settings, (val, key) => key.startsWith(`$${prop}.`))
                return [prop, value]
            })
        )
        Object.entries(this.SETTING_SCHEMAS).forEach(([fixedName, boxes]) => {
            const settingI18N = i18nData[fixedName]
            boxes.forEach(box => {
                const t = box.title
                if (t) {
                    const commonValue = common.title[t]
                    const pluginValue = settingI18N[t]
                    box.title = commonValue || pluginValue
                }
                box.fields.forEach(field => {
                    properties.forEach(prop => {
                        const key = field[prop]
                        if (key != null) {
                            const commonValue = common[prop][key]
                            const pluginValue = settingI18N[key]
                            field[prop] = commonValue || pluginValue
                        }
                    })
                    if (field.options != null) {
                        const ops = field.options
                        Object.keys(ops).forEach(k => {
                            const i18nKey = ops[k]
                            field.options[k] = settingI18N[i18nKey]
                        })
                    }
                    if (field.unit != null) {
                        field.unit = common.unit[field.unit]
                    }
                })
            })
        })
    }
}

module.exports = {
    plugin: preferencesPlugin
}
