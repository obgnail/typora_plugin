class SidebarEnhancePlugin extends BasePlugin {
    styleTemplate = () => !!this.config.SORTABLE_OUTLINE

    process = () => {
        if (this.config.DISPLAY_NON_MARKDOWN_FILES && File.SupportedFiles) {
            this._displayNonMarkdownFiles()
        }
        if (this.config.KEEP_OUTLINE_FOLD_STATE && File.option.canCollapseOutlinePanel) {
            this._keepOutlineFoldState()
        }
        if (this.config.SORTABLE_OUTLINE) {
            this._sortableOutline()
        }
    }

    init = () => {
        this.entities = {
            outline: document.getElementById("outline-content")
        }
    }

    _displayNonMarkdownFiles = () => {
        File.SupportedFiles.push(...this.config.SUPPORTED_FILE_EXT)
        const supportedExt = new Set(this.config.SUPPORTED_FILE_EXT.map(e => `.${e}`))
        // Delay decoration to ensure this beforeFn runs first, this beforeFn may return a stopCallError
        this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.allPluginsHadInjected, () => {
            this.utils.decorate(() => File?.editor?.library, "openFile", (toOpenFile) => {
                const ext = this.utils.Package.Path.extname(toOpenFile)
                if (supportedExt.has(ext)) {
                    this.utils.openPath(toOpenFile)
                    return this.utils.stopCallError
                }
            })
        })
    }

    /**
     * Preserves the fold/expand state of sidebar outline nodes across file switches.
     *
     * Since the outline DOM renders asynchronously, this method utilizes a `MutationObserver` to monitor the sidebar.
     * It intercepts the restoration task via a `delayWrapper` and defers execution until DOM mutations stabilize,
     * ensuring target elements exist before re-applying the state.
     */
    _keepOutlineFoldState = () => {
        let todo

        const callback = this.utils.debounce(() => {
            if (typeof todo === "function") {
                todo()
                todo = null
            }
        }, 100)
        new MutationObserver(callback).observe(this.entities.outline, { childList: true, subtree: true })

        const hasOpenClass = "outline-item-open"
        const recordSelector = "#outline-content .outline-item-wrapper:not(.outline-item-signle)"  // `signle` is Typora's typo
        const stateGetter = el => el.classList.contains(hasOpenClass)
        const stateRestorer = (el, isOpen) => isOpen && el.classList.add(hasOpenClass)
        const delayWrapper = (task) => todo = task
        this.utils.stateRecorder.register(this.fixedName, recordSelector, stateGetter, stateRestorer, null, delayWrapper)
    }

    _sortableOutline = () => {
        const outline = this.entities.outline

        const fresh = this.utils.debounce(() => outline.querySelectorAll(".outline-item").forEach(e => e.draggable = true), 200)
        this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.outlineUpdated, fresh)
        this.utils.decorate(() => File, "freshMenu", null, fresh)
        this.utils.decorate(() => File?.editor?.library?.outline, "renderOutline", null, fresh)

        let dragItem
        const classAbove = "plugin-sortable-outline-above"
        const classBelow = "plugin-sortable-outline-below"
        const classSource = "plugin-sortable-outline-source"
        const isAncestorOf = (ancestor, descendant) => ancestor.parentElement.contains(descendant)
        const isPreceding = (el, otherEl) => el.compareDocumentPosition(otherEl) === document.DOCUMENT_POSITION_PRECEDING
        const getCid = item => item.querySelector(":scope > .outline-label").dataset.ref
        const clearStyle = () => outline.querySelectorAll(`.${classAbove}, .${classBelow}, .${classSource}`).forEach(e => {
            e.classList.remove(classAbove, classBelow, classSource)
        })
        const setStyle = function (ev) {
            if (isAncestorOf(dragItem, this)) {
                ev.originalEvent.dataTransfer.effectAllowed = "none"
                ev.originalEvent.dataTransfer.dropEffect = "none"
            } else {
                const cls = isPreceding(dragItem, this) ? classAbove : classBelow
                this.parentElement.classList.add(cls)
            }
            return false
        }
        const getHeader = (cid, headers, blocks) => {
            const start = headers.findIndex(h => h.node.cid === cid)
            if (start === -1) return

            const targetDepth = headers[start].node.attributes?.depth
            if (targetDepth == null) return

            let end = start + 1
            while (end < headers.length) {
                const nextDepth = headers[end].node.attributes?.depth
                if (nextDepth != null && nextDepth <= targetDepth) break
                end++
            }

            const startIdx = headers[start].idx
            const endIdx = headers.length === end ? blocks.length : headers[end].idx
            return { startIdx, endIdx }
        }
        $(outline)
            .on("dragstart", ".outline-item", function (ev) {
                dragItem = this
                ev.originalEvent.dataTransfer.effectAllowed = "move"
                ev.originalEvent.dataTransfer.dropEffect = "move"
                this.parentElement.classList.add(classSource)
            })
            .on("dragenter", ".outline-item", setStyle)
            .on("dragover", ".outline-item", setStyle)
            .on("dragleave", ".outline-item", function () {
                this.parentElement.classList.remove(classAbove, classBelow)
            })
            .on("drop", ".outline-item", function () {
                if (isAncestorOf(dragItem, this)) return
                const dragCid = getCid(dragItem)
                const dropCid = getCid(this)
                if (!dragCid || !dropCid) return

                const headers = []
                const blocks = File.editor.nodeMap.blocks.toArray()
                blocks.forEach((node, idx) => node.attributes.type === Node.TYPE.heading && headers.push({ idx: idx, node: node }))

                const drag = getHeader(dragCid, headers, blocks)
                const drop = getHeader(dropCid, headers, blocks)

                const dragLength = drag.endIdx - drag.startIdx
                const removed = blocks.splice(drag.startIdx, dragLength)
                const isDragDown = drag.startIdx < drop.startIdx
                const insertIdx = isDragDown ? drop.endIdx - dragLength : drop.startIdx
                blocks.splice(insertIdx, 0, ...removed)

                const joiner = File.option.preferCRLF ? "\r\n" : "\n"
                const content = blocks.map(node => node.toMark()).join(joiner)
                const op = File.option.enableAutoSave ? { delayRefresh: true, skipChangeCount: true, skipStore: true } : undefined
                File.reloadContent(content, op)
            })
            .on("dragend", clearStyle)
    }
}

module.exports = {
    plugin: SidebarEnhancePlugin
}
