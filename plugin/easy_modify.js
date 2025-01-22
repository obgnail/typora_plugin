class easyModifyPlugin extends BasePlugin {
    hotkey = () => [
        { hotkey: this.config.HOTKEY_COPY_FULL_PATH, callback: () => this.call("copy_full_path") },
        { hotkey: this.config.HOTKEY_INCREASE_HEADERS_LEVEL, callback: () => this.call("increase_headers_level") },
        { hotkey: this.config.HOTKEY_DECREASE_HEADERS_LEVEL, callback: () => this.call("decrease_headers_level") },
        { hotkey: this.config.HOTKEY_CONVERT_CRLF_TO_LF, callback: () => this.call("convert_crlf_to_lf") },
        { hotkey: this.config.HOTKEY_CONVERT_LF_TO_CRLF, callback: () => this.call("convert_lf_to_crlf") },
        { hotkey: this.config.HOTKEY_TRAILING_WHITE_SPACE, callback: () => this.call("trailing_white_space") },
        { hotkey: this.config.HOTKEY_EXTRACT_RANGE_TO_NEW_FILE, callback: () => this.dynamicCall("extract_rang_to_new_file") },
        { hotkey: this.config.HOTKEY_INSERT_MERMAID_MINDMAP, callback: () => this.dynamicCall("insert_mermaid_mindmap") },
        { hotkey: this.config.HOTKEY_INSERT_MERMAID_GRAPH, callback: () => this.dynamicCall("insert_mermaid_graph") },
    ]

    init = () => {
        this._showWarnDialog = true

        const defaultDoc = "若无选中文段，则调整整篇文档"
        const notRecommended = "除非有特殊需求，不建议使用此功能"
        this.staticActions = [
            { act_name: "复制标题路径", act_value: "copy_full_path", act_hotkey: this.config.HOTKEY_COPY_FULL_PATH },
            { act_name: "提升选中文段的标题等级", act_value: "increase_headers_level", act_hotkey: this.config.HOTKEY_INCREASE_HEADERS_LEVEL, act_hint: defaultDoc },
            { act_name: "降低选中文段的标题等级", act_value: "decrease_headers_level", act_hotkey: this.config.HOTKEY_DECREASE_HEADERS_LEVEL, act_hint: defaultDoc },
            { act_name: "换行符 CRLF 转为 LF", act_value: "convert_crlf_to_lf", act_hotkey: this.config.HOTKEY_CONVERT_CRLF_TO_LF, act_hint: notRecommended },
            { act_name: "换行符 LF 转为 CRLF", act_value: "convert_lf_to_crlf", act_hotkey: this.config.HOTKEY_CONVERT_LF_TO_CRLF, act_hint: notRecommended },
            { act_name: "添加结尾空格", act_value: "trailing_white_space", act_hotkey: this.config.HOTKEY_TRAILING_WHITE_SPACE, act_hint: notRecommended },
        ]
    }

    getDynamicActions = (anchorNode, meta) => {
        meta.range = window.getSelection().getRangeAt(0)
        const extract = {
            act_name: "提取选区文字到新文件",
            act_value: "extract_rang_to_new_file",
            act_disabled: meta.range.collapsed,
            act_hotkey: this.config.HOTKEY_EXTRACT_RANGE_TO_NEW_FILE
        }
        if (extract.act_disabled) {
            extract.act_hint = "请框选待提取的文段"
        }

        meta.copyAnchor = anchorNode.closest("#write > [cid]")
        meta.insertAnchor = anchorNode.closest(`#write > p[mdtype="paragraph"]`)
        const act_disabled = !meta.insertAnchor || meta.insertAnchor.querySelector("p > span")
        const act_hint = act_disabled ? "请将光标定位到空白行" : ""
        const insert = [
            { act_name: "插入思维导图：mindmap", act_value: "insert_mermaid_mindmap", act_hotkey: this.config.HOTKEY_INSERT_MERMAID_MINDMAP, act_disabled, act_hint },
            { act_name: "插入思维导图：graph", act_value: "insert_mermaid_graph", act_hotkey: this.config.HOTKEY_INSERT_MERMAID_GRAPH, act_disabled, act_hint },
        ]

        return [...insert, extract]
    }

    dynamicCall = action => this.utils.updateAndCallPluginDynamicAction(this.fixedName, action)

    call = async (action, meta = {}) => {
        const funcMap = {
            increase_headers_level: () => this.changeHeadersLevel(true),
            decrease_headers_level: () => this.changeHeadersLevel(false),
            copy_full_path: () => this.copyFullPath(meta.copyAnchor),
            insert_mermaid_mindmap: () => this.insertMindmap("mindmap", meta.insertAnchor),
            insert_mermaid_graph: () => this.insertMindmap("graph", meta.insertAnchor),
            extract_rang_to_new_file: async () => this.extractRangeToNewFile(meta.range),
            trailing_white_space: this.trailingWhiteSpace,
            convert_crlf_to_lf: this.convertCRLF2LF,
            convert_lf_to_crlf: this.convertLF2CRLF,
        }
        const func = funcMap[action]
        if (!func) return

        const dontShow = await func()
        if (dontShow !== true) {
            this.utils.notification.show("执行成功")
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

    copyFullPath = anchorNode => {
        const getHeaderName = (title, name) => `${title} ${name}`;
        const paragraphList = ["H1", "H2", "H3", "H4", "H5", "H6"];
        const nameList = ["一级标题", "二级标题", "三级标题", "四级标题", "五级标题", "六级标题"];
        const pList = [];
        let ele = anchorNode || this.utils.getAnchorNode().closest("#write > [cid]")[0]

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

    convertCRLF2LF = async () => this.utils.editCurrentFile(content => content.replace(/\r\n/g, "\n"))

    convertLF2CRLF = async () => this.utils.editCurrentFile(content => content.replace(/\r?\n/g, "\r\n"))

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

    trailingWhiteSpace = async () => {
        if (this._showWarnDialog) {
            const option = { type: "warning", buttons: ["确定", "取消"], message: "为整篇文档添加结尾空格", checkboxLabel: "不再提示（直到关闭Typora）" };
            const { response, checkboxChecked } = await this.utils.showMessageBox(option);
            if (response === 1) return true;
            if (checkboxChecked) {
                this._showWarnDialog = false;
            }
        }

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

    insertMindmap = (type, target) => {
        if (!target) return;

        const clean = title => `("${title.replace(/"/g, "")}")`
        const getComment = type => (type === "mindmap" && !window.mermaidAPI.defaultConfig.mindmap)
            ? "%%mermaid版本低，不支持mindmap组件，请前往https://mermaid.live/查看\n"
            : ""
        const mermaidFunc = {
            mindmap: tree => {
                const preOrder = (node, list, indent) => {
                    list.push("\t".repeat(indent), clean(node.text), "\n");
                    node.children.forEach(child => preOrder(child, list, indent + 1));
                    return list;
                }
                return preOrder(tree, ["mindmap", "\n"], 1);
            },
            graph: tree => {
                let num = 0;
                const getName = node => {
                    if (node._shortName) return node._shortName;
                    node._shortName = "T" + ++num;
                    return node._shortName + clean(node.text);
                }
                const levelOrder = (node, list) => {
                    node.children.forEach(child => list.push(getName(node), "-->", getName(child), "\n"));
                    node.children.forEach(child => levelOrder(child, list));
                    return list
                }
                return levelOrder(tree, ["graph LR", "\n"])
            }
        }
        const func = mermaidFunc[type];
        if (!func) return;
        const tree = this.utils.getTocTree();
        const lines = func(tree).join("");
        const content = ["```", "mermaid", "\n", getComment(type), lines, "```"].join("");
        this.utils.insertText(target, content)
    }
}

module.exports = {
    plugin: easyModifyPlugin,
}
