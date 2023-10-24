class collapseParagraphPlugin extends global._basePlugin {
    styleTemplate = () => true

    init = () => {
        this.className = "plugin-collapsed-paragraph";
        this.paragraphList = ["H1", "H2", "H3", "H4", "H5", "H6"];
        this.callArgs = [
            {arg_name: "折叠全部章节", arg_value: "collapse_all"},
            {arg_name: "展开全部章节", arg_value: "expand_all"},
        ];
    }

    process = () => {
        this.init();

        this.recordCollapseState(false);

        document.getElementById("write").addEventListener("click", ev => {
            if (!this.utils.metaKeyPressed(ev)) return;
            const paragraph = ev.target.closest("h1, h2, h3, h4, h5, h6");
            if (!paragraph) return;

            document.activeElement.blur();
            const collapsed = paragraph.classList.contains(this.className);
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
                && ele.classList.contains(this.className)
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
            paragraph.classList.remove(this.className);
            this.toggle(paragraph, "");
        } else {
            paragraph.classList.add(this.className);
            this.toggle(paragraph, "none");
        }
    }

    rollback = start => {
        if (!document.querySelector(`#write > .${this.className}`)) return;

        let ele = start.closest("#write > [cid]");

        const pList = [];
        while (ele) {
            const idx = this.paragraphList.indexOf(ele.tagName);
            if (idx !== -1) {
                if (pList.length === 0 || (pList[pList.length - 1].idx > idx && ele.classList.contains(this.className))) {
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

    recordCollapseState = (needChange = true) => {
        if (needChange) {
            this.config.RECORD_COLLAPSE = !this.config.RECORD_COLLAPSE;
        }
        const name = "recordCollapseParagraph";
        if (this.config.RECORD_COLLAPSE) {
            this.utils.registerStateRecorder(name, "#write h1,h2,h3,h4,h5,h6",
                ele => ele.classList.contains(this.className), ele => this.trigger(ele, false));
        } else {
            this.utils.unregisterStateRecorder(name);
        }
    }

    dynamicCallArgsGenerator = (anchorNode, meta) => {
        const target = anchorNode.closest("#write h1,h2,h3,h4,h5,h6");
        meta.target = target;

        return [
            {arg_name: `${this.config.RECORD_COLLAPSE ? "不" : ""}记录章节放缩状态`, arg_value: "record_collapse_state"},
            {arg_name: "折叠/展开当前章节", arg_value: "call_current", arg_disabled: !target},
            {arg_name: "折叠/展开全部兄弟章节", arg_value: "call_siblings", arg_disabled: !target},
            {arg_name: "折叠/展开全局同级章节", arg_value: "call_all_siblings", arg_disabled: !target}
        ]
    }

    dynamicCall = (type, meta) => {
        if (!meta.target) return;

        const collapsed = meta.target.classList.contains(this.className);

        let list;
        if (type === "call_current") {
            list = [meta.target];
        } else if (type === "call_siblings") {
            list = this.findSiblings(meta.target);
        } else if (type === "call_all_siblings") {
            list = this.findAllSiblings(meta.target);
        }

        if (list) {
            list.forEach(ele => this.trigger(ele, collapsed));
        }
    }

    call = (type, meta) => {
        if (type === "collapse_all") {
            for (let i = this.paragraphList.length - 1; i >= 0; i--) {
                document.getElementsByTagName(this.paragraphList[i]).forEach(ele => this.trigger(ele, false));
            }
        } else if (type === "expand_all") {
            this.paragraphList.forEach(tag => document.getElementsByTagName(tag).forEach(ele => this.trigger(ele, true)));
        } else if (type === "record_collapse_state") {
            this.recordCollapseState();
        } else {
            this.dynamicCall(type, meta);
        }
        this.callbackOtherPlugin();
    }
}

module.exports = {
    plugin: collapseParagraphPlugin
};

