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
        { hotkey: this.config.HOTKEY_CONVERT_IMAGE_TO_BASE64, callback: () => this.dynamicCall("convert_image_to_base64") },
        { hotkey: this.config.HOTKEY_CONVERT_ALL_IMAGES_TO_BASE64, callback: () => this.dynamicCall("convert_all_images_to_base64") },
        { hotkey: this.config.HOTKEY_UNWRAP_OUTERMOST_BLOCK, callback: () => this.dynamicCall("unwrap_outermost_block") },
    ]

    init = () => {
        const notRecommended = this.i18n.t("actHint.notRecommended")
        const defaultDoc = this.i18n.t("actHint.defaultDoc")

        this._showWarnDialog = true
        this.staticActions = this.i18n.fillActions([
            { act_value: "copy_full_path", act_hotkey: this.config.HOTKEY_COPY_FULL_PATH },
            { act_value: "increase_headers_level", act_hotkey: this.config.HOTKEY_INCREASE_HEADERS_LEVEL, act_hint: defaultDoc },
            { act_value: "decrease_headers_level", act_hotkey: this.config.HOTKEY_DECREASE_HEADERS_LEVEL, act_hint: defaultDoc },
            { act_value: "unwrap_outermost_block", act_hotkey: this.config.HOTKEY_UNWRAP_OUTERMOST_BLOCK },
            { act_value: "convert_crlf_to_lf", act_hotkey: this.config.HOTKEY_CONVERT_CRLF_TO_LF, act_hint: notRecommended },
            { act_value: "convert_lf_to_crlf", act_hotkey: this.config.HOTKEY_CONVERT_LF_TO_CRLF, act_hint: notRecommended },
            { act_value: "filter_invisible_characters", act_hotkey: this.config.HOTKEY_FILTER_INVISIBLE_CHARACTERS, act_hint: notRecommended },
            { act_value: "trailing_white_space", act_hotkey: this.config.HOTKEY_TRAILING_WHITE_SPACE, act_hint: notRecommended },
        ])
    }

    getDynamicActions = (anchorNode, meta) => {
        const I18N = {
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
            extract.act_hint = I18N.noSelection
        }

        meta.innermostAnchor = anchorNode.closest("#write [cid]")
        meta.outermostAnchor = anchorNode.closest("#write > [cid]")
        meta.insertAnchor = anchorNode.closest('#write > p[mdtype="paragraph"]')
        meta.imageAnchor = anchorNode.closest("#write .md-image.md-img-loaded")
        const act_disabled = !meta.insertAnchor || meta.insertAnchor.querySelector("p > span")
        const act_hint = act_disabled ? I18N.positionEmptyLine : ""
        const insert = [
            { act_value: "insert_mermaid_mindmap", act_hotkey: this.config.HOTKEY_INSERT_MERMAID_MINDMAP, act_disabled, act_hint },
            { act_value: "insert_mermaid_graph", act_hotkey: this.config.HOTKEY_INSERT_MERMAID_GRAPH, act_disabled, act_hint },
        ]
        const convert = [
            { act_value: "convert_image_to_base64", act_hotkey: this.config.HOTKEY_CONVERT_IMAGE_TO_BASE64, act_disabled: !meta.imageAnchor },
            { act_value: "convert_all_images_to_base64", act_hotkey: this.config.HOTKEY_CONVERT_ALL_IMAGES_TO_BASE64 },
        ]
        return this.i18n.fillActions([...insert, ...convert, extract])
    }

    dynamicCall = action => this.utils.updateAndCallPluginDynamicAction(this.fixedName, action)

    call = async (action, meta = {}) => {
        const funcMap = {
            increase_headers_level: () => this.changeHeadersLevel(true),
            decrease_headers_level: () => this.changeHeadersLevel(false),
            unwrap_outermost_block: () => this.unwrapOutermostBlock(meta.outermostAnchor, meta.innermostAnchor),
            copy_full_path: () => this.copyFullPath(meta.outermostAnchor),
            insert_mermaid_mindmap: () => this.insertMindmap("mindmap", meta.insertAnchor),
            insert_mermaid_graph: () => this.insertMindmap("graph", meta.insertAnchor),
            extract_rang_to_new_file: async () => this.extractRangeToNewFile(meta.range),
            trailing_white_space: this.trailingWhiteSpace,
            convert_crlf_to_lf: this.convertCRLF2LF,
            convert_lf_to_crlf: this.convertLF2CRLF,
            convert_image_to_base64: async () => this.convertImageToBase64(meta.imageAnchor),
            convert_all_images_to_base64: this.convertAllImagesToBase64,
            filter_invisible_characters: this.filterInvisibleCharacters,
        }
        const func = funcMap[action]
        if (!func) return

        const success = await func()
        if (success !== false) {
            const msg = this.i18n._t("global", "success")
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
        if (!range || range.collapsed) {
            return false
        }

        const fields = [
            { key: "filename", type: "text", label: this.i18n.t("act.extract_rang_to_new_file.filename"), placeholder: this.i18n.t("act.extract_rang_to_new_file.filenameHint") },
            { key: "autoOpen", type: "switch", label: this.i18n.t("act.extract_rang_to_new_file.autoOpenFile") },
        ]
        const op = {
            title: this.i18n.t("act.extract_rang_to_new_file"),
            schema: [{ title: undefined, fields }],
            data: { filename: "", autoOpen: true },
        }
        const { response, data } = await this.utils.formDialog.modal(op)
        if (response === 0) {
            return false
        }

        let { filename, autoOpen } = data

        // get filename
        if (filename && !filename.toLowerCase().endsWith(".md")) {
            filename += ".md"
        }
        filename = await this.utils.newFilePath(filename)

        // get content
        const selection = window.getSelection()
        selection.removeAllRanges()
        selection.addRange(range)
        const content = File.editor.UserOp.getSpeechText()

        const ok = await this.utils.writeFile(filename, content)
        if (!ok) {
            return false
        }

        // delete content
        File.editor.UserOp.backspaceHandler(File.editor, null, "Delete")

        if (autoOpen) {
            this.utils.openFile(filename)
        }
    }

    trailingWhiteSpace = async () => {
        if (this._showWarnDialog) {
            const message = this.i18n.t("act.trailing_white_space.hint")
            const checkboxLabel = this.i18n._t("global", "disableReminder")
            const op = { type: "warning", message, checkboxLabel }
            const { response, checkboxChecked } = await this.utils.showMessageBox(op)
            if (response === 1) {
                return false
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

    unwrapOutermostBlock = (outermostAnchor, innermostAnchor) => {
        if (!outermostAnchor || !innermostAnchor) return

        // exit if the anchor is inside a code or math block
        if (innermostAnchor.matches(".md-fences, .md-math-block")) return

        const createUnwrapFn = (type) => {
            return () => {
                const closestCid = innermostAnchor.getAttribute("cid")
                const closestNode = File.editor.nodeMap.allNodes.get(closestCid)
                if (!closestNode) return

                // Monkey-patch: Temporarily replace the method to ensure `toggleIndent` targets the top-level block
                const originFn = closestNode.getClosetBlock
                closestNode.getClosetBlock = () => closestNode.getTopBlock().getFirstChild()
                try {
                    File.editor.stylize.toggleIndent(type)
                } finally {
                    closestNode.getClosetBlock = originFn
                }
            }
        }

        const handlers = {
            '[mdtype="heading"]': () => File.editor.stylize.changeBlock(`header${outermostAnchor.tagName[1]}`, undefined, true),
            '[mdtype="blockquote"]': createUnwrapFn("blockquote"),
            '.task-list-item': createUnwrapFn("tasklist"),
            'ol[mdtype="list"]': createUnwrapFn("ol"),
            'ul[mdtype="list"]': createUnwrapFn("ul"),
        }
        const type = Object.keys(handlers).find(selector => outermostAnchor.matches(selector))
        if (type) handlers[type]()
    }

    convertImageToBase64 = async (imageElem) => {
        if (!imageElem) return
        let src = File.editor.imgEdit.getSrcFromDom(imageElem, true)
        if (!src) return

        if (this.utils.isSpecialImage(src)) return
        if (this.utils.isNetworkImage(src)) {
            try {
                const { ok, filepath } = await this.utils.downloadImage(src)
                if (!ok) {
                    this.utils.notification.show(this.i18n._t("global", "error.timeout"))
                    return
                }
                src = filepath
            } catch (e) {
                this.utils.notification.show(e.toString(), "error")
                return
            }
        }

        const bin = await this.utils.Package.Fs.promises.readFile(src)
        const base64 = this.utils.convertImageToBase64(bin)

        const { range } = this.utils.getRangy()
        const bookmark = range.getBookmark(imageElem)
        range.moveToBookmark(bookmark)
        range.select()
        File.editor.imgEdit.insertImageFromURL(base64)
    }

    convertAllImagesToBase64 = async () => {
        const images = [...document.querySelectorAll("#write .md-image.md-img-loaded")]
        const promises = images.map(async image => this.convertImageToBase64(image))
        return Promise.all(promises)
    }
}

module.exports = {
    plugin: easyModifyPlugin,
}
