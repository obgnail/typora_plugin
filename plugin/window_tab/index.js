(() => {
    const config = {
        LOOP_DETECT_INTERVAL: 500,
        CLOSE_HOTKEY: ev => ev.altKey && ev.key === "w"
    };

    const Package = {
        Path: reqnode("path"),
    };

    (() => {
        const css = `
        #plugin-window-tab {
            position: fixed;
            top: 0;
            width: 100%;
            height: 40px;
            z-index: 1
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
        
        #plugin-window-tab .tab-container:hover {
            background-color: var(--item-hover-bg-color);
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

    const entities = {
        content: document.querySelector("content"),
        tabBar: document.querySelector("#plugin-window-tab .tab-bar"),
    }

    const closeWindow = () => JSBridge.invoke("window.close");

    const openFile = filePath => File.editor.library.openFile(filePath);
    const OpenFileLocal = filPath => {
        localOpen = true;
        openFile(filPath)
        localOpen = false;  // 自动还原
    }

    const getName = filePath => {
        let fileName = Package.Path.basename(filePath);
        const idx = fileName.lastIndexOf(".");
        if (idx !== -1) {
            fileName = fileName.substring(0, idx);
        }
        return fileName
    }

    const newTabDiv = (filePath, active) => {
        const fileName = getName(filePath);
        const _active = active ? "active" : "";
        return `<div class="tab-container ${_active}" data-path="${filePath}" draggable="true">
                    <div class="active-indicator"></div>
                    <span class="name">${fileName}</span>
                    <span class="close-button"><div class="close-icon"></div></span>
                </div>`
    }

    let localOpen = false;
    let tabs = [];
    let activePath;
    // tabs->DOM的简单单向数据绑定
    const renderDOM = wantOpenPath => {
        let tabContainer = entities.tabBar.firstElementChild;
        tabs.forEach(tab => {
            if (!tabContainer) {
                const tabDiv = newTabDiv(tab.path, true);
                entities.tabBar.insertAdjacentHTML('beforeend', tabDiv);
                tabContainer = entities.tabBar.lastElementChild;
            }
            if (tab.path === wantOpenPath) {
                tabContainer.classList.add("active");
            } else {
                tabContainer.classList.remove("active");
            }
            tabContainer.setAttribute("data-path", tab.path);
            tabContainer.querySelector(".name").innerText = getName(tab.path);

            tabContainer = tabContainer.nextElementSibling;
        })

        while (tabContainer) {
            tabContainer.parentElement.removeChild(tabContainer);
            tabContainer = tabContainer.nextElementSibling;
        }

        activePath = wantOpenPath;
    }

    const openTab = wantOpenPath => {
        const pathIdx = tabs.findIndex(tab => tab.path === wantOpenPath);
        if (localOpen && pathIdx === -1) {
            tabs.forEach(tab => {
                if (tab.path === activePath) {
                    tab.path = wantOpenPath;
                }
            })
        } else if (pathIdx === -1) {
            tabs.push({path: wantOpenPath});
        }
        renderDOM(wantOpenPath);
    }

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

    const _timer = setInterval(() => {
        if (File) {
            clearInterval(_timer);

            File.editor.library.openFile = decorator(File.editor.library.openFile, after);

            const filePath = File?.filePath || File.bundle?.filePath;
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
        const _path = tab.getAttribute("data-path");
        if (closeButton) {
            tabs = tabs.filter(tab => tab.path !== _path);
            if (tabs.length === 0) {
                closeWindow();
                return
            }
            if (_path === activePath) {
                activePath = tab.nextElementSibling?.getAttribute("data-path") || tabs[tabs.length - 1].path;
            }
            openFile(activePath);
        } else {
            openFile(_path);
        }
    })

    entities.tabBar.addEventListener("wheel", ev => {
        const target = ev.target.closest("#plugin-window-tab .tab-bar");
        if (target) {
            target.scrollLeft += ev.deltaY;
        }
    })

    const metaKeyPressed = ev => File.isMac ? ev.metaKey : ev.ctrlKey;

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