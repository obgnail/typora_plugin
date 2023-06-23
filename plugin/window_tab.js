(() => {
    const config = {
        requireVarName: "__PLUGIN_REQUIRE__",
        electronVarName: "__PLUGIN_ELECTRON__"
    }

    const Package = {
        // Typora常用的第一方内置库
        File: File,
        Client: ClientCommand,

        // node标准库
        Path: reqnode('path'),
        Fs: reqnode('fs'),

        // 劫持过来的electron核心库
        getElectron: () => global[config.electronVarName],
        getRequire: () => global[config.requireVarName],
    }

    const execForWindow = (winId, js) => JSBridge.invoke("executeJavaScript", winId, js);
    const execForAllWindows = js => Package.Client.execForAll(js);

    const getAPP = () => Package.getElectron().app;
    const getBrowserWindow = () => Package.getElectron().BrowserWindow
    const getIPC = () => Package.getElectron().ipcMain;

    const getAllWindows = () => getBrowserWindow().getAllWindows();
    const getFocusedWindowId = () => getAPP().getCurrentFocusWindowId();
    const getFocusWindow = () => getAllWindows()[getFocusedWindowId()]
    const setFocusWindow = (winId) => getAllWindows()[winId].focus();

    const getDocumentController = () => getAPP().getDocumentController();
    const getDocument = id => getDocumentController().getDocumentFromWindowId(id);

    setTimeout(() => {
        execForAllWindows(`
            if (!global["${config.electronVarName}"]) {
                global.${config.requireVarName} = global.reqnode('electron').remote.require;
                global.${config.electronVarName} = ${config.requireVarName}('electron');
                console.log("had hijacked require function:", ${config.requireVarName})
                console.log("had hijacked electron instance:", ${config.electronVarName})
            }`
        )
    });

    (() => {
        const title_bar_css = `
        #title-bar-window-tabs {
            position: absolute;
            left: 100px;
            -webkit-app-region: no-drag;
            width: 75%;
            height: 24px;
            margin-left: 10px;
            margin-right: 10px;
            z-index: 9999;
        }
        
        #title-bar-window-tabs .title-bar-window-tabs-list {
            display: flex;
            flex-direction: row;
            flex-wrap: nowrap;
            justify-content: center;
            align-items: center;
            align-items:stretch;
            height: 24px;
        }
        
        #title-bar-window-tabs .title-bar-window-tab {
            flex-grow: 1;
            max-width: 200px;
            text-align: center;
            border-style: dashed;
            border-width: 1px;
            border-color: var(--mid-7);
            margin-right: -1px;
            cursor: pointer;
        }
        
        #title-bar-window-tabs .title-bar-window-tab.select {
            background-color: #ffafa3;
        }
        
        #title-bar-window-tabs .title-bar-window-tab:hover {
            background-color: #ffd4cc;
        }
        
        #title-bar-window-tabs .title-bar-window-tab span {
            overflow: hidden;
            text-overflow: ellipsis;
        }
        `
        const style = document.createElement('style');
        style.type = 'text/css';
        style.innerHTML = title_bar_css;
        document.getElementsByTagName("head")[0].appendChild(style);

        const title_bar_div = `<div class="title-bar-window-tabs-list"></div>`
        const windowTabs = document.createElement("div");
        windowTabs.id = 'title-bar-window-tabs';
        windowTabs.innerHTML = title_bar_div;
        const titleBarLeft = document.getElementById("w-titlebar-left");
        titleBarLeft.parentNode.insertBefore(windowTabs, titleBarLeft.nextSibling);
    })()

    const windowTab = {
        list: document.querySelector(".title-bar-window-tabs-list"),
    }

    global.whenOtherWindowClose = (closeId) => {
        windowTab.list.innerHTML = "";

        const windows = Package.getElectron().BrowserWindow.getAllWindows();
        windows.forEach(win => {
            if (win.id === closeId) {
                return
            }
            const name = win.getTitle().replace("- Typora", "").trim();
            const item = `<div class="title-bar-window-tab" winId="${win.id}"><span>${name}</span></div>`
            windowTab.list.insertAdjacentHTML('beforeend', item);
        })
    }

    let loopDetect = (check, after) => {
        const checkInterval = 30;
        let timer = setInterval(() => {
            if (check()) {
                clearInterval(timer);
                after()
            }
        }, checkInterval)
    }

    let onElectronLoad = func => {
        loopDetect(
            () => Package.getElectron() && Package.getRequire(),
            () => func(Package.getRequire(), Package.getElectron())
        )
    }

    onElectronLoad((require, electron) => {
        //
        const windows = electron.BrowserWindow.getAllWindows();
        windows.forEach(win => {
            const name = win.getTitle().replace("- Typora", "").trim();
            const item = `<div class="title-bar-window-tab" winId="${win.id}"><span>${name}</span></div>`
            windowTab.list.insertAdjacentHTML('beforeend', item);
        })

        // deco File.FileInfoPanel.setFileTitle
        loopDetect(
            () => File.FileInfoPanel && File.FileInfoPanel.setFileTitle,
            () => global.File.FileInfoPanel.setFileTitle = (path, encoding, mountFolder) => {
                return File.FileInfoPanel.setFileTitle
                // const result = File.FileInfoPanel.setFileTitle(path, encoding, mountFolder);
                //
                // const focusWinId = electron.app.getCurrentFocusWindowId();
                // const tabs = windowTab.list.querySelectorAll(`.title-bar-window-tab`);
                // for (const tab of tabs) {
                //     const winId = tab.getAttribute("winId");
                //     if (winId !== focusWinId) {
                //         tab.classList.remove("select");
                //     } else {
                //         tab.classList.add("select");
                //     }
                // }
                // return result
            }
        )

        // register
        let noticeDone = false;
        loopDetect(
            () => window.onbeforeunload,
            () => window.onbeforeunload = ev => {
                if (!noticeDone) {
                    const windows = electron.BrowserWindow.getAllWindows();
                    const focusWinId = electron.app.getCurrentFocusWindowId();
                    windows.forEach(win => {
                        if (win.id !== focusWinId) {
                            global.execForWindow(win.id, `global.whenOtherWindowClose(${focusWinId})`)
                        }
                    })
                    noticeDone = true;
                }
                window.onbeforeunload(ev)
            }
        )
    })

    global.test = () => getAllWindows().forEach(win => {
        console.log({"id": win.id, "name": win.getTitle()})
    })

    global.getFocusedWindow = getFocusedWindowId
    global.execForWindow = execForWindow
    global.execForAllWindows = execForAllWindows

    console.log("window_tab.js had been injected");
})();
