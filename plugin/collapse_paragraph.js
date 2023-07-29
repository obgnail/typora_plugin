(() => {
    const config = {
        // 折叠状态下的颜色
        BACKGROUND_COLOR: "#ffafa3",
    };

    (() => {
        const css = `
            #write .collapsed-paragraph {
                background-color: ${config.BACKGROUND_COLOR};
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

    const trigger = (paragraph, collapsed) => {
        if (collapsed) {
            paragraph.classList.remove("collapsed-paragraph");
            toggle(paragraph, "");
        } else {
            paragraph.classList.add("collapsed-paragraph");
            toggle(paragraph, "none");
        }
    }

    const findSiblings = paragraph => {
        const idx = paragraphList.indexOf(paragraph.tagName);
        const stop = paragraphList.slice(0, idx);

        const result = [paragraph];
        ["previousElementSibling", "nextElementSibling"].forEach(direction => {
            for (let ele = paragraph[direction]; !!ele; ele = ele[direction]) {
                if (stop.indexOf(ele.tagName) !== -1) {
                    return
                }
                if (ele.tagName === paragraph.tagName) {
                    result.push(ele);
                }
            }
        })
        return result;
    }

    const metaKeyPressed = ev => File.isMac ? ev.metaKey : ev.ctrlKey;

    document.getElementById("write").addEventListener("click", ev => {
        if (!metaKeyPressed(ev)) return;
        const paragraph = ev.target.closest("h1, h2, h3, h4, h5, h6");
        if (!paragraph) return;

        document.activeElement.blur();
        const collapsed = paragraph.classList.contains("collapsed-paragraph");
        const list = ev.altKey ? (ev.shiftKey ? document.querySelectorAll(`#write ${paragraph.tagName}`) : findSiblings(paragraph)) : [paragraph];
        list.forEach(ele => trigger(ele, collapsed));
    })

    module.exports = {config};

    console.log("collapse_paragraph.js had been injected");
})()