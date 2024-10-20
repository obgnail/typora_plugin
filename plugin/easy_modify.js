class easyModifyPlugin extends BasePlugin {
    hotkey = () => [
        { hotkey: this.config.HOTKEY_COPY_FULL_PATH, callback: () => this.call("copy_full_path") },
        { hotkey: this.config.HOTKEY_INCREASE_HEADERS_LEVEL, callback: () => this.call("increase_headers_level") },
        { hotkey: this.config.HOTKEY_DECREASE_HEADERS_LEVEL, callback: () => this.call("decrease_headers_level") },
        { hotkey: this.config.HOTKEY_TRAILING_WHITE_SPACE, callback: () => this.call("trailing_white_space") },
        { hotkey: this.config.HOTKEY_EXTRACT_RANGE_TO_NEW_FILE, callback: () => this.dynamicCall("extract_rang_to_new_file") },
    ]

    init = () => {
        const arg_hint = "若无选中文段，则调整整篇文档";
        this.callArgs = [
            { arg_name: "复制标题路径", arg_value: "copy_full_path", arg_hotkey: this.config.HOTKEY_COPY_FULL_PATH },
            { arg_name: "提升选中文段的标题等级", arg_value: "increase_headers_level", arg_hotkey: this.config.HOTKEY_INCREASE_HEADERS_LEVEL, arg_hint },
            { arg_name: "降低选中文段的标题等级", arg_value: "decrease_headers_level", arg_hotkey: this.config.HOTKEY_DECREASE_HEADERS_LEVEL, arg_hint },
            { arg_name: "添加结尾空格", arg_value: "trailing_white_space", arg_hotkey: this.config.HOTKEY_TRAILING_WHITE_SPACE, arg_hint: "除非有特殊需求，不建议使用此功能" },
        ];
    }

    dynamicCallArgsGenerator = (anchorNode, meta) => {
        meta.range = window.getSelection().getRangeAt(0);
        const extract = {
            arg_name: "提取选区文字到新文件",
            arg_value: "extract_rang_to_new_file",
            arg_disabled: meta.range.collapsed,
            arg_hotkey: this.config.HOTKEY_EXTRACT_RANGE_TO_NEW_FILE
        }
        if (extract.arg_disabled) {
            extract.arg_hint = "请框选待提取的文段";
        }
        return [extract];
    }

    dynamicCall = type => {
        this.utils.generateDynamicCallArgs(this.fixedName);
        this.utils.withMeta(meta => this.call(type, meta));
    }

    call = async (type, meta = {}) => {
        const funcMap = {
            increase_headers_level: () => this.changeHeadersLevel(true),
            decrease_headers_level: () => this.changeHeadersLevel(false),
            copy_full_path: () => this.copyFullPath(),
            trailing_white_space: () => this.trailingWhiteSpace(),
            extract_rang_to_new_file: async () => this.extractRangeToNewFile(meta.range),
        }
        const func = funcMap[type];
        if (func) {
            await func();
            this.utils.notification.show("执行成功");
        }
    }

    changeHeadersLevel = incr => {
        const _getTargetHeaders = () => {
            const headers = File.editor.nodeMap.toc.headers;
            const range = window.getSelection().getRangeAt(0);
            if (range.collapsed) return headers;

            const fragment = range.cloneContents();
            const cidSet = new Set(Array.from(fragment.querySelectorAll(`[mdtype='heading']`), e => e.getAttribute('cid')));
            return headers.filter(h => cidSet.has(h.cid))
        }

        const _changeHeaderLevel = (node, incr) => {
            const nodeType = node.get('type');
            if (incr && nodeType === 'paragraph') {
                File.editor.stylize.changeBlock('header6', node);
                return;
            }
            if (nodeType === 'heading') {
                const newLevel = +node.get('depth') + (incr ? -1 : 1);
                if (newLevel === 7) {
                    File.editor.stylize.changeBlock('paragraph', node);
                } else if (0 < newLevel && newLevel <= 6) {
                    File.editor.stylize.changeBlock(`header${newLevel}`, node);
                }
            }
        }

        _getTargetHeaders().forEach(node => _changeHeaderLevel(node, incr));
    }

    copyFullPath = () => {
        const getHeaderName = (title, name) => `${title} ${name}`;
        const paragraphList = ["H1", "H2", "H3", "H4", "H5", "H6"];
        const nameList = ["一级标题", "二级标题", "三级标题", "四级标题", "五级标题", "六级标题"];
        const pList = [];
        let ele = this.utils.getAnchorNode().closest("#write > [cid]")[0];

        while (ele) {
            const idx = paragraphList.indexOf(ele.tagName);
            if (idx !== -1) {
                if (pList.length === 0 || (pList[pList.length - 1].idx > idx)) {
                    pList.push({ ele, idx })
                    if (pList[pList.length - 1].idx === 0) break;
                }
            }
            ele = ele.previousElementSibling;
        }

        pList.reverse();

        const filePath = this.utils.getFilePath();
        const result = [filePath || "untitled"];
        let headerIdx = 0;
        for (const p of pList) {
            while (headerIdx < 6 && p.ele.tagName !== paragraphList[headerIdx]) {
                result.push(getHeaderName("无", nameList[headerIdx]));
                headerIdx++;
            }
            if (p.ele.tagName === paragraphList[headerIdx]) {
                result.push(getHeaderName(p.ele.textContent, nameList[headerIdx]));
                headerIdx++;
            }
        }

        const text = this.utils.Package.Path.join(...result);
        navigator.clipboard.writeText(text);
    }

    extractRangeToNewFile = async range => {
        if (!range || range.collapsed) return;

        // copy content
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        ClientCommand.copyAsMarkdown();
        const text = await window.parent.navigator.clipboard.readText();

        // delete content
        File.editor.UserOp.backspaceHandler(File.editor, null, "Delete");

        // modal
        const components = [{ label: "文件名", type: "input", value: "", placeholder: "请输入新文件名，为空则创建副本" }];
        let { response, submit: [filepath] } = await this.utils.dialog.modalAsync({ title: "提取选区文字到新文件", components });
        if (response !== 1) return;

        // extract
        if (filepath && !filepath.endsWith(".md")) {
            filepath += ".md";
        }
        filepath = await this.utils.newFilePath(filepath);
        const ok = await this.utils.writeFile(filepath, text);
        if (!ok) return;
        this.utils.openFile(filepath);
    }

    trailingWhiteSpace = () => {
        const replaceFlag = 2;
        const tailSpace = "  ";
        this.utils.entities.querySelectorAllInWrite("p[cid]").forEach(ele => {
            const textContent = ele.textContent;
            if (!textContent.trim() || textContent.endsWith(tailSpace)) return
            const span = ele.querySelector(":scope > span:last-child");
            if (!span) return
            if (span) {
                const textContent = span.textContent;
                if (!textContent.trim() || textContent.endsWith(tailSpace)) return
                span.textContent += tailSpace;
                const cid = ele.getAttribute("cid");
                File.editor.undo.addSnap(cid, replaceFlag);
                File.editor.brush.brushNode(cid);
            }
        })
    }
}

module.exports = {
    plugin: easyModifyPlugin,
};
