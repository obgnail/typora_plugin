class searchMultiKeywordPlugin extends BasePlugin {
    styleTemplate = () => true

    html = () => {
        const modal = document.createElement("div");
        modal.id = 'plugin-search-multi';
        modal.classList.add("plugin-common-modal");
        modal.style.display = "none";
        modal.innerHTML = `
            <div id="plugin-search-multi-input">
                <input type="text" placeholder="多关键字查找 空格分隔" ty-hint="⌃↵当前页打开。⇧⌃↵新页面打开">
                <span class="option-btn case-option-btn ${(this.config.CASE_SENSITIVE) ? "select" : ""}" ty-hint="区分大小写">
                    <svg class="icon"> <use xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="#find-and-replace-icon-case"></use></svg>
                </span>
                <span class="option-btn path-option-btn ${(this.config.INCLUDE_FILE_PATH) ? "select" : ""}" ty-hint="将文件路径加入搜索内容">
                    <div class="ion-ionic"></div>
                </span>
            </div>
        
            <div class="plugin-search-multi-result">
                <div class="search-result-title" data-localize="File Results" data-lg="Menu">匹配的文件</div>
                <div class="search-result-list"></div>
            </div>
        
            <div class="plugin-search-multi-info-item">
                <div class="plugin-search-multi-info" data-localize="Searching" data-lg="Front">Searching</div>
                <div class="typora-search-spinner">
                    <div class="rect1"></div><div class="rect2"></div><div class="rect3"></div><div class="rect4"></div><div class="rect5"></div>
                </div>
            </div>`;
        return modal
    }

    hotkey = () => [{hotkey: this.config.HOTKEY, callback: this.call}]

    process = () => {
        this.modal = {
            modal: document.getElementById('plugin-search-multi'),
            input: document.querySelector("#plugin-search-multi-input input"),
            result: document.querySelector(".plugin-search-multi-result"),
            resultTitle: document.querySelector(".plugin-search-multi-result .search-result-title"),
            resultList: document.querySelector(".plugin-search-multi-result .search-result-list"),
            info: document.querySelector(".plugin-search-multi-info-item"),
        }

        this.utils.addEventListener(this.utils.eventType.allPluginsHadInjected, () => {
            this.utils.getPlugin("multi_highlighter") && new LinkHelper(this).process();
        })

        if (this.config.REFOUCE_WHEN_OPEN_FILE) {
            this.utils.addEventListener(this.utils.eventType.fileOpened, () => {
                if (this.modal.modal.style.display === "block") {
                    setTimeout(() => this.modal.input.select(), 300);
                }
            })
        }

        if (this.config.ALLOW_DRAG) {
            this.utils.dragFixedModal(this.modal.input, this.modal.modal);
        }

        const selectItem = this.utils.selectItemFromList(this.modal.resultList, ".plugin-search-multi-item.active");
        this.modal.input.addEventListener("keydown", ev => {
            switch (ev.key) {
                case "Enter":
                    if (this.utils.metaKeyPressed(ev)) {
                        const select = this.modal.resultList.querySelector(".plugin-search-multi-item.active");
                        if (select) {
                            ev.preventDefault();
                            ev.stopPropagation();
                            const filepath = select.getAttribute("data-path");
                            if (ev.shiftKey) {
                                this.openFileInNewWindow(filepath, false);
                            } else {
                                this.openFileInThisWindow(filepath);
                            }
                            this.modal.input.focus();
                            return
                        }
                    }
                    this.modal.result.style.display = "none";
                    this.modal.info.style.display = "block";
                    this.modal.resultList.innerHTML = "";
                    const workspace = File.getMountFolder();
                    this.searchMulti(workspace, this.modal.input.value, () => this.modal.info.style.display = "none");
                    break
                case "Escape":
                case "Backspace":
                    if (ev.key === "Escape" || ev.key === "Backspace" && this.config.BACKSPACE_TO_HIDE && !this.modal.input.value) {
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

        this.modal.resultList.addEventListener("click", ev => {
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

        this.modal.modal.addEventListener("click", ev => {
            const caseButton = ev.target.closest("#plugin-search-multi-input .case-option-btn");
            const pathButton = ev.target.closest("#plugin-search-multi-input .path-option-btn");

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
        const utils = this.utils;

        async function traverse(dir) {
            const files = await utils.Package.Fs.promises.readdir(dir);
            for (const file of files) {
                const filePath = utils.Package.Path.join(dir, file);
                const stats = await utils.Package.Fs.promises.stat(filePath);
                if (stats.isFile()) {
                    if (filter && !filter(filePath, stats)) {
                        continue
                    }
                    utils.Package.Fs.promises.readFile(filePath)
                        .then(buffer => callback(filePath, stats, buffer))
                        .catch(error => console.error(error))
                } else if (stats.isDirectory()) {
                    await traverse(filePath);
                }
            }
        }

        traverse(dir).then(then).catch(err => console.error(err));
    }

    appendItemFunc = keyArr => {
        let index = 0;
        const rootPath = File.getMountFolder();
        const showResult = this.utils.once(() => this.modal.result.style.display = "block");

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
            this.modal.resultList.appendChild(item);

            this.modal.resultTitle.textContent = `匹配的文件：${index}`;
            if (index <= 8) {
                this.modal.resultList.style.height = 40 * index + "px";
            }
            showResult();
        }
    }

    hideIfNeed = () => {
        if (this.config.AUTO_HIDE) {
            this.modal.modal.style.display = "none";
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

    allowRead = (filepath, stat) => this.verifySize(stat) && this.verifyExt(filepath)

    searchMulti = (rootPath, keys, then) => {
        if (!rootPath) return;

        let keyArr = keys.split(this.config.SEPARATOR).filter(Boolean);
        if (!keyArr) return;

        if (!this.config.CASE_SENSITIVE) {
            keyArr = keyArr.map(ele => ele.toLowerCase());
        }
        const appendItem = this.appendItemFunc(keyArr);
        this.traverseDir(rootPath, this.allowRead, appendItem, then);
    }

    hide = () => {
        this.modal.modal.style.display = "none";
        this.modal.info.style.display = "none";
    }

    call = () => {
        if (this.modal.modal.style.display === "block") {
            this.hide();
        } else {
            this.modal.modal.style.display = "block";
            this.modal.input.select();
        }
    }
}

class LinkHelper {
    constructor(searcher) {
        this.searcher = searcher;
        this.utils = this.searcher.utils;

        this.highlighter = this.utils.getPlugin("multi_highlighter");
        this.originValue = this.highlighter.config.RESEARCH_WHILE_OPEN_FILE;
        this.styleList = ["position", "padding", "backgroundColor", "boxShadow", "border"];

        this.highlighterDiv = document.querySelector("#plugin-multi-highlighter");
        this.searcherInput = document.querySelector("#plugin-search-multi-input");
        this.button = null;
    }

    process = () => {
        this.appendButton();
        const isLinking = () => this.searcher.config.LINK_OTHER_PLUGIN && this.searcher.modal.modal.style.display === "block";

        // 当处于联动状态，在search_multi搜索前先设置highlighter的inputValue和caseSensitive
        this.utils.decorate(() => this.highlighter, "highlight", () => isLinking() && this.syncValue());

        // 当处于联动状态，search_multi触发搜索的时候，先触发highlighter搜索
        this.utils.decorate(() => this.searcher, "searchMulti", () => isLinking() && this.highlighter.highlight());

        // 当处于联动状态，highlighter要展示modal之前，先恢复状态
        this.utils.decorate(() => this.highlighter, "toggleModal", () => this.searcher.config.LINK_OTHER_PLUGIN && this.toggle(true));

        this.searcher.modal.modal.addEventListener("click", ev => {
            if (ev.target.closest("#plugin-search-multi-input .link-option-btn")) {
                this.toggle(true);
                ev.preventDefault();
                ev.stopPropagation();
            }
        }, true)
    }

    appendButton = () => {
        const wantLink = this.searcher.config.LINK_OTHER_PLUGIN;

        const span = document.createElement("span");
        this.button = span;
        span.className = `option-btn link-option-btn ${wantLink ? "select" : ""}`;
        span.setAttribute("ty-hint", "插件联动");
        const div = document.createElement("div");
        div.className = "fa fa-link";
        span.appendChild(div);
        this.searcherInput.appendChild(span);

        wantLink && this.moveElement();
    }

    toggle = (forceHide = false) => {
        this.button.classList.toggle("select");
        this.searcher.config.LINK_OTHER_PLUGIN = !this.searcher.config.LINK_OTHER_PLUGIN;
        if (this.searcher.config.LINK_OTHER_PLUGIN) {
            this.moveElement();
            this.highlighter.highlight();
        } else {
            this.restoreMove(forceHide);
        }
        this.syncValue();
    }

    syncValue = () => {
        this.highlighter.setInputValue(this.searcher.modal.input.value);
        if (this.searcher.config.CASE_SENSITIVE !== this.highlighter.config.CASE_SENSITIVE) {
            document.querySelector(".plugin-multi-highlighter-option-btn").click();
        }
    }

    moveElement = () => {
        this.utils.removeElement(this.highlighterDiv);
        this.searcherInput.parentNode.insertBefore(this.highlighterDiv, this.searcherInput.nextSibling);

        this.highlighterDiv.style.display = "block";
        this.highlighterDiv.querySelector("#plugin-multi-highlighter-input").style.display = "none";
        this.styleList.forEach(style => this.highlighterDiv.style[style] = "initial");
        this.highlighter.config.RESEARCH_WHILE_OPEN_FILE = true;
    }

    restoreMove = forceHide => {
        this.utils.removeElement(this.highlighterDiv);
        this.utils.insertDiv(this.highlighterDiv);

        this.highlighterDiv.style.display = forceHide ? "none" : "block";
        this.highlighterDiv.querySelector("#plugin-multi-highlighter-input").style.display = "";
        this.styleList.forEach(style => this.highlighterDiv.style[style] = "");
        this.highlighter.config.RESEARCH_WHILE_OPEN_FILE = this.originValue;
    }
}

module.exports = {
    plugin: searchMultiKeywordPlugin
};
