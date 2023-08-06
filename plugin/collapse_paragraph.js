(() => {
    const config = {
        // 添加的class
        CLASS_NAME: "plugin-collapsed-paragraph",
    };

    (() => {
        const css = `
            #write .${config.CLASS_NAME}::after {
                display: initial;
                content: "{\\2026}" !important;
                margin: 0 0.6rem;
                padding: 0 1px;
                color: white;
                opacity: 0.6;
                background-color: gray;
            }
            `;
        const style = document.createElement('style');
        style.id = "plugin-collapse-paragraph-style";
        style.type = 'text/css';
        style.innerHTML = css;
        document.getElementsByTagName("head")[0].appendChild(style);
    })()

    const callbackOtherPlugin = () => {
        const outlinePlugin = global._getPlugin("outline");
        outlinePlugin && outlinePlugin.meta.refresh();
    }

    const paragraphList = ["H1", "H2", "H3", "H4", "H5", "H6"];

    const toggle = (paragraph, display) => {
        const idx = paragraphList.indexOf(paragraph.tagName);
        const stop = paragraphList.slice(0, idx + 1);

        let ele = paragraph.nextElementSibling;
        while (ele && stop.indexOf(ele.tagName) === -1) {
            if (paragraphList.indexOf(ele.tagName) !== -1
                && ele.classList.contains(config.CLASS_NAME)
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
            paragraph.classList.remove(config.CLASS_NAME);
            toggle(paragraph, "");
        } else {
            paragraph.classList.add(config.CLASS_NAME);
            toggle(paragraph, "none");
        }
    }

    const rollback = start => {
        if (!document.querySelector(`#write > .${config.CLASS_NAME}`)) return;

        let ele = start.closest("#write > [cid]");

        const pList = [];
        while (ele) {
            const idx = paragraphList.indexOf(ele.tagName);
            if (idx !== -1) {
                if (pList.length === 0 || (pList[pList.length - 1].idx > idx && ele.classList.contains(config.CLASS_NAME))) {
                    pList.push({ele, idx})
                    if (pList[pList.length - 1].idx === 0) break;
                }
            }
            ele = ele.previousElementSibling;
        }

        if (pList.length > 0) {
            for (let i = pList.length - 1; i >= 0; i--) {
                trigger(pList[i].ele, true);
            }
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

    const findAllSiblings = paragraph => document.querySelectorAll(`#write ${paragraph.tagName}`);

    const metaKeyPressed = ev => File.isMac ? ev.metaKey : ev.ctrlKey;

    document.getElementById("write").addEventListener("click", ev => {
        if (!metaKeyPressed(ev)) return;
        const paragraph = ev.target.closest("h1, h2, h3, h4, h5, h6");
        if (!paragraph) return;

        document.activeElement.blur();
        const collapsed = paragraph.classList.contains(config.CLASS_NAME);
        const list = ev.altKey ? (ev.shiftKey ? findAllSiblings(paragraph) : findSiblings(paragraph)) : [paragraph];
        list.forEach(ele => trigger(ele, collapsed));
        callbackOtherPlugin();
    })

    //////////////////////// 以下是声明式插件系统代码 ////////////////////////
    const dynamicUtil = {target: null}
    const dynamicCallArgsGenerator = anchorNode => {
        const target = anchorNode.closest("#write h1,h2,h3,h4,h5,h6");
        if (!target) return;

        dynamicUtil.target = target;

        return [
            {
                arg_name: "折叠/展开当前章节",
                arg_value: "call_current",
            },
            {
                arg_name: "折叠/展开全部兄弟章节",
                arg_value: "call_siblings",
            },
            {
                arg_name: "折叠/展开全局同级章节",
                arg_value: "call_all_siblings",
            }
        ]
    }

    const callArgs = [
        {
            arg_name: "折叠全部章节",
            arg_value: "collapse_all"
        },
        {
            arg_name: "展开全部章节",
            arg_value: "expand_all"
        },
    ];

    const dynamicCall = type => {
        if (!dynamicUtil.target) return;

        const collapsed = dynamicUtil.target.classList.contains(config.CLASS_NAME);

        let list;
        if (type === "call_current") {
            list = [dynamicUtil.target];
        } else if (type === "call_siblings") {
            list = findSiblings(dynamicUtil.target);
        } else if (type === "call_all_siblings") {
            list = findAllSiblings(dynamicUtil.target);
        }

        if (list) {
            list.forEach(ele => trigger(ele, collapsed));
        }
    }

    const call = type => {
        if (type === "collapse_all") {
            for (let i = paragraphList.length - 1; i >= 0; i--) {
                document.getElementsByTagName(paragraphList[i]).forEach(ele => trigger(ele, false));
            }
        } else if (type === "expand_all") {
            paragraphList.forEach(tag => document.getElementsByTagName(tag).forEach(ele => trigger(ele, true)));
        } else {
            dynamicCall(type);
        }
        callbackOtherPlugin();
    }

    module.exports = {
        config,
        call,
        callArgs,
        dynamicCallArgsGenerator,
        meta: {
            trigger,
            rollback,
        }
    };

    console.log("collapse_paragraph.js had been injected");
})()