class collapseParagraphPlugin extends global._basePlugin {
    style = () => {
        return `
            #write .${this.config.CLASS_NAME}::after {
                display: initial;
                content: "{\\2026}" !important;
                margin: 0 0.6rem;
                padding: 0 1px;
                color: white;
                opacity: 0.6;
                background-color: gray;
            }`;
    }

    init = () => {
        this.paragraphList = ["H1", "H2", "H3", "H4", "H5", "H6"];
        this.dynamicUtil = {target: null}
    }

    process = () => {
        this.init();

        if (this.config.RECORD_COLLAPSE) {
            new collapseRecorder(this).process();
        }

        document.getElementById("write").addEventListener("click", ev => {
            if (!this.utils.metaKeyPressed(ev)) return;
            const paragraph = ev.target.closest("h1, h2, h3, h4, h5, h6");
            if (!paragraph) return;

            document.activeElement.blur();
            const collapsed = paragraph.classList.contains(this.config.CLASS_NAME);
            const list = ev.altKey ? (ev.shiftKey ? this.findAllSiblings(paragraph) : this.findSiblings(paragraph)) : [paragraph];
            list.forEach(ele => this.trigger(ele, collapsed));
            this.callbackOtherPlugin();
        })
    }

    callbackOtherPlugin = () => {
        const outlinePlugin = this.utils.getPlugin("outline");
        outlinePlugin && outlinePlugin.refresh();
    }

    toggle = (paragraph, display) => {
        const idx = this.paragraphList.indexOf(paragraph.tagName);
        const stop = this.paragraphList.slice(0, idx + 1);

        let ele = paragraph.nextElementSibling;
        while (ele && stop.indexOf(ele.tagName) === -1) {
            if (this.paragraphList.indexOf(ele.tagName) !== -1
                && ele.classList.contains(this.config.CLASS_NAME)
                && display === "") {
                ele.style.display = "";
                ele = this.toggle(ele, "none");
                continue
            }

            ele.style.display = display;
            ele = ele.nextElementSibling;
        }

        return ele;
    }
    trigger = (paragraph, collapsed) => {
        if (collapsed) {
            paragraph.classList.remove(this.config.CLASS_NAME);
            this.toggle(paragraph, "");
        } else {
            paragraph.classList.add(this.config.CLASS_NAME);
            this.toggle(paragraph, "none");
        }
    }

    rollback = start => {
        if (!document.querySelector(`#write > .${this.config.CLASS_NAME}`)) return;

        let ele = start.closest("#write > [cid]");

        const pList = [];
        while (ele) {
            const idx = this.paragraphList.indexOf(ele.tagName);
            if (idx !== -1) {
                if (pList.length === 0 || (pList[pList.length - 1].idx > idx && ele.classList.contains(this.config.CLASS_NAME))) {
                    pList.push({ele, idx})
                    if (pList[pList.length - 1].idx === 0) break;
                }
            }
            ele = ele.previousElementSibling;
        }

        if (pList.length > 0) {
            for (let i = pList.length - 1; i >= 0; i--) {
                this.trigger(pList[i].ele, true);
            }
        }
    }

    findSiblings = paragraph => {
        const idx = this.paragraphList.indexOf(paragraph.tagName);
        const stop = this.paragraphList.slice(0, idx);

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

    findAllSiblings = paragraph => document.querySelectorAll(`#write ${paragraph.tagName}`);

    dynamicCallArgsGenerator = anchorNode => {
        const target = anchorNode.closest("#write h1,h2,h3,h4,h5,h6");
        this.dynamicUtil.target = target;

        return [
            {
                arg_name: "折叠/展开当前章节",
                arg_value: "call_current",
                arg_disabled: !target,
            },
            {
                arg_name: "折叠/展开全部兄弟章节",
                arg_value: "call_siblings",
                arg_disabled: !target,
            },
            {
                arg_name: "折叠/展开全局同级章节",
                arg_value: "call_all_siblings",
                arg_disabled: !target,
            }
        ]
    }

    callArgs = [
        {
            arg_name: "折叠全部章节",
            arg_value: "collapse_all"
        },
        {
            arg_name: "展开全部章节",
            arg_value: "expand_all"
        },
    ];

    dynamicCall = type => {
        if (!this.dynamicUtil.target) return;

        const collapsed = this.dynamicUtil.target.classList.contains(this.config.CLASS_NAME);

        let list;
        if (type === "call_current") {
            list = [this.dynamicUtil.target];
        } else if (type === "call_siblings") {
            list = this.findSiblings(this.dynamicUtil.target);
        } else if (type === "call_all_siblings") {
            list = this.findAllSiblings(this.dynamicUtil.target);
        }

        if (list) {
            list.forEach(ele => this.trigger(ele, collapsed));
        }
    }

    call = type => {
        if (type === "collapse_all") {
            for (let i = this.paragraphList.length - 1; i >= 0; i--) {
                document.getElementsByTagName(this.paragraphList[i]).forEach(ele => this.trigger(ele, false));
            }
        } else if (type === "expand_all") {
            this.paragraphList.forEach(tag => document.getElementsByTagName(tag).forEach(ele => this.trigger(ele, true)));
        } else {
            this.dynamicCall(type);
        }
        this.callbackOtherPlugin();
    }
}


class collapseRecorder {
    constructor(controller) {
        this.controller = controller;
        this.utils = this.controller.utils;
        this.config = this.controller.config;

        this.records = {}
    }

    range = rangeFunc => {
        let element = document.querySelector("#write").lastElementChild;
        let idx = 0;
        while (element) {
            rangeFunc(element, idx);
            element = element.previousElementSibling;
            idx++;
        }
    }

    collect = () => {
        const filepath = this.utils.getFilePath();
        this.records[filepath] = [];
        this.range((ele, idx) => {
            if (ele.classList.contains(this.config.CLASS_NAME)) {
                this.records[filepath].push(idx);
            }
        })
    }

    collapseHeading = filepath => {
        const collapseIdxList = this.records[filepath];
        if (!collapseIdxList || !collapseIdxList.length) return

        let targetIdx = 0
        this.range((ele, idx) => {
            if (idx === collapseIdxList[targetIdx] && targetIdx !== collapseIdxList.length) {
                this.controller.trigger(ele, false);
                targetIdx++;
            }
        })
    }

    process = () => {
        this.utils.addEventListener(this.utils.eventType.beforeFileOpen, this.collect);
        this.utils.addEventListener(this.utils.eventType.fileContentLoaded, this.collapseHeading);
    }
}

module.exports = {
    plugin: collapseParagraphPlugin
};

