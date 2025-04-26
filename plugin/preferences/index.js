class preferencesPlugin extends BasePlugin {
    hotkey = () => [{ hotkey: this.config.HOTKEY, callback: this.call }]

    styleTemplate = () => true

    html = () => `
        <div id="plugin-preferences-dialog" class="plugin-common-hidden">
            <div id="plugin-preferences-dialog-content">
                <div id="plugin-preferences-dialog-left">
                    <div id="plugin-preferences-menu-search"><input type="text" placeholder="${this.i18n._t("global", "search")}"></div>
                    <div id="plugin-preferences-menu"></div>
                </div>
                <div id="plugin-preferences-dialog-right">
                    <div id="plugin-preferences-dialog-title"></div>
                    <div id="plugin-preferences-dialog-close" class="ion-close-round"></div>
                    <div id="plugin-preferences-dialog-main"><div id="plugin-preferences-dialog-form" data-plugin="global"></div></div>
                </div>
            </div>
        </div>
    `

    init = () => {
        this.initSchemas()

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
    }

    process = async () => {
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
        const delegateEvent = () => {
            const that = this
            let shownSelectOption = null

            $(this.entities.form).on("click", function () {
                if (shownSelectOption) {
                    that.utils.hide(shownSelectOption)
                }
                shownSelectOption = null
            }).on("click", ".plugin-preferences-select-wrap", function () {
                const optionBox = this.nextElementSibling
                const boxes = [...that.entities.form.querySelectorAll(".plugin-preferences-option-box")]
                boxes.filter(box => box !== optionBox).forEach(that.utils.hide)
                that.utils.toggleVisible(optionBox)
                const isShown = that.utils.isShow(optionBox)
                if (isShown) {
                    optionBox.scrollIntoView({ block: "nearest" })
                }
                shownSelectOption = isShown ? optionBox : null
                return false
            }).on("click", ".plugin-preferences-option-item", async function () {
                const optionEl = this
                const boxEl = optionEl.closest(".plugin-preferences-option-box")
                const selectEl = optionEl.closest(".plugin-preferences-select")
                const selectValueEl = selectEl.querySelector(".plugin-preferences-select-value")
                const allOptionEl = [...boxEl.querySelectorAll(".plugin-preferences-option-item")]
                const isMulti = selectEl.dataset.multi === "true"
                const values = isMulti ? selectEl.dataset.value.split("#").filter(Boolean) : selectEl.dataset.value
                const optionValue = optionEl.dataset.value
                if (isMulti) {
                    const deselect = optionEl.dataset.choose === "true"
                    const minItems = Number(selectEl.dataset.minItems)
                    const maxItems = Number(selectEl.dataset.maxItems)
                    const itemCount = allOptionEl.filter(op => op.dataset.choose === "true").length + (deselect ? -1 : 1)
                    if (itemCount < minItems || itemCount > maxItems) {
                        const msg = itemCount < minItems
                            ? that.i18n.t("error.minItems", { minItems })
                            : that.i18n.t("error.maxItems", { maxItems })
                        that.utils.notification.show(msg, "error")
                        that.utils.hide(boxEl)
                        return
                    }
                    optionEl.dataset.choose = deselect ? "false" : "true"
                    const idx = values.indexOf(optionValue)
                    if (idx === -1) {
                        values.push(optionValue)
                    } else {
                        values.splice(idx, 1)
                    }
                    const map = new Map(allOptionEl.map(op => [op.dataset.value, op]))
                    selectValueEl.textContent = values.length === 0
                        ? that.i18n._t("global", "empty")
                        : that._joinSelected(values.map(v => map.get(v).textContent))
                    selectEl.dataset.value = values.join("#")
                    that.utils.hide(boxEl)
                    await that._updateSettings(selectEl.dataset.key, values)
                } else {
                    allOptionEl.forEach(op => op.dataset.choose = "false")
                    optionEl.dataset.choose = "true"
                    selectEl.dataset.value = optionEl.dataset.value
                    selectValueEl.textContent = optionEl.textContent
                    that.utils.hide(boxEl)
                    await that._updateSettings(selectEl.dataset.key, optionValue)
                }
            }).on("click", ".plugin-preferences-object-btn", async function () {
                const textarea = this.closest(".plugin-preferences-control").querySelector(".plugin-preferences-object")
                try {
                    const value = that._deserialize(textarea.value)
                    await that._updateSettings(textarea.dataset.key, value)
                    const msg = that.i18n.t("notification.changesSubmitted")
                    that.utils.notification.show(msg)
                } catch (e) {
                    console.error(e)
                    const msg = that.i18n.t("error.IncorrectFormatContent", { format: that.config.OBJECT_SETTINGS_FORMAT })
                    that.utils.notification.show(msg, "error")
                }
            }).on("click", ".plugin-preferences-hotkey-reset", async function () {
                const input = this.closest(".plugin-preferences-hotkey-wrap").querySelector("input")
                await that._updateSettings(input.dataset.key, "")
                that.utils.hotkeyHub.unregister(input.value)
                input.value = ""
            }).on("click", ".plugin-preferences-hotkey-undo", async function () {
                const input = this.closest(".plugin-preferences-hotkey-wrap").querySelector("input")
                input.value = input.getAttribute("value")
                await that._updateSettings(input.dataset.key, input.value)
            }).on("click", '.plugin-preferences-control[data-type="action"]', async function () {
                const icon = this.querySelector(".plugin-preferences-action")
                const act = icon.dataset.action
                const fn = that.SETTING_ACTIONS[act]
                if (fn) {
                    await fn()
                }
            }).on("click", ".plugin-preferences-array-item-delete", async function () {
                const itemEl = this.parentElement
                const valueEl = this.previousElementSibling
                const displayEl = this.closest(".plugin-preferences-array")
                await that._updateSettings(displayEl.dataset.key, valueEl.textContent, "remove")
                itemEl.remove()
            }).on("click", ".plugin-preferences-array-item-add", async function () {
                const addEl = this
                const inputEl = this.previousElementSibling
                that.utils.hide(addEl)
                that.utils.show(inputEl)
                inputEl.focus()
            }).on("blur", ".plugin-preferences-array-item-input", async function () {
                const input = this
                const displayEl = input.parentElement
                const addEl = input.nextElementSibling
                const value = input.textContent
                const values = [...displayEl.querySelectorAll(".plugin-preferences-array-item-value")].map(e => e.textContent)
                if (values.includes(value)) {
                    const msg = that.i18n._t("global", "error.duplicateValue")
                    that.utils.notification.show(msg, "error")
                    input.focus()
                    return
                }
                input.insertAdjacentHTML("beforebegin", that._createArrayItem(value))
                input.textContent = ""
                that.utils.hide(input)
                that.utils.show(addEl)
                await that._updateSettings(displayEl.dataset.key, value, "push")
            }).on("input", ".plugin-preferences-range-input", function () {
                this.nextElementSibling.textContent = that._toFixed2(Number(this.value))
            }).on("change", "input.plugin-preferences-switch-input", async function () {
                await that._updateSettings(this.dataset.key, this.checked)
            }).on("change", ".plugin-preferences-number-input, .plugin-preferences-range-input, .plugin-preferences-unit-input", async function () {
                await that._updateSettings(this.dataset.key, Number(this.value))
            }).on("change", ".plugin-preferences-text-input, .plugin-preferences-textarea", async function () {
                await that._updateSettings(this.dataset.key, this.value)
            })
        }

        const domEvent = () => {
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
            const ignoreKeys = ["control", "alt", "shift", "meta"]
            const updateHotkey = this.utils.debounce(async hk => this._updateSettings(hk.dataset.key, hk.value), 500)
            this.entities.form.addEventListener("keydown", ev => {
                if (ev.key === undefined) return
                const input = ev.target.closest(".plugin-preferences-hotkey-input")
                if (!input) return

                if (ev.key !== "Process") {
                    const key = ev.key.toLowerCase()
                    const arr = [
                        this.utils.metaKeyPressed(ev) ? "ctrl" : undefined,
                        this.utils.shiftKeyPressed(ev) ? "shift" : undefined,
                        this.utils.altKeyPressed(ev) ? "alt" : undefined,
                        ignoreKeys.includes(key) ? undefined : key,
                    ]
                    input.value = arr.filter(Boolean).join("+")
                    updateHotkey(input)
                }
                ev.stopPropagation()
                ev.preventDefault()
            }, true)
        }

        searchInDialog()
        delegateEvent()
        domEvent()
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

    initSchemas = () => {
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
        this.entities.form.innerHTML = this._fillForm(fixedName, values)
        this.entities.title.textContent = this.i18n._t(fixedName, "pluginName")
        this.entities.menu.querySelectorAll(".plugin-preferences-menu-item").forEach(e => e.classList.remove("active"))
        this.entities.menu.querySelector(`.plugin-preferences-menu-item[data-plugin="${fixedName}"]`).classList.add("active")
        this.entities.main.scrollTop = 0
    }

    _getSettings = async (fixedName) => {
        const isBase = this.utils.getPluginSetting(fixedName)
        const fn = isBase ? "readBasePluginSettings" : "readCustomPluginSettings"
        const settings = await this.utils.settings[fn]()
        return settings[fixedName]
    }

    _updateSettings = async (key, value, type = "set") => {
        if (!this.SETTING_OPERATORS.hasOwnProperty(type)) return

        const fixedName = this.entities.form.dataset.plugin
        const settings = await this._getSettings(fixedName)
        this.SETTING_OPERATORS[type](settings, key, value)
        await this.utils.settings.saveSettings(fixedName, settings)
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

    _createArrayItem = (value) => `
        <span class="plugin-preferences-array-item">
            <span class="plugin-preferences-array-item-value">${this.utils.escape(value)}</span>
            <span class="plugin-preferences-array-item-delete">×</span>
        </span>
    `

    _fillForm = (fixedName, values) => {
        const isBlockControl = type => type === "textarea" || type === "object" || type === "array"
        const createTitle = (title) => `<div class="plugin-preferences-title">${title}</div>`
        const createTooltip = (item) => item.tooltip ? `<span class="plugin-preferences-tooltip"><span class="fa fa-info-circle"></span><span>${item.tooltip}</span></span>` : ""
        const createGeneralControl = (ctl, value) => {
            const disabled = ctl => ctl.disabled ? "disabled" : ""
            const checked = () => value === true ? "checked" : ""
            const placeholder = ctl => ctl.placeholder ? `placeholder="${ctl.placeholder}"` : ""
            const range = ctl => {
                const arr = [
                    ctl.min != null ? `min="${ctl.min}"` : "",
                    ctl.max != null ? `max="${ctl.max}"` : "",
                    ctl.step != null ? `step="${ctl.step}"` : "",
                    `value="${value != null ? value : 1}"`,
                ]
                return arr.join(" ")
            }
            switch (ctl.type) {
                case "switch":
                    return `<input class="plugin-preferences-switch-input" type="checkbox" data-key="${ctl.key}" ${checked()} ${disabled(ctl)} />`
                case "text":
                    return `<input class="plugin-preferences-text-input" type="text" data-key="${ctl.key}" value="${value}" ${placeholder(ctl)} ${disabled(ctl)}>`
                case "number":
                case "unit":
                    const input = `<input class="plugin-preferences-${ctl.type}-input" type="number" data-key="${ctl.key}" ${range(ctl)} ${disabled(ctl)}>`
                    if (ctl.type === "number") {
                        return input
                    }
                    const unit = `<div class="plugin-preferences-unit-value">${ctl.unit}</div>`
                    return input + unit
                case "range":
                    return `
                        <div class="plugin-preferences-range-wrap">
                            <input class="plugin-preferences-range-input" type="range" data-key="${ctl.key}" ${range(ctl)} ${disabled(ctl)}>
                            <div class="plugin-preferences-range-value">${this._toFixed2(value)}</div>
                        </div>
                    `
                case "action":
                    return `<div class="plugin-preferences-action fa fa-angle-right" data-action="${ctl.act}"></div>`
                case "static":
                    return `<div class="plugin-preferences-static">${value}</div>`
                case "select":
                    const isMulti = Array.isArray(value)
                    const show = isMulti
                        ? this._joinSelected(value.map(e => ctl.options[e]))
                        : ctl.options[value]
                    const isSelected = (option) => isMulti ? value.includes(option) : option === value
                    const options = Object.entries(ctl.options).map(([option, optionShowName]) => {
                        const choose = isSelected(option) ? "true" : "false"
                        return `<div class="plugin-preferences-option-item" data-value="${option}" data-choose="${choose}">${optionShowName}</div>`
                    })
                    const val = isMulti ? value.join("#") : value
                    const minItems = (isMulti && ctl.minItems != null) ? ctl.minItems : 0
                    const maxItems = (isMulti && ctl.maxItems != null) ? ctl.maxItems : Infinity
                    return `
                        <div class="plugin-preferences-select" data-multi="${isMulti}" data-min-items="${minItems}" data-max-items="${maxItems}" data-key="${ctl.key}" data-value="${val}">
                            <div class="plugin-preferences-select-wrap"><span class="plugin-preferences-select-value">${show}</span>
                                <span class="plugin-preferences-select-icon fa fa-caret-down"></span>
                            </div>
                            <div class="plugin-preferences-option-box plugin-common-hidden" data-name="${ctl.key}">${options.join("")}</div>
                        </div>`
                case "hotkey":
                    return `
                        <div class="plugin-preferences-hotkey-wrap">
                            <input type="text" class="plugin-preferences-hotkey-input" data-key="${ctl.key}" value="${value}" placeholder="" ${disabled(ctl)}>
                            <div>
                                <div class="plugin-preferences-hotkey-undo">↺</div>
                                <div class="plugin-preferences-hotkey-reset">×</div>
                            </div>
                        </div>
                        `
                case "textarea":
                case "object":
                    const isObject = ctl.type === "object"
                    const rows = ctl.rows || 3
                    const readonly = ctl.readonly ? "readonly" : ""
                    const value_ = isObject ? this._serialize(value) : value
                    const textarea = `<textarea class="plugin-preferences-${ctl.type}" rows="${rows}" ${readonly} data-key="${ctl.key}" ${placeholder(ctl)} ${disabled(ctl)}>${value_}</textarea>`
                    const btn = isObject ? `<button class="plugin-preferences-object-btn">${this.i18n._t("global", "confirm")}</button>` : ""
                    return textarea + btn
                case "array":
                    const items = value.map(this._createArrayItem).join("")
                    return `
                        <div class="plugin-preferences-array" data-key="${ctl.key}">
                            ${items}
                            <span class="plugin-preferences-array-item-input plugin-common-hidden" contenteditable="true"></span>
                            <span class="plugin-preferences-array-item-add">+ ${this.i18n._t("global", "add")}</span>
                        </div>
                    `
                default:
                    return ""
            }
        }
        const createControl = (field) => {
            if (field.type === "number" && field.unit != null) {
                field.type = "unit"
            }
            const isBlock = isBlockControl(field.type)
            const value = values[field.key]

            const control = createGeneralControl(field, value)
            const wrappedControl = isBlock ? control : `<div>${control}</div>`
            const wrappedLabel = isBlock ? "" : `<div>${field.label}${createTooltip(field)}</div>`
            return `<div class="plugin-preferences-control" data-type="${field.type}">${wrappedLabel}${wrappedControl}</div>`
        }
        const createBox = ({ title, fields }) => {
            const t = title ? createTitle(title) : ""
            const items = fields.map(createControl).join("")
            const box = `<div class="plugin-preferences-form-box">${items}</div>`
            return t + box
        }
        return this.SETTING_SCHEMAS[fixedName].map(createBox).join("")
    }

    _toFixed2 = (num) => Number.isInteger(num) ? num : num.toFixed(2)

    _joinSelected = (options) => options.join(", ")

    _serialize = (obj) => {
        const funcMap = {
            JSON: (obj) => JSON.stringify(obj, null, "\t"),
            TOML: (obj) => this.utils.stringifyToml(obj),
            YAML: (obj) => this.utils.stringifyYaml(obj)
        }
        const f = funcMap[this.config.OBJECT_SETTINGS_FORMAT] || funcMap.JSON
        return f(obj)
    }

    _deserialize = (str) => {
        const funcMap = {
            JSON: (str) => JSON.parse(str),
            TOML: (str) => this.utils.readToml(str),
            YAML: (str) => this.utils.readYaml(str),
        }
        const f = funcMap[this.config.OBJECT_SETTINGS_FORMAT] || funcMap.JSON
        return f(str)
    }
}

module.exports = {
    plugin: preferencesPlugin
}
