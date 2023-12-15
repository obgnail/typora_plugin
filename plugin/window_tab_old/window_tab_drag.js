(() => {
    const config = {
        // 启用脚本,若为false,以下配置全部失效
        ENABLE: false,
        // 当只有一个窗口时是否隐藏标签
        HIDE_TAB_WHEN_ONE_WINDOW: true,
        // 当打开配置菜单的时候是否隐藏
        HIDE_WHEN_MENU_OPEN: true,
        // 隐藏掉原始的标题，当 HIDE_TAB_WHEN_ONE_WINDOW 为 true，且只有一个窗口时，强制为 false
        HIDE_ORIGIN_WINDOW_TITLE: true,
        // 隐藏掉最小大化关闭按钮
        HIDE_TRAFFIC_LIGHTS: false,
        // 隐藏掉tab里的关闭按钮
        HIDE_CLOSE_BUTTON: true,
        // 经典窗口视图时使用
        HIDE_TITLE_BAR: false,
        HIDE_TITLE_BAR_LEFT: false,

        TABS_WIDTH: "75%",
        TABS_LEFT: "100px",
        TABS_MARGIN_LEFT: "10px",
        TABS_MARGIN_RIGHT: "10px",
        TABS_HEIGHT: "24px",
        TABS_JUSTIFY_CONTENT: "center",
        TABS_ALIGN_ITEMS: "stretch",
        TAB_DISPLAY: "inline-flex",
        TAB_SELECT_BG_COLOR: "#ffafa3",
        TAB_HOVER_BG_COLOR: "#ffd4cc",
        TAB_MAX_WIDTH: "150px",
        TAB_WRAP: "nowrap",
        TAB_OVERFLOW: "hidden",
        TAB_TEXT_OVERFLOW: "ellipsis",
        TAB_WHITE_SPACE: "nowrap",
        TAB_TEXT_ALIGN: "center",
        TAB_PADDING_LEFT: "10px",
        TAB_PADDING_RIGHT: "10px",
        TAB_BORDER_STYLE: "dotted",
        TAB_BORDER_WIDTH: "1px",
        TAB_BORDER_COLOR: "#8c8c8c",
        TAB_BORDER_RADIUS: "3px",
        TAB_OVER_BORDER_COLOR: "purple",
        TAB_OVER_BORDER_WIDTH: "2px",
        TAB_OVER_BORDER_STYLE: "dashed",

        LOOP_CHECK_INTERVAL: 50,
        FOCUS_CHECK_INTERVAL: 100,

        REQUIRE_VAR_NAME: "__PLUGIN_REQUIRE__",
        ELECTRON_VAR_NAME: "__PLUGIN_ELECTRON__",

        DEBUG: false,
    }

    // 高版本不再开启此脚本
    if (parseInt(window._options.appVersion.split(".")[0]) > 0) {
        config.ENABLE = false
    }

    if (!config.ENABLE) {
        return
    }

    // 兼容经典布局
    if (!window._options.framelessWindow) {
        config.HIDE_TITLE_BAR = false;
        config.HIDE_TRAFFIC_LIGHTS = true;
        config.HIDE_TITLE_BAR_LEFT = true;
    }

    if (config.HIDE_CLOSE_BUTTON) {
        config.TAB_DISPLAY = "";
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

    const closeWindow = () => JSBridge.invoke("window.close");
    const execForWindow = (winId, js) => JSBridge.invoke("executeJavaScript", winId, js);
    const execForAllWindows = js => Package.Client.execForAll(js);

    const getAPP = () => Package.getElectron().app;
    const getBrowserWindow = () => {
        const electron = Package.getElectron();
        if (electron) {
            return electron.BrowserWindow;
        }
    }
    const getIPC = () => Package.getElectron().ipcMain;

    const getAllWindows = () => getBrowserWindow().getAllWindows();
    const getFocusedWindow = () => {
        const browserWindow = getBrowserWindow();
        if (browserWindow) {
            return browserWindow.getFocusedWindow();
        }
    }
    const setFocusWindow = winId => {
        const windows = getAllWindows();
        for (const win of windows) {
            if (win.id === winId) {
                win.focus();
                return
            }
        }
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

    const showTabsIfNeed = forceHide => {
        if (forceHide) {
            windowTabs.tabs.style.display = "none";
            return
        }

        const b = config.HIDE_TAB_WHEN_ONE_WINDOW && windowTabs.list.childElementCount <= 1;
        windowTabs.tabs.style.display = b ? "none" : "block";
    }

    const showOriginTitleIfNeed = forceHide => {
        if (forceHide) {
            document.getElementById('title-text').style.display = "none";
            return
        }

        if (config.HIDE_ORIGIN_WINDOW_TITLE) {
            const b = config.HIDE_TAB_WHEN_ONE_WINDOW && windowTabs.list.childElementCount <= 1;
            windowTabs.titleText.style.display = b ? "block" : "none";
        } else {
            windowTabs.titleText.style.display = "block";
        }
    }

    const showTrafficLightsIfNeed = () => {
        if (config.HIDE_TRAFFIC_LIGHTS) {
            document.getElementById("w-traffic-lights").style.display = "none";
        }
    }

    const showTitleBarIfNeed = () => {
        if (!config.HIDE_TITLE_BAR) {
            document.getElementById("top-titlebar").style.display = "block";
        }
    }

    const showTitleBarLeftIfNeed = () => {
        if (config.HIDE_TITLE_BAR_LEFT) {
            document.getElementById("w-titlebar-left").style.display = "none";
        }
    }

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
            border-radius: ${config.TAB_BORDER_RADIUS};
            display: ${config.TAB_DISPLAY};
            margin-right: -1px;
            margin-left: -1px;
            cursor: pointer;
        }
        
        #title-bar-window-tabs .title-bar-window-tab:hover {
            background-color: ${config.TAB_HOVER_BG_COLOR};
        }
        #title-bar-window-tabs .title-bar-window-tab:hover > .tab-close-button {
            display: block;
        }

        #title-bar-window-tabs .title-bar-window-tab.select {
            background-color: ${config.TAB_SELECT_BG_COLOR};
        }
        #title-bar-window-tabs .title-bar-window-tab.over {
            border-color: ${config.TAB_OVER_BORDER_COLOR};
            border-width: ${config.TAB_OVER_BORDER_WIDTH};
            border-style: ${config.TAB_OVER_BORDER_STYLE};
        }
                
        #title-bar-window-tabs .window-tab-name {
            overflow: ${config.TAB_OVERFLOW};
            text-overflow: ${config.TAB_TEXT_OVERFLOW};
            white-space: ${config.TAB_WHITE_SPACE};
            margin-right: auto;
        }
        
        #title-bar-window-tabs .tab-close-button {
            opacity: 0.8;
            display: none;
            transition: opacity 0.3s ease-in-out;
        }
        #title-bar-window-tabs .tab-close-button:hover i {
            color: crimson;
        }
        `
        const style = document.createElement('style');
        style.type = 'text/css';
        style.innerHTML = title_bar_css;
        document.head.appendChild(style);

        // insert html
        const title_bar_div = `<div class="title-bar-window-tabs-list"></div>`;
        const windowTabs = document.createElement("div");
        windowTabs.id = 'title-bar-window-tabs';
        windowTabs.innerHTML = title_bar_div;
        const titleBarLeft = document.getElementById("w-titlebar-left");
        titleBarLeft.parentNode.insertBefore(windowTabs, titleBarLeft.nextSibling);

        showOriginTitleIfNeed(true);
        showTrafficLightsIfNeed();
        showTitleBarLeftIfNeed();
        showTitleBarIfNeed();
    })()

    const metaKeyPressed = ev => File.isMac ? ev.metaKey : ev.ctrlKey

    const windowTabs = {
        tabs: document.getElementById('title-bar-window-tabs'),
        list: document.querySelector(".title-bar-window-tabs-list"),
        titleText: document.getElementById('title-text'),
    }

    const getWindowName = win => {
        let name = win.getTitle().replace("- Typora", "").trim();
        const idx = name.lastIndexOf(".");
        if (idx !== -1) {
            name = name.substring(0, idx);
        }
        return name
    }

    const whichChildOfParent = child => {
        let i = 1;
        for (const sibling of child.parentElement.children) {
            if (sibling && sibling === child) {
                return i
            }
            i++
        }
    }

    const newTab = (winId, title, select) => {
        const selected = select ? "select" : "";
        const closeButton = config.HIDE_CLOSE_BUTTON ? "" : `<div class="tab-close-button"><i class="ion-android-close"></i></div>`;
        return `<div class="title-bar-window-tab ${selected}" ty-hint="${title}" winid="${winId}" draggable="true">
                        <div class="window-tab-name">${title}</div>
                        ${closeButton}
                </div>`
    }

    global._flushWindowTabs = (excludeId, order) => {
        const windows = getAllWindows();
        let copy = [...windows];
        if (excludeId) {
            copy = copy.filter(win => win.id !== excludeId);
        }

        let sortedWindows = [];
        if (!order) {
            sortedWindows = copy.sort((a, b) => a.id - b.id);
        } else {
            const winIdList = order.split(",");
            for (const id of winIdList) {
                for (const win of copy) {
                    if (id === win.id + "") {
                        sortedWindows.push(win);
                    }
                }
            }
        }

        const focusWinId = getFocusedWindow().id;
        const divArr = sortedWindows.map(win => {
            const title = getWindowName(win);
            const select = win.id === focusWinId;
            return newTab(win.id, title, select);
        })
        windowTabs.list.innerHTML = divArr.join("");

        showTabsIfNeed();
        showOriginTitleIfNeed();
    }

    global._addWindowTab = (winId, title, select) => {
        const tab = newTab(winId, title, select);
        windowTabs.list.insertAdjacentHTML('beforeend', tab);
    }

    global._removeWindowTab = winId => {
        const tab = windowTabs.list.querySelector(`.title-bar-window-tab[winid="${winId}"]`);
        if (tab) {
            tab.parentNode.removeChild(tab);
        }
        showTabsIfNeed();
        showOriginTitleIfNeed();
    }

    global._changeTab = () => {
        const focus = getFocusedWindow();
        // 使用系统的alt+Tab切换任务时，可能会没有聚焦的窗口。那怎么办？凉拌。不切了。
        if (!focus) {
            return
        }
        const focusWinId = focus.id + "";
        const tabs = windowTabs.list.querySelectorAll(`.title-bar-window-tab`);
        for (const tab of tabs) {
            const winId = tab.getAttribute("winid");
            if (winId !== focusWinId) {
                tab.classList.remove("select");
            } else {
                tab.classList.add("select");
                const name = getWindowName(focus);
                tab.setAttribute("ty-hint", name);
            }
        }
    }

    global._updateTabTitle = (winId, title) => {
        const tab = windowTabs.list.querySelector(`.title-bar-window-tab[winid="${winId}"] .window-tab-name`);
        if (tab) {
            tab.textContent = title;
        }
        showTabsIfNeed();
    }

    // 注意idx从1开始
    global._moveTab = (fromIdx, toIdx) => {
        const max = fromIdx > toIdx ? fromIdx : toIdx;
        const tabs = windowTabs.list.querySelectorAll(".title-bar-window-tab");
        if (tabs.length >= max) {
            const fromTab = tabs[fromIdx - 1];
            const toTab = tabs[toIdx - 1];
            windowTabs.list.insertBefore(fromTab, toTab);
        }
    }

    global._getWinId = () => global._winid || windowTabs.tabs.getAttribute("winid") || getFocusedWindow().id;

    global._updateWinList = winIdListStr => flushWindowTabs(undefined, winIdListStr);

    global._getWinIdInTabs = newWindId => {
        const result = [];
        const winList = windowTabs.list.querySelectorAll(".title-bar-window-tab");
        for (const win of winList) {
            const winId = win.getAttribute("winid");
            result.push(winId);
        }
        if (newWindId) {
            result.push(newWindId);
        }
        return result
    }

    global._openFileInNewWindow = () => {
        const filePath = Package.File.filePath || (Package.File.bundle && Package.File.bundle.filePath);
        if (filePath) {
            Package.File.editor.library.openFileInNewWindow(filePath, false);
        } else {
            Package.Client.newFile();
        }
    };

    // 其实下面函数都可以使用flushWindowTabs代替,但是flushWindowTabs太重了
    const flushWindowTabs = (excludeId, order) => execForAllWindows(`global._flushWindowTabs(${excludeId}, "${order}")`);
    const updateTabTitle = (winId, title) => execForAllWindows(`global._updateTabTitle(${winId}, "${title}")`);
    const moveTab = (idx1, idx2) => execForAllWindows(`global._moveTab(${idx1}, ${idx2})`);
    const changeTab = () => execForAllWindows(`global._changeTab()`);
    const removeWindowTab = winId => execForAllWindows(`global._removeWindowTab(${winId})`);
    const openFileInNewWindow = winId => execForWindow(winId, "global._openFileInNewWindow()");
    const addWindowTab = (noticeWins, winId, title, select) => {
        for (const win of noticeWins) {
            execForWindow(win.id, `global._addWindowTab(${winId}, "${title}", ${select})`);
        }
    }

    const updateWinIdListFromOtherWindows = (myWinId, otherWinId) => {
        JSBridge.invoke('executeJavaScript', otherWinId,
            `_winIdList=global._getWinIdInTabs(${myWinId}); JSBridge.invoke('executeJavaScript', ${myWinId}, ` + "`global._updateWinList('${_winIdList}')`)");
    }

    const onElectronLoad = func => {
        const timer = setInterval(() => {
            if (Package.getElectron() && Package.getRequire()) {
                clearInterval(timer);
                func();
            }
        }, config.LOOP_CHECK_INTERVAL)
    }

    // 当窗口加载完毕
    onElectronLoad(() => {
        handleWindowTab();
        registerOnFocus();
        registerOrderTab();
    })

    const handleWindowTab = () => {
        const curWin = getFocusedWindow();
        if (curWin) {
            windowTabs.tabs.setAttribute("winid", curWin.id);
            global._winid = curWin.id;
        }

        const windows = getAllWindows();
        if (windows.length === 1) {
            global._flushWindowTabs();
            return
        }

        for (const win of windows) {
            if (win.id !== curWin.id) {
                updateWinIdListFromOtherWindows(curWin.id, win.id);
                return
            }
        }
    }

    // 应用外点击任务栏切换窗口
    const registerOnFocus = () => {
        let lastFocusTime = 0;
        document.addEventListener("focus", ev => {
            if (ev.timeStamp - lastFocusTime > config.FOCUS_CHECK_INTERVAL) {
                changeTab();
                lastFocusTime = ev.timeStamp;
            }
        }, true);
    }

    // 当前窗口切换文件
    new MutationObserver(() => {
        showOriginTitleIfNeed();
        const win = getFocusedWindow();
        if (win) {
            const name = getWindowName(win);
            updateTabTitle(win.id, name);
        }
    }).observe(windowTabs.titleText, {childList: true});

    // 关闭窗口
    window.addEventListener("beforeunload", ev => {
        const focusWinId = global._getWinId();
        removeWindowTab(focusWinId);
    }, true)

    // 点击Tab切换窗口/关闭窗口
    windowTabs.list.addEventListener("click", ev => {
        const closeButton = ev.target.closest(".tab-close-button");
        if (closeButton) {
            closeWindow();
            return
        }

        const target = ev.target.closest(".title-bar-window-tab");
        if (!target) {
            return
        }

        const _winId = target.getAttribute("winid");
        const winId = parseInt(_winId);

        if (metaKeyPressed(ev)) {
            openFileInNewWindow(winId);
        } else {
            setFocusWindow(winId);
            changeTab();
        }
    })

    // 当拖拽排序tab
    const registerOrderTab = () => {
        let lastOver = null;
        const toggleOver = (ev, f) => {
            const target = ev.target.closest(".title-bar-window-tab");
            if (target) {
                if (f === "add") {
                    target.classList.add("over");
                    lastOver = target;
                } else {
                    target.classList.remove("over");
                }
            }
            ev.preventDefault()
        }

        windowTabs.list.addEventListener("dragstart", ev => {
            const draggedTab = ev.target.closest(".title-bar-window-tab")
            if (draggedTab) {
                draggedTab.style.opacity = 0.5;
                lastOver = null;
            }
        })
        windowTabs.list.addEventListener("dragend", ev => {
            const from = ev.target.closest(".title-bar-window-tab")
            const to = lastOver;
            if (from && to) {
                from.style.opacity = "";
                ev.preventDefault();
                const fromIdx = whichChildOfParent(from);
                const toIdx = whichChildOfParent(to);
                moveTab(fromIdx, toIdx);
            }
        });
        windowTabs.list.addEventListener("dragover", ev => toggleOver(ev, "add"))
        windowTabs.list.addEventListener("dragenter", ev => toggleOver(ev, "add"))
        windowTabs.list.addEventListener("dragleave", ev => toggleOver(ev, "remove"))
    }

    if (config.HIDE_WHEN_MENU_OPEN) {
        new MutationObserver((mutationList) => {
            for (const mutation of mutationList) {
                if (mutation.type === 'attributes' && mutation.attributeName === "class") {
                    const value = document.body.getAttribute(mutation.attributeName);
                    const force = value.indexOf("megamenu-opened") !== -1 || value.indexOf("show-preference-panel") !== -1;
                    showTabsIfNeed(force);
                }
            }
        }).observe(document.body, {attributes: true});
    }

    if (config.DEBUG) {
        global.test = () => getAllWindows().forEach(win => {
            console.log({"id": win.id, "name": win.getTitle()});
        })
        global.getFocusedWindow = getFocusedWindow;
        global.execForWindow = execForWindow;
        global.execFromOtherWindow = updateWinIdListFromOtherWindows;
        global.execForAllWindows = execForAllWindows;
        global.getDocument = getDocument;
    }

    console.log("window_tab_drag.js had been injected");
})();
