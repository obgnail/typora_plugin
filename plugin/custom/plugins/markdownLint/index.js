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
                    switch (a.className) {
                        case "markdown-lint-doc":
                            this.utils.openUrl("https://github.com/DavidAnson/markdownlint/blob/main/doc/Rules.md");
                            break;
                        case "markdown-lint-translate":
                            this.config.translate = !this.config.translate;
                            this.checkLintError();
                            break;
                        case "markdown-lint-refresh":
                            this.checkLintError();
                            break;
                        case "markdown-lint-fix":
                            this.fixLintError();
                            break;
                        case "markdown-lint-close":
                            this.callback();
                            break;
                        case "markdown-lint-error-line":
                            const lineToGo = parseInt(a.textContent);
                            if (!lineToGo) return;
                            if (!File.editor.sourceView.inSourceMode) {
                                File.toggleSourceMode();
                            }
                            _scrollSourceView(lineToGo)
                            break;
                        case "markdown-lint-errors":
                        case "markdown-lint-config":
                            const [obj, label] = a.className === "markdown-lint-errors"
                                ? [this.errors.map(i => this.utils.fromObject(i, ["lineNumber", "ruleNames", "errorDetail", "errorContext", "errorRange", "fixInfo"])), "详细信息"]
                                : [this.config.rule_config, "当前配置"]
                            const content = JSON.stringify(obj, null, "\t");
                            const components = [{ label, type: "textarea", rows: 15, readonly: "readonly", content }];
                            this.utils.modal({ title: "格式规范检测", width: "550px", components });
                            break;
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
                    worker.postMessage({ action: "init", payload: this.config.rule_config });
                    this.checkLintError();
                }, 1000);
            })
            const send = async type => {
                const filepath = this.utils.getFilePath();
                const payload = filepath ? filepath : await File.getContent();
                const action = type + (filepath ? "Path" : "Content");
                worker.postMessage({ action, payload });
            }
            this.checkLintError = () => send("check");
            this.fixLintError = () => send("lint");
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
        const operateInfo = `<span title="${hintList.join('\n')}">💡</span>`;

        const aList = [
            ["markdown-lint-errors", "详细信息", "🔍"],
            ["markdown-lint-config", "当前配置", "⚙️"],
            ["markdown-lint-translate", "翻译", "🌐"],
            ["markdown-lint-doc", "规则文档", "📃"],
            ["markdown-lint-fix", "尽力修复规范错误", "🛠️"],
            ["markdown-lint-refresh", "强制刷新", "🔄"],
            ["markdown-lint-close", "关闭窗口", "❌"],
        ].map(([cls, title, icon]) => `<a class="${cls}" title="${title}">${icon}</a>`)

        const header = `Line  Rule   Error | ${operateInfo} ${aList.join(" ")}\n`;
        const result = content.map(line => {
            const lineNo = line.lineNumber + "";
            const [rule, _] = line.ruleNames;
            const lineNum = `<a class="markdown-lint-error-line">${lineNo}</a>` + " ".repeat(6 - lineNo.length);
            const desc = (translate && this.l10n[rule]) || line.ruleDescription;
            return "\n" + lineNum + rule.padEnd(7) + desc;
        })
        return header + result.join("")
    }
}

module.exports = {
    plugin: markdownLintPlugin
};