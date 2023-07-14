(() => {
    const config = {
        ENABLE: true,
        LOOP_DETECT_INTERVAL: 30,
        HIDE_ORIGIN_WINDOW_TITLE: true,
        CLOSE_HOTKEY: ev => metaKeyPressed(ev) && ev.key === "w",
        CHANGE_TAB_HOTKEY: ev => metaKeyPressed(ev) && ev.key === "Tab"
    };

    if (!config.ENABLE) {
        return
    }

    if (window._options.framelessWindow && config.HIDE_ORIGIN_WINDOW_TITLE) {
        document.getElementById("top-titlebar").style.display = "none";
    }

    (() => {
        const css = `
            #plugin-window-tab {
                position: fixed;
                top: 0;
                width: 100%;
                height: 40px;
                z-index: 9999
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
                background-color: var(--side-bar-bg-color, gray);
                border-bottom: solid 1px rgba(0, 0, 0, 0.07)
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
            `
        const style = document.createElement('style');
        style.type = 'text/css';
        style.innerHTML = css;
        document.getElementsByTagName("head")[0].appendChild(style);

        const div = `<div class="tab-bar"></div>`
        const windowTab = document.createElement("div");
        windowTab.id = "plugin-window-tab";
        windowTab.innerHTML = div;
        document.getElementById("write-style").parentElement
            .insertBefore(windowTab, document.getElementById("write-style"));
    })()

    const Package = {
        Path: reqnode("path"),
    };

    const entities = {
        content: document.querySelector("content"),
        tabBar: document.querySelector("#plugin-window-tab .tab-bar"),
    }

    const metaKeyPressed = ev => File.isMac ? ev.metaKey : ev.ctrlKey;

    // 新窗口打开
    const openFileNewWindow = (path, isFolder) => File.editor.library.openFileInNewWindow(path, isFolder)
    // 新标签页打开
    const openFile = filePath => File.editor.library.openFile(filePath);
    // 当前标签页打开
    const OpenFileLocal = filePath => {
        tabUtil.localOpen = true;
        File.editor.library.openFile(filePath);
        tabUtil.localOpen = false;  // 自动还原
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

    const tabUtil = {
        tabs: [],
        activeIdx: 0,
        localOpen: false,
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
            const filePath = File?.filePath || File.bundle?.filePath;
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
        if (tabUtil.localOpen && pathIdx === -1) {
            tabUtil.tabs[tabUtil.activeIdx].path = wantOpenPath;
        } else if (pathIdx === -1) {
            tabUtil.tabs.push({path: wantOpenPath, scrollTop: 0});
            tabUtil.activeIdx = tabUtil.tabs.length - 1;
        } else if (pathIdx !== -1) {
            tabUtil.activeIdx = pathIdx;
        }
        renderDOM(wantOpenPath);
    }

    const after = (result, ...args) => {
        const filePath = args[0];
        if (filePath) {
            openTab(filePath);
        }
    }

    const decorator = (original, after) => {
        return function () {
            const result = original.apply(this, arguments);
            after.call(this, result, ...arguments);
            return result;
        };
    }

    const _timer = setInterval(() => {
        if (File) {
            clearInterval(_timer);

            File.editor.library.openFile = decorator(File.editor.library.openFile, after);

            const filePath = File.filePath || File.bundle?.filePath;
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
        if (target) {
            target.scrollLeft += ev.deltaY;
        }
    })

    window.addEventListener("keydown", ev => {
        if (config.CLOSE_HOTKEY(ev)) {
            ev.preventDefault();
            ev.stopPropagation();

            const tab = entities.tabBar.querySelector(".tab-container.active");
            if (tab) {
                tab.querySelector(".close-button").click();
            }
        } else if (config.CHANGE_TAB_HOTKEY(ev)) {
            ev.preventDefault();
            ev.stopPropagation();

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

    global.tabUtil = tabUtil;
    // let lastOver = null;
    // const toggleOver = (ev, f) => {
    //     const target = ev.target.closest(".tab-container");
    //     if (target) {
    //         if (f === "add") {
    //             target.classList.add("over");
    //             lastOver = target;
    //         } else {
    //             target.classList.remove("over");
    //         }
    //     }
    //     ev.preventDefault();
    // }
    //
    // entities.tabBar.addEventListener("dragstart", ev => {
    //     const draggedTab = ev.target.closest(".tab-container")
    //     if (draggedTab) {
    //         draggedTab.style.opacity = 0.5;
    //         lastOver = null;
    //     }
    // })
    // entities.tabBar.addEventListener("dragend", ev => {
    //     const from = ev.target.closest(".tab-container")
    //     const to = lastOver;
    //     if (from && to) {
    //         from.style.opacity = "";
    //         ev.preventDefault();
    //
    //     }
    // });
    // entities.tabBar.addEventListener("dragover", ev => toggleOver(ev, "add"))
    // entities.tabBar.addEventListener("dragenter", ev => toggleOver(ev, "add"))
    // entities.tabBar.addEventListener("dragleave", ev => toggleOver(ev, "remove"))

    console.log("window_tab.js had been injected");
})()