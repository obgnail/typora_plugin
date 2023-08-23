class searchMultiKeywordPlugin extends global._basePlugin {
    style = () => {
        const textID = "plugin-search-multi-style";
        const text = `
        #plugin-search-multi {
            position: fixed;
            top: 40px;
            left: 60%;
            width: 420px;
            z-index: 9999;
            padding: 4px;
            background-color: #f8f8f8;
            box-shadow: 0 4px 10px rgba(0, 0, 0, .5);
            border: 1px solid #ddd;
            border-top: none;
            color: var(--text-color);
            transform: translate3d(0, 0, 0)
        }
        
        #plugin-search-multi .search-result-title {
            padding-left: 20px;
            font-size: 10px;
            margin-top: 4px;
            opacity: .8;
            line-height: 16px;
            height: 16px;
        }
        
        .mac-seamless-mode #plugin-search-multi {
            top: 30px
        }
        
        #plugin-search-multi-input {
            position: relative;
        }
        
        #plugin-search-multi-input input {
            width: 100%;
            font-size: 14px;
            line-height: 25px;
            max-height: 27px;
            overflow: auto;
            border: 1px solid #ddd;
            box-shadow: inset 0 1px 1px rgba(0, 0, 0, .075);
            border-radius: 2px;
            padding-left: 5px;
            padding-right: 50px;
        }
        
        #plugin-search-multi-input input:focus {
            outline: 0
        }
        
        #plugin-search-multi-input svg {
            width: 20px;
            height: 14px;
            stroke: none;
            fill: currentColor
        }
        
        #plugin-search-multi-input .option-btn {
            position: absolute;
            top: 7px;
            opacity: .5;
            line-height: 10px;
            border-radius: 3px;
            cursor: pointer;
        }
        
        #plugin-search-multi-input .case-option-btn {
            right: 6px;
            padding: 2px 1px;
        }
        
        #plugin-search-multi-input .path-option-btn {
            right: 30px;
            padding: 1px 3px;
        }
        
        #plugin-search-multi-input .option-btn.select, .option-btn:hover {
            background: var(--active-file-bg-color);
            color: var(--active-file-text-color);
            opacity: 1
        }
        
        .plugin-search-multi-item {
            display: block;
            font-size: 14px;
            height: 40px;
            padding-left: 20px;
            padding-right: 20px;
            padding-top: 2px;
            overflow: hidden;
        }
        
        .plugin-search-multi-item:hover,
        .plugin-search-multi-item.active {
            background-color: var(--active-file-bg-color);
            border-color: var(--active-file-text-color);
            color: var(--active-file-text-color);
            cursor: pointer;
        }
        
        .plugin-search-multi-item-title {
            line-height: 24px;
            max-height: 24px;
            overflow: hidden
        }
        
        .plugin-search-multi-result {
            margin-top: 0;
            cursor: default;
            max-height: 340px;
            overflow-x: hidden;
            overflow-y: auto;
            display: none;
        }
        
        .plugin-search-multi-result .search-result-list {
            position: relative;
            height: 520px;
            overflow-y: auto;
            width: 100%;
        }
        
        .plugin-search-multi-item-path {
            opacity: .5;
            font-size: 11px;
            margin-top: -4px;
            text-overflow: ellipsis;
            width: 100%;
            overflow: hidden;
            white-space: nowrap;
            line-height: 14px
        }
        
        .plugin-search-multi-info-item {
            opacity: .7;
            font-size: 12px;
            line-height: 40px;
            position: relative;
            padding-left: 20px;
            display: none;
        }`
        return {textID, text}
    }

    html = () => {
        const modal_div = `
        <div id="plugin-search-multi-input">
            <input type="text" class="input" tabindex="1" autocorrect="off" spellcheck="false"
                autocapitalize="off" value="" placeholder="多关键字查找 空格分隔" ty-hint="⌃↵当前页打开。⇧⌃↵新页面打开"
                data-localize="Search by file name" data-lg="Front">
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
                <div class="rect1"></div>
                <div class="rect2"></div>
                <div class="rect3"></div>
                <div class="rect4"></div>
                <div class="rect5"></div>
            </div>
        </div>`;
        const searchModal = document.createElement("div");
        searchModal.id = 'plugin-search-multi';
        searchModal.style.display = "none";
        searchModal.innerHTML = modal_div;

        this.utils.insertDiv(searchModal);
    }

    hotkey = () => {
        return [{
            hotkey: this.config.HOTKEY,
            callback: this.call
        }]
    }

    process = () => {
        this.modal = {
            modal: document.getElementById('plugin-search-multi'),
            input: document.querySelector("#plugin-search-multi-input input"),
            result: document.querySelector(".plugin-search-multi-result"),
            resultTitle: document.querySelector(".plugin-search-multi-result .search-result-title"),
            resultList: document.querySelector(".plugin-search-multi-result .search-result-list"),
            info: document.querySelector(".plugin-search-multi-info-item"),
        }

        if (this.config.REFOUCE_WHEN_OPEN_FILE) {
            this.utils.decorateOpenFile(null, () => {
                if (this.modal.modal.style.display === "block") {
                    setTimeout(() => this.modal.input.select(), 300);
                }
            })
        }

        if (this.config.ALLOW_DRAG) {
            this.utils.dragFixedModal(this.modal.input, this.modal.modal);
        }

        let floor;

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
                    ev.stopPropagation();
                    ev.preventDefault();
                    this.hide();
                    break
                case "ArrowUp":
                case "ArrowDown":
                    ev.stopPropagation();
                    ev.preventDefault();

                    if (!this.modal.resultList.childElementCount) return;

                    const activeItem = this.modal.resultList.querySelector(".plugin-search-multi-item.active")
                    let nextItem;
                    if (ev.key === "ArrowDown") {
                        if (floor !== 7) floor++;

                        if (activeItem && activeItem.nextElementSibling) {
                            nextItem = activeItem.nextElementSibling;
                        } else {
                            nextItem = this.modal.resultList.firstElementChild;
                            floor = 1
                        }
                    } else {
                        if (floor !== 1) floor--;

                        if (activeItem && activeItem.previousElementSibling) {
                            nextItem = activeItem.previousElementSibling;
                        } else {
                            nextItem = this.modal.resultList.lastElementChild;
                            floor = 7
                        }
                    }

                    activeItem && activeItem.classList.toggle("active");
                    nextItem.classList.toggle("active");

                    let top;
                    if (floor === 1) {
                        top = nextItem.offsetTop - nextItem.offsetHeight;
                    } else if (floor === 7) {
                        top = nextItem.offsetTop - 6 * nextItem.offsetHeight;
                    } else if (Math.abs(this.modal.resultList.scrollTop - activeItem.offsetTop) > 7 * nextItem.offsetHeight) {
                        top = nextItem.offsetTop - 3 * nextItem.offsetHeight;
                    }
                    top && this.modal.resultList.scrollTo({top: top, behavior: "smooth"});
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

    separator = File.isWin ? "\\" : "/";
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
        let once = true;
        const rootPath = File.getMountFolder();

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
            path.innerText = dirPath + this.separator;
            item.appendChild(title);
            item.appendChild(path);
            this.modal.resultList.appendChild(item);

            this.modal.resultTitle.textContent = `匹配的文件：${index}`;
            if (index <= 8) {
                this.modal.resultList.style.height = 40 * index + "px";
            }
            if (once) {
                this.modal.result.style.display = "block";
                once = false;
            }
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

    allowRead = (filepath, stat) => {
        return this.verifySize(stat) && this.verifyExt(filepath);
    }

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

module.exports = {
    plugin: searchMultiKeywordPlugin
};
