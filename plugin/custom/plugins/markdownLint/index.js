class markdownLintPlugin extends BaseCustomPlugin {
    styleTemplate = () => ({ modal_width: (this.config.modal_width === "auto" ? "fit-content" : this.config.modal_width) })

    hint = () => "点击出现弹窗，再次点击隐藏弹窗"

    hotkey = () => [this.config.hotkey]

    html = () => `
        <div id="plugin-markdownlint" class="plugin-common-modal plugin-common-hidden"><pre tabindex="0"></pre></div>
        ${this.config.use_button ? '<div id="plugin-markdownlint-button" ty-hint="格式规范检测"></div>' : ""}
    `

    init = () => {
        this.entities = {
            modal: document.querySelector("#plugin-markdownlint"),
            pre: document.querySelector("#plugin-markdownlint pre"),
            button: document.querySelector("#plugin-markdownlint-button"),
        }
        this.updateLinter = this.getLinter(this.onMessage);
        this.translateMap = {
            MD001: "标题级别应该逐级递增，不允许跳级",
            MD002: "第一个标题应该是顶级标题",
            MD003: "在标题前加#号来表示标题级别",
            MD004: "无序列表的格式要求是一致的",
            MD005: "同级列表项的缩进要求是一致的",
            MD006: "最高级标题不能缩进",
            MD007: "无序列表嵌套时，使用两个空格缩进",
            MD008: "MD008",
            MD009: "行尾最多可以添加两个空格，用于表示换行",
            MD010: "不能使用tab缩进，要使用空格",
            MD011: "内联形式的链接的中括号和圆括号使用错误",
            MD012: "不能有连续的空行",
            MD013: "行的长度应该在一定范围内",
            MD014: "代码块中，终端命令除非后接其输出，否则前面不能有$符号",
            MD015: "MD015",
            MD016: "MD016",
            MD017: "MD017",
            MD018: "atx标题格式下，#号和文字之间需要一个空格隔开",
            MD019: "atx标题格式下，#号和文字之间的空格不能多于一个",
            MD020: "closed_atx标题格式下，文字和前后#号之间需用一个空格隔开",
            MD021: "closed_atx标题格式下，文字和前后#号之间的空格不能多于一个",
            MD022: "标题行的上下行必须都是空行",
            MD023: "标题行不能缩进",
            MD024: "不能连续出现内容重复的标题",
            MD025: "只能有一个一级标题",
            MD026: "标题不应以标点符号结尾",
            MD027: "引用区块的引用符号和文字之间有且只有一个空格",
            MD028: "两个引用区块间不能用空行隔开。引用区块中的空行要用>开头",
            MD029: "有序列表的序号必须从1开始，按顺序递增",
            MD030: "列表的每一列表项的标识符后只能空一格，后接列表内容",
            MD031: "单独的代码块前后需要用空行隔开",
            MD032: "列表前后需要用空行隔开，列表的缩进必须一致",
            MD033: "不建议使用HTML语句",
            MD034: "单纯的链接地址需要用尖括号包裹",
            MD035: "要求采用一致的水平线格式",
            MD036: "不应为整行文字加粗或斜体",
            MD037: "强调标记的内侧不应紧邻空格",
            MD038: "反引号的内侧不应紧邻空格",
            MD039: "链接中，中括号的内侧不应紧邻空格",
            MD040: "代码块应该指定编程语言",
            MD041: "文档正文一开始必须是一级标题",
            MD042: "链接的地址不能为空",
            MD043: "要求标题遵循一定的结构",
            MD044: "大小写错误",
            MD045: "图片链接必须包含描述文本",
            MD046: "代码块要用三个反引号包裹",
            MD047: "文档末尾需要一个空行结尾",
            MD048: "代码块应采用一致的分隔符",
            MD049: "要求采用一致的倾斜格式",
            MD050: "要求采用一致的加粗格式",
            MD051: "文内链接必须有效，不能指向一个不存在的标题",
            MD052: "引用链接和图片应该使用已经定义的标签",
            MD053: "链接和图片引用定义不可省略",
            MD054: "链接和图片格式要求是一致的，不能混用",
            MD055: "表格的分隔符格式要求是一致的，不能混用",
            MD056: "表格列数要求是一致的，不能省略或多余",
        }
    }

    process = () => {
        this.initEventHandler();
        this.onLineClick();
        this.registerFixLintHotkey();
    }

    getLinter = onMessage => {
        const worker = new Worker(this.utils.joinPath("./plugin/custom/plugins/markdownLint/linterWorker.js"));
        worker.onmessage = event => onMessage(event.data || "");
        this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.allPluginsHadInjected, () => {
            setTimeout(() => worker.postMessage({ action: "init", payload: this.config.rule_config }), 1000);
        })
        return async (filepath = this.utils.getFilePath()) => {
            let message;
            if (filepath) {
                await File.saveUseNode();
                message = { action: "lint-path", payload: filepath };
            } else {
                const content = await File.getContent();
                message = { action: "lint-content", payload: content };
            }
            worker.postMessage(message);
        }
    }

    onMessage = data => {
        const { error_color, pass_color } = this.config;
        if (this.entities.button) {
            this.entities.button.style.backgroundColor = data.length ? error_color : pass_color;
        }
        if (this.utils.isShow(this.entities.modal)) {
            this.entities.pre.innerHTML = this.genMarkdownlint(data);
        }
    }

    initEventHandler = () => {
        if (this.entities.button) {
            this.entities.button.addEventListener("click", this.callback);
        }
        if (this.config.allow_drag) {
            this.utils.dragFixedModal(this.entities.modal, this.entities.modal, true);
        }
        this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.fileEdited, this.updateLinter);
    }

    onLineClick = () => {
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
                        this.updateLinter();
                        break;
                    case "markdown-lint-refresh":
                        this.updateLinter();
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
                        this.scrollSourceView(lineToGo)
                        break;
                    case "markdown-lint-config":
                        const content = JSON.stringify(this.config.rule_config, null, "\t");
                        const components = [{ label: "当前配置", type: "textarea", rows: 15, readonly: "readonly", content }];
                        this.utils.modal({ title: "格式规范检测", components });
                        break;
                }
            }
        })
    }

    registerFixLintHotkey = () => this.utils.hotkeyHub.registerSingle(this.config.hotkey_fix_lint_error, this.fixLintError);

    callback = async anchorNode => {
        this.utils.toggleVisible(this.entities.modal);
        await this.updateLinter();
    }

    scrollSourceView = lineToGo => {
        const cm = File.editor.sourceView.cm;
        cm.scrollIntoView({ line: lineToGo - 1, ch: 0 });
        cm.setCursor({ line: lineToGo - 1, ch: 0 });
    }

    genMarkdownlint = content => {
        const { allow_drag, translate } = this.config;
        const hintList = ["鼠标右键：切换源码模式"];
        allow_drag && hintList.push("ctrl+鼠标拖动：移动窗口");
        const operateInfo = `<span title="${hintList.join('\n')}">💡</span>`;

        const config = `<a class="markdown-lint-config" title="当前配置">⚙️</a>`
        const tran = `<a class="markdown-lint-translate" title="翻译">🌐</a>`;
        const doc = `<a class="markdown-lint-doc" title="具体规则文档">📃</a>`;
        const refresh = `<a class="markdown-lint-refresh" title="强制刷新">🔄</a>`
        const close = `<a class="markdown-lint-close" title="关闭窗口">❌</a>`;

        const header = `Line  Rule   Error | ${operateInfo} ${doc} ${config} ${tran} ${refresh} ${close}\n`;
        const result = content.map(line => {
            const lineNo = line.lineNumber + "";
            const [rule, _] = line.ruleNames;
            const lineNum = `<a class="markdown-lint-error-line">${lineNo}</a>` + " ".repeat(6 - lineNo.length);
            const desc = translate ? this.translateMap[rule] : line.ruleDescription;
            return "\n" + lineNum + rule.padEnd(7) + desc;
        })
        return header + result.join("")
    }

    // 修复逻辑的入口函数
    fixLintError = async () => await this.utils.editCurrentFile(content => new lintFixer(content).prepare().format(this.config.try_fix_lint_error))
}

class lintFixer {
    constructor(content) {
        this.content = content;
    }

    prepare = () => {
        this.lineBreak = this.content.indexOf("\r\n") !== -1 ? "\r\n" : "\n";
        return this
    }

    format = lintTypeList => {
        lintTypeList.forEach(lintType => {
            const func = this[lintType.toUpperCase()];
            func && func();
        })
        return this.content
    }

    MD031 = () => {
        this.content = this.content
            .replace(/(\s*)(\r?\n)*\s*```[\s\S]*?```/g, (match, leadingSpaces) => this.lineBreak + leadingSpaces + match.trim() + this.lineBreak)
            .replace(/\r?\n(\s*)\r?\n/g, this.lineBreak.repeat(2));
    }

    MD047 = () => {
        if (!this.content.endsWith(this.lineBreak)) {
            this.content += this.lineBreak;
        }
    }
}

module.exports = {
    plugin: markdownLintPlugin
};