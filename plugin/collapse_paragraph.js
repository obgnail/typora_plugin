class collapseParagraphPlugin extends BasePlugin {
    styleTemplate = () => true

    init = () => {
        this.className = "plugin-collapsed-paragraph";
        this.selector = `#write > [mdtype="heading"]`;
        this.paragraphList = ["H1", "H2", "H3", "H4", "H5", "H6"];
        this.callArgs = [
            {arg_name: "折叠全部章节", arg_value: "collapse_all"},
            {arg_name: "展开全部章节", arg_value: "expand_all"},
        ];
        this.funcList = this.getFuncList();
    }

    process = () => {
        this.init();
        this.recordCollapseState(false);
        document.getElementById("write").addEventListener("click", ev => {
            const paragraph = this.getTargetHeader(ev.target);
            if (!paragraph) return;
            const obj = this.funcList.find(({filter}) => filter(ev));
            if (!obj) return;
            if (ev.target.closest('.md-link')) return; // 特殊处理
            document.activeElement.blur();
            const collapsed = paragraph.classList.contains(this.className);
            const list = obj.callback(paragraph);
            list.forEach(ele => this.trigger(ele, collapsed));
            this.callbackOtherPlugin();
        })
    }

    getTargetHeader = target => {
        if (this.config.STRICT_MODE) {
            return target.closest(this.selector)
        }
        let ele = target.closest("#write > [cid]");
        while (ele) {
            if (ele.getAttribute("mdtype") === "heading") {
                return ele
            }
            ele = ele.previousElementSibling;
        }
    }

    getFuncList = () => {
        const funcMap = {
            COLLAPSE_SINGLE: ele => [ele],
            COLLAPSE_SIBLINGS: this.findSiblings,
            COLLAPSE_ALL_SIBLINGS: this.findAllSiblings,
            COLLAPSE_RECURSIVE: this.findSubSiblings,
        }
        const result = [];
        for (const [key, callback] of Object.entries(funcMap)) {
            const modifier = this.config.MODIFIER_KEY[key];
            if (modifier) {
                result.push({filter: this.utils.modifierKey(modifier), callback});
            }
        }
        return result
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
        paragraph.classList.toggle(this.className, !collapsed);
        this.toggle(paragraph, collapsed ? "" : "none");
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

    rangeSiblings = (paragraph, rangeFunc) => {
        ["previousElementSibling", "nextElementSibling"].forEach(direction => {
            for (let ele = paragraph[direction]; !!ele; ele = ele[direction]) {
                const stop = rangeFunc(ele);
                if (stop) return;
            }
        })
    }

    findSiblings = paragraph => {
        const idx = this.paragraphList.indexOf(paragraph.tagName);
        const stop = this.paragraphList.slice(0, idx);
        const result = [paragraph];
        this.rangeSiblings(paragraph, ele => {
            if (stop.indexOf(ele.tagName) !== -1) return true;
            (ele.tagName === paragraph.tagName) && result.push(ele);
        })
        return result;
    }

    findSubSiblings = paragraph => {
        const idx = this.paragraphList.indexOf(paragraph.tagName);
        const stop = this.paragraphList.slice(0, idx + 1);
        const result = [paragraph];
        this.rangeSiblings(paragraph, ele => {
            if (stop.indexOf(ele.tagName) !== -1) return true;
            (idx < this.paragraphList.indexOf(ele.tagName)) && result.push(ele);
        })
        return result;
    }

    findAllSiblings = paragraph => document.querySelectorAll(`#write > ${paragraph.tagName}`);

    recordCollapseState = (needChange = true) => {
        if (needChange) {
            this.config.RECORD_COLLAPSE = !this.config.RECORD_COLLAPSE;
        }
        const name = "recordCollapseParagraph";
        const selector = this.selector;
        const stateGetter = ele => ele.classList.contains(this.className);
        const stateRestorer = ele => this.trigger(ele, false);
        if (this.config.RECORD_COLLAPSE) {
            this.utils.registerStateRecorder(name, selector, stateGetter, stateRestorer)
        } else {
            this.utils.unregisterStateRecorder(name);
        }
    }

    collapseAll = () => {
        for (let i = this.paragraphList.length - 1; i >= 0; i--) {
            document.getElementsByTagName(this.paragraphList[i]).forEach(ele => this.trigger(ele, false));
        }
    }
    expandAll = () => {
        this.paragraphList.forEach(tag => document.getElementsByTagName(tag).forEach(ele => this.trigger(ele, true)));
    }

    dynamicCallArgsGenerator = (anchorNode, meta) => {
        const arg_name = `${this.config.RECORD_COLLAPSE ? "不" : ""}记住章节折叠状态`;
        const result = [{arg_name: arg_name, arg_value: "record_collapse_state"}];
        const target = this.getTargetHeader(anchorNode);
        if (target) {
            meta.target = target;
            result.push(
                {arg_name: "折叠/展开当前章节", arg_value: "call_current", arg_disabled: !target},
                {arg_name: "折叠/展开当前章节（递归）", arg_value: "call_recursive", arg_disabled: !target},
                {arg_name: "折叠/展开全部兄弟章节", arg_value: "call_siblings", arg_disabled: !target},
                {arg_name: "折叠/展开全局同级章节", arg_value: "call_all_siblings", arg_disabled: !target},
            )
        }
        return result
    }

    dynamicCall = (type, meta) => {
        if (!meta.target) return;
        const map = {
            call_current: el => [el],
            call_siblings: this.findSiblings,
            call_all_siblings: this.findAllSiblings,
            call_recursive: this.findSubSiblings,
        }
        const func = map[type];
        if (!func) return;
        const collapsed = meta.target.classList.contains(this.className);
        const list = func(meta.target);
        if (list) {
            list.forEach(ele => this.trigger(ele, collapsed));
        }
    }

    call = (type, meta) => {
        if (type === "collapse_all") {
            this.collapseAll();
        } else if (type === "expand_all") {
            this.expandAll();
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

