class markdownLintPlugin extends BaseCustomPlugin {
    styleTemplate = () => ({ modal_width: (this.config.modal_width === "auto" ? "fit-content" : this.config.modal_width) })

    hint = () => this.i18n.t("actHint")

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
                <div class="plugin-markdownlint-icon ion-gear-b" action="settings" ty-hint="${this.i18n.t("func.settings")}"></div>
                <div class="plugin-markdownlint-icon ion-document-text" action="doc" ty-hint="${this.i18n.t("func.doc")}"></div>
            </div>
            <div class="plugin-markdownlint-table">
                <table><thead><tr><th>LINE</th><th>RULE</th><th>ERROR</th><th>OP</th></tr></thead><tbody></tbody></table>
            </div>
        </div>
        ${this.config.use_button ? `<div id="plugin-markdownlint-button" ty-hint="${this.i18n.t("func.check")}"></div>` : ""}
    `

    init = () => {
        this.errors = []
        this.checkLint = this.utils.noop
        this.fixLint = this.utils.noop
        this.resetConfig = this.utils.noop
        this.translations = this.i18n.entries([...Object.keys(this.i18n.data)].filter(e => e.startsWith("MD")))
        this.entities = {
            modal: document.querySelector("#plugin-markdownlint"),
            iconGroup: document.querySelector("#plugin-markdownlint .plugin-markdownlint-icon-group"),
            moveIcon: document.querySelector('#plugin-markdownlint .plugin-markdownlint-icon[action="move"]'),
            tbody: document.querySelector("#plugin-markdownlint tbody"),
            button: document.querySelector("#plugin-markdownlint-button"),
        }
    }

    process = () => {
        const _getDetail = (infos = this.errors) => {
            const obj = infos.map(i => this.utils.fromObject(i, ["lineNumber", "ruleNames", "errorDetail", "errorContext", "errorRange", "fixInfo"]))
            const content = JSON.stringify(obj.length === 1 ? obj[0] : obj, null, "\t")
            const components = [{ label: "", type: "textarea", rows: 15, content }]
            const title = this.i18n.t("func.detailAll")
            const op = { title, components, width: "550px" }
            this.utils.dialog.modal(op)
        }

        const funcMap = {
            close: () => this.callback(),
            refresh: () => this.checkLint(),
            detailAll: () => _getDetail(this.errors),
            detailSingle: infoIdx => _getDetail([this.errors[infoIdx]]),
            fixAll: () => this.fixLint(),
            fixSingle: infoIdx => this.fixLint([this.errors[infoIdx]]),
            toggleSourceMode: () => File.toggleSourceMode(),
            doc: () => {
                const title = this.i18n.t("func.doc")
                const label = this.i18n.t("gotoWeb") + " " + '<a class="fa fa-external-link"></a>'
                const url = "https://github.com/DavidAnson/markdownlint/blob/main/doc/Rules.md"
                const onclick = ev => ev.target.closest("a") && this.utils.openUrl(url)
                const content = Object.entries(this.translations).map(([key, value]) => `${key}\t${value}`).join("\n")
                const components = [{ label, type: "p", onclick }, { label: "", type: "textarea", rows: 15, content }]
                const op = { title, components, width: "600px" }
                this.utils.dialog.modal(op)
            },
            settings: () => {
                const title = this.i18n.t("func.settings")
                const label = this.i18n.t("editConfigFile") + " " + '<a class="fa fa-external-link"></a>'
                const onclick = ev => ev.target.closest("a") && this.utils.runtime.openSettingFolder("custom_plugin.user.toml")
                const content = JSON.stringify(this.config.rule_config, null, "\t")
                const components = [{ label: label, type: "p", onclick }, { label: "", type: "textarea", rows: 15, content }]
                const op = { title, components, width: "550px" }
                this.utils.dialog.modal(op)
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
                this.utils.runtime.saveConfig(this.fixedName, { translate: this.config.translate })
            },
        }

        const initWorker = (onCheck, onFix) => {
            const worker = new Worker(this.utils.joinPath("./plugin/custom/plugins/markdownLint/linter-worker.js"))
            worker.onmessage = event => {
                const { action, result } = event.data || {}
                const on = action.startsWith("check") ? onCheck : onFix
                on(result)
            }
            this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.allPluginsHadInjected, () => {
                setTimeout(() => {
                    worker.postMessage({ action: "init", payload: { config: this.config.rule_config } })
                    this.checkLint()
                }, 1000)
            })
            const send = async (type, customPayload) => {
                const payload = { ...customPayload }
                const filePath = this.utils.getFilePath()
                const action = type + (filePath ? "Path" : "Content")
                if (filePath) {
                    payload.filePath = filePath
                } else {
                    payload.fileContent = await File.getContent()
                }
                worker.postMessage({ action, payload })
            }
            this.checkLint = () => send("check")
            this.fixLint = (fixInfo = this.errors) => send("fix", { fixInfo })
            this.resetConfig = () => worker.postMessage({ action: "assignConfig", payload: { config: this.config.rule_config } })
        }

        const onEvent = () => {
            const { eventHub } = this.utils
            eventHub.addEventListener(eventHub.eventType.fileEdited, this.utils.debounce(this.checkLint, 500))
            eventHub.addEventListener(eventHub.eventType.toggleSettingPage, force => {
                if (this.entities.button) {
                    this.utils.toggleVisible(this.entities.button, force)
                }
            })
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
                    funcMap[action] && funcMap[action]()
                }
            })
            this.entities.tbody.addEventListener("mousedown", ev => {
                ev.preventDefault()
                ev.stopPropagation()
                if (ev.button === 2) {
                    funcMap.toggleSourceMode()
                } else if (ev.button === 0) {
                    const target = ev.target.closest("[action]")
                    if (!target) {
                        File.editor.restoreLastCursor(ev)
                    } else {
                        const action = target.getAttribute("action")
                        const value = parseInt(target.dataset.value)
                        funcMap[action] && funcMap[action](value)
                    }
                }
            })
        }

        initWorker(this.onCheck, this.onFix)
        onEvent()
        onElementEvent()
    }

    onCheck = data => {
        this.errors = data

        const { error_color, pass_color, translate } = this.config
        if (this.entities.button) {
            this.entities.button.style.backgroundColor = data.length ? error_color : pass_color
        }
        if (!this.utils.isShow(this.entities.modal)) return

        const tbody = data.map((item, idx) => {
            const [rule, _] = item.ruleNames
            const lineNumber = item.lineNumber
            const desc = (translate && this.translations[rule]) || item.ruleDescription
            const info = `<i class="ion-information-circled" action="detailSingle" data-value="${idx}"></i>`
            const locate = `<i class="ion-android-locate" action="jumpToLine" data-value="${lineNumber}"></i>`
            const fixInfo = item.fixInfo ? `<i class="ion-wrench" action="fixSingle" data-value="${idx}"></i>` : ''
            return `<tr><td>${lineNumber}</td><td>${rule}</td><td>${desc}</td><td>${info}${locate}${fixInfo}</td></tr>`
        })
        this.entities.tbody.innerHTML = tbody.length ? tbody.join("") : `<tr><td colspan="4">Empty</td></tr>`
    }

    onFix = async data => {
        await this.utils.editCurrentFile(data)
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
