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
        this._initActionHandlers()
        this._initPreProcessors()
        this._initPostProcessors()
        this._initSchemas()
        this._initDialogForm()
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
            this.entities.form.addEventListener("form-curd", async ev => {
                const { key, value, type = "set" } = ev.detail
                const propHandler = this.utils.nestedPropertyHelpers[type]
                if (propHandler) {
                    const fixedName = this.entities.form.dataset.plugin
                    const settings = await this._getSettings(fixedName)
                    propHandler(settings, key, value)
                    await this.utils.settings.saveSettings(fixedName, settings)
                    const postFn = this.POSTPROCESSORS[`${fixedName}.${key}`]
                    if (postFn) {
                        await postFn(value, settings)
                    }
                    return
                }
                const actionHandler = type === "action" && this.ACTION_HANDLERS[key]
                if (actionHandler) {
                    await actionHandler()
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
        const plugins = this._getAllPlugins()
        const menus = Object.entries(plugins).map(([name, pluginName]) => {
            const showName = this.utils.escape(pluginName)
            return `<div class="plugin-preferences-menu-item" data-plugin="${name}">${showName}</div>`
        })
        this.entities.menu.innerHTML = menus.join("")
        showMenu = plugins.hasOwnProperty(showMenu) ? showMenu : "global"
        await this.switchMenu(showMenu)
        setTimeout(() => {
            const active = this.entities.menu.querySelector(".plugin-preferences-menu-item.active")
            active.scrollIntoView({ block: "center" })
        }, 50)
    }

    switchMenu = async (fixedName) => {
        const settings = await this._getSettings(fixedName)
        const values = await this._preprocess(fixedName, settings)
        this.entities.form.dataset.plugin = fixedName
        this.entities.form.render(this.SETTING_SCHEMAS[fixedName], values)
        this.entities.menu.querySelectorAll(".active").forEach(e => e.classList.remove("active"))
        const menuItem = this.entities.menu.querySelector(`.plugin-preferences-menu-item[data-plugin="${fixedName}"]`)
        menuItem.classList.add("active")
        this.entities.title.textContent = menuItem.textContent
        $(this.entities.main).animate({ scrollTop: 0 }, 300)
    }

    _getAllPlugins = () => {
        const names = [
            "global",
            ...Object.keys(this.utils.getAllPluginSettings()),
            ...Object.keys(this.utils.getAllCustomPluginSettings())
        ]
        const plugins = names
            .filter(name => this.SETTING_SCHEMAS.hasOwnProperty(name))
            .map(name => {
                const p = this.utils.tryGetPlugin(name)
                const pluginName = p ? p.pluginName : this.i18n._t(name, "pluginName")
                return [name, pluginName]
            })
        return Object.fromEntries(plugins)
    }

    _getSettings = async (fixedName) => {
        const isBase = this.utils.getPluginSetting(fixedName)
        const fn = isBase ? "readBasePluginSettings" : "readCustomPluginSettings"
        const settings = await this.utils.settings[fn]()
        return settings[fixedName]
    }

    _preprocess = async (fixedName, values) => {
        const fnMap = this.PREPROCESSORS
        await Promise.all(
            this.SETTING_SCHEMAS[fixedName].flatMap(box => {
                return box.fields
                    .filter(field => field.key && fnMap.hasOwnProperty(`${fixedName}.${field.key}`))
                    .map(async field => await fnMap[`${fixedName}.${field.key}`](field, values))
            })
        )
        return values
    }

    _initDialogForm = () => this.entities.form.init(this.utils, { objectFormat: this.config.OBJECT_SETTINGS_FORMAT })

    /** Will NOT modify the schemas structure, just i18n */
    _translateSchema = (schemas) => {
        const specialProps = ["options", "thMap"]
        const baseProps = ["label", "tooltip", "placeholder"]
        const commonProps = [...baseProps, "title", "unit"]

        const i18nData = this.i18n.noConflict.data
        const commonI18N = Object.fromEntries(
            commonProps.map(prop => {
                const val = this.utils.pickBy(i18nData.settings, (val, key) => key.startsWith(`$${prop}.`))
                return [prop, val]
            })
        )

        const translateFieldBaseProps = (field, pluginI18N) => {
            baseProps.forEach(prop => {
                const propVal = field[prop]
                if (propVal != null) {
                    const commonVal = commonI18N[prop][propVal]
                    const pluginVal = pluginI18N[propVal]
                    field[prop] = commonVal || pluginVal
                }
            })
        }
        const translateFieldSpecialProps = (field, pluginI18N) => {
            specialProps.forEach(prop => {
                const propVal = field[prop]
                if (propVal != null) {
                    Object.keys(propVal).forEach(k => {
                        const i18nKey = propVal[k]
                        propVal[k] = pluginI18N[i18nKey]
                    })
                }
            })
        }
        const translateFieldNestedBoxesProp = (field, pluginI18N) => {
            if (field.nestedBoxes != null) {
                field.nestedBoxes.forEach(box => translateBox(box, pluginI18N))
            }
        }
        const translateFieldUnitProp = (field) => {
            if (field.unit != null) {
                field.unit = commonI18N.unit[field.unit]
            }
        }
        const translateBox = (box, pluginI18N) => {
            const t = box.title
            if (t) {
                const commonVal = commonI18N.title[t]
                const pluginVal = pluginI18N[t]
                box.title = commonVal || pluginVal
            }
            box.fields.forEach(field => {
                translateFieldBaseProps(field, pluginI18N)
                translateFieldSpecialProps(field, pluginI18N)
                translateFieldNestedBoxesProp(field, pluginI18N)
                translateFieldUnitProp(field)
            })
        }

        Object.entries(schemas).forEach(([fixedName, boxes]) => {
            const pluginI18N = i18nData[fixedName]
            boxes.forEach(box => translateBox(box, pluginI18N))
        })
    }

    _removeDependencies = (obj) => {
        if (obj == null || typeof obj !== "object") return

        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                if (key === "dependencies") {
                    delete obj[key]
                } else if (typeof obj[key] === "object") {
                    this._removeDependencies(obj[key])
                }
            }
        }
    }

    _initSchemas = () => {
        this.SETTING_SCHEMAS = require("./schemas.js")

        this._translateSchema(this.SETTING_SCHEMAS)
        if (this.config.IGNORE_CONFIG_DEPENDENCIES) {
            this._removeDependencies(this.SETTING_SCHEMAS)
        }
    }

    /** Callback functions for type="action" settings in schema */
    _initActionHandlers = () => {
        this.ACTION_HANDLERS = {
            visitRepo: () => this.utils.openUrl("https://github.com/obgnail/typora_plugin"),
            deepWiki: () => this.utils.openUrl("https://deepwiki.com/obgnail/typora_plugin"),
            assistWithTranslations: () => this.utils.openUrl("https://github.com/obgnail/typora_plugin/tree/master/plugin/global/locales"),
            viewMarkdownlintRules: () => this.utils.openUrl("https://github.com/DavidAnson/markdownlint/blob/main/doc/Rules.md"),
            chooseEchartsRenderer: () => this.utils.openUrl("https://echarts.apache.org/handbook/en/best-practices/canvas-vs-svg/"),
            viewArticleUploaderReadme: () => this.utils.showInFinder(this.utils.joinPath("./plugin/article_uploader/README.md")),
            backupSettings: async () => this.utils.settings.backupSettingFile(),
            openSettingsFolder: async () => this.utils.settings.openSettingFolder(),
            restoreSettings: async () => {
                const fixedName = this.entities.form.dataset.plugin
                await this.utils.settings.clearSettings(fixedName)
                await this.switchMenu(fixedName)
                this.utils.notification.show(this.i18n._t("global", "notification.settingsRestored"))
            },
            restoreAllSettings: async () => {
                const fixedName = this.entities.form.dataset.plugin
                await this.utils.settings.clearAllSettings()
                await this.switchMenu(fixedName)
                this.utils.notification.show(this.i18n._t("global", "notification.allSettingsRestored"))
            },
            runtimeSettings: async () => {
                const fixedName = this.entities.form.dataset.plugin
                const settings = await this._getSettings(fixedName)
                const title = this.i18n._t("settings", "$label.runtimeSettings") + `（${this.i18n._t("global", "readonly")}）`
                const schema = [{ fields: [{ key: "runtimeSettings", type: "textarea", rows: 15 }] }]
                const data = { runtimeSettings: JSON.stringify(settings, null, "\t") }
                await this.utils.formDialog.modal(title, schema, data)
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
    }

    /** PreProcessors for specific settings in schema */
    _initPreProcessors = () => {
        const _disableOption = (options, targetOption) => Object.defineProperty(options, targetOption, { enumerable: false })
        const _incompatibleSwitch = (field, values, tooltip = this.i18n._t("settings", "$tooltip.lowVersion")) => {
            field.disabled = true
            field.tooltip = tooltip
            values[field.key] = false
        }
        this.PREPROCESSORS = {
            "global.pluginVersion": async (field, values) => {
                if (!values[field.key]) {
                    let version = "Unknown"
                    try {
                        const file = this.utils.joinPath("./plugin/bin/version.json")
                        const json = await this.utils.Package.FsExtra.readJson(file)
                        version = json.tag_name
                    } catch (e) {
                        console.error(e)
                    }
                    values[field.key] = version
                }
            },
            "window_tab.LAST_TAB_CLOSE_ACTION": (field, values) => {
                if (this.utils.isBetaVersion) {
                    const illegalOption = "blankPage"
                    _disableOption(field.options, illegalOption)
                    if (values[field.key] === illegalOption) {
                        values[field.key] = "reconfirm"
                    }
                }
            },
            "fence_enhance.ENABLE_INDENT": (field, values) => {
                if (this.utils.isBetaVersion) {
                    _incompatibleSwitch(field, values)
                }
            },
            "blur.ENABLE": (field, values) => {
                if (!this.utils.supportHasSelector) {
                    _incompatibleSwitch(field, values)
                }
            },
            "export_enhance.ENABLE": (field, values) => {
                if (!this.utils.exportHelper.isAsync) {
                    _incompatibleSwitch(field, values)
                }
            },
            "markmap.AUTO_COLLAPSE_PARAGRAPH_WHEN_FOLD": (field, values) => {
                if (!this.utils.getPlugin("collapse_paragraph")) {
                    _incompatibleSwitch(field, values, this.i18n._t("markmap", "$tooltip.experimental"))
                }
            },
            "reopenClosedFiles.enable": (field, values) => {
                if (!this.utils.getPlugin("window_tab")) {
                    _incompatibleSwitch(field, values, this.i18n._t("reopenClosedFiles", "$tooltip.dependOnWindowTab"))
                }
            },
            "preferences.DEFAULT_MENU": (field, values) => {
                if (!field.options) {
                    field.options = this._getAllPlugins()
                }
            },
        }
    }

    /** PostProcessors for specific settings in schema */
    _initPostProcessors = () => {
        this.POSTPROCESSORS = {}
    }
}

module.exports = {
    plugin: preferencesPlugin
}
