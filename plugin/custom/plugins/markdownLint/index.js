class markdownLintPlugin extends BaseCustomPlugin {
    styleTemplate = () => ({modal_width: (this.config.modal_width === "auto" ? "fit-content" : this.config.modal_width)})
    hint = () => "点击出现弹窗，再次点击隐藏弹窗"
    hotkey = () => [this.config.hotkey]
    htmlTemplate = () => {
        const hint = "当前禁用的检测规则：\n" + this.config.disable_rules.join("\n");
        const pre = [{ele: "pre", tabindex: "0", title: hint}];
        const el = [{id: "plugin-markdownlint", class_: "plugin-common-modal", style: {display: "none"}, children: pre}]
        if (this.config.use_button) {
            el.push({id: "plugin-markdownlint-button", "ty-hint": "markdown格式规范检测"});
        }
        return el
    }

    process = () => {
        this.entities = {
            modal: document.querySelector("#plugin-markdownlint"),
            pre: document.querySelector("#plugin-markdownlint pre"),
            button: document.querySelector("#plugin-markdownlint-button"),
        }
        this.initWorker();
        this.initEventHandler();
        this.onLineClick();
    }

    initWorker = () => {
        this.worker = new Worker(this.utils.joinPath("./plugin/custom/plugins/markdownLint/linterWorker.js"));
        this.worker.onmessage = ({data: content}) => {
            if (this.entities.button) {
                this.entities.button.style.backgroundColor = content.length ? this.config.error_color : this.config.pass_color;
            }
            if (this.entities.modal.style.display !== "none") {
                this.entities.pre.innerHTML = content.length ? this.genMarkdownlint(content) : this.config.pass_text
            }
        }
        setTimeout(() => this.worker.postMessage({action: "init", payload: this.config.disable_rules}), 1000);
    }

    initEventHandler = () => {
        if (this.entities.button) {
            this.entities.button.addEventListener("click", this.callback);
        }
        if (this.config.allow_drag) {
            this.utils.dragFixedModal(this.entities.modal, this.entities.modal, true);
        }
        const defaultTime = 500;
        const debounce = this.utils.debounce(this.updateLinter, Math.max(defaultTime, this.config.debounce_interval - defaultTime));
        this.utils.addEventListener(this.utils.eventType.fileEdited, debounce);
    }

    onLineClick = () => {
        this.entities.pre.addEventListener("mousedown", ev => {
            if (ev.button === 0) {
                const doc = ev.target.closest(".markdown-lint-doc");
                if (doc) {
                    this.utils.openUrl("https://github.com/markdownlint/markdownlint/blob/main/docs/RULES.md");
                    return;
                }
                const target = ev.target.closest("a");
                if (!target) return;
                const lineToGo = parseInt(target.textContent);
                if (!lineToGo) return;
                ev.preventDefault();
                ev.stopPropagation();
                if (!File.editor.sourceView.inSourceMode) {
                    File.toggleSourceMode();
                }
                const cm = File.editor.sourceView.cm;
                cm.scrollIntoView({line: lineToGo - 1, ch: 0});
                cm.setCursor({line: lineToGo - 1, ch: 0});
            } else if (ev.button === 2) {
                File.toggleSourceMode();
                ev.preventDefault();
                ev.stopPropagation();
            }
        })
    }

    updateLinter = () => this.worker.postMessage({action: "lint", payload: this.utils.getFilePath()});

    callback = async anchorNode => {
        this.entities.modal.style.display = this.entities.modal.style.display === "none" ? "" : "none";
        await this.updateLinter();
    }

    // 这么大的对象，不希望它常驻内存
    translate = () => ({
        "MD001": "标题层级一次只应增加一个级别",
        "MD002": "第一个标题必须是最高级的标题",
        "MD003": "在标题前加#号来表示标题级别",
        "MD004": "无序列表的格式要一致",
        "MD005": "同一个等级的列表的缩进要一致",
        "MD006": "最高级标题不能缩进",
        "MD007": "无序列表嵌套时，使用两个空格缩进",
        "MD008": "MD008",
        "MD009": "行尾最多可以添加两个空格，用于表示换行",
        "MD010": "不能使用tab缩进，要使用空格",
        "MD011": "内联形式的链接的中括号和圆括号使用错误",
        "MD012": "不能有连续的空行",
        "MD013": "行的最大长度是80",
        "MD014": "代码块中，终端命令除非后接其输出，否则前面不能有$符号",
        "MD015": "MD015",
        "MD016": "MD016",
        "MD017": "MD017",
        "MD018": "atx标题格式下，#号和文字之间需要一个空格隔开",
        "MD019": "atx标题格式下，#号和文字之间的空格不能多于一个",
        "MD020": "closed_atx标题格式下，文字和前后#号之间需用一个空格隔开",
        "MD021": "closed_atx标题格式下，文字和前后#号之间的空格不能多于一个",
        "MD022": "标题行的上下行必须都是空行",
        "MD023": "标题行不能缩进",
        "MD024": "不能连续出现内容重复的标题",
        "MD025": "只能有一个一级标题",
        "MD026": "标题不应以标点符号结尾",
        "MD027": "引用区块的引用符号和文字之间有且只有一个空格",
        "MD028": "两个引用区块间不能用空行隔开。引用区块中的空行要用>开头",
        "MD029": "有序列表必须从1开始，按顺序递增",
        "MD030": "列表的每一列表项的标识符后只能空一格，后接列表内容",
        "MD031": "单独的代码块前后需要用空行隔开",
        "MD032": "列表前后需要用空行隔开，列表的缩进必须一致",
        "MD033": "不允许使用HTML语句",
        "MD034": "单纯的链接地址需要用尖括号包裹",
        "MD035": "所有的水平线要和第一次创建时使用的符号一致",
        "MD036": "不应为整行文字加粗或斜体",
        "MD037": "强调标记的内侧不应紧邻空格",
        "MD038": "单反引号的内侧不应紧邻空格",
        "MD039": "链接中，中括号的内侧不应紧邻空格",
        "MD040": "代码块应该指定编程语言",
        "MD041": "文档正文一开始必须是一级标题",
        "MD042": "链接的地址不能为空",
        "MD043": "要求标题遵循一定的结构",
        "MD044": "指定一些名称，检查它是否有正确的大写",
        "MD045": "图片链接必须包含描述文本",
        "MD046": "代码块要用三个反引号包裹",
        "MD047": "文档末尾需要一个空行结尾",
    })

    genMarkdownlint = content => {
        const map = this.translate();
        const doc = `<a class="markdown-lint-doc" title="document">📖</a>`;
        const header = `line  rule   error${doc}\n`;
        const result = content.map(line => {
            const lineNo = line.lineNumber + "";
            const [ruleName, _] = line.ruleNames;
            const lineNum = `<a>${lineNo.padEnd(6)}</a>`;
            const desc = this.config.translate ? map[ruleName] : line.ruleDescription;
            return "\n" + lineNum + ruleName.padEnd(7) + desc;
        })
        return header + result
    }

    // 修复逻辑的入口函数
    fixLintError = async () => {
        const content = await this.utils.Package.Fs.promises.readFile(this.utils.getFilePath(), 'utf-8');
        const newContent = new lintFixer(content).prepare().format(this.config.try_fix_lint_error);
        File.reloadContent(newContent, {fromDiskChange: false});
    }
}

class lintFixer {
    constructor(content) {
        this.content = content;
    }

    prepare = () => {
        // 怀疑处理这些规范问题需要进行词法解析、语法解析，可以在这里准备好相关数据
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
        const codeBlockRegex = /(\s*)\n*\s*```[\s\S]*?```/g;
        this.content = this.content.replace(codeBlockRegex, (match, leadingSpaces) => {
            const trimmedMatch = match.trim();
            return `\n${leadingSpaces}${trimmedMatch}\n`;
        }).replace(/\n(\s*)\n/g, '\n\n');
    }
}

module.exports = {
    plugin: markdownLintPlugin
};