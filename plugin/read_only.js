(() => {
    const config = {
        // 使用启用只读模式脚本,若为false,以下配置全部失效
        ENABLE: true,
        // 进入和脱离只读模式的快捷键
        HOTKEY: ev => metaKeyPressed(ev) && ev.shiftKey && ev.key === "R",
        // 是否默认使用只读模式
        READ_ONLY_DEFAULT: false,

        // 脚本内部使用
        DEBUG: false,
        READ_ONLY: false,
        FIRST_ENTER_READ_ONLY: true,
    };

    if (!config.ENABLE) {
        return
    }

    const showNotification = () => {
        if (!config.FIRST_ENTER_READ_ONLY) {
            return
        }

        const notification = document.getElementById("md-notification");
        let div = `
            <p class="ty-enter-mode-warning-header"><strong>Read Only Mode</strong> 已开启。</p>
            <p data-lg="Front" style="opacity: 0.7;font-size: 0.8rem;margin-top: -4px;">键入快捷键 Ctrl+Shift+R 关闭</p>
            <p style="float: right;position: absolute;right: 32px;bottom: -2px;padding:0;background: inherit;">
                <button id="ty-surpress-mode-warning-close-btn" class="btn btn-default btn-sm ty-read-only-close-btn" style="float:right;margin-right: -18px;margin-top:1px;" data-localize="Dismiss" data-lg="Front">关闭</button>
            </p>
        `
        notification.insertAdjacentHTML('beforeend', div);
        document.querySelector(".ty-read-only-close-btn").addEventListener("click", ev => notification.style.display = "none");
        if (notification.style.display !== "block") {
            notification.style.display = "block";
        }
        config.FIRST_ENTER_READ_ONLY = false;
    }

    if (config.READ_ONLY_DEFAULT) {
        config.READ_ONLY = true;
        showNotification();
    }

    const metaKeyPressed = ev => File.isMac ? ev.metaKey : ev.ctrlKey;

    const write = document.getElementById("write");
    const setEdit = contenteditable => {
        let eleList = write.querySelectorAll(`[contenteditable="${!contenteditable}"]`);
        for (const ele of eleList) {
            ele.setAttribute("contenteditable", `${contenteditable}`);
        }
    }

    const observer = new MutationObserver(() => setEdit(false));
    const setContentEditable = () => {
        if (config.READ_ONLY) {
            observer.observe(write, {childList: true, characterData: true, subtree: true});
        } else {
            observer.disconnect();
            setEdit(true);
        }
    }

    window.addEventListener("keydown", ev => {
        if (config.HOTKEY(ev)) {
            ev.preventDefault();
            ev.stopPropagation();
            document.activeElement.blur();

            config.READ_ONLY = !config.READ_ONLY;
            setContentEditable();
            showNotification();
        }
    }, true)

    if (config.DEBUG) {
        JSBridge.invoke("window.toggleDevTools");
    }

    console.log("read_only.js had been injected");
})()