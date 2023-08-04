(() => {
    const config = {
        // 隐藏掉titleBar
        HIDE_WINDOW_TITLE_BAR: true,
        // 拖拽排序标签页的方式（1 or 2）
        DRAG_STYLE: 1,
        // 当标签页脱离父标签3倍高度时，视为新建窗口
        HEIGHT_SCALE: 3,
        // 总是在当前标签页打开
        LOCAL_OPEN: false,

        // 是否调整content的top，以免被tab遮挡
        CHANGE_CONTENT_TOP: true,
        // 是否调整.md-notification-container的z-index，以免被tab遮挡
        CHANGE_NOTIFICATION_Z_INDEX: true,

        LOOP_DETECT_INTERVAL: 30,
        CLOSE_HOTKEY: ev => metaKeyPressed(ev) && ev.key === "w",
        SWITCH_TAB_HOTKEY: ev => metaKeyPressed(ev) && ev.key === "Tab",
    };

    if (window._options.framelessWindow && config.HIDE_WINDOW_TITLE_BAR) {
        document.querySelector("header").style.zIndex = "897";
        document.getElementById("top-titlebar").style.display = "none";
    }

    (() => {
        const css = `
            #plugin-window-tab {
                position: fixed;
                top: 0;
                width: 100%;
                height: 40px;
                z-index: 898;
            }
    
            #plugin-window-tab .tab-bar {
                background-color: var(--bg-color, white);
                height: 100%;
                display: flex;
                align-items: center;
                justify-content: flex-start;
                width: calc(100vw - var(--sidebar-width, 0));
                overflow-x: scroll
            }
            
            #plugin-window-tab .tab-bar::after {
                content: "";
                height: 100%;
                width: 100vw;
                border-bottom: solid 1px rgba(0, 0, 0, 0.07);
            }
    
            #plugin-window-tab .tab-bar:hover::-webkit-scrollbar-thumb {
                visibility: visible;
            }
            
            #plugin-window-tab .tab-bar::-webkit-scrollbar {
                height: 5px
            }
            
            #plugin-window-tab .tab-bar::-webkit-scrollbar-thumb {
                height: 5px;
                background-color: var(----active-file-bg-color, gray);
                visibility: hidden
            }
            
            #plugin-window-tab .tab-container {
                background-color: var(--side-bar-bg-color, gray);
                height: 100%;
                min-width: 100px;
                position: relative;
                padding: 0 15px;
                padding-right: 10px;
                border-bottom: solid 1px rgba(0, 0, 0, 0.07);
                display: flex;
                align-items: center;
                justify-content: space-between;
                user-select: none;
                flex-shrink: 0;
                cursor: pointer
            }
            
            #plugin-window-tab .tab-container.over {
                background-color: var(--active-file-bg-color, lightgray);
            }
            
            #plugin-window-tab .name {
                max-width: 350px;
                padding-right: 15px;
                font-size: 14px;
                overflow: hidden;
                white-space: nowrap;
                text-overflow: ellipsis;
                pointer-events: none
            }
            
            #plugin-window-tab .close-button {
                padding: 4px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 5px
            }
            
            #plugin-window-tab .tab-container:hover > .close-button {
                visibility: visible !important
            }
            
            #plugin-window-tab .close-icon {
                position: relative;
                width: 11px;
                height: 11px;
                display: flex;
                flex-direction: column;
                justify-content: center;
            }
            
            #plugin-window-tab .close-icon::before,
            #plugin-window-tab .close-icon::after {
                content: "";
                position: absolute;
                width: 100%;
                height: 2px;
                background-color: var(--active-file-border-color, black)
            }
            
            #plugin-window-tab .close-icon::before {
                transform: rotate(45deg)
            }
            
            #plugin-window-tab .close-icon::after {
                transform: rotate(-45deg)
            }
            
            #plugin-window-tab .close-button:hover {
                background-color: var(--active-file-bg-color, lightgray);
            }
            
            #plugin-window-tab .active {
                border: solid 1px rgba(0, 0, 0, 0.07);
                border-bottom: none;
                background-color: var(--bg-color, white)
            }
            
            #plugin-window-tab .active .active-indicator {
                display: block;
            }
            
            #plugin-window-tab .active-indicator {
                position: absolute;
                top: -1px;
                left: -1px;
                width: calc(100% + 2px);
                height: 3px;
                background-color: var(--active-file-border-color, black);
                display: none;
            }
            
            #plugin-window-tab [dragging] {
                position: static !important;
                box-sizing: border-box !important;
                margin: 0 !important;
            }
        
            #plugin-window-tab .drag-obj {
                position: fixed;
                left: 0;
                top: 0;
                z-index: 99999;
                pointer-events: none;
            }
            `
        const style = document.createElement('style');
        style.id = "plugin-window-tab-style";
        style.type = 'text/css';
        style.innerHTML = css;
        document.getElementsByTagName("head")[0].appendChild(style);

        const div = `<div class="tab-bar"></div>`
        const windowTab = document.createElement("div");
        windowTab.id = "plugin-window-tab";
        windowTab.innerHTML = div;
        document.getElementById("write-style").parentElement
            .insertBefore(windowTab, document.getElementById("write-style"));

        if (config.CHANGE_CONTENT_TOP) {
            const {height} = document.querySelector("#plugin-window-tab").getBoundingClientRect();
            document.querySelector("content").style.top = height + "px";
        }

        if (config.CHANGE_NOTIFICATION_Z_INDEX) {
            const container = document.querySelector(".md-notification-container");
            if (container) {
                container.style.zIndex = "99999";
            }
        }
    })()

    const Package = {
        Path: reqnode("path"),
    };

    const entities = {
        content: document.querySelector("content"),
        tabBar: document.querySelector("#plugin-window-tab .tab-bar"),
    }

    const tabUtil = {
        tabs: [],
        activeIdx: 0,
    }

    const metaKeyPressed = ev => File.isMac ? ev.metaKey : ev.ctrlKey;

    // 新窗口打开
    const openFileNewWindow = (path, isFolder) => File.editor.library.openFileInNewWindow(path, isFolder)
    // 新标签页打开
    const openFile = filePath => File.editor.library.openFile(filePath);
    // 当前标签页打开
    const OpenFileLocal = filePath => {
        config.LOCAL_OPEN = true;
        File.editor.library.openFile(filePath);
        config.LOCAL_OPEN = false;  // 自动还原
    }
    // 关闭窗口
    const closeWindow = () => JSBridge.invoke("window.close");

    const getName = filePath => {
        let fileName = Package.Path.basename(filePath);
        const idx = fileName.lastIndexOf(".");
        if (idx !== -1) {
            fileName = fileName.substring(0, idx);
        }
        return fileName
    }

    const newTabDiv = (filePath, idx, active = true) => {
        const fileName = getName(filePath);
        const _active = active ? "active" : "";
        return `<div class="tab-container ${_active}" idx="${idx}" draggable="true">
                    <div class="active-indicator"></div>
                    <span class="name">${fileName}</span>
                    <span class="close-button"><div class="close-icon"></div></span>
                </div>`
    }

    // tabs->DOM的简单数据单向绑定
    const renderDOM = wantOpenPath => {
        let tabDiv = entities.tabBar.firstElementChild;
        tabUtil.tabs.forEach((tab, idx) => {
            if (!tabDiv) {
                const _tabDiv = newTabDiv(tab.path, idx);
                entities.tabBar.insertAdjacentHTML('beforeend', _tabDiv);
                tabDiv = entities.tabBar.lastElementChild;
            }
            if (tab.path === wantOpenPath) {
                tabDiv.classList.add("active");
                tabDiv.scrollIntoViewIfNeeded();
                scrollContent(tab);
            } else {
                tabDiv.classList.remove("active");
            }
            tabDiv.setAttribute("idx", idx + "");
            tabDiv.querySelector(".name").innerText = getName(tab.path);

            tabDiv = tabDiv.nextElementSibling;
        })

        while (tabDiv) {
            tabDiv.parentElement.removeChild(tabDiv);
            tabDiv = tabDiv.nextElementSibling;
        }
    }

    // openFile是一个延迟操作，需要等待content加载好，才能定位scrollTop
    // 问题是我压根不知道content什么时候加载好
    // 解决方法: 轮询设置scrollTop，当连续3次scrollTop不再改变，就判断content加载好了
    // 这种方法很不环保，很ugly。但是我确实也想不到在不修改frame.js的前提下该怎么做了
    const scrollContent = activeTab => {
        if (!activeTab) {
            return
        }

        let count = 0;
        const stopCount = 3;
        const scrollTop = activeTab.scrollTop;
        const _timer = setInterval(() => {
            const filePath = File && File.filePath || File && File.bundle && File.bundle.filePath;
            if (filePath === activeTab.path && entities.content.scrollTop !== scrollTop) {
                entities.content.scrollTop = scrollTop;
                count = 0;
            } else {
                count++;
            }
            if (count === stopCount) {
                clearInterval(_timer);
            }
        }, config.LOOP_DETECT_INTERVAL);
    }

    const openTab = wantOpenPath => {
        const pathIdx = tabUtil.tabs.findIndex(tab => tab.path === wantOpenPath);
        // 原地打开并且不存在tab时，修改当前tab的文件路径
        if (config.LOCAL_OPEN && pathIdx === -1) {
            tabUtil.tabs[tabUtil.activeIdx].path = wantOpenPath;
        } else if (pathIdx === -1) {
            tabUtil.tabs.push({path: wantOpenPath, scrollTop: 0});
            tabUtil.activeIdx = tabUtil.tabs.length - 1;
        } else if (pathIdx !== -1) {
            tabUtil.activeIdx = pathIdx;
        }
        renderDOM(wantOpenPath);
    }

    const _timer = setInterval(() => {
        if (File) {
            clearInterval(_timer);

            const decorator = (original, after) => {
                return function () {
                    const result = original.apply(this, arguments);
                    after.call(this, result, ...arguments);
                    return result;
                };
            }
            const after = (result, ...args) => {
                const filePath = args[0];
                if (filePath) {
                    openTab(filePath);
                }
            }

            File.editor.library.openFile = decorator(File.editor.library.openFile, after);

            const filePath = File.filePath || File.bundle && File.bundle.filePath;
            if (filePath) {
                openTab(filePath);
            }
        }
    }, config.LOOP_DETECT_INTERVAL);

    entities.tabBar.addEventListener("click", ev => {
        const closeButton = ev.target.closest(".close-button");
        const tabContainer = ev.target.closest(".tab-container");
        if (!closeButton && !tabContainer) {
            return
        }

        ev.stopPropagation();
        ev.preventDefault();

        const tab = closeButton ? closeButton.closest(".tab-container") : tabContainer;
        const idx = parseInt(tab.getAttribute("idx"));

        if (metaKeyPressed(ev)) {
            const _path = tabUtil.tabs[idx].path;
            openFileNewWindow(_path, false);
            return
        }

        if (closeButton) {
            tabUtil.tabs.splice(idx, 1);
            if (tabUtil.tabs.length === 0) {
                closeWindow();
                return
            }
            if (tabUtil.activeIdx !== 0) {
                tabUtil.activeIdx--;
            }
        } else {
            tabUtil.activeIdx = idx;
        }
        openFile(tabUtil.tabs[tabUtil.activeIdx].path);
    })

    entities.tabBar.addEventListener("wheel", ev => {
        const target = ev.target.closest("#plugin-window-tab .tab-bar");
        if (!target) {
            return
        }
        if (metaKeyPressed(ev)) {
            target.dispatchEvent(new KeyboardEvent("keydown", {
                key: "Tab", code: "Tab", ctrlKey: true, metaKey: true, shiftKey: (ev.deltaY < 0),
            }))
        } else {
            target.scrollLeft += ev.deltaY;
        }
    })

    window.addEventListener("keydown", ev => {
        const close = config.CLOSE_HOTKEY(ev);
        const switchTab = config.SWITCH_TAB_HOTKEY(ev);
        if (!close && !switchTab) {
            return
        }

        ev.preventDefault();
        ev.stopPropagation();

        if (close) {
            const activeTab = entities.tabBar.querySelector(".tab-container.active");
            if (activeTab) {
                activeTab.querySelector(".close-button").click();
            }
        } else {
            if (ev.shiftKey) {
                tabUtil.activeIdx = (tabUtil.activeIdx === 0) ? tabUtil.tabs.length - 1 : tabUtil.activeIdx - 1;
            } else {
                tabUtil.activeIdx = (tabUtil.activeIdx === tabUtil.tabs.length - 1) ? 0 : tabUtil.activeIdx + 1;
            }
            openFile(tabUtil.tabs[tabUtil.activeIdx].path);
        }
    }, true)

    entities.content.addEventListener("scroll", ev => {
        tabUtil.tabs[tabUtil.activeIdx].scrollTop = entities.content.scrollTop;
    })

    document.querySelector(".typora-quick-open-list").addEventListener("mousedown", ev => {
        const target = ev.target.closest(".typora-quick-open-item");
        if (!target) {
            return
        }
        // 将原先的click行为改成ctrl+click
        if (metaKeyPressed(ev)) {
            return
        }
        ev.preventDefault();
        ev.stopPropagation();
        const filePath = target.getAttribute("data-path");
        openFile(filePath);
    }, true)

    const newWindowIfNeed = (offsetY, tab) => {
        offsetY = Math.abs(offsetY);
        const height = entities.tabBar.getBoundingClientRect().height;
        if (offsetY > height * config.HEIGHT_SCALE) {
            const idx = parseInt(tab.getAttribute("idx"));
            const _path = tabUtil.tabs[idx].path;
            openFileNewWindow(_path, false);
        }
    }

    if (config.DRAG_STYLE === 1) {
        const resetTabBar = () => {
            const tabs = document.querySelectorAll("#plugin-window-tab .tab-container");
            const activeIdx = parseInt(entities.tabBar.querySelector(".tab-container.active").getAttribute("idx"));
            const activePath = tabUtil.tabs[activeIdx].path;
            const newTabList = []
            tabs.forEach(tab => {
                const idx = parseInt(tab.getAttribute("idx"));
                newTabList.push(tabUtil.tabs[idx]);
            })
            tabUtil.tabs = newTabList;
            openTab(activePath);
        }

        const tabBar = $("#plugin-window-tab .tab-bar");
        let currentDragItem = null;
        let _offsetX = 0;

        tabBar.on("dragstart", ".tab-container", function (ev) {
            _offsetX = ev.offsetX;
            currentDragItem = this;
        }).on("dragend", ".tab-container", function (ev) {
            currentDragItem = null;
        }).on("dragover", ".tab-container", function (ev) {
            ev.preventDefault();
            if (!currentDragItem) return;
            this[ev.offsetX > _offsetX ? 'after' : 'before'](currentDragItem);
        }).on("dragenter", function (ev) {
            return false
        })

        let cloneObj = null;
        let offsetX = 0;
        let offsetY = 0;
        let startX = 0;
        let startY = 0;
        let dragBox = null;
        let axis, _axis;

        tabBar.on("dragstart", ".tab-container", function (ev) {
            dragBox = this;
            dragBox.dragData = {};
            axis = dragBox.getAttribute('axis');
            _axis = axis;
            ev.originalEvent.dataTransfer.effectAllowed = "move";
            ev.originalEvent.dataTransfer.dropEffect = 'move';
            let rect = dragBox.getBoundingClientRect();
            let left = rect.left;
            let top = rect.top;
            startX = ev.clientX;
            startY = ev.clientY;
            offsetX = startX - left;
            offsetY = startY - top;
            dragBox.style.transition = 'none';

            const fakeObj = dragBox.cloneNode(true);
            fakeObj.style.width = dragBox.offsetWidth + 'px';
            fakeObj.style.height = dragBox.offsetHeight + 'px';
            fakeObj.style.transform = 'translate3d(0,0,0)';
            fakeObj.setAttribute('dragging', '');
            cloneObj = document.createElement('DIV');
            cloneObj.appendChild(fakeObj);
            cloneObj.className = 'drag-obj';
            cloneObj.style = `transform:translate3d(${left}px, ${top}px, 0)`;
            document.querySelector("content").appendChild(cloneObj);
        }).on("dragend", ".tab-container", function (ev) {
            newWindowIfNeed(ev.offsetY, this);

            if (!cloneObj) return;
            const rect = this.getBoundingClientRect();
            const reset = cloneObj.animate(
                [{
                    transform: cloneObj.style.transform
                }, {
                    transform: `translate3d(${rect.left}px, ${rect.top}px, 0)`
                }], {
                    duration: 150,
                    easing: "ease-in-out",
                }
            )

            reset.onfinish = function () {
                document.querySelector("content").removeChild(cloneObj);
                cloneObj = null;
                dragBox.dragData = null;
                dragBox.style.visibility = 'visible';
                resetTabBar();
            }
        })

        document.addEventListener('dragover', function (ev) {
            if (!cloneObj) return;

            ev.preventDefault();
            ev.stopPropagation();
            ev.dataTransfer.dropEffect = 'move';
            dragBox.style.visibility = 'hidden';
            let left = ~~(ev.clientX - offsetX);
            let top = ~~(ev.clientY - offsetY);
            if (ev.shiftKey || axis) {
                if (_axis === 'X') {
                    top = ~~(startY - offsetY);
                } else if (_axis === 'Y') {
                    left = ~~(startX - offsetX);
                } else {
                    _axis = (~~Math.abs(ev.clientX - startX) > ~~Math.abs(ev.clientY - startY) && 'X' ||
                        ~~Math.abs(ev.clientX - startX) < ~~Math.abs(ev.clientY - startY) && 'Y' || ''
                    )
                }
            } else {
                _axis = '';
            }
            startX = left + offsetX;
            startY = top + offsetY;

            cloneObj.style.transform = `translate3d(${left}px, ${top}px, 0)`;
            dragBox.dragData.left = left;
            dragBox.dragData.top = top;
        })
    }

    if (config.DRAG_STYLE === 2) {
        const toggleOver = (target, f) => {
            if (f === "add") {
                target.classList.add("over");
                lastOver = target;
            } else {
                target.classList.remove("over");
            }
        }

        let lastOver = null;
        $("#plugin-window-tab .tab-bar").on("dragstart", ".tab-container", function (ev) {
            ev.originalEvent.dataTransfer.effectAllowed = "move";
            ev.originalEvent.dataTransfer.dropEffect = 'move';
            this.style.opacity = 0.5;
            lastOver = null;
        }).on("dragend", ".tab-container", function (ev) {
            this.style.opacity = "";
            newWindowIfNeed(ev.offsetY, this);
            if (lastOver) {
                lastOver.classList.remove("over");
                const activeIdx = parseInt(entities.tabBar.querySelector(".tab-container.active").getAttribute("idx"));
                const activePath = tabUtil.tabs[activeIdx].path;
                const toIdx = parseInt(lastOver.getAttribute("idx"));
                const fromIdx = parseInt(this.getAttribute("idx"));
                const ele = tabUtil.tabs.splice(fromIdx, 1)[0];
                tabUtil.tabs.splice(toIdx, 0, ele);
                openTab(activePath);
            }
        }).on("dragover", ".tab-container", function () {
            toggleOver(this, "add");
            return false
        }).on("dragenter", ".tab-container", function () {
            toggleOver(this, "add");
            return false
        }).on("dragleave", ".tab-container", function () {
            toggleOver(this, "remove");
        })
    }

    //////////////////////// 以下是声明式插件系统代码 ////////////////////////
    const dynamicCallArgsGenerator = () => {
        let arg_name, arg_value;
        if (config.LOCAL_OPEN) {
            arg_name = "新标签打开文件";
            arg_value = "new_tab_open";
        } else {
            arg_name = "当前标签打开文件";
            arg_value = "local_open";
        }
        return [{arg_name, arg_value}]
    }

    const call = type => {
        if (type === "new_tab_open") {
            config.LOCAL_OPEN = false;
        } else if (type === "local_open") {
            config.LOCAL_OPEN = true;
        }
    }

    module.exports = {
        config,
        call,
        dynamicCallArgsGenerator,
    };

    console.log("window_tab.js had been injected");
})()