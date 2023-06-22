(() => {
    const config = {
        requireVarName: "__MY_REQUIRE__",
        electronVarName: "__MY_ELECTRON__"
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

    const execForWindow = (winId, js) => JSBridge.invoke("executeJavaScript", winId, js)
    const execForAllWindows = js => Package.Client.execForAll(js)
    const getFocusedWindow = () => {
    }

    setTimeout(() => {
        let js = `
            if (!global["${config.electronVarName}"]) {
                ${config.requireVarName} = global.reqnode('electron').remote.require;
                ${config.electronVarName} = ${config.requireVarName}('electron');
                console.log("had hijacked electron instance:", ${config.electronVarName})
            }
            `
        execForAllWindows(js)
    })


    global.test = () => Package.getElectron().BrowserWindow.getAllWindows().forEach(win => {
        console.log({"id": win.id, "name": win.getTitle()})
    })

    console.log("window_tab.js had been injected");
})();
