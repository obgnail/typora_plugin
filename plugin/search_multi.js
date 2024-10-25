class searchMultiKeywordPlugin extends BasePlugin {
    styleTemplate = () => true

    html = () => `
        <div id="plugin-search-multi" class="plugin-common-modal plugin-common-hidden">
            <div id="plugin-search-multi-input">
                <input type="text" placeholder="多关键字查找">
                <div class="plugin-search-multi-btn-group">
                    <span class="option-btn" action="searchGrammarModal" ty-hint="查看搜索语法">
                        <div class="fa fa-info-circle"></div>
                    </span>
                    <span class="option-btn ${(this.config.CASE_SENSITIVE) ? "select" : ""}" action="toggleCaseSensitive" ty-hint="区分大小写">
                        <svg class="icon"><use xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="#find-and-replace-icon-case"></use></svg>
                    </span>
                </div>
            </div>

            <div class="plugin-search-multi-result plugin-common-hidden">
                <div class="search-result-title" data-lg="Menu">匹配的文件</div>
                <div class="search-result-list"></div>
            </div>

            <div class="plugin-search-multi-info-item plugin-common-hidden">
                <div class="plugin-search-multi-info" data-lg="Front">Searching</div>
                <div class="typora-search-spinner">
                    <div class="rect1"></div><div class="rect2"></div><div class="rect3"></div><div class="rect4"></div><div class="rect5"></div>
                </div>
            </div>
        </div>
    `

    hotkey = () => [{ hotkey: this.config.HOTKEY, callback: this.call }]

    init = () => {
        this.searchHelper = new SearchHelper(this);
        this.allowedExtensions = new Set(this.config.ALLOW_EXT.map(ext => ext.toLowerCase()));
        this.entities = {
            modal: document.querySelector("#plugin-search-multi"),
            input: document.querySelector("#plugin-search-multi-input input"),
            buttonGroup: document.querySelector(".plugin-search-multi-btn-group"),
            result: document.querySelector(".plugin-search-multi-result"),
            resultTitle: document.querySelector(".plugin-search-multi-result .search-result-title"),
            resultList: document.querySelector(".plugin-search-multi-result .search-result-list"),
            info: document.querySelector(".plugin-search-multi-info-item"),
        }
        this.actionMap = {
            searchGrammarModal: () => this.searchHelper.showGrammar(),
            toggleCaseSensitive: btn => {
                btn.classList.toggle("select");
                this.config.CASE_SENSITIVE = !this.config.CASE_SENSITIVE;
            },
        }
    }

    process = () => {
        this.searchHelper.process();

        this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.allPluginsHadInjected, () => {
            const highlighter = this.utils.getPlugin("multi_highlighter");
            highlighter && new LinkHelper(this, highlighter).process();
        })
        if (this.config.REFOUCE_WHEN_OPEN_FILE) {
            this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.otherFileOpened, () => {
                !this.isModalHidden() && setTimeout(() => this.entities.input.select(), 300);
            })
        }
        if (this.config.ALLOW_DRAG) {
            this.utils.dragFixedModal(this.entities.input, this.entities.modal);
        }

        this.entities.resultList.addEventListener("click", ev => {
            const target = ev.target.closest(".plugin-search-multi-item");
            if (!target) return;
            const filepath = target.dataset.path;
            this.utils.openFile(filepath);
            this.config.AUTO_HIDE && this.utils.hide(this.entities.modal);
        });
        this.entities.buttonGroup.addEventListener("click", ev => {
            const btn = ev.target.closest(".option-btn");
            const action = btn.getAttribute("action");
            this.actionMap[action] && this.actionMap[action](btn);
        })
        this.entities.input.addEventListener("keydown", ev => {
            switch (ev.key) {
                case "Enter":
                    if (!this.utils.metaKeyPressed(ev)) {
                        this.searchMulti();
                        return;
                    }
                    const select = this.entities.resultList.querySelector(".plugin-search-multi-item.active");
                    if (!select) return;
                    this.utils.openFile(select.dataset.path);
                    this.entities.input.focus();
                    break
                case "Escape":
                case "Backspace":
                    if (ev.key === "Escape" || ev.key === "Backspace" && this.config.BACKSPACE_TO_HIDE && !this.entities.input.value) {
                        this.hide();
                    }
                    break
                case "ArrowUp":
                case "ArrowDown":
                    ev.stopPropagation();
                    ev.preventDefault();
                    this.utils.scrollActiveItem(this.entities.resultList, ".plugin-search-multi-item.active", ev.key === "ArrowDown");
            }
        });
    }

    traverseDir = async (dir, fileFilter, dirFilter, callback) => {
        const { Fs: { promises: { readdir, stat, readFile } }, Path } = this.utils.Package;

        async function traverse(dir) {
            const files = await readdir(dir);
            await Promise.all(files.map(async file => {
                const filePath = Path.join(dir, file);
                const stats = await stat(filePath);
                if (stats.isFile() && (!fileFilter || fileFilter(filePath, stats))) {
                    const buffer = await readFile(filePath);
                    callback({ filePath, stats, buffer, file });
                } else if (stats.isDirectory() && (!dirFilter || dirFilter(file))) {
                    await traverse(filePath);
                }
            }))
        }

        await traverse(dir);
    }

    refreshResult = () => {
        this.utils.hide(this.entities.result);
        this.utils.show(this.entities.info);
        this.entities.resultList.innerHTML = "";
    }

    appendItemFunc = (rootPath, checker) => {
        let index = 0;
        const showResult = this.utils.once(() => this.utils.show(this.entities.result));
        const { RELATIVE_PATH, SHOW_MTIME } = this.config;
        const newResultItem = (rootPath, filePath, stats) => {
            const { dir, base } = this.utils.Package.Path.parse(filePath);
            const dirPath = RELATIVE_PATH ? dir.replace(rootPath, ".") : dir;

            const item = document.createElement("div");
            item.className = "plugin-search-multi-item";
            item.setAttribute("data-path", filePath);
            if (SHOW_MTIME) {
                const time = stats.mtime.toLocaleString("chinese", { hour12: false });
                item.setAttribute("ty-hint", time);
            }

            const title = document.createElement("div");
            title.className = "plugin-search-multi-item-title";
            title.textContent = base;

            const path = document.createElement("div");
            path.className = "plugin-search-multi-item-path";
            path.textContent = dirPath + this.utils.separator;

            item.append(title, path);
            return item
        }

        return ({ filePath, file, stats, buffer }) => {
            if (!checker({ filePath, file, stats, buffer })) return;

            index++;
            const item = newResultItem(rootPath, filePath, stats);
            this.entities.resultList.appendChild(item);
            this.entities.resultTitle.textContent = `匹配的文件：${index}`;
            showResult();
        }
    }

    _getAST = input => {
        try {
            const ast = this.searchHelper.parse(input);
            return this.searchHelper.test(ast)
        } catch (e) {
            this.utils.notification.show(`语法错误，请检测输入内容\n${e.toString()}`, "error", 7000);
        }
    }

    searchMulti = async (rootPath = this.utils.getMountFolder(), input = this.entities.input.value) => {
        input = input.trim();
        if (!input) return;

        const ast = this._getAST(input);
        if (!ast) return;

        const checker = dataset => this.searchHelper.check(ast, dataset);
        const appendItem = this.appendItemFunc(rootPath, checker);
        const verifyExt = filename => {
            if (filename.startsWith(".")) return false;
            const ext = this.utils.Package.Path.extname(filename).toLowerCase();
            const extension = ext.startsWith(".") ? ext.substring(1) : ext;
            return this.allowedExtensions.has(extension);
        };
        const verifySize = stat => 0 > this.config.MAX_SIZE || stat.size < this.config.MAX_SIZE;

        this.refreshResult();
        await this.traverseDir(
            rootPath,
            (filepath, stat) => verifySize(stat) && verifyExt(filepath),
            path => !this.config.IGNORE_FOLDERS.includes(path),
            appendItem,
        );
        this.utils.hide(this.entities.info);
    }

    isModalHidden = () => this.utils.isHidden(this.entities.modal);
    hide = () => {
        this.utils.hide(this.entities.modal);
        this.utils.hide(this.entities.info);
    }
    show = () => {
        this.utils.show(this.entities.modal);
        setTimeout(() => this.entities.input.select());
    }
    call = () => {
        if (!this.isModalHidden()) {
            this.hide();
        } else {
            this.show();
        }
    }
}

