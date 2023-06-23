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
    })

    let loopDetect = (check, after) => {
        let checkInterval = 20;
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

    global.whenOtherWindowClose = (lastCloseId) => {
        let windows = Package.getElectron().BrowserWindow.getAllWindows();
        windows.forEach(win => {
            if (win.id !== lastCloseId) {
                console.log({"id": win.id, "name": win.getTitle()})
            }
        })
    }

    onElectronLoad((require, electron) => {
        let noticeDone = false;
        loopDetect(
            () => window.onbeforeunload,
            () => window.onbeforeunload = ev => {
                if (!noticeDone) {
                    let windows = electron.BrowserWindow.getAllWindows();
                    let focusWinId = electron.app.getCurrentFocusWindowId();
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
