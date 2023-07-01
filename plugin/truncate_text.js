(() => {
    const config = {
        // 使用启用只读模式脚本,若为false,以下配置全部失效
        ENABLE: true,
        // 快捷键
        HOTKEY: ev => metaKeyPressed(ev) && ev.shiftKey && ev.key === "B",
        HOTKEY_SHOWALL: ev => metaKeyPressed(ev) && ev.shiftKey && ev.key === "U",
        HOTKEY_ATVIEW: ev => metaKeyPressed(ev) && ev.shiftKey && ev.key === "Y",

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

    window.addEventListener("keydown", ev => {
        if (config.HOTKEY_SHOWALL(ev)) {
            ev.preventDefault();
            ev.stopPropagation();

            document.getElementById("write").children.forEach(element => {
                element.style = "";
            });

        }
    }, true)

    window.addEventListener("keydown", ev => {
        if (config.HOTKEY_ATVIEW(ev)) {
            ev.preventDefault();
            ev.stopPropagation();
            let viewel = []
            const write = document.getElementById("write");
            write.children.forEach((element, index) => {
                if (isinviewbox(element)) { viewel.push(index) }
            });
            viewel = [viewel[0] - config.TRUNCATE_LENGTH / 2 > 0 ? viewel[0] - config.TRUNCATE_LENGTH / 2 : 0, viewel.at(-1) + config.TRUNCATE_LENGTH / 2 < write.children.length ? viewel.at(-1) + config.TRUNCATE_LENGTH / 2 : write.children.length]
            write.children.forEach((element, index) => {
                if (index < viewel[0] || index > viewel[1]) {
                    element.style.display = "none";
                } else {
                    element.style = "";
                }
            });


        }
    }, true)

    if (config.DEBUG) {
        JSBridge.invoke("window.toggleDevTools");
    }

    console.log("truncate_text.js had been injected");
})()

function isinviewbox(el) {
    const totalHeight = window.innerHeight || document.documentElement.clientHeight;
    const totalWidth = window.innerWidth || document.documentElement.clientWidth;
    const { top, right, bottom, left } = el.getBoundingClientRect();
    if (el.style.display) { return false } else { return (top >= 0 && left >= 0 && right <= totalWidth && bottom <= totalHeight); }
}

