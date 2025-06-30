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
                            switchOrder|fa-sort-amount-asc|${this.i18n.t(`$option.result_order_by.${this.config.result_order_by}`)};
                            detailAll|fa-info-circle|${this.i18n.t("func.detailAll")};
                            fixAll|fa-wrench|${this.i18n.t("func.fixAll")};
                            toggleSourceMode|fa-code|${this.i18n.t("func.toggleSourceMode")};
                            refresh|fa-refresh|${this.i18n.t("func.refresh")};
                            close|fa-times|${this.i18n.t("func.close")}">
            <div class="plugin-markdownlint-table-wrap">
                <table>
                    <thead><tr><th>${this.i18n.t("line")}</th><th>${this.i18n.t("rule")}</th><th>${this.i18n.t("desc")}</th><th>${this.i18n.t("ops")}</th></tr></thead>
                    <tbody></tbody>
                </table>
            </div>
        </fast-window>
        ${this.config.use_button ? `<div id="plugin-markdownlint-button"></div>` : ""}
    `

    init = () => {
        this.initLint = this.utils.noop
        this.checkLint = this.utils.noop
        this.fixLint = this.utils.noop
        this.fixInfos = []
        this.entities = {
            window: document.querySelector("#plugin-markdownlint"),
            wrap: document.querySelector(".plugin-markdownlint-table-wrap"),
            table: document.querySelector("#plugin-markdownlint table"),
            tbody: document.querySelector("#plugin-markdownlint tbody"),
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

        const onEvent = () => {
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
            detailSingle: infoIdx => _getDetail([this.fixInfos[infoIdx]]),
            fixAll: () => this.fixLint(),
            fixSingle: infoIdx => this.fixLint([this.fixInfos[infoIdx]]),
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
            switchOrder: () => {
                const orderBy = this.config.result_order_by === "ruleName" ? "lineNumber" : "ruleName"
                this.config.result_order_by = orderBy
                this.checkLint()
                const hint = this.i18n.t(`$option.result_order_by.${orderBy}`)
                this.entities.window.updateButton("switchOrder", btn => btn.hint = hint)
                this.utils.notification.show(hint)
                this.utils.settings.saveSettings(this.fixedName, { result_order_by: orderBy })
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
            this.entities.table.addEventListener("click", ev => {
                const target = ev.target.closest("[action]")
                if (!target) return
                const action = target.getAttribute("action")
                const value = parseInt(target.dataset.value)
                const fn = funcMap[action]
                if (fn) fn(value)
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
        onEvent()
        onElementEvent()
    }

    callback = async anchorNode => {
        this.entities.window.toggle()
        this.checkLint()
    }

    _onCheck = fixInfos => {
        const compareFn = this.config.result_order_by === "ruleName"
            ? (a, b) => a.ruleNames[0] - b.ruleNames[0]
            : (a, b) => a.lineNumber - b.lineNumber
        this.fixInfos = fixInfos.sort(compareFn)

        if (this.entities.button) {
            this.entities.button.toggleAttribute("lint-check-failed", this.fixInfos.length)
        }

        if (this.entities.window.hidden) return

        const useInfo = this.config.tools.includes("info")
        const useLocate = this.config.tools.includes("locate")
        const useFix = this.config.tools.includes("fix")
        const tds = this.fixInfos.map((item, idx) => {
            const rule = item.ruleNames[0]
            const lineNumber = item.lineNumber
            const desc = (this.config.translate && this.TRANSLATIONS[rule]) || item.ruleDescription
            const info = useInfo ? `<i class="fa fa-info-circle" action="detailSingle" data-value="${idx}"></i>` : ""
            const locate = useLocate ? `<i class="fa fa-crosshairs" action="jumpToLine" data-value="${lineNumber}"></i>` : ""
            const fixInfo = (useFix && item.fixInfo) ? `<i class="fa fa-wrench" action="fixSingle" data-value="${idx}"></i>` : ""
            return `<tr><td>${lineNumber}</td><td>${rule}</td><td>${desc}</td><td>${info}${locate}${fixInfo}</td></tr>`
        })
        this.entities.tbody.innerHTML = tds.length ? tds.join("") : `<tr><td colspan="4">${this.i18n._t("global", "empty")}</td></tr>`
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
