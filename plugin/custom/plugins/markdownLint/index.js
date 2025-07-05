class markdownLintPlugin extends BaseCustomPlugin {
    styleTemplate = () => true

    hotkey = () => [
        { hotkey: this.config.hotkey, callback: this.callback },
        { hotkey: this.config.hotkey_fix_lint_error, callback: this.fixLint },
    ]

    html = () => `
        <fast-window 
            id="plugin-markdownlint"
            hidden
            window-title="${this.pluginName}"
            window-buttons="doc|fa-file-text|${this.i18n.t("func.doc")};
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
        this.initLint = this.utils.noop
        this.checkLint = this.utils.noop
        this.fixLint = this.utils.noop
        this.updateTable = this._getUpdater()

        this.fixInfos = []
        this.entities = {
            window: document.querySelector("#plugin-markdownlint"),
            wrap: document.querySelector(".plugin-markdownlint-table-wrap"),
            table: document.querySelector(".plugin-markdownlint-table"),
            button: document.querySelector("#plugin-markdownlint-button"),
        }
        this.TRANSLATIONS = this.i18n.entries([...Object.keys(this.i18n.data)].filter(e => e.startsWith("MD")))
    }

    process = () => {
        const initWorker = (onCheck, onFix) => {
            const ACTION = { INIT: "init", CHECK: "check", FIX: "fix" }
            const worker = new Worker("plugin/custom/plugins/markdownLint/linter-worker.js")
            worker.onmessage = event => {
                const { action, result } = event.data
                const fn = action === ACTION.FIX ? onFix : onCheck
                fn(result)
            }
            const send = (action, customPayload) => {
                const content = this.utils.getCurrentFileContent()
                const payload = { content, ...customPayload }
                worker.postMessage({ action, payload })
            }
            Object.assign(this, {
                initLint: () => send(ACTION.INIT, {
                    config: this.config.rule_config,
                    libPath: this.utils.joinPath("plugin/custom/plugins/markdownLint/markdownlint.min.js"),
                    customRulePaths: this.config.custom_rules.map(r => this.utils.joinPath(r)),
                }),
                checkLint: () => send(ACTION.CHECK),
                fixLint: (fixInfo = this.fixInfos) => send(ACTION.FIX, { fixInfo }),
            })
        }

        const onLifecycle = () => {
            const { eventHub } = this.utils
            eventHub.addEventListener(eventHub.eventType.fileEdited, this.utils.debounce(this.checkLint, 500))
            eventHub.addEventListener(eventHub.eventType.allPluginsHadInjected, () => setTimeout(this.initLint, 1000))
            eventHub.addEventListener(eventHub.eventType.toggleSettingPage, force => {
                if (force) {
                    this.entities.window.toggle(force)
                }
                if (this.entities.button) {
                    this.utils.toggleVisible(this.entities.button, force)
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
                schema: [{ fields: [{ type: "textarea", key: "detail", rows: 14 }] }],
                data: { detail: content }
            }
            await this.utils.formDialog.modal(op)
        }

        const funcMap = {
            close: () => this.callback(),
            refresh: () => {
                this.checkLint()
                this.utils.notification.show(this.i18n._t("global", "success.refresh"))
            },
            detailAll: () => _getDetail(this.fixInfos),
            fixAll: () => this.fixLint(this.fixInfos),
            detailSingle: idx => _getDetail([this.fixInfos[idx]]),
            fixSingle: idx => this.fixLint([this.fixInfos[idx]]),
            toggleSourceMode: () => File.toggleSourceMode(),
            doc: async () => {
                const op = {
                    title: this.i18n.t("func.doc"),
                    schema: [
                        { fields: [{ type: "action", key: "viewRules", label: this.i18n.t("$label.viewMarkdownlintRules") }] },
                        { fields: [{ type: "textarea", key: "doc", rows: 12 }] },
                    ],
                    data: {
                        doc: Object.entries(this.TRANSLATIONS).map(([key, value]) => `${key}\t${value}`).join("\n"),
                    },
                    action: {
                        viewRules: () => this.utils.openUrl("https://github.com/DavidAnson/markdownlint/blob/main/doc/Rules.md"),
                    },
                }
                await this.utils.formDialog.modal(op)
            },
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
                this.entities.button.addEventListener("click", this.callback)
            }
            this.entities.window.addEventListener("btn-click", ev => {
                const { action } = ev.detail
                const fn = funcMap[action]
                if (fn) fn()
            })
            this.entities.table.addEventListener("table-click", ev => {
                const { action, rowData } = ev.detail
                const arg = (action === "fixSingle" || action === "detailSingle") ? rowData.idx : rowData.line
                funcMap[action](arg)
            })
            this.entities.wrap.addEventListener("mousedown", ev => {
                ev.preventDefault()
                ev.stopPropagation()
                if (ev.button === 2) {
                    funcMap.toggleSourceMode()
                }
            })
        }

        initWorker(this._onCheck, this._onFix)
        onLifecycle()
        onElementEvent()
    }

    callback = async anchorNode => {
        this.entities.window.toggle()
        this.checkLint()
    }

    _getUpdater = () => {
        const useInfo = this.config.tools.includes("info")
        const useLocate = this.config.tools.includes("locate")
        const useFix = this.config.tools.includes("fix")
        const optionsRender = () => {
            const info = useInfo ? `<i class="fa fa-info-circle action-icon" action="detailSingle"></i>` : ""
            const locate = useLocate ? `<i class="fa fa-crosshairs action-icon" action="jumpToLine"></i>` : ""
            const fixInfo = useFix ? `<i class="fa fa-wrench action-icon" action="fixSingle"></i>` : ""
            return [info, locate, fixInfo].join("")
        }
        const sortKey = { index: "idx", lineNumber: "line", ruleName: "rule", ruleDesc: "desc" }[this.config.result_order_by] || "line"
        const supportColumns = {
            idx: { key: "idx", title: this.i18n.t("$option.columns.idx"), width: "3em", sortable: true },
            line: { key: "line", title: this.i18n.t("$option.columns.line"), width: "4em", sortable: true },
            rule: { key: "rule", title: this.i18n.t("$option.columns.rule"), width: "5em", sortable: true },
            desc: { key: "desc", title: this.i18n.t("$option.columns.desc"), sortable: true },
            ops: { key: "ops", title: this.i18n.t("$option.columns.ops"), width: "5.2em", render: optionsRender },
        }
        const schema = {
            defaultSort: { key: sortKey, direction: "asc" },
            columns: this.config.columns.map(col => supportColumns[col])
        }
        return (fixInfos) => {
            const data = fixInfos.map((item, idx) => {
                const rule = item.ruleNames[0]
                const line = item.lineNumber
                const desc = (this.config.translate && this.TRANSLATIONS[rule]) || item.ruleDescription
                return { rule, line, desc, idx }
            })
            this.entities.table.setData(data, schema)
        }
    }

    _onCheck = fixInfos => {
        this.fixInfos = fixInfos
        if (this.entities.button) {
            this.entities.button.toggleAttribute("lint-check-failed", fixInfos.length)
        }
        if (!this.entities.window.hidden) {
            this.updateTable(fixInfos)
        }
    }

    _onFix = async fileContent => {
        await this.utils.editCurrentFile(fileContent)
        this.utils.notification.show(this.i18n.t("func.fixAll.ok"))
        this.checkLint()
    }
}

module.exports = {
    plugin: markdownLintPlugin
}
