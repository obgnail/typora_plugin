(() => {
    // 打开新窗口后自动关闭
    global._pluginUtils.decorate(
        () => !!File,
        File.editor.library,
        "openFileInNewWindow",
        null,
        () => (!global._DO_NOT_CLOSE) && setTimeout(() => ClientCommand.close(), 3000)
    )
    JSBridge.invoke("window.toggleDevTools");
    console.log("test.js had been injected");
})()