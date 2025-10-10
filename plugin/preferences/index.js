class preferencesPlugin extends BasePlugin {
    hotkey = () => [{ hotkey: this.config.HOTKEY, callback: this.call }]

    styleTemplate = () => true

    html = () => `
        <div class="plugin-preferences-dialog plugin-common-hidden">
            <div class="plugin-preferences-content">
                <div class="plugin-preferences-left">
                    <div class="plugin-preferences-search">
                        <input type="text" placeholder="${this.i18n._t("global", "search")}">
                    </div>
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
        </div>
    `

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
        this._initHook()
        this._initActionHandlers()
        this._initPreProcessors()
        this._initPostProcessors()
        this._initSchemas()
        this._initRules()
        this._initWatchers()
    }

    process = () => {
        const dragAndMove = () => {
            const { dialog, title } = this.entities
            this.utils.dragElement({
                targetEle: title,
                moveEle: dialog,
                onMouseDown: () => {
                    title.classList.add("dragging")
                    const { transform } = window.getComputedStyle(dialog)
                    if (transform !== "none") {
                        const { left, top } = dialog.getBoundingClientRect()
                        dialog.style.left = `${left}px`
                        dialog.style.top = `${top}px`
                        dialog.style.transform = "none"
                    }
                },
                onMouseUp: () => title.classList.remove("dragging"),
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
        const onEvents = () => {
            this.entities.closeButton.addEventListener("click", () => this.call())
            this.entities.menu.addEventListener("click", async ev => {
                const target = ev.target.closest(".plugin-preferences-menu-item")
                if (target) {
                    const fixedName = target.dataset.plugin
                    await this.switchMenu(fixedName)
                }
            })
            this.entities.form.addEventListener("form-crud", async ev => {
                const { key, value } = ev.detail
                const fixedName = this.entities.form.dataset.plugin
                const settings = await this._getSettings(fixedName)
                this.utils.nestedPropertyHelpers.set(settings, key, value)
                await this.utils.settings.saveSettings(fixedName, settings)

                this._setDialogState(true)

                const postFn = this.POSTPROCESSORS[`${fixedName}.${key}`]
                if (postFn) {
                    await postFn(value, settings)
                }
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
                this.utils.notification.show(this.i18n._t("global", "takesEffectAfterRestart"))
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
        setTimeout(() => {
            const active = this.entities.menu.querySelector(".plugin-preferences-menu-item.active")
            active.scrollIntoView({ block: "center" })
        }, 50)
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
        const schema = this.SETTING_SCHEMAS[fixedName]
        if (!schema) return

        const data = await this._preprocess(fixedName)
        return this.editOptions({
            schema,
            data,
            actions: this.ACTION_HANDLERS,
            // rules: this.VALIDATION_RULES[fixedName] || {},
            watchers: this.WATCHERS[fixedName] || {},
            controlOptions: { object: { format: this.config.OBJECT_SETTINGS_FORMAT } },
            disableEffect: this.config.DEPENDENCIES_FAILURE_BEHAVIOR,
        })
    }

    _getAllPlugins = () => {
        const names = [
            "global",
            ...Object.keys(this.utils.getAllBasePluginSettings()),
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
        const isBase = this.utils.getBasePluginSetting(fixedName)
        const fn = isBase ? "readBasePluginSettings" : "readCustomPluginSettings"
        const settings = await this.utils.settings[fn]()
        return settings[fixedName]
    }

    _preprocess = async (fixedName) => {
        const preprocessors = this.PREPROCESSORS
        const settings = await this._getSettings(fixedName)
        const promises = this.SETTING_SCHEMAS[fixedName].flatMap(box => {
            return box.fields
                .filter(field => field.key && preprocessors.hasOwnProperty(`${fixedName}.${field.key}`))
                .map(async field => await preprocessors[`${fixedName}.${field.key}`](field, settings, box))
        })
        await Promise.all(promises)
        return settings
    }

    /** Will NOT modify the schemas structure, just i18n */
    _translateSchema = (schemas) => {
        const specialProps = ["options", "thMap"]
        const baseProps = ["label", "tooltip", "placeholder", "hintHeader", "hintDetail"]
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

    _initSchemas = () => {
        this.SETTING_SCHEMAS = require("./schemas.js")
        this._translateSchema(this.SETTING_SCHEMAS)
    }

    _initRules = () => {
        this.VALIDATION_RULES = this.config.VALIDATE_CONFIG_OPTIONS ? require("./rules.js") : {}
    }

    _initWatchers = () => {
        this.WATCHERS = require("./watchers.js")
    }

    _setDialogState = (changed = true) => this.entities.dialog.toggleAttribute("has-changed", changed)
    _hasDialogChanged = () => this.entities.dialog.hasAttribute("has-changed")

    _initHook = () => {
        const fn = this.utils.safeEval(this.config.FORM_RENDERING_HOOK)
        this.editOptions = (typeof fn === "function") ? fn : this.utils.identity
    }

    /** Callback functions for type="action" fields in schema */
    _initActionHandlers = () => {
        const consecutive = (onConfirmed) => this.utils.createConsecutiveAction({ threshold: 3, timeWindow: 3000, onConfirmed })

        this.ACTION_HANDLERS = {
            visitRepo: () => this.utils.openUrl("https://github.com/obgnail/typora_plugin"),
            viewDeepWiki: () => this.utils.openUrl("https://deepwiki.com/obgnail/typora_plugin"),
            githubImageBed: () => this.utils.openUrl("https://github.com/obgnail/typora_image_uploader"),
            sendEmail: () => this.utils.sendEmail("he1251698542@gmail.com", "Feedback"),
            viewMarkdownlintRules: () => this.utils.openUrl("https://github.com/DavidAnson/markdownlint/blob/main/doc/Rules.md"),
            viewCustomMarkdownlintRules: () => this.utils.openUrl("https://github.com/obgnail/markdownlint-custom-rules"),
            viewCodeMirrorKeymapsManual: () => this.utils.openUrl("https://codemirror.net/5/doc/manual.html#keymaps"),
            viewVitePressLineHighlighting: ()=> this.utils.openUrl("https://vitepress.dev/guide/markdown#line-highlighting-in-code-blocks"),
            viewAbcVisualOptionsHelp: () => this.utils.openUrl("https://paulrosen.github.io/abcjs/visual/render-abc-options.html"),
            chooseEchartsRenderer: () => this.utils.openUrl("https://echarts.apache.org/handbook/en/best-practices/canvas-vs-svg/"),
            viewArticleUploaderReadme: () => this.utils.showInFinder(this.utils.joinPath("./plugin/article_uploader/README.md")),
            viewJsonRPCReadme: () => this.utils.showInFinder(this.utils.joinPath("./plugin/json_rpc/README.md")),
            editStyles: () => this.utils.showInFinder(this.utils.joinPath("./plugin/global/user_styles/README.md")),
            developPlugins: () => this.utils.showInFinder(this.utils.joinPath("./plugin/custom/README.md")),
            openPluginFolder: () => this.utils.showInFinder(this.utils.joinPath("./plugin")),
            backupSettings: async () => this.utils.settings.backupSettingFile(),
            openSettingsFolder: async () => this.utils.settings.openSettingFolder(),
            invokeMarkdownLintSettings: async () => this.utils.callPluginFunction("markdownLint", "settings"),
            restoreSettings: consecutive(async () => {
                const fixedName = this.entities.form.dataset.plugin
                await this.utils.settings.clearSettings(fixedName)
                await this.switchMenu(fixedName)
                this._setDialogState(true)
                this.utils.notification.show(this.i18n._t("global", "success.restore"))
            }),
            restoreAllSettings: consecutive(async () => {
                const fixedName = this.entities.form.dataset.plugin
                await this.utils.settings.clearAllSettings()
                await this.switchMenu(fixedName)
                this._setDialogState(true)
                this.utils.notification.show(this.i18n._t("global", "success.restoreAll"))
            }),
            runtimeSettings: async () => {
                const fixedName = this.entities.form.dataset.plugin
                const settings = await this._getSettings(fixedName)
                const op = {
                    title: this.i18n._t("settings", "$label.runtimeSettings") + `（${this.i18n._t("global", "readonly")}）`,
                    schema: [{ fields: [{ key: "runtimeSettings", type: "textarea", readonly: true, rows: 14 }] }],
                    data: { runtimeSettings: JSON.stringify(settings, null, "\t") },
                }
                await this.utils.formDialog.modal(op)
            },
            updatePlugin: async () => {
                const updater = this.utils.getBasePlugin("updater")
                if (!updater) {
                    const plugin = this.i18n._t("updater", "pluginName")
                    const msg = this.i18n._t("global", "error.pluginDisabled", { plugin })
                    this.utils.notification.show(msg, "error")
                } else {
                    await updater.call()
                }
            },
            uninstallPlugin: async () => {
                const uninstall = async () => {
                    const { FsExtra } = this.utils.Package
                    const remove = '<script src="./plugin/index.js" defer="defer"></script>'
                    const windowHTML = this.utils.joinPath("./window.html")
                    const pluginFolder = this.utils.joinPath("./plugin")
                    try {
                        const content = await FsExtra.readFile(windowHTML, "utf-8")
                        const newContent = content.replace(remove, "")
                        await FsExtra.writeFile(windowHTML, newContent)
                        await FsExtra.remove(pluginFolder)
                    } catch (e) {
                        alert(e.toString())
                        return
                    }
                    const message = this.i18n._t("global", "success.uninstall")
                    const confirm = this.i18n._t("global", "confirm")
                    const op = { type: "info", title: "typora plugin", message, buttons: [confirm] }
                    await this.utils.showMessageBox(op)
                    this.utils.restartTypora(false)
                }

                const title = this.i18n._t("global", "$label.uninstallPlugin")
                const hintHeader = this.i18n._t("global", "uninstallPluginWarning")
                const hintDetail = this.i18n._t("global", "uninstallPluginDetail", { reconfirm: title })
                const label = this.i18n._t("global", "uninstallPluginConfirmInput")
                const op = {
                    title,
                    schema: [
                        { fields: [{ type: "hint", hintHeader, hintDetail }] },
                        { fields: [{ type: "text", key: "confirmInput", label, placeholder: title }] },
                    ],
                    data: { confirmInput: "" },
                }
                const { response, data } = await this.utils.formDialog.modal(op)
                if (response === 0) return
                if (data.confirmInput !== title) {
                    const msg = this.i18n._t("global", "error.incorrectCommand")
                    this.utils.notification.show(msg, "error")
                } else {
                    await uninstall()
                }
            },
            donate: async () => {
                const WeChatPay = "8-RWSVREYNE9TCVADDKEGVPNJ1KGAYNZ31KENF2LWDEA3KFHHDRWYEPA4F00KSZT3454M24RD5PVVM21AAJ5DAGMQ3H62CHEQOOT226D49LZR6G1FKOG0G7NUV5GR2HD2B6V3V8DHR2S8027S36ESCU3GJ0IAE7IY9S25URTMZQCZBY8ZTHFTQ45VVGFX3VD1SE9K4Y9K7I1Y7U4FIKZSS2Y87BH4OSASYLS48A6SR2T5YZJNMJ2WCQE0ZBK9OVLGWGWGL1ED400U1BYMZRW7UAS7VECNVL98WKG4PNIF0KFNIVS45KHQXJFH9E9SYRCWYRUX45Q37"
                const AliPay = "9-CF07WK7ZZ6CKLVC5KX92LZGUL3X93E51RYAL92NHYVQSD6CAH4D1DTCENAJ8HHB0062DU7LS29Q8Y0NT50M8XPFP9N1QE1JPFW39U0CDP2UX9H2WLEYD712FI3C5657LIWMT7K5CCVL509G04FT4N0IJD3KRAVBDM76CWI81XY77LLSI2AZ668748L62IC4E8CYYVNBG4Z525HZ4BXQVV6S81JC0CVABEACU597FNP9OHNC959X4D29MMYXS1V5MWEU8XC4BD5WSLL29VSAQOGLBWAVVTMX75DOSRF78P9LARIJ7J50IK1MM2QT5UXU5Q1YA7J2AVVHMG00E06Q80RCDXVGOFO76D1HCGYKW93MXR5X4H932TYXAXL93BYWV9UH6CTDUDFWACE5G0OM9N"
                const qrCodeList = [{ label: "WeChat Pay", color: "#1AAD19", compressed: WeChatPay }, { label: "AliPay", color: "#027AFF", compressed: AliPay }]
                const qrCodeSize = 140

                const _decompress = (compressed) => {
                    const [chunk, raw] = compressed.split("-", 2)
                    const rows = raw.match(new RegExp(`\\w{${chunk}}`, "g"))
                    return rows.map(r => parseInt(r, 36).toString(2).padStart(rows.length, "0"))
                }
                const _toSVG = (compressed, fillColor, size) => {
                    const table = _decompress(compressed)
                    const numModules = table.length
                    const moduleSize = (size / numModules).toFixed(2)
                    const paths = []
                    for (let rIdx = 0; rIdx < numModules; rIdx++) {
                        for (let cIdx = 0; cIdx < numModules; cIdx++) {
                            if (table[rIdx][cIdx] === "1") {
                                const x = (cIdx * moduleSize).toFixed(2)
                                const y = (rIdx * moduleSize).toFixed(2)
                                paths.push(`M${x},${y}h${moduleSize}v${moduleSize}h${-moduleSize}Z`)
                            }
                        }
                    }
                    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><path d="${paths.join("")}" fill="${fillColor}" /></svg>`
                }

                const qrs = qrCodeList.map(qr => {
                    const svg = _toSVG(qr.compressed, qr.color, qrCodeSize)
                    return `<div style="display: flex; flex-direction: column; align-items: center">${svg}<div style="font-weight: bold">${qr.label}</div></div>`
                })
                const content = `<div style="display: flex; justify-content: space-evenly; padding-top: 8px">${qrs.join("")}</div>`
                const op = {
                    title: this.i18n._t("global", "$label.donate"),
                    schema: [
                        { fields: [{ type: "action", key: "starMe", label: "<b>Star this project on GitHub</b>" }] },
                        { fields: [{ type: "custom", content: content, unsafe: true }] },
                    ],
                    actions: {
                        starMe: this.ACTION_HANDLERS.visitRepo,
                    }
                }
                await this.utils.formDialog.modal(op)
            },
        }
    }

    /** PreProcessors for specific settings in schema */
    _initPreProcessors = () => {
        const _disableOption = (options, targetOption) => Object.defineProperty(options, targetOption, { enumerable: false })
        const _incompatibleSwitch = (field, settings, tooltip = this.i18n._t("settings", "$tooltip.lowVersion")) => {
            field.disabled = true
            field.tooltip = tooltip
            settings[field.key] = false
        }
        this.PREPROCESSORS = {
            "global.pluginVersion": async (field, data) => {
                if (!data[field.key]) {
                    let version = "Unknown"
                    try {
                        const file = this.utils.joinPath("./plugin/bin/version.json")
                        const json = await this.utils.Package.FsExtra.readJson(file)
                        version = json.tag_name
                    } catch (e) {
                        console.error(e)
                    }
                    data[field.key] = version
                }
            },
            "window_tab.LAST_TAB_CLOSE_ACTION": (field, data) => {
                if (this.utils.isBetaVersion) {
                    const invalidOption = "blankPage"
                    _disableOption(field.options, invalidOption)
                    if (data[field.key] === invalidOption) {
                        data[field.key] = "reconfirm"
                    }
                }
            },
            "read_only.REMAIN_AVAILABLE_MENU_KEY": (field) => {
                if (!field.options) {
                    const all = [...document.querySelectorAll(".context-menu:not(.ext-context-menu) [data-key]")]
                    const entries = all.map(op => {
                        const key = op.dataset.key
                        if (!key) return
                        let hint
                        if (op.classList.contains("menu-style-btn")) {
                            hint = (op.getAttribute("ty-hint") || "").split("\t")[0] || key
                        } else {
                            const menu = op.querySelector('[data-lg="Menu"]')
                            hint = menu ? menu.textContent.trim() : key
                        }
                        return [key, hint]
                    }).filter(Boolean)
                    field.options = Object.fromEntries(entries)
                }
            },
            "fence_enhance.ENABLE_INDENT": (field, data) => {
                if (this.utils.isBetaVersion) {
                    _incompatibleSwitch(field, data)
                }
            },
            "fence_enhance.PRELOAD_ALL_FENCES": (field, data) => {
                if (!File.hasOwnProperty("loadFile")) {
                    _incompatibleSwitch(field, data)
                }
            },
            "blur.ENABLE": (field, data) => {
                if (!this.utils.supportHasSelector) {
                    _incompatibleSwitch(field, data)
                }
            },
            "export_enhance.ENABLE": (field, data) => {
                if (!this.utils.exportHelper.isAsync) {
                    _incompatibleSwitch(field, data)
                }
            },
            "markmap.AUTO_COLLAPSE_PARAGRAPH_WHEN_FOLD": (field, data) => {
                if (!this.utils.getBasePlugin("collapse_paragraph")) {
                    _incompatibleSwitch(field, data, this.i18n._t("markmap", "$tooltip.experimental"))
                }
            },
            "preferences.DEFAULT_MENU": (field) => {
                if (!field.options) {
                    field.options = { __LAST__: this.i18n._t("global", "lastUsed"), ...this._getAllPlugins() }
                }
            },
            "preferences.HIDE_MENUS": (field) => {
                if (!field.options) {
                    field.options = this._getAllPlugins()
                    _disableOption(field.options, "preferences")
                    _disableOption(field.options, "global")
                }
            },
            "markdownLint.rule_config": (field, data, box) => {
                const plu = this.utils.getCustomPlugin("markdownLint")
                if (plu) {
                    box.fields[0] = { type: "action", key: "invokeMarkdownLintSettings", label: this.i18n._t("markdownLint", "$label.invokeMarkdownLintSettings") }
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
