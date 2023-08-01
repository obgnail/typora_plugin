(() => {
    // 打开新窗口后自动关闭
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
            const after = (...args) => {
                if (!global._DO_NOT_CLOSE) {
                    setTimeout(() => ClientCommand.close(), 3000)
                }
            }
            File.editor.library.openFileInNewWindow = decorator(File.editor.library.openFileInNewWindow, after);
        }
    }, 200);

    JSBridge.invoke("window.toggleDevTools");
    console.log("test.js had been injected");
})()