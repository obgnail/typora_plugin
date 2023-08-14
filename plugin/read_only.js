(() => {
    const config = global._pluginUtils.getPluginSetting("read_only");

    (() => {
        const css = `#footer-word-count-label::before {content: attr(data-value) !important}`;
        global._pluginUtils.insertStyle("plugin-read-only-style", css);
    })()

    const isExclude = ev => {
        for (const func of config.EXCLUDE_HOTKEY) {
            if (func(ev)) {
                return true
            }
        }
        return false
    }

    const stopMouse = ev => {
        if (!File.isLocked) return;

        const target = ev.target.closest('.footnotes, figure[mdtype="table"], .md-task-list-item, .md-image, .ty-cm-lang-input, input[type="checkbox"]');
        // const target = ev.target.closest('.md-image');
        if (target) {
            ev.preventDefault();
            ev.stopPropagation();
        }
    }

    let lastClickTime = 0;
    const stopKeyboard = ev => {
        if (!File.isLocked) return;

        if (ev.timeStamp - lastClickTime > config.CLICK_CHECK_INTERVAL) {
            File.lock();
        }

        // File.isLocked 也挡不住回车键 :(
        // 为什么要使用isExclude排除按键？因为输入法激活状态下键入能突破 File.isLocked
        if ((ev.key === "Enter") || !isExclude(ev)) {
            document.activeElement.blur();
            ev.preventDefault();
            ev.stopPropagation();
        }
    }

    const write = document.getElementById("write");
    window.addEventListener("keydown", ev => config.HOTKEY(ev) && call(), true);
    write.addEventListener("keydown", stopKeyboard, true);
    write.addEventListener("mousedown", stopMouse, true);
    write.addEventListener("click", stopMouse, true);


    const call = () => {
        const span = document.getElementById("footer-word-count-label");
        if (File.isLocked) {
            File.unlock();
            span.setAttribute("data-value", "");
        } else {
            File.lock();
            document.activeElement.blur();
            span.setAttribute("data-value", "ReadOnly" + String.fromCharCode(160).repeat(3));
        }
    }

    global._pluginUtils.decorate(
        () => !!File,
        File,
        "freshLock",
        null,
        () => {
            if (!File.isLocked) return;
            [
                "#typora-search-multi-input input",
                "#typora-commander-form input",
                "#plugin-multi-highlighter-input input",
                "#typora-quick-open-input input",
            ].forEach(selector => {
                const input = document.querySelector(selector);
                input && input.removeAttribute("readonly");
            })
        }
    )

    if (config.READ_ONLY_DEFAULT) {
        global._pluginUtils.loopDetector(() => !!File, call);
    }

    module.exports = {
        call,
    };

    console.log("read_only.js had been injected");
})()