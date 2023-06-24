(() => {
    const config = {
        DEBUG: false,

        SHOW_TAB_WHEN_ONE_WINDOW: false,

        TABS_WIDTH: "75%",
        TABS_LEFT: "100px",
        TABS_MARGIN_LEFT: "10px",
        TABS_MARGIN_RIGHT: "10px",
        TABS_HEIGHT: "24px",
        TABS_JUSTIFY_CONTENT: "center",
        TABS_ALIGN_ITEMS: "stretch",
        TAB_SELECT_BG_COLOR: "#ffafa3",
        TAB_HOVER_BG_COLOR: "#ffd4cc",
        TAB_MAX_WIDTH: "150px",
        TAB_WRAP: "wrap",
        TAB_OVERFLOW: "hidden",
        TAB_TEXT_OVERFLOW: "ellipsis",
        TAB_WHITE_SPACE: "nowrap",
        TAB_TEXT_ALIGN: "center",
        TAB_PADDING_LEFT: "10px",
        TAB_PADDING_RIGHT: "10px",
        TAB_BORDER_STYLE: "dashed",
        TAB_BORDER_WIDTH: "1px",
        TAB_BORDER_COLOR: "#8c8c8c",

        CHECK_INTERVAL: 50,

        REQUIRE_VAR_NAME: "__PLUGIN_REQUIRE__",
        ELECTRON_VAR_NAME: "__PLUGIN_ELECTRON__"
    }

    const Package = {
        // Typora常用的第一方内置库
        File: File,
        Client: ClientCommand,

        // node标准库
        Path: reqnode('path'),
        Fs: reqnode('fs'),

        // 劫持过来的electron核心库
        getElectron: () => global[config.ELECTRON_VAR_NAME],
        getRequire: () => global[config.REQUIRE_VAR_NAME],
    }

    const execForWindow = (winId, js) => JSBridge.invoke("executeJavaScript", winId, js);
    const execForAllWindows = js => Package.Client.execForAll(js);

    const getAPP = () => Package.getElectron().app;
    const getBrowserWindow = () => Package.getElectron().BrowserWindow;
    const getIPC = () => Package.getElectron().ipcMain;

    const getAllWindows = () => getBrowserWindow().getAllWindows();
    const getFocusedWindowId = () => getAPP().getCurrentFocusWindowId();
    const rangeWindow = func => {
        const windows = getAllWindows();
        for (const win of windows) {
            if (func(win)) {
                return
            }
        }
    }
    const getFocusedWindow = () => {
        let focused = getFocusedWindowId();
        const windows = getAllWindows();
        for (const win of windows) {
            if (win.id === focused) {
                return win
            }
        }
    }
    const setFocusWindow = winId => {
        rangeWindow(win => {
            if (win.id === winId) {
                win.focus();
                return true
            }
        })
    };

    const getDocumentController = () => getAPP().getDocumentController();
    const getDocument = id => getDocumentController().getDocumentFromWindowId(id);

    // hijack electron instance and require function in Typora backend
    setTimeout(() => {
        execForAllWindows(`
            if (!global["${config.ELECTRON_VAR_NAME}"]) {
                global.${config.REQUIRE_VAR_NAME} = global.reqnode('electron').remote.require;
                global.${config.ELECTRON_VAR_NAME} = ${config.REQUIRE_VAR_NAME}('electron');
            }`
        )
    });

    (() => {
        // insert css
        const title_bar_css = `
        #title-bar-window-tabs {
            position: absolute;
            -webkit-app-region: no-drag;
            left: ${config.TABS_LEFT};
            width: ${config.TABS_WIDTH};
            height: ${config.TABS_HEIGHT};
            margin-left: ${config.TABS_MARGIN_LEFT};
            margin-right: ${config.TABS_MARGIN_RIGHT};
            z-index: 9999;
        }
        
        #title-bar-window-tabs .title-bar-window-tabs-list {
            display: flex;
            flex-direction: row;
            flex-wrap: ${config.TAB_WRAP};
            justify-content: ${config.TABS_JUSTIFY_CONTENT};
            align-items: ${config.TABS_ALIGN_ITEMS};
            height: ${config.TABS_HEIGHT};
        }
        
        #title-bar-window-tabs .title-bar-window-tab {
            flex-grow: 1;
            height: ${config.TABS_HEIGHT};
            max-width: ${config.TAB_MAX_WIDTH};
            padding-left: ${config.TAB_PADDING_LEFT};
            padding-right: ${config.TAB_PADDING_RIGHT};
            text-align: ${config.TAB_TEXT_ALIGN};
            border-style: ${config.TAB_BORDER_STYLE};
            border-width: ${config.TAB_BORDER_WIDTH};
            border-color: ${config.TAB_BORDER_COLOR};
            margin-right: -1px;
            margin-left: -1px;
            cursor: pointer;
        }
        
        #title-bar-window-tabs .title-bar-window-tab.select {
            background-color: ${config.TAB_SELECT_BG_COLOR};
        }
        
        #title-bar-window-tabs .title-bar-window-tab:hover {
            background-color: ${config.TAB_HOVER_BG_COLOR};
        }
        
        #title-bar-window-tabs .title-bar-window-tab .window-tab-name {
            overflow: ${config.TAB_OVERFLOW};
            text-overflow: ${config.TAB_TEXT_OVERFLOW};
            white-space: ${config.TAB_WHITE_SPACE};
        }
        `
        const style = document.createElement('style');
        style.type = 'text/css';
        style.innerHTML = title_bar_css;
        document.getElementsByTagName("head")[0].appendChild(style);

        // insert html
        const title_bar_div = `<div class="title-bar-window-tabs-list"></div>`
        const windowTabs = document.createElement("div");
        windowTabs.id = 'title-bar-window-tabs';
        windowTabs.innerHTML = title_bar_div;
        const titleBarLeft = document.getElementById("w-titlebar-left");
        titleBarLeft.parentNode.insertBefore(windowTabs, titleBarLeft.nextSibling);
    })()

    const windowTabs = {
        tabs: document.getElementById('title-bar-window-tabs'),
        list: document.querySelector(".title-bar-window-tabs-list"),
        titleText: document.getElementById('title-text'),
    }

    global.flushWindowTabs = excludeId => {
        const windows = getAllWindows();
        let copy = [...windows];
        if (excludeId) {
            copy = copy.filter(win => win.id !== excludeId)
        }
        let sortedWindows = copy.sort((a, b) => a.id - b.id);

        if (sortedWindows.length === 1 && !config.SHOW_TAB_WHEN_ONE_WINDOW) {
            windowTabs.tabs.style.display = "none";
            return
        }

        windowTabs.tabs.style.display = "block";
        // const focusWinId = getFocusedWindowId();
        const divArr = sortedWindows.map(win => {
            const name = getWindowName(win);
            // let selected = win.id === focusWinId ? " select" : "";
            let selected = "";
            return `<div class="title-bar-window-tab${selected}" winId="${win.id}"><div class="window-tab-name">${name}</div></div>`
        })
        windowTabs.list.innerHTML = divArr.join("");
    }

    const flushWindowTabs = excludeId => {
        execForAllWindows(`global.flushWindowTabs(${excludeId})`)
    }

    const loopDetect = (check, after) => {
        const timer = setInterval(() => {
            if (check()) {
                clearInterval(timer);
                after();
            }
        }, config.CHECK_INTERVAL)
    }

    const onElectronLoad = func => {
        loopDetect(
            () => Package.getElectron() && Package.getRequire(),
            () => func(Package.getRequire(), Package.getElectron())
        )
    }

    const getWindowName = win => {
        let name = win.getTitle().replace("- Typora", "").trim();
        const idx = name.lastIndexOf(".");
        if (idx !== -1) {
            name = name.substring(0, idx);
        }
        return name
    }

    onElectronLoad((require, electron) => {
        flushWindowTabs();
    })

    window.addEventListener("beforeunload", ev => {
        const focusWinId = getFocusedWindowId();
        execForAllWindows(`global.flushWindowTabs(${focusWinId})`)
    }, true)

    windowTabs.list.addEventListener("click", ev => {
        const target = ev.target.closest(".title-bar-window-tab");
        if (!target) {
            return
        }
        const winId = target.getAttribute("winId");
        setFocusWindow(parseInt(winId));
    })

    new MutationObserver(() => {
        flushWindowTabs();
    }).observe(windowTabs.titleText, {childList: true});


    document.addEventListener('visibilitychange', () => {
        // 用户离开了当前页面
        if (document.visibilityState === 'hidden') {
            console.log('页面不可见');
        }

        // 用户打开或回到页面
        if (document.visibilityState === 'visible') {
            console.log('visible');
            const focusWinId = getFocusedWindowId()
            const tabs = windowTabs.list.querySelectorAll(`.title-bar-window-tab`);
            for (const tab of tabs) {
                const winId = tab.getAttribute("winId");
                if (winId !== focusWinId) {
                    tab.classList.remove("select");
                } else {
                    tab.classList.add("select");
                }
            }
        }
    });

    if (config.DEBUG) {
        global.test = () => getAllWindows().forEach(win => {
            console.log({"id": win.id, "name": win.getTitle()})
        })
        global.getFocusedWindow = getFocusedWindowId
        global.getFocusedWindow = getFocusedWindow
        global.execForWindow = execForWindow
        global.execForAllWindows = execForAllWindows
        global.getDocument = getDocument
    }
    console.log("window_tab.js had been injected");
})();
