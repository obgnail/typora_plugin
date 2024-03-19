class searchMultiKeywordPlugin extends BasePlugin {
    styleTemplate = () => true

    html = () => `
        <div id="plugin-search-multi" class="plugin-common-modal plugin-common-hidden">
            <div id="plugin-search-multi-input">
                <input type="text" placeholder="多关键字查找 空格分隔" title="空格分隔 引号包裹视为词组">
                <span class="option-btn case-option-btn ${(this.config.CASE_SENSITIVE) ? "select" : ""}" ty-hint="区分大小写">
                    <svg class="icon"><use xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="#find-and-replace-icon-case"></use></svg>
                </span>
                <span class="option-btn path-option-btn ${(this.config.INCLUDE_FILE_PATH) ? "select" : ""}" ty-hint="将文件路径加入搜索内容">
                    <div class="ion-ionic"></div>
                </span>
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

    process = () => {
        this.entities = {
            modal: document.getElementById('plugin-search-multi'),
            inputBar: document.querySelector("#plugin-search-multi-input"),
            input: document.querySelector("#plugin-search-multi-input input"),
            result: document.querySelector(".plugin-search-multi-result"),
            resultTitle: document.querySelector(".plugin-search-multi-result .search-result-title"),
            resultList: document.querySelector(".plugin-search-multi-result .search-result-list"),
            info: document.querySelector(".plugin-search-multi-info-item"),
        }

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

        const selectItem = this.utils.selectItemFromList(this.entities.resultList, ".plugin-search-multi-item.active");
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
                    selectItem(ev);
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

        this.entities.inputBar.addEventListener("click", ev => {
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

    traverseDir = (dir, filter, callback, then) => {
        const {Fs: {promises: {readdir, stat, readFile}}, Path} = this.utils.Package;

        async function traverse(dir) {
            const files = await readdir(dir);
            for (const file of files) {
                const filePath = Path.join(dir, file);
                const stats = await stat(filePath);
                if (stats.isFile() && (!filter || filter(filePath, stats))) {
                    readFile(filePath).then(buffer => callback(filePath, stats, buffer)).catch(console.error);
                } else if (stats.isDirectory()) {
                    await traverse(filePath);
                }
            }
        }

        traverse(dir).then(then).catch(console.error);
    }

    appendItemFunc = keyArr => {
        let index = 0;
        const rootPath = File.getMountFolder();
        const showResult = this.utils.once(() => this.entities.result.classList.remove("plugin-common-hidden"));

        return (filePath, stats, buffer) => {
            let data = buffer.toString();
            if (this.config.INCLUDE_FILE_PATH) {
                data = data + filePath;
            }
            if (!this.config.CASE_SENSITIVE) {
                data = data.toLowerCase();
            }
            for (const keyword of keyArr) {
                if (data.indexOf(keyword) === -1) return false;
            }

            index++;
            const parseUrl = this.utils.Package.Path.parse(filePath);
            const dirPath = !this.config.RELATIVE_PATH ? parseUrl.dir : parseUrl.dir.replace(rootPath, ".");

            const item = document.createElement("div");
            item.classList.add("plugin-search-multi-item");
            item.setAttribute("data-is-dir", "false");
            item.setAttribute("data-path", filePath);
            item.setAttribute("data-index", index + "");
            if (this.config.SHOW_MTIME) {
                item.setAttribute("ty-hint", stats.mtime.toLocaleString('chinese', {hour12: false}));
            }
            const title = document.createElement("div");
            title.classList.add("plugin-search-multi-item-title");
            title.innerText = parseUrl.base;
            const path = document.createElement("div");
            path.classList.add("plugin-search-multi-item-path");
            path.innerText = dirPath + this.utils.separator;
            item.appendChild(title);
            item.appendChild(path);
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

        this.entities.result.classList.add("plugin-common-hidden");
        this.entities.info.classList.remove("plugin-common-hidden");
        this.entities.resultList.innerHTML = "";

        rootPath = rootPath || File.getMountFolder();
        const allowRead = (filepath, stat) => this.verifySize(stat) && this.verifyExt(filepath);
        const appendItem = this.appendItemFunc(keyArr);
        const then = () => this.entities.info.classList.add("plugin-common-hidden");
        this.traverseDir(rootPath, allowRead, appendItem, then);
    }

    toggleModal = show => this.entities.modal.classList.toggle("plugin-common-hidden", !show);
    hideIfNeed = () => this.config.AUTO_HIDE && this.toggleModal(false)
    isModalHidden = () => this.entities.modal.classList.contains("plugin-common-hidden")
    hide = () => {
        this.toggleModal(false);
        this.entities.info.classList.add("plugin-common-hidden");
    }
    show = () => {
        this.toggleModal(true);
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
        this.searcherInput = this.searcher.entities.inputBar;
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

        this.searcherInput.addEventListener("click", ev => {
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
        this.searcherInput.appendChild(span);
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
        this.searcherInput.parentNode.insertBefore(this.highlighterModal, this.searcherInput.nextSibling);

        this.highlighterModal.classList.remove("plugin-common-hidden");
        this.highlighterInput.classList.add("plugin-common-hidden");
        this.styleList.forEach(style => this.highlighterModal.style[style] = "initial");
        this.highlighter.config.RESEARCH_WHILE_OPEN_FILE = true;
    }

    restoreElement = forceHide => {
        this.utils.removeElement(this.highlighterModal);
        this.utils.insertElement(this.highlighterModal);

        this.highlighterModal.classList.toggle("plugin-common-hidden", forceHide);
        this.highlighterInput.classList.remove("plugin-common-hidden");
        this.styleList.forEach(style => this.highlighterModal.style[style] = "");
        this.highlighter.config.RESEARCH_WHILE_OPEN_FILE = this.originValue;
    }
}

module.exports = {
    plugin: searchMultiKeywordPlugin
};
