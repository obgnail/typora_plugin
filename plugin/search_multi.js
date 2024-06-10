class searchMultiKeywordPlugin extends BasePlugin {
    styleTemplate = () => true

    html = () => `
        <div id="plugin-search-multi" class="plugin-common-modal plugin-common-hidden">
            <div id="plugin-search-multi-input">
                <input type="text" placeholder="多关键字查找 空格分隔" title="空格分隔 引号包裹视为词组">
                <div class="plugin-search-multi-btn-group">
                    <span class="option-btn case-option-btn ${(this.config.CASE_SENSITIVE) ? "select" : ""}" ty-hint="区分大小写">
                        <svg class="icon"><use xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="#find-and-replace-icon-case"></use></svg>
                    </span>
                    <span class="option-btn path-option-btn ${(this.config.INCLUDE_FILE_PATH) ? "select" : ""}" ty-hint="将文件路径加入搜索内容">
                        <div class="fa fa-folder-open-o"></div>
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

    hotkey = () => [{hotkey: this.config.HOTKEY, callback: this.call}]

    init = () => {
        this.entities = {
            modal: document.getElementById('plugin-search-multi'),
            input: document.querySelector("#plugin-search-multi-input input"),
            buttonGroup: document.querySelector(".plugin-search-multi-btn-group"),
            result: document.querySelector(".plugin-search-multi-result"),
            resultTitle: document.querySelector(".plugin-search-multi-result .search-result-title"),
            resultList: document.querySelector(".plugin-search-multi-result .search-result-list"),
            info: document.querySelector(".plugin-search-multi-info-item"),
        }
    }

    process = () => {
        this.utils.addEventListener(this.utils.eventType.allPluginsHadInjected, () => {
            const highlighter = this.utils.getPlugin("multi_highlighter");
            highlighter && new LinkHelper(this, highlighter).process();
        })

        if (this.config.REFOUCE_WHEN_OPEN_FILE) {
            this.utils.addEventListener(this.utils.eventType.otherFileOpened, () => {
                if (!this.isModalHidden()) {
                    setTimeout(() => this.entities.input.select(), 300);
                }
            })
        }

        if (this.config.ALLOW_DRAG) {
            this.utils.dragFixedModal(this.entities.input, this.entities.modal);
        }

        this.entities.input.addEventListener("keydown", ev => {
            switch (ev.key) {
                case "Enter":
                    if (this.utils.metaKeyPressed(ev)) {
                        const select = this.entities.resultList.querySelector(".plugin-search-multi-item.active");
                        if (select) {
                            ev.preventDefault();
                            ev.stopPropagation();
                            const filepath = select.getAttribute("data-path");
                            if (ev.shiftKey) {
                                this.openFileInNewWindow(filepath, false);
                            } else {
                                this.openFileInThisWindow(filepath);
                            }
                            this.entities.input.focus();
                            return
                        }
                    }
                    this.searchMulti();
                    break
                case "Escape":
                case "Backspace":
                    if (ev.key === "Escape" || ev.key === "Backspace" && this.config.BACKSPACE_TO_HIDE && !this.entities.input.value) {
                        ev.stopPropagation();
                        ev.preventDefault();
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

        this.entities.resultList.addEventListener("click", ev => {
            const target = ev.target.closest(".plugin-search-multi-item");
            if (!target) return;

            ev.preventDefault();
            ev.stopPropagation();

            const filepath = target.getAttribute("data-path");
            if (this.utils.metaKeyPressed(ev)) {
                this.openFileInNewWindow(filepath, false);
            } else {
                this.openFileInThisWindow(filepath);
            }
            this.hideIfNeed();
        });

        this.entities.buttonGroup.addEventListener("click", ev => {
            const caseButton = ev.target.closest(".case-option-btn");
            const pathButton = ev.target.closest(".path-option-btn");

            if (caseButton || pathButton) {
                ev.preventDefault();
                ev.stopPropagation();
            }

            if (caseButton) {
                caseButton.classList.toggle("select");
                this.config.CASE_SENSITIVE = !this.config.CASE_SENSITIVE;
            } else if (pathButton) {
                pathButton.classList.toggle("select");
                this.config.INCLUDE_FILE_PATH = !this.config.INCLUDE_FILE_PATH;
            }
        })
    }

    openFileInThisWindow = filePath => File.editor.library.openFile(filePath);
    openFileInNewWindow = (path, isFolder) => File.editor.library.openFileInNewWindow(path, isFolder);

    traverseDir = (dir, fileFilter, dirFilter, callback, then) => {
        const {Fs: {promises: {readdir, stat, readFile}}, Path} = this.utils.Package;

        async function traverse(dir) {
            const files = await readdir(dir);
            for (const file of files) {
                const filePath = Path.join(dir, file);
                const stats = await stat(filePath);
                if (stats.isFile() && (!fileFilter || fileFilter(filePath, stats))) {
                    readFile(filePath).then(buffer => callback(filePath, stats, buffer)).catch(console.error);
                } else if (stats.isDirectory() && dirFilter(file)) {
                    await traverse(filePath);
                }
            }
        }

        traverse(dir).then(then).catch(console.error);
    }

    appendItemFunc = keyArr => {
        let index = 0;
        const rootPath = this.utils.getMountFolder();
        const showResult = this.utils.once(() => this.utils.show(this.entities.result));
        const {INCLUDE_FILE_PATH, CASE_SENSITIVE, RELATIVE_PATH, SHOW_MTIME} = this.config;

        return (filePath, stats, buffer) => {
            let data = buffer.toString();
            if (INCLUDE_FILE_PATH) {
                data += "\n" + filePath;
            }
            if (!CASE_SENSITIVE) {
                data = data.toLowerCase();
            }

            if (!keyArr.every(keyword => data.includes(keyword))) return false;

            index++;
            const {dir, base} = this.utils.Package.Path.parse(filePath);
            const dirPath = RELATIVE_PATH ? dir.replace(rootPath, ".") : dir;

            const item = document.createElement("div");
            item.classList.add("plugin-search-multi-item");
            item.setAttribute("data-is-dir", "false");
            item.setAttribute("data-path", filePath);
            item.setAttribute("data-index", index + "");
            if (SHOW_MTIME) {
                item.setAttribute("ty-hint", stats.mtime.toLocaleString('chinese', {hour12: false}));
            }

            const title = document.createElement("div");
            title.classList.add("plugin-search-multi-item-title");
            title.textContent = base;

            const path = document.createElement("div");
            path.classList.add("plugin-search-multi-item-path");
            path.textContent = dirPath + this.utils.separator;

            item.append(title, path);
            this.entities.resultList.appendChild(item);
            this.entities.resultTitle.textContent = `匹配的文件：${index}`;

            showResult();
        }
    }

    verifyExt = filename => {
        if (filename[0] === ".") {
            return false
        }
        const ext = this.utils.Package.Path.extname(filename).replace(/^\./, '');
        if (~this.config.ALLOW_EXT.indexOf(ext.toLowerCase())) {
            return true
        }
    }

    verifySize = stat => 0 > this.config.MAX_SIZE || stat.size < this.config.MAX_SIZE;

    searchMulti = (rootPath, keys) => {
        let keyArr = this.utils.splitKeyword(keys || this.entities.input.value);
        if (!keyArr || keyArr.length === 0) return;
        if (!this.config.CASE_SENSITIVE) {
            keyArr = keyArr.map(ele => ele.toLowerCase());
        }

        this.utils.hide(this.entities.result);
        this.utils.show(this.entities.info);
        this.entities.resultList.innerHTML = "";

        rootPath = rootPath || this.utils.getMountFolder();
        const allowRead = (filepath, stat) => this.verifySize(stat) && this.verifyExt(filepath);
        const allowTraverse = path => !this.config.IGNORE_FOLDERS.includes(path)
        const appendItem = this.appendItemFunc(keyArr);
        const then = () => this.utils.hide(this.entities.info);
        this.traverseDir(rootPath, allowRead, allowTraverse, appendItem, then);
    }

    hideIfNeed = () => this.config.AUTO_HIDE && this.utils.hide(this.entities.modal);
    isModalHidden = () => this.utils.isHidden(this.entities.modal);
    hide = () => {
        this.utils.hide(this.entities.modal);
        this.utils.hide(this.entities.info);
    }
    show = () => {
        this.utils.show(this.entities.modal)
        this.entities.input.select();
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

        this.searcher.entities.buttonGroup.addEventListener("click", ev => {
            if (ev.target.closest(".link-option-btn")) {
                this.toggle(true);
                ev.preventDefault();
                ev.stopPropagation();
            }
        }, true)
    }

    genButton = () => {
        const wantLink = this.searcher.config.LINK_OTHER_PLUGIN;
        const span = document.createElement("span");
        span.className = `option-btn link-option-btn ${wantLink ? "select" : ""}`;
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
        this.highlighter.setInputValue(this.searcher.entities.input.value);
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
