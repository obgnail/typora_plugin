(() => {
    const config = {
        // 启用脚本,若为false,以下配置全部失效
        ENABLE: true,

        DEBUG: false
    }

    if (!config.ENABLE) {
        return
    }

    (() => {
        const css = `
            #write .collapsed-paragraph {
                background-color: #ffafa3;
                cursor: pointer;
            }`;
        const style = document.createElement('style');
        style.type = 'text/css';
        style.innerHTML = css;
        document.getElementsByTagName("head")[0].appendChild(style);
    })()

    const paragraphList = ["H1", "H2", "H3", "H4", "H5", "H6"];

    const toggle = (paragraph, display) => {
        const idx = paragraphList.indexOf(paragraph.tagName);
        const stop = paragraphList.slice(0, idx + 1);

        let ele = paragraph.nextElementSibling;
        while (ele && stop.indexOf(ele.tagName) === -1) {
            if (paragraphList.indexOf(ele.tagName) !== -1
                && ele.classList.contains("collapsed-paragraph")
                && display === "") {
                ele.style.display = "";
                ele = toggle(ele, "none");
                continue
            }

            ele.style.display = display;
            ele = ele.nextElementSibling;
        }

        return ele;
    }

    const metaKeyPressed = ev => File.isMac ? ev.metaKey : ev.ctrlKey;

    document.getElementById("write").addEventListener("click", ev => {
        if (!metaKeyPressed(ev)) {
            return
        }
        const paragraph = ev.target.closest("h1, h2, h3, h4, h5, h6");
        if (!paragraph) {
            return
        }

        document.activeElement.blur();
        if (paragraph.classList.contains("collapsed-paragraph")) {
            paragraph.classList.remove("collapsed-paragraph");
            toggle(paragraph, "");
        } else {
            paragraph.classList.add("collapsed-paragraph");
            toggle(paragraph, "none");
        }
    })

    if (config.DEBUG) {
        JSBridge.invoke("window.toggleDevTools");
    }
    console.log("collapse_paragraph.js had been injected");
})()