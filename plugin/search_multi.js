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
            searchGrammarModal: () => this.utils.searchStringParser.showGrammar(),
            toggleCaseSensitive: btn => {
                btn.classList.toggle("select");
                this.config.CASE_SENSITIVE = !this.config.CASE_SENSITIVE;
            },
        }
    }

    process = () => {
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

    searchMulti = async (rootPath = this.utils.getMountFolder(), input = this.entities.input.value) => {
        input = input.trim();
        input = this.config.CASE_SENSITIVE ? input : input.toLowerCase();
        if (!input) return;

        this.refreshResult();

        const ast = this.utils.searchStringParser.parse(input);
        const checker = ({ filePath, file, stats, buffer }) => {
            return this.utils.searchStringParser.checkByAST(ast, scope => {
                let result = "";
                if (scope === "all") {
                    result = `${buffer.toString()}\n${filePath}`;
                } else if (scope === "file") {
                    result = file
                } else if (scope === "path") {
                    result = filePath
                } else if (scope === "content") {
                    result = buffer.toString()
                } else if (scope === "ext") {
                    result = this.utils.Package.Path.extname(file)
                }
                return this.config.CASE_SENSITIVE ? result : result.toLowerCase();
            })
        }
        const verifyExt = filename => {
            if (filename.startsWith(".")) return false;
            const ext = this.utils.Package.Path.extname(filename).toLowerCase();
            const extension = ext.startsWith(".") ? ext.substring(1) : ext;
            return this.allowedExtensions.has(extension);
        };
        const verifySize = stat => 0 > this.config.MAX_SIZE || stat.size < this.config.MAX_SIZE;

        await this.traverseDir(
            rootPath,
            (filepath, stat) => verifySize(stat) && verifyExt(filepath),
            path => !this.config.IGNORE_FOLDERS.includes(path),
            this.appendItemFunc(rootPath, checker),
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

    getQueryTokens = () => {
        const parser = this.utils.searchStringParser;
        const { KEYWORD, PHRASE, REGEXP, OR, AND, NOT } = parser.TYPE;

        function evaluate({ type, left, right, value, scope }) {
            switch (type) {
                case KEYWORD:
                case PHRASE:
                    return (scope === "content" || scope === "all") ? [value] : [];
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

        const query = this.searcher.entities.input.value;
        return evaluate(parser.parse(query));
    }

    syncOption = () => {
        const keyArr = this.getQueryTokens(this.searcher.entities.input.value);
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