class SearchHelper {
    constructor(plugin) {
        this.plugin = plugin;
        this.config = plugin.config;
        this.utils = plugin.utils;
        this.parser = plugin.utils.searchStringParser;
        this.qualifiers = new Map();
        this.operator = {
            ":": (a, b) => a.includes(b),
            ">=": (a, b) => a >= b,
            "<=": (a, b) => a <= b,
            ">": (a, b) => a > b,
            "<": (a, b) => a < b,
            "=": (a, b) => a === b,
        }
    }

    process() {
        // There is a difference between KB and KiB, but who cares?
        const units = {
            b: 1,
            k: 1024,
            m: 1024 ** 2,
            g: 1024 ** 3,
            t: 1024 ** 4,
            kb: 1024,
            mb: 1024 ** 2,
            gb: 1024 ** 3,
            tb: 1024 ** 4,
            kib: 1024,
            mib: 1024 ** 2,
            gib: 1024 ** 3,
            tib: 1024 ** 4,
        }
        const convertToBytes = sizeString => {
            const match = sizeString.match(/^(\d+(\.\d+)?)([a-z]+)$/i);
            if (!match) {
                throw new Error(`Invalid size format: "${sizeString}"`);
            }
            const value = parseFloat(match[1]);
            const unit = match[3].toLowerCase();
            if (!units.hasOwnProperty(unit)) {
                throw new Error(`Unsupported unit: "${unit}"`);
            }
            const bytes = value * units[unit];
            return Math.round(bytes);
        }

        const keywordMatch = (scope, operator, operand, queryResult) => {
            queryResult = this.config.CASE_SENSITIVE ? queryResult : queryResult.toLowerCase();
            // operand 先前已经做了大小写转化处理，这里不再需要做了
            return queryResult.includes(operand);
        }
        const regexpMatch = (scope, operator, operand, queryResult) => {
            return new RegExp(operand).test(queryResult.toString());
        }
        const numberCompare = (scope, operator, operand, queryResult) => {
            return this.operator[operator](queryResult, operand);
        }
        const stringTest = (scope, operator, operand, type) => {
            if (operator !== ":" && operator !== "=") {
                throw new Error(`${scope}’s operator can only be ":" or "="`);
            }
        }
        const numberTest = (scope, operator, operand, type) => {
            if (operator === ":") {
                throw new Error(`${scope}’s operator can not be ":"`);
            }
            if (type === "regexp") {
                throw new Error(`${scope}’s operand type can not be regexp`);
            }
            if (/^"?\d/.test(operand)) {
                return new Error(`${scope}’s operand must start with number`);
            }
        }

        /**
         * scope:   关键字
         * query:   从fileData中查询需要的信息
         * keyword: 当用户输入keyword时，根据查询的信息和input进行匹配，默认使用keywordMatch
         * phrase:  当用户输入phrase时，根据查询的信息和input进行匹配，默认和keyword保持一致
         * regexp:  当用户输入regexp时，根据查询的信息和input进行匹配，默认使用regexpMatch
         * test:    测试用户输入是否合法，默认使用stringTest
         */
        const qualifiers = [
            {
                scope: "default",
                query: ({ filePath, file, stats, buffer }) => `${buffer.toString()}\n${filePath}`,
            },
            {
                scope: "file",
                query: ({ filePath, file, stats, buffer }) => file,
            },
            {
                scope: "path",
                query: ({ filePath, file, stats, buffer }) => filePath,
            },
            {
                scope: "content",
                query: ({ filePath, file, stats, buffer }) => buffer.toString(),
            },
            {
                scope: "ext",
                query: ({ filePath, file, stats, buffer }) => this.utils.Package.Path.extname(file),
            },
            {
                scope: "size",
                query: ({ filePath, file, stats, buffer }) => stats.size,
                keyword: (scope, operator, operand, queryResult) => numberCompare(scope, operator, convertToBytes(operand), queryResult),
                test: (scope, operator, operand, type) => {
                    numberTest(scope, operator, operand, type);
                    convertToBytes(operand);
                },
            },
            {
                scope: "time",
                query: ({ filePath, file, stats, buffer }) => stats.mtime,
                keyword: (scope, operator, operand, queryResult) => numberCompare(scope, operator, new Date(operand), queryResult),
                test: numberTest,
            }
        ];
        qualifiers.forEach(q => {
            q.keyword = q.keyword || keywordMatch;
            q.phrase = q.phrase || q.keyword;
            q.regexp = q.regexp || regexpMatch;
            q.test = q.test || stringTest;
        });
        qualifiers.forEach(q => this.registerQualifier(q.scope, q));
        this.parser.setQualifier(qualifiers.map(q => q.scope), Array.from(Object.keys(this.operator)));
    }

