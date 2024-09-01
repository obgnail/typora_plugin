class markdownLintPlugin extends BaseCustomPlugin {
    styleTemplate = () => ({ modal_width: (this.config.modal_width === "auto" ? "fit-content" : this.config.modal_width) })

    hint = () => "点击出现弹窗，再次点击隐藏弹窗"

    hotkey = () => [
        { hotkey: this.config.hotkey, callback: this.callback },
        { hotkey: this.config.hotkey_fix_lint_error, callback: this.fixLintError },
    ]

    html = () => `
        <div id="plugin-markdownlint" class="plugin-common-modal plugin-common-hidden"><pre tabindex="0"></pre></div>
        ${this.config.use_button ? '<div id="plugin-markdownlint-button" ty-hint="格式规范检测"></div>' : ""}
    `

    init = () => {
        this.errors = [];
        this.checkLintError = () => undefined;
        this.fixLintError = () => undefined;
        this.entities = {
            modal: document.querySelector("#plugin-markdownlint"),
            pre: document.querySelector("#plugin-markdownlint pre"),
            button: document.querySelector("#plugin-markdownlint-button"),
        }
        this.l10n = require("./l10n.js");
    }

    process = () => {
        const _scrollSourceView = lineToGo => {
            const cm = File.editor.sourceView.cm;
            cm.scrollIntoView({ line: lineToGo - 1, ch: 0 });
            cm.setCursor({ line: lineToGo - 1, ch: 0 });
        }
        const _funcMap = {
            "markdown-lint-doc": a => this.utils.openUrl("https://github.com/DavidAnson/markdownlint/blob/main/doc/Rules.md"),
            "markdown-lint-translate": a => {
                this.config.translate = !this.config.translate;
                this.checkLintError();
            },
            "markdown-lint-refresh": a => this.checkLintError(),
            "markdown-lint-fix-all": a => this.fixLintError(),
            "markdown-lint-fix-single": a => {
                const idx = parseInt(a.dataset.idx);
                const errors = [this.errors[idx]];
                this.fixLintError(errors);
            },
            "markdown-lint-close": a => this.callback(),
            "markdown-lint-error-line": a => {
                const lineToGo = parseInt(a.textContent);
                if (!lineToGo) return;
                if (!File.editor.sourceView.inSourceMode) {
                    File.toggleSourceMode();
                }
                _scrollSourceView(lineToGo)
            },
            "markdown-lint-errors": a => {
                const obj = this.errors.map(i => this.utils.fromObject(i, ["lineNumber", "ruleNames", "errorDetail", "errorContext", "errorRange", "fixInfo"]));
                const label = "详细信息";
                const content = JSON.stringify(obj, null, "\t");
                const components = [{ label, type: "textarea", rows: 15, readonly: "readonly", content }];
                this.utils.modal({ title: "格式规范检测", width: "550px", components });
            },
            "markdown-lint-config": a => {
                const obj = this.config.rule_config;
                const label = "当前配置";
                const content = JSON.stringify(obj, null, "\t");
                const components = [{ label, type: "textarea", rows: 15, readonly: "readonly", content }];
                this.utils.modal({ title: "格式规范检测", width: "550px", components });
            }
        }
        const initEventHandler = () => {
            if (this.entities.button) {
                this.entities.button.addEventListener("click", this.callback);
            }
            if (this.config.allow_drag) {
                this.utils.dragFixedModal(this.entities.modal, this.entities.modal, true);
            }
            this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.fileEdited, this.utils.debounce(this.checkLintError, 500));
        }
        const onLineClick = () => {
            this.entities.pre.addEventListener("mousedown", ev => {
                ev.preventDefault();
                ev.stopPropagation();
                if (ev.button === 2) {
                    File.toggleSourceMode();
                    return;
                }
                if (ev.button === 0) {
                    const a = ev.target.closest("a");
                    if (!a) {
                        File.editor.restoreLastCursor(ev);
                        return;
                    }
                    if (_funcMap[a.className]) {
                        _funcMap[a.className](a);
                    }
                }
            })
        }
        const registerWorker = (onCheckMessage = this.onCheckMessage, onLintMessage = this.onLintMessage) => {
            const worker = new Worker(this.utils.joinPath("./plugin/custom/plugins/markdownLint/linter-worker.js"));
            worker.onmessage = event => {
                const { action, result } = event.data || {};
                const func = action.startsWith("check") ? onCheckMessage : onLintMessage;
                func(result);
            }
            this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.allPluginsHadInjected, () => {
                setTimeout(() => {
                    worker.postMessage({ action: "init", payload: { config: this.config.rule_config } });
                    this.checkLintError();
                }, 1000);
            })
            const send = async (type, customPayload) => {
                const payload = { ...customPayload };
                const filePath = this.utils.getFilePath();
                const action = type + (filePath ? "Path" : "Content");
                if (filePath) {
                    payload.filePath = filePath;
                } else {
                    payload.fileContent = await File.getContent();
                }
                worker.postMessage({ action, payload });
            }
            this.checkLintError = () => send("check");
            this.fixLintError = (fixInfo = this.errors) => send("lint", { fixInfo });
        }

        registerWorker();
        initEventHandler();
        onLineClick();
    }

    onCheckMessage = data => {
        this.errors = data;
        const { error_color, pass_color } = this.config;
        if (this.entities.button) {
            this.entities.button.style.backgroundColor = data.length ? error_color : pass_color;
        }
        if (this.utils.isShow(this.entities.modal)) {
            this.entities.pre.innerHTML = this.genMarkdownlint(data);
        }
    }

    onLintMessage = async data => {
        await this.utils.editCurrentFile(data);
        this.utils.notification.show("已部分修复规范错误");
    }

    callback = async anchorNode => {
        this.utils.toggleVisible(this.entities.modal);
        await this.checkLintError();
    }

    genMarkdownlint = content => {
        const { allow_drag, translate } = this.config;
        const hintList = ["鼠标右键：切换源码模式"];
        allow_drag && hintList.push("ctrl+鼠标拖动：移动窗口");
        const info = `<span title="${hintList.join('\n')}">💡</span>`;

        const aList = [
            ["markdown-lint-doc", "规则文档", "📃"],
            ["markdown-lint-config", "当前配置", "⚙️"],
            ["markdown-lint-translate", "翻译", "🌐"],
            ["markdown-lint-errors", "详细信息", "🔍"],
            ["markdown-lint-fix-all", "尽力修复规范错误", "🛠️"],
            ["markdown-lint-refresh", "强制刷新", "🔄"],
            ["markdown-lint-close", "关闭窗口", "❌"],
        ].map(([cls, title, icon]) => `<a class="${cls}" title="${title}">${icon}</a>`)

        const tool = `<span style="display: flex; justify-content: space-around;">${info}${aList.join(" ")}</span>`;
        const result = content.map((item, idx) => {
            const lineNo = item.lineNumber + "";
            const [rule, _] = item.ruleNames;
            const lineNum = `<a class="markdown-lint-error-line">${lineNo}</a>` + " ".repeat(6 - lineNo.length);
            const desc = (translate && this.l10n[rule]) || item.ruleDescription;
            const fixInfo = item.fixInfo ? ` [<a class="markdown-lint-fix-single" data-idx="${idx}">Fix</a>]` : '';
            return "\n" + lineNum + rule.padEnd(7) + desc + fixInfo;
        })
        return tool + result.join("")
    }
}

module.exports = {
    plugin: markdownLintPlugin
};