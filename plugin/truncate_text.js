(() => {
    const config = {
        // 使用启用只读模式脚本,若为false,以下配置全部失效
        ENABLE: true,
        // 快捷键
        HOTKEY: ev => metaKeyPressed(ev) && ev.shiftKey && ev.key === "B",
        // 剩余文本段
        TRUNCATE_LENGTH: 80,

        DEBUG: false,
    }

    if (!config.ENABLE) {
        return
    }

    const metaKeyPressed = ev => File.isMac ? ev.metaKey : ev.ctrlKey;

    window.addEventListener("keydown", ev => {
        if (config.HOTKEY(ev)) {
            ev.preventDefault();
            ev.stopPropagation();

            const write = document.getElementById("write");
            const length = write.children.length;
            if (length > config.TRUNCATE_LENGTH) {
                for (let i = 0; i <= length - config.TRUNCATE_LENGTH; i++) {
                    write.children[i].style.display = "none";
                }
            }
        }
    }, true)

    if (config.DEBUG) {
        JSBridge.invoke("window.toggleDevTools");
    }

    console.log("truncate_text.js had been injected");
})()