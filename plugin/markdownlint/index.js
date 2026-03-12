class MarkdownlintPlugin extends BasePlugin {
    // Markdownlint config supports names and aliases,
    // keys are not case-sensitive and processed in order from top to bottom with later values overriding earlier ones.
    // To simplify the main processing logic, we first normalize the config by resolving all aliases to their names.
    beforeProcess = () => {
        const mapAliasToName = require("./rule-aliases.json")
        this.config.RULE_CONFIG = Object.fromEntries(
            Object.entries(this.config.RULE_CONFIG).map(([name, option]) => {
                name = /^md\d{3}$/i.test(name) ? name.toUpperCase() : name.toLowerCase()
                name = mapAliasToName[name] ?? name
                return [name, option]
            })
        )
    }

    styleTemplate = () => true

    hotkey = () => [
        { hotkey: this.config.HOTKEY, callback: () => this.call() },
        { hotkey: this.config.HOTKEY_FIX_LINT, callback: () => this.linter.fix() },
    ]

    html = () => {
        const icons = { settings: "fa-gear", detailAll: "fa-info-circle", fixAll: "fa-wrench", toggleSourceMode: "fa-code", refresh: "fa-refresh", close: "fa-times" }
        const buttons = this.config.TITLE_BAR_BUTTONS.map(name => `${name}|${icons[name]}|${this.i18n.t(`$option.TITLE_BAR_BUTTONS.${name}`)}`).join(";")
        return `
            <fast-window id="plugin-markdownlint" window-title="${this.pluginName}" window-buttons="${buttons}" hidden>
                <div class="plugin-markdownlint-table-wrap"><fast-table class="plugin-markdownlint-table"></fast-table></div>
            </fast-window>
            ${this.config.USE_INDICATOR_BUTTON ? `<div id="plugin-markdownlint-button"></div>` : ""}
        `
    }

    init = () => {
        this.linter = this._createLinter(this._onCheck, this._onFix)
        this.fixInfos = []
        this.entities = {
            window: document.querySelector("#plugin-markdownlint"),
            wrap: document.querySelector(".plugin-markdownlint-table-wrap"),
            table: document.querySelector(".plugin-markdownlint-table"),
            button: document.querySelector("#plugin-markdownlint-button"),
        }
        this.TRANSLATIONS = this.i18n.entries([...Object.keys(this.i18n.data)].filter(e => e.startsWith("MD")))

        this._initTableColumns()
    }

    process = () => {
        const onLifecycle = () => {
            const { eventHub } = this.utils
            eventHub.addEventListener(eventHub.eventType.fileEdited, this.utils.debounce(this.linter.check, 500))
            eventHub.addEventListener(eventHub.eventType.allPluginsHadInjected, () => this.linter.configure())
            eventHub.addEventListener(eventHub.eventType.toggleSettingPage, force => {
                if (force) {
                    this.entities.window.toggle(force)
                }
                if (this.entities.button) {
                    this.utils.toggleInvisible(this.entities.button, force)
                }
            })
        }

        const _getDetail = async (infos = this.fixInfos) => {
            const attrs = ["lineNumber", "ruleNames", "errorDetail", "errorContext", "errorRange", "fixInfo"]
            const infoList = infos.map(info => this.utils.pick(info, attrs))
            const value = infoList.length === 1 ? infoList[0] : infoList
            const content = JSON.stringify(value, null, "\t")
            const op = {
                title: this.i18n.t("$option.TITLE_BAR_BUTTONS.detailAll"),
                schema: [{ fields: [{ type: "textarea", key: "detail", rows: 14, readonly: true }] }],
                data: { detail: content }
            }
            await this.utils.formDialog.modal(op)
        }

        const funcMap = {
            close: () => this.call(),
            refresh: () => {
                this.linter.check()
                this.utils.notification.show(this.i18n.t("success.refresh"))
            },
            detailAll: () => _getDetail(this.fixInfos),
            fixAll: () => this.linter.fix(this.fixInfos),
            detailSingle: idx => _getDetail([this.fixInfos[idx]]),
            fixSingle: idx => this.linter.fix([this.fixInfos[idx]]),
            toggleSourceMode: () => File.toggleSourceMode(),
            settings: this.settings,
            jumpToLine: lineToGo => {
                if (!lineToGo) return
                if (!File.editor.sourceView.inSourceMode) {
                    File.toggleSourceMode()
                }
                this.utils.scrollSourceView(lineToGo)
            },
        }

        const onElementEvent = () => {
            this.entities.button?.addEventListener("mousedown", ev => {
                if (ev.button === 0) {
                    this.call()
                } else if (this.config.RIGHT_CLICK_BUTTON_TO_FIX && ev.button === 2) {
                    this.linter.fix()
                }
            })
            if (this.config.RIGHT_CLICK_TABLE_TO_TOGGLE_SOURCE_MODE) {
                this.entities.wrap.addEventListener("mousedown", ev => {
                    ev.preventDefault()
                    ev.stopPropagation()
                    if (ev.button === 2) {
                        funcMap.toggleSourceMode()
                    }
                })
            }
            this.entities.window.addEventListener("btn-click", ev => funcMap[ev.detail.action]?.())
            this.entities.table.addEventListener("row-action", ev => {
                const { action, rowData } = ev.detail
                const arg = (action === "fixSingle" || action === "detailSingle") ? rowData.idx : rowData.line
                funcMap[action](arg)
            })
        }

        onLifecycle()
        onElementEvent()
    }

    call = () => {
        this.entities.window.toggle()
        this.linter.check()
    }

    settings = async () => {
        const defaultValues = require("./rule-default-values.json")
        const getData = () => {
            const cfg = this.config.RULE_CONFIG
            return {
                ...defaultValues,
                ...cfg,
                default: true,  // Force `default` to true
                extends: cfg.extends || "",  // `extends` type is null or string. Text fields do not support null, convert it to an empty string
            }
        }
        const getRules = () => {
            const path = "path"
            const required = "required"
            const regex = "regex"
            const word = { name: "pattern", args: [/^\w+$/] }
            const codingLang = { name: "pattern", args: [/^[a-zA-Z0-9#+.\-]+$/] }
            const heading = { name: "pattern", args: [/^(\*|\+|\?|#{1,6}\s+\S.*)$/] }
            const readJSON = ({ value }) => {
                if (!value) return
                value = this.utils.Package.Path.resolve(value)
                const cnt = this.utils.Package.FsExtra.readJsonSync(value, { throws: false })
                if (cnt == null) {
                    return new Error(`Read JSON file failed: ${value}`)
                }
            }
            const numberOrNumberArray = ({ value }) => {
                const isArr = Array.isArray(value)
                if (!isArr && typeof value !== "number") {
                    return new Error(`Must be Array or Number, got ${typeof value}`)
                }
                if (isArr && value.length !== 6) {
                    return new Error(`The length of the Array must be 6, got ${value.length}`)
                }
                if (isArr && value.some(item => isNaN(item))) {
                    return new Error(`Array elements must be numbers`)
                }
            }
            const each = (rules) => ({ $each: rules })
            return {
                "extends": [path, readJSON],
                "MD001.front_matter_title": [required, regex],
                "MD010.ignore_code_languages": each([required, codingLang]),
                "MD022.lines_above": numberOrNumberArray,
                "MD022.lines_below": numberOrNumberArray,
                "MD025.front_matter_title": [required, regex],
                "MD033.allowed_elements": each(required),
                "MD033.table_allowed_elements": each(required),
                "MD035.style": required,
                "MD040.allowed_languages": each([required, codingLang]),
                "MD041.front_matter_title": [required, regex],
                "MD043.headings": each([required, heading]),
                "MD044.names": each([required, word]),
                "MD051.ignored_pattern": regex,
                "MD052.ignored_labels": each(required),
                "MD053.ignored_definitions": each(required),
                "MD059.prohibited_texts": each(required),
            }
        }
        const getParsers = () => {
            const toNumberOrNumberArray = (value) => {
                if (!isNaN(value)) {
                    return Number(value)
                }
                try {
                    return JSON.parse(`[${value}]`).flat()  // supports: [1,2,3] or 1,2,3
                } catch (err) {
                    console.error(err)
                }
                return value
            }
            return {
                "extends": (value) => value.trim(),
                "MD022.lines_above": toNumberOrNumberArray,
                "MD022.lines_below": toNumberOrNumberArray,
            }
        }
        const getActions = () => ({
            viewRules: () => this.utils.openUrl("https://github.com/DavidAnson/markdownlint/blob/main/doc/Rules.md"),
            restoreRules: this.utils.createConsecutiveAction({
                threshold: 3,
                timeWindow: 3000,
                onConfirmed: async () => {
                    await this.utils.settings.handle(this.fixedName, pluginSettings => delete pluginSettings.RULE_CONFIG)
                    const settings = await this.utils.settings.readCustom()
                    this.config = settings[this.fixedName]
                    this.utils.notification.show(this.i18n.t("success.restore"))
                    await this.utils.formDialog.updateModal(op => op.data = getData())
                }
            }),
        })

        const op = {
            title: this.i18n.t("$option.TITLE_BAR_BUTTONS.settings"),
            schema: require("./config-schema.js"),
            data: getData(),
            actions: getActions(),
            rules: getRules(),
            parsers: getParsers(),
        }
        const { response, data } = await this.utils.formDialog.modal(op)
        if (response === 1) {
            if (data.extends === "") {
                data.extends = null  // Convert an empty string back to null
            }
            const ruleConfig = this.utils.minimize(data, defaultValues)
            await this.linter.configure({ ruleConfig, persistent: true })
            this.utils.notification.show(this.i18n.t("success.edit"))
        }
    }

    _createLinter = (onCheck, onFix) => {
        const ACTION = { CONFIGURE: "configure", CLOSE: "close", CHECK: "check", FIX: "fix" }
        const worker = new Worker("plugin/markdownlint/linter-worker.js")
        worker.onmessage = event => {
            const { action, result } = event.data
            const onEvent = (action === ACTION.FIX) ? onFix : onCheck
            onEvent(result)
        }
        worker.onerror = event => console.error(event.message)
        const send = (action, customPayload) => {
            const content = this.utils.getCurrentFileContent()
            const payload = { content, ...customPayload }
            worker.postMessage({ action, payload })
        }
        return {
            configure: async ({ ruleConfig = this.config.RULE_CONFIG, customRuleFiles = this.config.CUSTOM_RULE_FILES, persistent = false } = {}) => {
                if (persistent) {
                    const conf = { RULE_CONFIG: ruleConfig, CUSTOM_RULE_FILES: customRuleFiles }
                    await this.utils.settings.handle(this.fixedName, pluginSettings => Object.assign(pluginSettings, conf))
                    Object.assign(this.config, conf)
                }
                send(ACTION.CONFIGURE, {
                    ruleConfig,
                    coreLib: this.utils.joinPath("plugin/markdownlint/markdownlint.min.js"),
                    helpersLib: this.utils.joinPath("plugin/markdownlint/markdownlint-rule-helpers.min.js"),
                    polyfillLib: this.utils.joinPath("plugin/global/core/polyfill.js"),
                    customRuleFiles: customRuleFiles.map(file => this.utils.resolvePath(file)),
                })
            },
            close: () => send(ACTION.CLOSE),
            check: () => send(ACTION.CHECK),
            fix: (fixInfo = this.fixInfos) => send(ACTION.FIX, { fixInfo }),
        }
    }

    _initTableColumns = () => {
        const [useInfo, useLocate, useFix] = ["info", "locate", "fix"].map(t => this.config.TOOLS.includes(t))
        const opsRender = (rowData) => {
            const infoEl = useInfo ? '<i class="fa fa-info-circle action-icon" action="detailSingle"></i>' : ""
            const locateEl = useLocate ? '<i class="fa fa-crosshairs action-icon" action="jumpToLine"></i>' : ""
            const fixEl = (useFix && rowData.fixable) ? '<i class="fa fa-wrench action-icon" action="fixSingle"></i>' : ""
            return [infoEl, locateEl, fixEl].join("")
        }
        const sortKey = { index: "idx", lineNumber: "line", ruleName: "rule", ruleDesc: "desc" }[this.config.RESULT_ORDER_BY] || "line"
        const supportedColumns = {
            idx: { key: "idx", title: this.i18n.t("$option.COLUMNS.idx"), width: "3em", sortable: true },
            line: { key: "line", title: this.i18n.t("$option.COLUMNS.line"), width: "4em", sortable: true },
            rule: { key: "rule", title: this.i18n.t("$option.COLUMNS.rule"), width: "5em", sortable: true },
            desc: { key: "desc", title: this.i18n.t("$option.COLUMNS.desc"), sortable: true },
            ops: { key: "ops", title: this.i18n.t("$option.COLUMNS.ops"), width: "5.2em", render: opsRender },
        }
        const schema = {
            defaultSort: { key: sortKey, direction: "asc" },
            columns: this.config.COLUMNS.map(col => supportedColumns[col])
        }
        this.entities.table.setSchema(schema)
    }

    _onCheck = fixInfos => {
        this.fixInfos = fixInfos
        this.entities.button?.toggleAttribute("lint-check-failed", !!fixInfos.length)
        if (!this.entities.window.hidden) {
            this.entities.table.setData(fixInfos.map((item, idx) => {
                const rule = item.ruleNames[0]
                const line = item.lineNumber
                const fixable = !!item.fixInfo
                const desc = (this.config.TRANSLATE && this.TRANSLATIONS[rule]) || item.ruleDescription
                return { idx, rule, line, fixable, desc }
            }))
        }
    }

    _onFix = async content => {
        await this.utils.editCurrentFile(content)
        this.utils.notification.show(this.i18n.t("success.fixAll"))
        this.linter.check()
    }
}

module.exports = {
    plugin: MarkdownlintPlugin
}