    registerQualifier(scope, qualifier) {
        this.qualifiers.set(scope, qualifier);
    }

    check(ast, source) {
        return this.parser.evaluate(ast, this._buildSearchFunctions(ast, source));
    }

    _buildSearchFunctions(ast, source) {
        const keyword = (scope, operator, operand) => this._getSearchFunc(scope, operator, operand, source, "keyword");
        const phrase = (scope, operator, operand) => this._getSearchFunc(scope, operator, operand, source, "phrase");
        const regexp = (scope, operator, operand) => this._getSearchFunc(scope, operator, operand, source, "regexp");
        return { keyword, phrase, regexp };
    }

    _getSearchFunc(scope, operator, operand, source, type) {
        const qualifier = this.qualifiers.get(scope);
        const queryResult = qualifier.query.call(this, source);
        return qualifier[type].call(this, scope, operator, operand, queryResult);
    }

    test(ast) {
        const buildTestFunction = type => (scope, operator, operand) => {
            const { test } = this.qualifiers.get(scope);
            test.call(this, scope, operator, operand, type);
        }
        const keyword = buildTestFunction("keyword");
        const phrase = buildTestFunction("phrase");
        const regexp = buildTestFunction("regexp");
        this.parser.traverse(ast, { keyword, phrase, regexp });
        return ast
    }

