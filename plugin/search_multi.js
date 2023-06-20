window.onload = () => {
    const pkg = {
        path: reqnode('path'), // Typora将require封装为reqnode
        fs: reqnode('fs'),
        file: File, // 和Typora文件相关的第一方库
    }

    const config = {
        // 允许拖动模态框
        allowDrag: false,
        // 模态框自动隐藏
        autoHide: false,
        // 搜索内容时大小写敏感
        caseSensitive: false,
        // 展示文件路径时使用相对路径
        relativePath: true,
        // 关键词按空格分割
        separator: " ",
        // Typora允许打开小于2000000(即pkg.file.MAX_FILE_SIZE)的文件，大于maxSize的文件在搜索时将被忽略。若maxSize<0则不过滤
        maxSize: pkg.file.MAX_FILE_SIZE,
        // Typora允许打开的文件的后缀名，此外的文件在搜索时将被忽略
        allowExt: ["", "md", "markdown", "mdown", "mmd", "text", "txt", "rmarkdown",
            "mkd", "mdwn", "mdtxt", "rmd", "mdtext", "apib"],
        // 快捷键ctrl/command+shift+P打开搜索框，懒得写keycodes映射函数，能用就行
        hotkey: ev => metaKeyPressed(ev) && ev.shiftKey && ev.keyCode === 80,
    };

    // prepare
    (() => {
        // insert css
        const modal_css = `
        #typora-search-multi {
            position: fixed;
            left: 80%;
            width: 420px;
            margin-left: -200px;
            z-index: 9999;
            padding: 4px;
            background-color: #f8f8f8;
            box-shadow: 0 4px 10px rgba(0, 0, 0, .5);
            border: 1px solid #ddd;
            border-top: none;
            color: var(--text-color);
            margin-top: 0;
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
        
        #typora-search-multi-input svg.icon {
            width: 20px;
            height: 14px;
            stroke: none;
            fill: currentColor
        }
        
        #typora-search-multi-input .searchpanel-search-option-btn {
            position: absolute;
            right: 6px;
            top: 6px;
            opacity: .5;
            border: none
        }
        
        #typora-search-multi-input .searchpanel-search-option-btn.select,
        #typora-search-multi-input .searchpanel-search-option-btn:hover {
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
            max-height: 320px;
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
        const search_div = `
        <div id="typora-search-multi-input">
            <input type="text" class="input" tabindex="1" autocorrect="off" spellcheck="false"
                autocapitalize="off" value="" placeholder="多关键字查找，空格为分隔符"
                data-localize="Search by file name" data-lg="Front">
            <span ty-hint="区分大小写" id="typora-search-multi-case-option-btn" class="searchpanel-search-option-btn" aria-label="区分大小写">
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
        searchModal.className = 'modal-dialog';
        searchModal.style.display = "none";
        searchModal.innerHTML = search_div;
        const quickOpenNode = document.getElementById("typora-quick-open");
        quickOpenNode.parentNode.insertBefore(searchModal, quickOpenNode.nextSibling);

        // init case sensitive
        config.caseSensitive = document.querySelector("#typora-search-multi-case-option-btn").classList.contains("select")
    })();

    const modal = {
        modal: document.getElementById('typora-search-multi'),
        info: document.querySelector(".typora-search-multi-info-item"),
        list: document.querySelector("#typora-search-multi-list"),
        block: document.querySelector(".typora-search-multi-list-inner .quick-open-group-block"),
        input: document.querySelector("#typora-search-multi-input input"),
        caseOption: document.querySelector("#typora-search-multi-case-option-btn"),
        resultTitle: document.querySelector(".typora-search-multi-list .ty-quick-open-category-title")
    }

    const separator = pkg.file.isWin ? "\\" : "/";
    const getRootPath = pkg.file.getMountFolder

    // ctrl or command, 兼容 mac/win
    let metaKeyPressed = ev => pkg.file.isMac ? ev.metaKey : ev.ctrlKey

    const autoHide = () => {
        if (config.autoHide) {
            modal.modal.style.display = "none";
        }
    }

    const clickHiddenNode = () => {
        let once = true;
        let hiddenNode;

        return filePath => {
            if (once) {
                // 推迟到此时才插入,避免#file-library-tree还未生成的情况
                (() => {
                    const hidden_div = `
                        <div data-path="{{}}" data-is-directory="false" style="display: none;">
                            <div class="file-node-content"></div>
                        </div>`
                    const tree = document.querySelector("#file-library-tree")
                    tree.insertAdjacentHTML('beforeend', hidden_div);
                    hiddenNode = tree.lastElementChild;
                    once = false;
                })();
            }
            // frame.js中绑定click事件的标签是.file-node-content，代码节选如下:
            // d("#file-library-tree").on("click", ".file-node-content", function (t) {
            //     var n=d(this).parent(),i=n.attr("data-path"),r=n.attr("data-is-directory")
            // })
            hiddenNode.setAttribute("data-path", filePath);
            hiddenNode.firstElementChild.click();
        }
    }

    const openFileInThisWindow = clickHiddenNode()

    const openFileOrFolder = (path, isFolder) => {
        // 路径是否在挂载文件夹下
        const isUnderMountFolder = (path, mountFolder) => {
            const subPath = mountFolder.replace(/[\/\\]$/, "") + separator + path;
            return path && mountFolder && subPath.startsWith(mountFolder);
        }

        if (pkg.file.isMac) {
            const handler = isFolder ? "controller.openFolder" : "path.openFile";
            bridge.callHandler(handler, path);
        } else if (pkg.file.isNode) {
            if (isFolder) {
                JSBridge.invoke("app.openFolder", path, true);
            } else {
                const folder = pkg.file.getMountFolder();
                const mountFolder = isUnderMountFolder(path, folder) ? folder : undefined;
                JSBridge.invoke("app.openFileOrFolder", path, {mountFolder: mountFolder});
            }
        }
    }

    const traverseDir = (dir, filter, callback) => {
        return new Promise((resolve, reject) => {
            pkg.fs.readdir(dir, (err, files) => {
                if (err) {
                    reject(err);
                    return
                }

                for (const file of files) {
                    const filePath = pkg.path.join(dir, file);
                    pkg.fs.stat(filePath, (err, stats) => {
                        if (err) {
                            reject(err);
                            return
                        }
                        if (stats.isFile()) {
                            if (filter && !filter(filePath, stats)) {
                                resolve();
                                return
                            }
                            pkg.fs.readFile(filePath, 'utf8', (err, data) => {
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
        let rootPath = getRootPath()

        return (filePath, data) => {
            if (!config.caseSensitive) {
                data = data.toLowerCase();
            }
            for (const keyword of keyArr) {
                if (data.indexOf(keyword) === -1) {
                    return false
                }
            }

            index++;
            const parseUrl = pkg.path.parse(filePath);
            const dirPath = !config.relativePath ? parseUrl.dir : parseUrl.dir.replace(rootPath, ".");
            const item = `
                <div class="typora-search-multi-item" data-is-dir="false"
                    data-path="${filePath}" data-index="${index}">
                    <div class="typora-search-multi-item-title">${parseUrl.base}</div>
                    <div class="typora-search-multi-item-path">${dirPath}${separator}</div>
                </div>`;
            modal.block.insertAdjacentHTML('beforeend', item);
            modal.resultTitle.textContent = `匹配的文件: ${index}`;

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
        const ext = pkg.path.extname(filename).replace(/^\./, '');
        if (~config.allowExt.indexOf(ext.toLowerCase())) {
            return true
        }
    }
    const verifySize = (stat) => 0 > config.maxSize || stat.size < config.maxSize
    const allowRead = (filepath, stat) => verifySize(stat) && verifyExt(filepath)

    async function searchMulti(rootPath, keys) {
        if (!rootPath) {
            return
        }
        let keyArr = keys.split(config.separator).filter(Boolean);
        if (!keyArr) {
            return
        }
        if (!config.caseSensitive) {
            keyArr = keyArr.map(ele => ele.toLowerCase());
        }
        const appendItem = appendItemFunc(keyArr);
        await traverseDir(rootPath, allowRead, appendItem);
    }

    if (config.allowDrag) {
        modal.modal.addEventListener("mousedown", ev => {
            modal.modal.style.position = 'absolute';
            let shiftX = ev.clientX - modal.modal.getBoundingClientRect().left;
            let shiftY = ev.clientY - modal.modal.getBoundingClientRect().top;

            function onMouseMove(event) {
                modal.modal.style.left = event.pageX - shiftX + 'px';
                modal.modal.style.top = event.pageY - shiftY + 'px';
            }

            document.addEventListener("mouseup", function () {
                document.removeEventListener('mousemove', onMouseMove);
                modal.modal.onmouseup = null;
            })

            document.addEventListener('mousemove', onMouseMove);
        })
        modal.modal.ondragstart = () => {
            return false
        };
    }


    modal.input.addEventListener("keydown", ev => {
        if (ev.keyCode === 13) {
            modal.list.style.display = "none";
            modal.info.style.display = "block";
            modal.block.innerHTML = "";
            const workspace = getRootPath();
            searchMulti(workspace, modal.input.value);
            modal.info.style.display = "none";
        } else if (ev.keyCode === 27) {
            modal.modal.style.display = "none";
            modal.info.style.display = "none";
        }
    });

    modal.block.addEventListener("click", ev => {
        for (const ele of ev.path) {
            if (ele.className === "typora-search-multi-item") {
                const filepath = ele.getAttribute("data-path");
                if (ev.ctrlKey) {
                    openFileOrFolder(filepath, false);
                    ev.preventDefault();
                    ev.stopPropagation();
                } else {
                    openFileInThisWindow(filepath)
                }
                autoHide()
                return
            }
        }
    });

    window.onkeydown = ev => {
        if (config.hotkey(ev)) {
            modal.modal.style.display = "block";
            modal.input.select();
            ev.preventDefault();
            ev.stopPropagation();
        }
    }

    modal.caseOption.addEventListener("click", ev => {
        modal.caseOption.classList.toggle("select");
        config.caseSensitive = !config.caseSensitive;
        ev.preventDefault();
        ev.stopPropagation();
    })

    console.log("search_multi.js had been injected");
}