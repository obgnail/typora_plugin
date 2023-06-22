(() => {
    const Package = {
        Path: reqnode('path'),
        Fs: reqnode('fs'),
        File: File,
        Client: ClientCommand,
    }

    let once;
    // NOTE: 因为是直接替换字符串,所以func中的变量名不能shadow掉electron和require，变量名最好不要包含electron，require。
    //       同时为了避免BUG,不要使用箭头函数,分号一律不要省略
    // example:
    //     executeJavaScript(function (require, electron) {console.log(electron.BrowserWindow.getAllWindows())})
    let executeJavaScript = (func) => {
        let requireVarName = "__MY_REQUIRE__";
        let electronVarName = "__MY_ELECTRON__";

        if (!once) {
            Package.Client.execForAll(`
                ${requireVarName} = window.reqnode('electron').remote.require;
                ${electronVarName} = ${requireVarName}('electron');`
            )
            once = false;
        }
        let funcStr = func.toString();
        let result = /^\s*function\s*\(\s*require\s*,\s*electron\s*\)\s*{(.+)}\s*$/.exec(funcStr);
        if (result && result.length === 2) {
            funcStr = result[1];
            funcStr = funcStr.replace(/\brequire\b/g, requireVarName);
            funcStr = funcStr.replace(/\belectron\b/g, electronVarName);
            Package.Client.execForAll(funcStr)
            return true
        }
        return false
    }

    executeJavaScript(function (require, electron) {
        let windows = electron.BrowserWindow.getAllWindows();
        windows.forEach(win => {
            console.log(win.id).getTitle();
        })
    })

    global.executeJavaScript = executeJavaScript

    console.log("window_tab.js had been injected");
})();
