class collapseParagraphPlugin extends BasePlugin {
    styleTemplate = () => true

    init = () => {
        this.className = "plugin-collapsed-paragraph";
        this.selector = `#write > [mdtype="heading"]`;
        this.paragraphList = ["H1", "H2", "H3", "H4", "H5", "H6"];
        this.callArgs = [
            { arg_name: "折叠全部章节", arg_value: "collapse_all" },
            { arg_name: "展开全部章节", arg_value: "expand_all" },
        ];
    }

    process = () => {
        this.utils.runtime.autoSaveConfig(this);
        this.disableExpandSimpleBlock();  // 选项【显示当前块元素的Markdown源码】会影响本插件，将其禁用
        this.recordCollapseState(false);
        const funcList = this.getFuncList();
        const write = this.utils.entities.eWrite;
        write.addEventListener("click", ev => {
            const paragraph = this.getTargetHeader(ev.target);
            if (!paragraph) return;
            const obj = funcList.find(({ filter }) => filter(ev));
            if (!obj) return;
            if (ev.target.closest('.md-link')) return; // 特殊处理
            document.activeElement.blur();
            const collapsed = paragraph.classList.contains(this.className);
            const list = obj.callback(paragraph);
            list.forEach(ele => this.trigger(ele, collapsed));
            this.callbackOtherPlugin();
        })

        document.querySelector(".sidebar-menu").addEventListener("click", ev => {
            const item = ev.target.closest(".outline-item");
            if (!item) return;
            const target = item.querySelector(".outline-label");
            if (!target) return;
            let ele = write.querySelector(`[cid=${target.dataset.ref}]`);
            if (!ele || ele.style.display !== "none") return;
            this.expandCollapsedParent(ele);
        })
    }

    disableExpandSimpleBlock = () => File.option.expandSimpleBlock = false;

    getTargetHeader = (target, forceLoose = false) => {
        if (this.config.STRICT_MODE && !forceLoose) {
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
        return Object.entries(funcMap)
            .filter(([key]) => this.config.MODIFIER_KEY[key])
            .flatMap(([key, callback]) => {
                const modifier = this.config.MODIFIER_KEY[key]
                return { filter: this.utils.modifierKey(modifier), callback }
            })
    }

    callbackOtherPlugin = () => this.utils.callPluginFunction("toc", "refresh");

    trigger = (paragraph, collapsed) => {
        const _trigger = (paragraph, display) => {
            const idx = this.paragraphList.indexOf(paragraph.tagName);
            const stop = this.paragraphList.slice(0, idx + 1);

            let ele = paragraph.nextElementSibling;
            while (ele && stop.indexOf(ele.tagName) === -1) {
                const need = this.paragraphList.indexOf(ele.tagName) !== -1 && ele.classList.contains(this.className) && display === ""
                if (need) {
                    ele.style.display = "";
                    ele = _trigger(ele, "none");
                    continue
                }

                ele.style.display = display;
                ele = ele.nextElementSibling;
            }
            return ele;
        }

        paragraph.classList.toggle(this.className, !collapsed);
        _trigger(paragraph, collapsed ? "" : "none");
    }

    expandCollapsedParent = paragraph => {
        let currentLevel = this.paragraphList.indexOf(paragraph.tagName);
        while (paragraph) {
            if (paragraph.getAttribute("mdtype") === "heading" && paragraph.classList.contains(this.className)) {
                const level = this.paragraphList.indexOf(paragraph.tagName);
                if (level < currentLevel) {
                    this.trigger(paragraph, true);
                    currentLevel = level;
                }
            }
            paragraph = paragraph.previousElementSibling;
        }
    }

    collapseOther = paragraph => {
        let currentLevel = this.paragraphList.indexOf(paragraph.tagName);
        if (currentLevel === -1) return;
        this.rangeSiblings(paragraph, ele => {
            const level = this.paragraphList.indexOf(ele.tagName);
            if (level === -1) return;
            if (level < currentLevel) {
                this.trigger(ele, true);
                currentLevel = level;
            } else {
                this.trigger(ele, false);
            }
        })
    }

    rollback = start => {
        if (!this.utils.entities.querySelectorInWrite(`:scope > .${this.className}`)) return;

        let ele = start.closest("#write > [cid]");

        const pList = [];
        while (ele) {
            const idx = this.paragraphList.indexOf(ele.tagName);
            if (idx !== -1) {
                if (pList.length === 0 || (pList[pList.length - 1].idx > idx && ele.classList.contains(this.className))) {
                    pList.push({ ele, idx })
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

    findAllSiblings = paragraph => this.utils.entities.querySelectorAllInWrite(`:scope > ${paragraph.tagName}`);

    recordCollapseState = (needChange = true) => {
        if (needChange) {
            this.config.RECORD_COLLAPSE = !this.config.RECORD_COLLAPSE;
        }
        const name = "recordCollapseParagraph";
        const selector = this.selector;
        const stateGetter = ele => ele.classList.contains(this.className);
        const stateRestorer = ele => this.trigger(ele, false);
        if (this.config.RECORD_COLLAPSE) {
            this.utils.stateRecorder.register(name, selector, stateGetter, stateRestorer)
        } else {
            this.utils.stateRecorder.unregister(name);
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
        const genHotkey = key => {
            const value = this.config.MODIFIER_KEY[key];
            return value ? `${value}+click` : undefined
        }
        const target = this.getTargetHeader(anchorNode, !this.config.STRICT_MODE_IN_CONTEXT_MENU);
        meta.target = target;
        return [
            { arg_name: "折叠其他章节", arg_value: "collapse_other", arg_disabled: !target },
            { arg_name: "折叠/展开当前章节", arg_value: "call_current", arg_disabled: !target, arg_hotkey: genHotkey("COLLAPSE_SINGLE") },
            { arg_name: "折叠/展开当前章节（递归）", arg_value: "call_recursive", arg_disabled: !target, arg_hotkey: genHotkey("COLLAPSE_RECURSIVE") },
            { arg_name: "折叠/展开同级章节", arg_value: "call_siblings", arg_disabled: !target, arg_hotkey: genHotkey("COLLAPSE_SIBLINGS") },
            { arg_name: "折叠/展开全局同级章节", arg_value: "call_all_siblings", arg_disabled: !target, arg_hotkey: genHotkey("COLLAPSE_ALL_SIBLINGS") },
            { arg_name: "启用功能：记住章节折叠状态", arg_value: "record_collapse_state", arg_state: this.config.RECORD_COLLAPSE },
        ]
    }

    dynamicCall = (type, meta) => {
        const { target } = meta;
        if (!target) return;
        if (type === "collapse_other") {
            this.collapseOther(target);
            return;
        }

        const map = {
            call_current: el => [el],
            call_siblings: this.findSiblings,
            call_all_siblings: this.findAllSiblings,
            call_recursive: this.findSubSiblings,
        }
        const func = map[type];
        if (!func) return;
        const collapsed = target.classList.contains(this.className);
        const list = func(target);
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

