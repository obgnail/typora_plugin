window.onload = () => {
    const Package = {
        Path: reqnode('path'), // Typora将require封装为reqnode
        Fs: reqnode('fs'),
        File: File,            // Typora第一方库
    }

    const config = {
        // 允许拖动模态框
        ALLOW_DRAG: true,
        // 模态框自动隐藏
        AUTO_HIDE: false,
        // 搜索内容时大小写敏感
        CASE_SENSITIVE: false,
        // 展示文件路径时使用相对路径
        RELATIVE_PATH: true,
        // 关键词按空格分割
        SEPARATOR: " ",
        // Typora允许打开小于2000000(即MAX_FILE_SIZE)的文件，大于maxSize的文件在搜索时将被忽略。若maxSize<0则不过滤
        MAX_SIZE: Package.File.MAX_FILE_SIZE,
        // Typora允许打开的文件的后缀名，此外的文件在搜索时将被忽略
        ALLOW_EXT: ["", "md", "markdown", "mdown", "mmd", "text", "txt", "rmarkdown",
            "mkd", "mdwn", "mdtxt", "rmd", "mdtext", "apib"],
        // 快捷键ctrl/command+shift+P打开搜索框，懒得写keycodes映射函数，能用就行
        HOTKEY: ev => metaKeyPressed(ev) && ev.shiftKey && ev.keyCode === 80,
    };

    // prepare
    (() => {
        // insert css
        const modal_css = `
        #typora-search-multi {
            position: fixed;
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
        
        .mac-seamless-mode .modal-dialog {
            margin-top: 40px
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
            padding-left: 5px
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
            padding: 1px;
            right: 6px;
            top: 8px;
            opacity: .5;
            line-height: 10px;
            border-radius: 3px
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

        // insert html
        const modal_div = `
        <div id="typora-search-multi-input">
            <input type="text" class="input" tabindex="1" autocorrect="off" spellcheck="false"
                autocapitalize="off" value="" placeholder="多关键字查找，空格为分隔符"
                data-localize="Search by file name" data-lg="Front">
            <span ty-hint="区分大小写" id="typora-search-multi-case-option-btn" class="search-multi-search-option-btn" aria-label="区分大小写">
                <svg class="icon">
                    <use xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="#find-and-replace-icon-case"></use>
                </svg>
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

        // init case sensitive
        config.CASE_SENSITIVE = document.querySelector("#typora-search-multi-case-option-btn").classList.contains("select")
    })();

    const modal = {
        modal: document.getElementById('typora-search-multi'),
        info: document.querySelector(".typora-search-multi-info-item"),
        list: document.querySelector("#typora-search-multi-list"),
        listInner: document.querySelector(".typora-search-multi-list-inner"),
        block: document.querySelector(".typora-search-multi-list-inner .quick-open-group-block"),
        input: document.querySelector("#typora-search-multi-input input"),
        caseOption: document.querySelector("#typora-search-multi-case-option-btn"),
        resultTitle: document.querySelector(".typora-search-multi-list .ty-quick-open-category-title")
    }

    // Typora里几乎所有常用操作库,具体代码可以在frame.js找到
    const getLibrary = () => Package.File.editor.library
    const getMountFolder = Package.File.getMountFolder
    const separator = Package.File.isWin ? "\\" : "/";
    let metaKeyPressed = ev => Package.File.isMac ? ev.metaKey : ev.ctrlKey

    const autoHide = () => {
        if (config.AUTO_HIDE) {
            modal.modal.style.display = "none";
        }
    }

    const openFileInThisWindow = filePath => {
        document.activeElement.blur();
        getLibrary().openFile(filePath);
    }

    const openFileOrFolder = (path, isFolder) => getLibrary().openFileInNewWindow(path, isFolder)

    const traverseDir = (dir, filter, callback) => {
        return new Promise((resolve, reject) => {
            Package.Fs.readdir(dir, (err, files) => {
                if (err) {
                    reject(err);
                    return
                }

                for (const file of files) {
                    const filePath = Package.Path.join(dir, file);
                    Package.Fs.stat(filePath, (err, stats) => {
                        if (err) {
                            reject(err);
                            return
                        }
                        if (stats.isFile()) {
                            if (filter && !filter(filePath, stats)) {
                                resolve();
                                return
                            }
                            Package.Fs.readFile(filePath, 'utf8', (err, data) => {
                                if (err) {
                                    reject(err);
                                    return
                                }
                                callback(filePath, data);
                            });
                        } else if (stats.isDirectory()) {
                            traverseDir(filePath, filter, callback);
                        }
                    });
                }
            });
        })
    }

    const appendItemFunc = (keyArr) => {
        let index = 0;
        let once = true;
        let rootPath = getMountFolder()

        return (filePath, data) => {
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
            const item = `
                <div class="typora-search-multi-item" data-is-dir="false"
                    data-path="${filePath}" data-index="${index}">
                    <div class="typora-search-multi-item-title">${parseUrl.base}</div>
                    <div class="typora-search-multi-item-path">${dirPath}${separator}</div>
                </div>`;
            modal.block.insertAdjacentHTML('beforeend', item);
            modal.resultTitle.textContent = `匹配的文件: ${index}`;
            if (index <= 8) {
                modal.listInner.style.height = 40 * index + "px";
            }

            if (once) {
                modal.list.style.display = "block";
                once = false;
            }
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
    const verifySize = (stat) => 0 > config.MAX_SIZE || stat.size < config.MAX_SIZE
    const allowRead = (filepath, stat) => verifySize(stat) && verifyExt(filepath)

    async function searchMulti(rootPath, keys) {
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
        await traverseDir(rootPath, allowRead, appendItem);
    }

    if (config.ALLOW_DRAG) {
        modal.modal.addEventListener("mousedown", ev => {
            ev.stopPropagation();
            let rect = modal.modal.getBoundingClientRect();
            let shiftX = ev.clientX - rect.left;
            let shiftY = ev.clientY - rect.top;

            let onMouseMove = ev => {
                ev.stopPropagation();
                ev.preventDefault();
                requestAnimationFrame(() => {
                    modal.modal.style.left = ev.clientX - shiftX + 'px';
                    modal.modal.style.top = ev.clientY - shiftY + 'px';
                });
            }

            document.addEventListener("mouseup", ev => {
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
        switch (ev.keyCode) {
            case 13: // enter
                modal.list.style.display = "none";
                modal.info.style.display = "block";
                modal.block.innerHTML = "";
                const workspace = getMountFolder();
                searchMulti(workspace, modal.input.value);
                modal.info.style.display = "none";
                break
            case 27: // esc
                ev.stopPropagation();
                ev.preventDefault();
                modal.modal.style.display = "none";
                modal.info.style.display = "none";
                break
            case 38: // up
            case 40: // down
                ev.stopPropagation();
                ev.preventDefault();

                if (!modal.block.childElementCount) {
                    return
                }

                let activeItem = modal.block.querySelector(".typora-search-multi-item.active")
                let nextItem;
                if (ev.keyCode === 40) {
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
                    top = nextItem.offsetTop - 1 * nextItem.offsetHeight
                } else if (floor === 7) {
                    top = nextItem.offsetTop - 6 * nextItem.offsetHeight
                }
                if (top) {
                    modal.list.scrollTo({top: top, behavior: "smooth"});
                }
        }
    });

    modal.block.addEventListener("click", ev => {
        let target = ev.target.closest(".typora-search-multi-item");
        if (!target) {
            return
        }
        const filepath = target.getAttribute("data-path");
        if (ev.ctrlKey) {
            openFileOrFolder(filepath, false);
            ev.preventDefault();
            ev.stopPropagation();
        } else {
            openFileInThisWindow(filepath)
        }
        autoHide()
    });

    window.onkeydown = ev => {
        if (config.HOTKEY(ev)) {
            modal.modal.style.display = "block";
            modal.input.select();
            ev.preventDefault();
            ev.stopPropagation();
        }
    }

    modal.caseOption.addEventListener("click", ev => {
        modal.caseOption.classList.toggle("select");
        config.CASE_SENSITIVE = !config.CASE_SENSITIVE;
        ev.preventDefault();
        ev.stopPropagation();
    })

    console.log("search_multi.js had been injected");
}