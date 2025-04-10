class easyModifyPlugin extends BasePlugin {
    hotkey = () => [
        { hotkey: this.config.HOTKEY_COPY_FULL_PATH, callback: () => this.call("copy_full_path") },
        { hotkey: this.config.HOTKEY_INCREASE_HEADERS_LEVEL, callback: () => this.call("increase_headers_level") },
        { hotkey: this.config.HOTKEY_DECREASE_HEADERS_LEVEL, callback: () => this.call("decrease_headers_level") },
        { hotkey: this.config.HOTKEY_CONVERT_CRLF_TO_LF, callback: () => this.call("convert_crlf_to_lf") },
        { hotkey: this.config.HOTKEY_CONVERT_LF_TO_CRLF, callback: () => this.call("convert_lf_to_crlf") },
        { hotkey: this.config.HOTKEY_FILTER_INVISIBLE_CHARACTERS, callback: () => this.call("filter_invisible_characters") },
        { hotkey: this.config.HOTKEY_TRAILING_WHITE_SPACE, callback: () => this.call("trailing_white_space") },
        { hotkey: this.config.HOTKEY_EXTRACT_RANGE_TO_NEW_FILE, callback: () => this.dynamicCall("extract_rang_to_new_file") },
        { hotkey: this.config.HOTKEY_INSERT_MERMAID_MINDMAP, callback: () => this.dynamicCall("insert_mermaid_mindmap") },
        { hotkey: this.config.HOTKEY_INSERT_MERMAID_GRAPH, callback: () => this.dynamicCall("insert_mermaid_graph") },
    ]

    init = () => {
        const notRecommended = this.i18n.t("actHint.notRecommended")
        const defaultDoc = this.i18n.t("actHint.defaultDoc")

        this._showWarnDialog = true
        this.staticActions = this.i18n.fillActions([
            { act_value: "copy_full_path", act_hotkey: this.config.HOTKEY_COPY_FULL_PATH },
            { act_value: "increase_headers_level", act_hotkey: this.config.HOTKEY_INCREASE_HEADERS_LEVEL, act_hint: defaultDoc },
            { act_value: "decrease_headers_level", act_hotkey: this.config.HOTKEY_DECREASE_HEADERS_LEVEL, act_hint: defaultDoc },
            { act_value: "convert_crlf_to_lf", act_hotkey: this.config.HOTKEY_CONVERT_CRLF_TO_LF, act_hint: notRecommended },
            { act_value: "convert_lf_to_crlf", act_hotkey: this.config.HOTKEY_CONVERT_LF_TO_CRLF, act_hint: notRecommended },
            { act_value: "filter_invisible_characters", act_hotkey: this.config.HOTKEY_FILTER_INVISIBLE_CHARACTERS, act_hint: notRecommended },
            { act_value: "trailing_white_space", act_hotkey: this.config.HOTKEY_TRAILING_WHITE_SPACE, act_hint: notRecommended },
        ])
    }

    getDynamicActions = (anchorNode, meta) => {
        const i18n = {
            noSelection: this.i18n.t("act.extract_rang_to_new_file.noSelection"),
            positionEmptyLine: this.i18n.t("act.extract_rang_to_new_file.positionEmptyLine")
        }

        meta.range = window.getSelection().getRangeAt(0)
        const extract = {
            act_value: "extract_rang_to_new_file",
            act_disabled: meta.range.collapsed,
            act_hotkey: this.config.HOTKEY_EXTRACT_RANGE_TO_NEW_FILE
        }
        if (extract.act_disabled) {
            extract.act_hint = i18n.noSelection
        }

        meta.copyAnchor = anchorNode.closest("#write > [cid]")
        meta.insertAnchor = anchorNode.closest('#write > p[mdtype="paragraph"]')
        const act_disabled = !meta.insertAnchor || meta.insertAnchor.querySelector("p > span")
        const act_hint = act_disabled ? i18n.positionEmptyLine : ""
        const insert = [
            { act_value: "insert_mermaid_mindmap", act_hotkey: this.config.HOTKEY_INSERT_MERMAID_MINDMAP, act_disabled, act_hint },
            { act_value: "insert_mermaid_graph", act_hotkey: this.config.HOTKEY_INSERT_MERMAID_GRAPH, act_disabled, act_hint },
        ]

        return this.i18n.fillActions([...insert, extract])
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
            filter_invisible_characters: this.filterInvisibleCharacters,
        }
        const func = funcMap[action]
        if (!func) return

        const notShow = await func()
        if (notShow !== true) {
            const msg = this.i18n.t("success")
            this.utils.notification.show(msg)
        }
    }

    changeHeadersLevel = incr => {
        const _getTargetHeaders = () => {
            const allHeaders = File.editor.nodeMap.toc.headers
            const range = window.getSelection().getRangeAt(0)
            if (range.collapsed) {
                return allHeaders
            }
            const headersInRange = range.cloneContents().querySelectorAll('[mdtype="heading"]')
            const cidSet = new Set([...headersInRange].map(e => e.getAttribute("cid")))
            return allHeaders.filter(header => cidSet.has(header.cid))
        }

        const _changeHeaderLevel = (node) => {
            const nodeType = node.get("type")
            if (incr && nodeType === "paragraph") {
                File.editor.stylize.changeBlock("header6", node)
                return
            }
            if (nodeType === "heading") {
                const newLevel = +node.get("depth") + (incr ? -1 : 1)
                if (newLevel === 7) {
                    File.editor.stylize.changeBlock("paragraph", node)
                } else if (0 < newLevel && newLevel <= 6) {
                    File.editor.stylize.changeBlock(`header${newLevel}`, node)
                }
            }
        }

        _getTargetHeaders().forEach(_changeHeaderLevel)
    }

    copyFullPath = async anchorNode => {
        let ele = anchorNode || this.utils.getAnchorNode().closest("#write > [cid]")[0]
        if (!ele) return

        const paragraphs = ["H1", "H2", "H3", "H4", "H5", "H6"]
        const headers = []
        while (ele) {
            const idx = paragraphs.indexOf(ele.tagName)
            if (idx !== -1 && (headers.length === 0 || (headers[headers.length - 1].idx > idx))) {
                headers.push({ idx, tagName: ele.tagName, textContent: ele.textContent })
                if (idx === 0) {
                    break
                }
            }
            ele = ele.previousElementSibling
        }

        headers.reverse()

        const names = this.i18n.array(paragraphs, "act.copy_full_path.")
        const noHeader = this.i18n.t("act.copy_full_path.NoHeader")

        const getHeaderName = (title, idx) => `${title} ${names[idx]}`

        const filePath = this.utils.getFilePath() || "Untitled"
        const result = [filePath]

        let idx = 0
        for (const { tagName, textContent } of headers) {
            while (idx < 6 && tagName !== paragraphs[idx]) {
                result.push(getHeaderName(noHeader, idx))
                idx++
            }
            if (tagName === paragraphs[idx]) {
                result.push(getHeaderName(textContent, idx))
                idx++
            }
        }

        const fullPath = this.utils.Package.Path.join(...result)
        await navigator.clipboard.writeText(fullPath)
    }

    convertCRLF2LF = async () => this.utils.editCurrentFile(content => content.replace(/\r\n/g, "\n"))

    convertLF2CRLF = async () => this.utils.editCurrentFile(content => content.replace(/\r?\n/g, "\r\n"))

    filterInvisibleCharacters = async () => this.utils.editCurrentFile(content => content.replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200D\uFEFF]/g, ""))

    extractRangeToNewFile = async range => {
        if (!range || range.collapsed) return

        // copy content
        const selection = window.getSelection()
        selection.removeAllRanges()
        selection.addRange(range)
        ClientCommand.copyAsMarkdown()
        const text = await window.parent.navigator.clipboard.readText()

        // delete content
        File.editor.UserOp.backspaceHandler(File.editor, null, "Delete")

        // modal
        const title = this.i18n.t("act.extract_rang_to_new_file")
        const label = this.i18n.t("act.extract_rang_to_new_file.filename")
        const placeholder = this.i18n.t("act.extract_rang_to_new_file.filenameHint")
        const components = [{ label, type: "input", value: "", placeholder }]
        const op = { title, components }
        let { response, submit: [filepath] } = await this.utils.dialog.modalAsync(op)
        if (response !== 1) return

        // extract
        if (filepath && !filepath.endsWith(".md")) {
            filepath += ".md"
        }
        filepath = await this.utils.newFilePath(filepath)
        const ok = await this.utils.writeFile(filepath, text)
        if (ok) {
            this.utils.openFile(filepath)
        }
    }

    trailingWhiteSpace = async () => {
        if (this._showWarnDialog) {
            const message = this.i18n.t("act.trailing_white_space.hint")
            const checkboxLabel = this.i18n._t("global", "disableReminder")
            const op = { type: "warning", message, checkboxLabel }
            const { response, checkboxChecked } = await this.utils.showMessageBox(op)
            if (response === 1) {
                return true
            }
            if (checkboxChecked) {
                this._showWarnDialog = false
            }
        }

        const replaceFlag = 2
        const tailSpace = "  "
        this.utils.entities.querySelectorAllInWrite("p[cid]").forEach(ele => {
            const textContent = ele.textContent
            if (!textContent.trim() || textContent.endsWith(tailSpace)) return
            const span = ele.querySelector(":scope > span:last-child")
            if (!span) return
            if (span) {
                const textContent = span.textContent
                if (!textContent.trim() || textContent.endsWith(tailSpace)) return
                span.textContent += tailSpace
                const cid = ele.getAttribute("cid")
                File.editor.undo.addSnap(cid, replaceFlag)
                File.editor.brush.brushNode(cid)
            }
        })
    }

    insertMindmap = (type, target) => {
        if (!target) return

        const errorMsg = this.i18n.t("act.insert_mermaid_mindmap.incompatible")
        const clean = title => `("${title.replace(/"/g, "")}")`
        const getComment = type => (type === "mindmap" && !window.mermaidAPI.defaultConfig.mindmap) ? `%%${errorMsg}\n` : ""
        const mermaidFunc = {
            mindmap: tree => {
                const getTokens = (node, ret, indent) => {
                    ret.push("\t".repeat(indent), clean(node.text), "\n")
                    node.children.forEach(child => getTokens(child, ret, indent + 1))
                    return ret
                }
                return getTokens(tree, ["mindmap", "\n"], 1)
            },
            graph: tree => {
                let num = 0
                const getName = node => {
                    if (node._shortName) {
                        return node._shortName
                    }
                    node._shortName = "T" + ++num
                    return node._shortName + clean(node.text)
                }
                const getTokens = (node, ret) => {
                    node.children.forEach(child => ret.push(getName(node), "-->", getName(child), "\n"))
                    node.children.forEach(child => getTokens(child, ret))
                    return ret
                }
                return getTokens(tree, ["graph LR", "\n"])
            }
        }
        const func = mermaidFunc[type]
        if (!func) return

        const tree = this.utils.getTocTree()
        const tokens = func(tree)
        const mermaid = ["```mermaid", "\n", getComment(type), ...tokens, "```"].join("")
        this.utils.insertText(target, mermaid)
    }
}

module.exports = {
    plugin: easyModifyPlugin,
}
