(() => {
    const Package = {
        Path: reqnode('path'), // Typora将require封装为reqnode，避免外部引入electron核心功能模块
        Fs: reqnode('fs'),
        File: File,            // Typora第一方库:文件、编辑器相关
        Client: ClientCommand, // Typora第一方库:窗口、服务相关
    }

    const config = {
        // 允许拖动模态框
        ALLOW_DRAG: true,
        // 模态框自动隐藏
        AUTO_HIDE: false,
        // 搜索内容时大小写敏感(此选项不必手动调整，可以在UI设置)
        CASE_SENSITIVE: false,
        // 将文件路径加入搜索内容(此选项不必手动调整，可以在UI设置)
        INCLUDE_FILE_PATH: false,
        // 展示文件路径时使用相对路径
        RELATIVE_PATH: true,
        // 关键词按空格分割
        SEPARATOR: " ",
        // hint展示文件修改时间
        SHOW_MTIME: false,
        // Typora允许打开小于2000000(即MAX_FILE_SIZE)的文件，大于maxSize的文件在搜索时将被忽略。若maxSize<0则不过滤
        MAX_SIZE: Package.File.MAX_FILE_SIZE,
        // Typora允许打开的文件的后缀名，此外的文件在搜索时将被忽略
        ALLOW_EXT: ["", "md", "markdown", "mdown", "mmd", "text", "txt", "rmarkdown",
            "mkd", "mdwn", "mdtxt", "rmd", "mdtext", "apib"],
        // 快捷键ctrl/command+shift+P打开模态框
        HOTKEY: ev => metaKeyPressed(ev) && ev.shiftKey && ev.key === "P",
    };

    (() => {
        const modal_css = `
        #typora-search-multi {
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
        
        #typora-search-multi .ty-quick-open-category-title {
            border-top: none;
        }
        
        .mac-seamless-mode #typora-search-multi {
            top: 30px
        }
        
        #typora-search-multi-input {
            position: relative;
        }
        
        #typora-search-multi-input input {
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
        
        #typora-search-multi-input input:focus {
            outline: 0
        }
        
        #typora-search-multi-input svg {
            width: 20px;
            height: 14px;
            stroke: none;
            fill: currentColor
        }
        
        #typora-search-multi-input .search-multi-search-option-btn {
            position: absolute;
            top: 7px;
            opacity: .5;
            line-height: 10px;
            border-radius: 3px;
            cursor: pointer;
        }
        
        #typora-search-multi-input #typora-search-multi-case-option-btn {
            right: 6px;
            padding: 2px 1px;
        }
        
        #typora-search-multi-input #typora-search-multi-path-option-btn {
            right: 30px;
            padding: 1px 3px;
        }
        
        #typora-search-multi-input .search-multi-search-option-btn.select,
        #typora-search-multi-input .search-multi-search-option-btn:hover {
            background: var(--active-file-bg-color);
            color: var(--active-file-text-color);
            opacity: 1
        }
        
        .typora-search-multi-item {
            display: block;
            font-size: 14px;
            height: 40px;
            padding-left: 20px;
            padding-right: 20px;
            padding-top: 2px;
            overflow: hidden
        }
        
        .typora-search-multi-item:hover,
        .typora-search-multi-item.active {
            background-color: var(--active-file-bg-color);
            border-color: var(--active-file-text-color);
            color: var(--active-file-text-color);
            cursor: pointer;
        }
        
        .typora-search-multi-item-title {
            line-height: 24px;
            max-height: 24px;
            overflow: hidden
        }
        
        .typora-search-multi-list {
            margin-top: 0;
            cursor: default;
            max-height: 340px;
            overflow-x: hidden;
            overflow-y: auto;
        }
        
        .typora-search-multi-list-inner {
            position: relative
        }
        
        .typora-search-multi-item-path {
            opacity: .5;
            font-size: 11px;
            margin-top: -4px;
            text-overflow: ellipsis;
            width: 100%;
            overflow: hidden;
            white-space: nowrap;
            line-height: 14px
        }
        
        .typora-search-multi-info-item {
            opacity: .7;
            font-size: 12px;
            line-height: 40px;
            position: relative;
            padding-left: 20px
        }`
        const style = document.createElement('style');
        style.type = 'text/css';
        style.innerHTML = modal_css;
        document.getElementsByTagName("head")[0].appendChild(style);

        const modal_div = `
        <div id="typora-search-multi-input">
            <input type="text" class="input" tabindex="1" autocorrect="off" spellcheck="false"
                autocapitalize="off" value="" placeholder="多关键字查找 空格分隔" ty-hint="⌃↵当前页打开。⇧⌃↵新页面打开"
                aria-label="⌃↵当前页打开。⇧⌃↵新页面打开" data-localize="Search by file name" data-lg="Front">
            <span ty-hint="区分大小写" id="typora-search-multi-case-option-btn" class="search-multi-search-option-btn" aria-label="区分大小写">
                <svg class="icon">
                    <use xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="#find-and-replace-icon-case"></use>
                </svg>
            </span>
            <span ty-hint="将文件名加入搜索内容" id="typora-search-multi-path-option-btn" class="search-multi-search-option-btn" aria-label="将文件名加入搜索内容">
                <div class="ion-ionic"></div>
            </span>
        </div>
    
        <div class="typora-search-multi-list" id="typora-search-multi-list" style="display:none">
            <div class="ty-quick-open-category ty-has-prev" id="ty-quick-open-infolder-category">
                <div class="ty-quick-open-category-title" data-localize="File Results" data-lg="Menu" style="height: auto;">
                    匹配的文件
                </div>
                <div class="typora-search-multi-list-inner" style="height: 520px;">
                    <div class="quick-open-group-block" data-block-index="0"
                        style="position: absolute; top: 0; width: 100%;">
                    </div>
                </div>
            </div>
        </div>
    
        <div class="typora-search-multi-info-item" style="display:none">
            <div class="typora-search-multi-info" data-localize="Searching" data-lg="Front">Searching</div>
            <div class="typora-search-spinner">
                <div class="rect1"></div>
                <div class="rect2"></div>
                <div class="rect3"></div>
                <div class="rect4"></div>
                <div class="rect5"></div>
            </div>
        </div>`;
        const searchModal = document.createElement("div");
        searchModal.id = 'typora-search-multi';
        searchModal.style.display = "none";
        searchModal.innerHTML = modal_div;
        const quickOpenNode = document.getElementById("typora-quick-open");
        quickOpenNode.parentNode.insertBefore(searchModal, quickOpenNode.nextSibling);
    })();

    const modal = {
        modal: document.getElementById('typora-search-multi'),
        info: document.querySelector(".typora-search-multi-info-item"),
        list: document.querySelector("#typora-search-multi-list"),
        listInner: document.querySelector(".typora-search-multi-list-inner"),
        block: document.querySelector(".typora-search-multi-list-inner .quick-open-group-block"),
        input: document.querySelector("#typora-search-multi-input input"),
        caseOption: document.querySelector("#typora-search-multi-case-option-btn"),
        pathOption: document.querySelector("#typora-search-multi-path-option-btn"),
        resultTitle: document.querySelector(".typora-search-multi-list .ty-quick-open-category-title")
    }

    // Typora里几乎所有常用操作库,具体代码可以在frame.js找到
    const getLibrary = () => Package.File.editor.library
    const getMountFolder = Package.File.getMountFolder
    const separator = Package.File.isWin ? "\\" : "/";
    const metaKeyPressed = ev => Package.File.isMac ? ev.metaKey : ev.ctrlKey

    const openFileInThisWindow = filePath => {
        document.activeElement.blur();
        getLibrary().openFile(filePath);
    }

    const openFileInNewWindow = (path, isFolder) => getLibrary().openFileInNewWindow(path, isFolder)

    const traverseDir = (dir, filter, callback, then) => {
        async function traverse(dir) {
            let files = await Package.Fs.promises.readdir(dir);
            for (const file of files) {
                const filePath = Package.Path.join(dir, file);
                const stats = await Package.Fs.promises.stat(filePath);
                if (stats.isFile()) {
                    if (filter && !filter(filePath, stats)) {
                        continue
                    }
                    Package.Fs.promises.readFile(filePath)
                        .then(buffer => callback(filePath, stats, buffer))
                        .catch(error => console.log(error))
                } else if (stats.isDirectory()) {
                    await traverse(filePath);
                }
            }
        }

        traverse(dir).then(then).catch(err => console.log(err));
    }

    const appendItemFunc = keyArr => {
        let index = 0;
        let once = true;
        const rootPath = getMountFolder()

        return (filePath, stats, buffer) => {
            let data = buffer.toString();
            if (config.INCLUDE_FILE_PATH) {
                data = data + filePath;
            }
            if (!config.CASE_SENSITIVE) {
                data = data.toLowerCase();
            }
            for (const keyword of keyArr) {
                if (data.indexOf(keyword) === -1) {
                    return false
                }
            }

            index++;
            const parseUrl = Package.Path.parse(filePath);
            const dirPath = !config.RELATIVE_PATH ? parseUrl.dir : parseUrl.dir.replace(rootPath, ".");
            const hint = config.SHOW_MTIME ? `ty-hint="修改时间: ${stats.mtime.toLocaleString('chinese', {hour12: false})}"` : ``;
            const item = `
                <div class="typora-search-multi-item" data-is-dir="false" data-path="${filePath}" data-index="${index}" ${hint}>
                    <div class="typora-search-multi-item-title">${parseUrl.base}</div>
                    <div class="typora-search-multi-item-path">${dirPath}${separator}</div>
                </div>`;
            modal.block.insertAdjacentHTML('beforeend', item);
            modal.resultTitle.textContent = `匹配的文件：${index}`;
            if (index <= 8) {
                modal.listInner.style.height = 40 * index + "px";
            }

            if (once) {
                modal.list.style.display = "block";
                once = false;
            }
        }
    }

    const hideIfNeed = () => {
        if (config.AUTO_HIDE) {
            modal.modal.style.display = "none";
        }
    }

    const verifyExt = (filename) => {
        if (filename[0] === ".") {
            return false
        }
        const ext = Package.Path.extname(filename).replace(/^\./, '');
        if (~config.ALLOW_EXT.indexOf(ext.toLowerCase())) {
            return true
        }
    }
    const verifySize = (stat) => 0 > config.MAX_SIZE || stat.size < config.MAX_SIZE;
    const allowRead = (filepath, stat) => verifySize(stat) && verifyExt(filepath);

    const searchMulti = (rootPath, keys, then) => {
        if (!rootPath) {
            return
        }
        let keyArr = keys.split(config.SEPARATOR).filter(Boolean);
        if (!keyArr) {
            return
        }
        if (!config.CASE_SENSITIVE) {
            keyArr = keyArr.map(ele => ele.toLowerCase());
        }
        const appendItem = appendItemFunc(keyArr);
        traverseDir(rootPath, allowRead, appendItem, then);
    }

    if (config.ALLOW_DRAG) {
        modal.modal.addEventListener("mousedown", ev => {
            if (!metaKeyPressed(ev) || ev.button !== 0) return;
            ev.stopPropagation();
            const rect = modal.modal.getBoundingClientRect();
            const shiftX = ev.clientX - rect.left;
            const shiftY = ev.clientY - rect.top;

            const onMouseMove = ev => {
                if (!metaKeyPressed(ev) || ev.button !== 0) return;
                ev.stopPropagation();
                ev.preventDefault();
                requestAnimationFrame(() => {
                    modal.modal.style.left = ev.clientX - shiftX + 'px';
                    modal.modal.style.top = ev.clientY - shiftY + 'px';
                });
            }

            document.addEventListener("mouseup", ev => {
                    if (!metaKeyPressed(ev) || ev.button !== 0) return;
                    ev.stopPropagation();
                    ev.preventDefault();
                    document.removeEventListener('mousemove', onMouseMove);
                    modal.modal.onmouseup = null;
                }
            )

            document.addEventListener('mousemove', onMouseMove);
        })
        modal.modal.ondragstart = () => false
    }

    let floor;

    modal.input.addEventListener("keydown", ev => {
        switch (ev.key) {
            case "Enter":
                if (metaKeyPressed(ev)) {
                    const select = modal.block.querySelector(".typora-search-multi-item.active");
                    if (select) {
                        ev.preventDefault();
                        ev.stopPropagation();
                        const filepath = select.getAttribute("data-path");
                        if (ev.shiftKey) {
                            openFileInNewWindow(filepath, false);
                        } else {
                            openFileInThisWindow(filepath);
                        }
                        modal.input.focus();
                        return
                    }
                }
                modal.list.style.display = "none";
                modal.info.style.display = "block";
                modal.block.innerHTML = "";
                const workspace = getMountFolder();
                searchMulti(workspace, modal.input.value, () => modal.info.style.display = "none");
                break
            case "Escape":
                ev.stopPropagation();
                ev.preventDefault();
                modal.modal.style.display = "none";
                modal.info.style.display = "none";
                break
            case "ArrowUp":
            case "ArrowDown":
                ev.stopPropagation();
                ev.preventDefault();

                if (!modal.block.childElementCount) {
                    return
                }

                const activeItem = modal.block.querySelector(".typora-search-multi-item.active")
                let nextItem;
                if (ev.key === "ArrowDown") {
                    if (floor !== 7) {
                        floor++
                    }
                    if (activeItem && activeItem.nextElementSibling) {
                        nextItem = activeItem.nextElementSibling
                    } else {
                        nextItem = modal.block.firstElementChild
                        floor = 1
                    }
                } else {
                    if (floor !== 1) {
                        floor--
                    }
                    if (activeItem && activeItem.previousElementSibling) {
                        nextItem = activeItem.previousElementSibling;
                    } else {
                        nextItem = modal.block.lastElementChild;
                        floor = 7
                    }
                }

                if (activeItem) {
                    activeItem.classList.toggle("active");
                }
                nextItem.classList.toggle("active");

                let top;
                if (floor === 1) {
                    top = nextItem.offsetTop - nextItem.offsetHeight;
                } else if (floor === 7) {
                    top = nextItem.offsetTop - 6 * nextItem.offsetHeight;
                } else if (Math.abs(modal.list.scrollTop - activeItem.offsetTop) > 7 * nextItem.offsetHeight) {
                    top = nextItem.offsetTop - 3 * nextItem.offsetHeight;
                }
                if (top) {
                    modal.list.scrollTo({top: top, behavior: "smooth"});
                }
        }
    });

    modal.block.addEventListener("click", ev => {
        const target = ev.target.closest(".typora-search-multi-item");
        if (!target) {
            return
        }
        const filepath = target.getAttribute("data-path");
        if (metaKeyPressed(ev)) {
            openFileInNewWindow(filepath, false);
            ev.preventDefault();
            ev.stopPropagation();
        } else {
            openFileInThisWindow(filepath);
        }
        hideIfNeed();
    });

    const Call = () => {
        modal.modal.style.display = "block";
        modal.input.select()
    }

    window.addEventListener("keydown", ev => {
        if (config.HOTKEY(ev)) {
            Call();
            ev.preventDefault();
            ev.stopPropagation();
        }
    })

    modal.caseOption.addEventListener("click", ev => {
        modal.caseOption.classList.toggle("select");
        config.CASE_SENSITIVE = !config.CASE_SENSITIVE;
        ev.preventDefault();
        ev.stopPropagation();
    })

    modal.pathOption.addEventListener("click", ev => {
        modal.pathOption.classList.toggle("select");
        config.INCLUDE_FILE_PATH = !config.INCLUDE_FILE_PATH;
        ev.preventDefault();
        ev.stopPropagation();
    })

    module.exports = {Call, config};

    console.log("search_multi.js had been injected");
})();