    parse(input) {
        input = this.config.CASE_SENSITIVE ? input : input.toLowerCase();
        return this.parser.parse(input)
    }

    getQueryTokens(query) {
        const { KEYWORD, PHRASE, REGEXP, OR, AND, NOT } = this.parser.TYPE;

        function evaluate({ type, left, right, value, scope }) {
            switch (type) {
                case KEYWORD:
                case PHRASE:
                    return (scope === "content" || scope === "default") ? [value] : [];
                case REGEXP:
                    return [];
                case OR:
                case AND:
                    return [...evaluate(left), ...evaluate(right)];
                case NOT:
                    const wont = evaluate(right);
                    return (left ? evaluate(left) : []).filter(e => !wont.includes(e));
                default:
                    throw new Error(`Unknown AST node type: ${type}`);
            }
        }

        const ast = this.parser.parse(query);
        return evaluate(ast);
    }

    showGrammar() {
        const table1 = `
<table>
    <tr><th>关键字</th><th>说明</th></tr>
    <tr><td>whitespace</td><td>表示与，文档应该同时包含全部关键词</td></tr>
    <tr><td>|</td><td>表示或，文档应该包含关键词之一，等价于 OR</td></tr>
    <tr><td>-</td><td>表示非，文档不能包含关键词</td></tr>
    <tr><td>""</td><td>词组</td></tr>
    <tr><td>qualifier</td><td>限定查找范围：default | file | path | ext | content | size | time<br/>默认值 default = path + content</td></tr>
    <tr><td>//</td><td>JavaScript 风格的正则表达式</td></tr>
    <tr><td>()</td><td>小括号，用于调整运算顺序</td></tr>
</table>`

        const table2 = `
<table>
    <tr><th>示例</th><th>搜索文档</th></tr>
    <tr><td>foo bar</td><td>包含 foo 和 bar</td></tr>
    <tr><td>foo OR bar</td><td>包含 foo 或 bar</td></tr>
    <tr><td>foo bar -zoo</td><td>包含 foo 和 bar 但不含 zoo</td></tr>
    <tr><td>"foo bar"</td><td>包含 foo bar 这一词组</td></tr>
    <tr><td>path:/[a-z]{3}/ content:bar</td><td>路径匹配 [a-z]{3} 且内容包含 bar</td></tr>
    <tr><td>file:(info | warn | err) -ext:log</td><td>文件名包含 info 或 warn 或 err，但扩展名不含 log</td></tr>
    <tr><td>file:foo size>=100k time>"2024-03-12"</td><td>文件名包含 foo，且体积大等于 100k，且更新时间大于 2024-03-12</td></tr>
</table>`

        const content = `
<query> ::= <expr>
<expr> ::= <term> ( <or> <term> )*
<term> ::= <factor> ( <not_and> <factor> )*
<factor> ::= <qualifier>? <match>
<qualifier> ::= <scope> <operator>
<match> ::= <keyword> | '"'<keyword>'"' | '/'<regexp>'/' | '('<expr>')'
<not_and> ::= '-' | ' '
<or> ::= 'OR' | '|'
<keyword> ::= [^"]+
<regexp> ::= [^/]+
<operator> ::= ':' | '=' | '>=' | '<=' | '>' | '<'
<scope> ::= 'default' | 'file' | 'path' | 'ext' | 'content' | 'size' | 'time'`

        const title = "这段文字是语法的形式化表述，你可以把它塞给AI，AI会为你解释";
        const components = [{ label: table1, type: "p" }, { label: table2, type: "p" }, { label: "", type: "textarea", rows: 12, content, title }];
        this.utils.dialog.modal({ title: "高级搜索", width: "600px", components });
    }
}

