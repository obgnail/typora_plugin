(() => {
    const config = {
        ENABLE: true,
        HOTKEY: ev => metaKeyPressed(ev) && ev.shiftKey && ev.key === "B",
        TRUNCATE_LENGTH: 30,

        DEBUG: false,
        ONCE: true,
    }

    if (!config.ENABLE) {
        return
    }

    const metaKeyPressed = ev => File.isMac ? ev.metaKey : ev.ctrlKey;

    window.addEventListener("keydown", ev => {
        if (config.ONCE && config.HOTKEY(ev)) {
            ev.preventDefault();
            ev.stopPropagation();

            config.ONCE = false;
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