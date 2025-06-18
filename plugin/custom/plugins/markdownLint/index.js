class markdownLintPlugin extends BaseCustomPlugin {
    styleTemplate = () => true

    hotkey = () => [
        { hotkey: this.config.hotkey, callback: this.callback },
        { hotkey: this.config.hotkey_fix_lint_error, callback: this.fixLint },
    ]

    html = () => `
        <div id="plugin-markdownlint" class="plugin-common-modal plugin-common-hidden">
            <div class="plugin-markdownlint-icon-group">
                <div class="plugin-markdownlint-icon ion-close" action="close" ty-hint="${this.i18n.t("func.close")}"></div>
                <div class="plugin-markdownlint-icon ion-arrow-move" action="move" ty-hint="${this.i18n.t("func.move")}"></div>
                <div class="plugin-markdownlint-icon ion-refresh" action="refresh" ty-hint="${this.i18n.t("func.refresh")}"></div>
                <div class="plugin-markdownlint-icon ion-code" action="toggleSourceMode" ty-hint="${this.i18n.t("func.toggleSourceMode")}"></div>
                <div class="plugin-markdownlint-icon ion-wrench" action="fixAll" ty-hint="${this.i18n.t("func.fixAll")}"></div>
                <div class="plugin-markdownlint-icon ion-earth" action="translate" ty-hint="${this.i18n.t("func.translate")}"></div>
                <div class="plugin-markdownlint-icon ion-information-circled" action="detailAll" ty-hint="${this.i18n.t("func.detailAll")}"></div>
                <div class="plugin-markdownlint-icon ion-document-text" action="doc" ty-hint="${this.i18n.t("func.doc")}"></div>
            </div>
            <div class="plugin-markdownlint-table">
                <table>
                    <thead><tr><th>${this.i18n.t("line")}</th><th>${this.i18n.t("rule")}</th><th>${this.i18n.t("desc")}</th><th>${this.i18n.t("ops")}</th></tr></thead>
                    <tbody></tbody>
                </table>
            </div>
        </div>
        ${this.config.use_button ? `<div id="plugin-markdownlint-button"></div>` : ""}
    `

    init = () => {
        this.initLint = this.utils.noop
        this.checkLint = this.utils.noop
        this.fixLint = this.utils.noop

        this.fixInfos = []
        this.TOOLS = new Set(this.config.tools)
        this.ACTION = { INIT: "init", CHECK: "check", FIX: "fix" }
        this.TRANSLATIONS = this.i18n.entries([...Object.keys(this.i18n.data)].filter(e => e.startsWith("MD")))
        this.entities = {
            modal: document.querySelector("#plugin-markdownlint"),
            iconGroup: document.querySelector("#plugin-markdownlint .plugin-markdownlint-icon-group"),
            moveIcon: document.querySelector('#plugin-markdownlint .plugin-markdownlint-icon[action="move"]'),
            table: document.querySelector("#plugin-markdownlint table"),
            tbody: document.querySelector("#plugin-markdownlint tbody"),
            button: document.querySelector("#plugin-markdownlint-button"),
        }
    }

    process = () => {
        const initWorker = (onCheck, onFix) => {
            const worker = new Worker("plugin/custom/plugins/markdownLint/linter-worker.js")
            worker.onmessage = event => {
                const { action, result } = event.data || {}
                const fn = action === this.ACTION.FIX ? onFix : onCheck
                fn(result)
            }
            const send = (action, customPayload) => {
                const content = this.utils.getCurrentFileContent()
                const payload = { content, ...customPayload }
                worker.postMessage({ action, payload })
            }
            this.initLint = () => {
                const config = this.config.rule_config
                const libPath = this.utils.joinPath("plugin/custom/plugins/markdownLint/markdownlint.min.js")
                const customRulePaths = this.config.custom_rules.map(e => this.utils.joinPath(e))
                send(this.ACTION.INIT, { config, libPath, customRulePaths })
            }
            this.checkLint = () => send(this.ACTION.CHECK)
            this.fixLint = (fixInfo = this.fixInfos) => send(this.ACTION.FIX, { fixInfo })
        }

        const onEvent = () => {
            const { eventHub } = this.utils
            eventHub.addEventListener(eventHub.eventType.fileEdited, this.utils.debounce(this.checkLint, 500))
            eventHub.addEventListener(eventHub.eventType.allPluginsHadInjected, () => setTimeout(this.initLint, 1000))
            eventHub.addEventListener(eventHub.eventType.toggleSettingPage, force => {
                if (force) {
                    this.utils.toggleVisible(this.entities.modal, force)
                }
                if (this.entities.button) {
                    this.utils.toggleVisible(this.entities.button, force)
                }
            })
        }

        const _getDetail = async (infos = this.fixInfos) => {
            const attrs = ["lineNumber", "ruleNames", "errorDetail", "errorContext", "errorRange", "fixInfo"]
            const obj = infos.map(info => this.utils.pick(info, attrs))
            const content = JSON.stringify(obj.length === 1 ? obj[0] : obj, null, "\t")
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
                const doc = Object.entries(this.TRANSLATIONS).map(([key, value]) => `${key}\t${value}`).join("\n")
                const viewRules = () => this.utils.openUrl("https://github.com/DavidAnson/markdownlint/blob/main/doc/Rules.md")
                const op = {
                    title: this.i18n.t("func.doc"),
                    schema: [
                        { fields: [{ type: "textarea", key: "doc", rows: 11 }] },
                        { fields: [{ type: "action", key: "viewRules", label: this.i18n.t("$label.viewMarkdownlintRules") }] },
                    ],
                    data: { doc },
                    action: { viewRules },
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
            translate: () => {
                this.config.translate = !this.config.translate
                this.checkLint()
                this.utils.settings.saveSettings(this.fixedName, { translate: this.config.translate })
            },
        }

        const onElementEvent = () => {
            this.utils.dragFixedModal(this.entities.moveIcon, this.entities.modal, false)
            if (this.entities.button) {
                this.entities.button.addEventListener("click", this.callback)
            }
            this.entities.iconGroup.addEventListener("click", ev => {
                const target = ev.target.closest("[action]")
                if (target) {
                    const action = target.getAttribute("action")
                    const fn = funcMap[action]
                    fn && fn()
                }
            })
            this.entities.table.addEventListener("click", ev => {
                const target = ev.target.closest("[action]")
                if (target) {
                    const action = target.getAttribute("action")
                    const value = parseInt(target.dataset.value)
                    const fn = funcMap[action]
                    fn && fn(value)
                }
            })
            this.entities.modal.addEventListener("mousedown", ev => {
                ev.preventDefault()
                ev.stopPropagation()
                if (ev.button === 2) {
                    funcMap.toggleSourceMode()
                }
            })
        }

        initWorker(this.onCheck, this.onFix)
        onEvent()
        onElementEvent()
    }

    onCheck = fixInfos => {
        const { error_color, pass_color, translate, result_order_by } = this.config

        const compareFn = result_order_by === "ruleName"
            ? (a, b) => a.ruleNames[0] - b.ruleNames[0]
            : (a, b) => a.lineNumber - b.lineNumber
        this.fixInfos = fixInfos.sort(compareFn)

        if (this.entities.button) {
            this.entities.button.style.backgroundColor = this.fixInfos.length ? error_color : pass_color
        }
        if (!this.utils.isShow(this.entities.modal)) return

        const tds = this.fixInfos.map((item, idx) => {
            const rule = item.ruleNames[0]
            const lineNumber = item.lineNumber
            const desc = (translate && this.TRANSLATIONS[rule]) || item.ruleDescription
            const info = this.TOOLS.has("info")
                ? `<i class="ion-information-circled" action="detailSingle" data-value="${idx}"></i>`
                : ""
            const locate = this.TOOLS.has("locate")
                ? `<i class="ion-android-locate" action="jumpToLine" data-value="${lineNumber}"></i>`
                : ""
            const fixInfo = this.TOOLS.has("fix") && item.fixInfo
                ? `<i class="ion-wrench" action="fixSingle" data-value="${idx}"></i>`
                : ""
            return `<tr><td>${lineNumber}</td><td>${rule}</td><td>${desc}</td><td>${info}${locate}${fixInfo}</td></tr>`
        })
        this.entities.tbody.innerHTML = tds.length ? tds.join("") : `<tr><td colspan="4">${this.i18n._t("global", "empty")}</td></tr>`
    }

    onFix = async fileContent => {
        await this.utils.editCurrentFile(fileContent)
        this.utils.notification.show(this.i18n.t("func.fixAll.ok"))
        this.checkLint()
    }

    callback = async anchorNode => {
        this.utils.toggleVisible(this.entities.modal)
        this.checkLint()
    }
}

module.exports = {
    plugin: markdownLintPlugin
}