class LinkHelper {
    constructor(searcher, highlighter) {
        this.searcher = searcher;
        this.highlighter = highlighter;
        this.utils = searcher.utils;

        this.originValue = this.highlighter.config.RESEARCH_WHILE_OPEN_FILE;
        this.styleList = ["position", "padding", "backgroundColor", "boxShadow", "border"];

        this.highlighterModal = document.querySelector("#plugin-multi-highlighter");
        this.highlighterInput = document.querySelector("#plugin-multi-highlighter-input");
        this.button = this.genButton();
    }

    process = () => {
        const isLinking = () => this.searcher.config.LINK_OTHER_PLUGIN && !this.searcher.isModalHidden();

        // 当处于联动状态，在search_multi搜索前先设置highlighter的inputValue和caseSensitive
        this.utils.decorate(() => this.highlighter, "highlight", () => isLinking() && this.syncOption());
        // 当处于联动状态，search_multi触发搜索的时候，先触发highlighter搜索
        this.utils.decorate(() => this.searcher, "searchMulti", () => isLinking() && this.highlighter.highlight());
        // 当处于联动状态，highlighter要展示modal之前，先恢复状态
        this.utils.decorate(() => this.highlighter, "toggleModal", () => this.searcher.config.LINK_OTHER_PLUGIN && this.toggle(true));
        // 当处于联动状态，在search_multi关闭前关闭highlighter
        this.utils.decorate(() => this.searcher, "hide", () => isLinking() && this.toggle(true));
        // 当处于联动状态，在search_multi开启前开启highlighter
        this.utils.decorate(() => this.searcher, "show", () => !this.searcher.config.LINK_OTHER_PLUGIN && this.toggle());

        this.searcher.actionMap.toggleLinkPlugin = () => this.toggle(true);
    }

    genButton = () => {
        const wantLink = this.searcher.config.LINK_OTHER_PLUGIN;
        const span = document.createElement("span");
        span.className = `option-btn ${wantLink ? "select" : ""}`;
        span.setAttribute("action", "toggleLinkPlugin");
        span.setAttribute("ty-hint", "插件联动");
        const div = document.createElement("div");
        div.className = "fa fa-link";
        span.appendChild(div);
        this.searcher.entities.buttonGroup.appendChild(span);
        wantLink && this.moveElement();
        return span
    }

    toggle = (forceHide = false) => {
        this.button.classList.toggle("select");
        this.searcher.config.LINK_OTHER_PLUGIN = !this.searcher.config.LINK_OTHER_PLUGIN;
        if (this.searcher.config.LINK_OTHER_PLUGIN) {
            this.moveElement();
            this.highlighter.highlight();
        } else {
            this.restoreElement(forceHide);
        }
        this.syncOption();
    }

    syncOption = () => {
        const keyArr = this.searcher.searchHelper.getQueryTokens(this.searcher.entities.input.value);
        const value = keyArr.map(key => key.includes(" ") ? `"${key}"` : key).join(" ");
        document.querySelector("#plugin-multi-highlighter-input input").value = value;
        if (this.searcher.config.CASE_SENSITIVE !== this.highlighter.config.CASE_SENSITIVE) {
            document.querySelector(".plugin-multi-highlighter-option-btn").click();
        }
    }

    moveElement = () => {
        this.utils.removeElement(this.highlighterModal);
        const input = document.querySelector("#plugin-search-multi-input");
        input.parentNode.insertBefore(this.highlighterModal, input.nextSibling);

        this.utils.show(this.highlighterModal);
        this.utils.hide(this.highlighterInput);
        this.styleList.forEach(style => this.highlighterModal.style[style] = "initial");
        this.highlighter.config.RESEARCH_WHILE_OPEN_FILE = true;
    }

    restoreElement = forceHide => {
        this.utils.removeElement(this.highlighterModal);
        this.utils.insertElement(this.highlighterModal);

        this.utils.toggleVisible(this.highlighterModal, forceHide);
        this.utils.show(this.highlighterInput);
        this.styleList.forEach(style => this.highlighterModal.style[style] = "");
        this.highlighter.config.RESEARCH_WHILE_OPEN_FILE = this.originValue;
    }
}

module.exports = {
    plugin: searchMultiKeywordPlugin
};
