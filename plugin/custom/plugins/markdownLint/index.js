class markdownLintPlugin extends BaseCustomPlugin {
    // Markdownlint config supports names and aliases,
    // keys are not case-sensitive and processed in order from top to bottom with later values overriding earlier ones.
    // To simplify the main processing logic, we first normalize the config by resolving all aliases to their names.
    beforeProcess = () => {
        const mapAliasToName = require("./rules-aliases.json")
        this.config.rule_config = Object.fromEntries(
            Object.entries(this.config.rule_config).map(([key, val]) => {
                key = /^md\d{3}$/i.test(key) ? key.toUpperCase() : key.toLowerCase()
                key = mapAliasToName[key] || key
                return [key, val]
            })
        )
    }

    styleTemplate = () => true

    hotkey = () => [
        { hotkey: this.config.hotkey, callback: this.callback },
        { hotkey: this.config.hotkey_fix_lint_error, callback: this.linter.fix },
    ]

    html = () => `
        <fast-window 
            id="plugin-markdownlint"
            hidden
            window-title="${this.pluginName}"
            window-buttons="settings|fa-gear|${this.i18n.t("func.settings")};
                            detailAll|fa-info-circle|${this.i18n.t("func.detailAll")};
                            fixAll|fa-wrench|${this.i18n.t("func.fixAll")};
                            toggleSourceMode|fa-code|${this.i18n.t("func.toggleSourceMode")};
                            refresh|fa-refresh|${this.i18n.t("func.refresh")};
                            close|fa-times|${this.i18n.t("func.close")}">
            <div class="plugin-markdownlint-table-wrap">
                <fast-table class="plugin-markdownlint-table"></fast-table>
            </div>
        </fast-window>
        ${this.config.use_button ? `<div id="plugin-markdownlint-button"></div>` : ""}
    `

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
            eventHub.addEventListener(eventHub.eventType.allPluginsHadInjected, () => setTimeout(this.linter.configure, 1000))
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
                title: this.i18n.t("func.detailAll"),
                schema: [{ fields: [{ type: "textarea", key: "detail", rows: 14, readonly: true }] }],
                data: { detail: content }
            }
            await this.utils.formDialog.modal(op)
        }

        const funcMap = {
            close: () => this.callback(),
            refresh: () => {
                this.linter.check()
                this.utils.notification.show(this.i18n._t("global", "success.refresh"))
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
            if (this.entities.button) {
                this.entities.button.addEventListener("mousedown", ev => {
                    if (ev.button === 0) {
                        this.callback()
                    } else if (this.config.right_click_button_to_fix && ev.button === 2) {
                        this.linter.fix()
                    }
                })
            }
            if (this.config.right_click_table_to_toggle_source_mode) {
                this.entities.wrap.addEventListener("mousedown", ev => {
                    ev.preventDefault()
                    ev.stopPropagation()
                    if (ev.button === 2) {
                        funcMap.toggleSourceMode()
                    }
                })
            }
            this.entities.window.addEventListener("btn-click", ev => {
                const { action } = ev.detail
                const fn = funcMap[action]
                if (fn) fn()
            })
            this.entities.table.addEventListener("row-action", ev => {
                const { action, rowData } = ev.detail
                const arg = (action === "fixSingle" || action === "detailSingle") ? rowData.idx : rowData.line
                funcMap[action](arg)
            })
        }

        onLifecycle()
        onElementEvent()
    }

    callback = async anchorNode => {
        this.entities.window.toggle()
        this.linter.check()
    }

    settings = async () => {
        const defaultValues = require("./rules-default-values.json")
        const getData = () => {
            const cfg = this.config.rule_config
            return {
                ...defaultValues,
                ...cfg,
                default: true,  // Force `default` to true
                extends: cfg.extends || "",  // `extends` type is null or string. Text fields do not support null, convert it to an empty string
            }
        }
        const getRules = () => {
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
            return {
                "extends": ["path", readJSON],
                "MD022.lines_above": numberOrNumberArray,
                "MD022.lines_below": numberOrNumberArray,
                "MD025.front_matter_title": ["required", "regex"],
                "MD041.front_matter_title": ["required", "regex"],
                "MD043.headings": { name: "pattern", args: [/^(\*|\+|\?|#{1,6}\s+\S.*)$/] },
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
                    await this.utils.settings.handleSettings(this.fixedName, pluginSettings => delete pluginSettings.rule_config)
                    const settings = await this.utils.settings.readCustomPluginSettings()
                    this.config = settings[this.fixedName]
                    this.utils.notification.show(this.i18n._t("global", "success.restore"))
                    await this.utils.formDialog.updateModal(op => op.data = getData())
                }
            }),
        })

        const op = {
            title: this.i18n.t("func.settings"),
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
            const minimizedRules = this.utils.minimize(data, defaultValues)
            await this.linter.configure(minimizedRules, this.config.custom_rules_files, true)
            this.utils.notification.show(this.i18n._t("global", "success.edit"))
        }
    }

    _createLinter = (onCheck, onFix) => {
        const ACTION = { CONFIGURE: "configure", CLOSE: "close", CHECK: "check", FIX: "fix" }
        const worker = new Worker("plugin/custom/plugins/markdownLint/linter-worker.js")
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
            configure: async (
                rule_config = this.config.rule_config,
                custom_rules_files = this.config.custom_rules_files,
                persistent = false,
            ) => {
                if (persistent) {
                    const cfg = { rule_config, custom_rules_files }
                    await this.utils.settings.handleSettings(this.fixedName, pluginSettings => Object.assign(pluginSettings, cfg))
                    Object.assign(this.config, cfg)
                }
                send(ACTION.CONFIGURE, {
                    rules: rule_config,
                    lib: this.utils.joinPath("plugin/custom/plugins/markdownLint/markdownlint.min.js"),
                    polyfillLib: this.utils.joinPath("plugin/global/core/polyfill.js"),
                    customRulesFiles: custom_rules_files.map(f => this.utils.joinPath(f)),
                })
            },
            close: () => send(ACTION.CLOSE),
            check: () => send(ACTION.CHECK),
            fix: (fixInfo = this.fixInfos) => send(ACTION.FIX, { fixInfo }),
        }
    }

    _initTableColumns = () => {
        const useInfo = this.config.tools.includes("info")
        const useLocate = this.config.tools.includes("locate")
        const useFix = this.config.tools.includes("fix")
        const operationsRender = (rowData) => {
            const info = useInfo ? `<i class="fa fa-info-circle action-icon" action="detailSingle"></i>` : ""
            const locate = useLocate ? `<i class="fa fa-crosshairs action-icon" action="jumpToLine"></i>` : ""
            const fixInfo = (useFix && rowData.fixable) ? `<i class="fa fa-wrench action-icon" action="fixSingle"></i>` : ""
            return [info, locate, fixInfo].join("")
        }
        const sortKey = { index: "idx", lineNumber: "line", ruleName: "rule", ruleDesc: "desc" }[this.config.result_order_by] || "line"
        const supportColumns = {
            idx: { key: "idx", title: this.i18n.t("$option.columns.idx"), width: "3em", sortable: true },
            line: { key: "line", title: this.i18n.t("$option.columns.line"), width: "4em", sortable: true },
            rule: { key: "rule", title: this.i18n.t("$option.columns.rule"), width: "5em", sortable: true },
            desc: { key: "desc", title: this.i18n.t("$option.columns.desc"), sortable: true },
            ops: { key: "ops", title: this.i18n.t("$option.columns.ops"), width: "5.2em", render: operationsRender },
        }
        const schema = {
            defaultSort: { key: sortKey, direction: "asc" },
            columns: this.config.columns.map(col => supportColumns[col])
        }
        this.entities.table.setSchema(schema)
    }

    _setTableData = (fixInfos) => {
        const data = fixInfos.map((item, idx) => {
            const rule = item.ruleNames[0]
            const line = item.lineNumber
            const fixable = Boolean(item.fixInfo)
            const desc = (this.config.translate && this.TRANSLATIONS[rule]) || item.ruleDescription
            return { rule, line, desc, idx, fixable }
        })
        this.entities.table.setData(data)
    }

    _onCheck = fixInfos => {
        this.fixInfos = fixInfos
        if (this.entities.button) {
            this.entities.button.toggleAttribute("lint-check-failed", fixInfos.length)
        }
        if (!this.entities.window.hidden) {
            this._setTableData(fixInfos)
        }
    }

    _onFix = async fileContent => {
        await this.utils.editCurrentFile(fileContent)
        this.utils.notification.show(this.i18n.t("func.fixAll.ok"))
        this.linter.check()
    }
}

module.exports = {
    plugin: markdownLintPlugin
}
