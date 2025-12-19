class SidebarEnhancePlugin extends BasePlugin {
    styleTemplate = () => !!this.config.SORTABLE_OUTLINE

    process = () => {
        if (this.config.DISPLAY_NON_MARKDOWN_FILES && File.SupportedFiles) {
            this._displayNonMarkdownFiles()
            if (this.config.CUSTOMIZE_SIDEBAR_ICONS) {
                this._customizeSidebarIcons()
            }
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
        const displayExt = new Set([...this.config.OPEN_BY_SYSTEM_EXT, ...this.config.OPEN_BY_TYPORA_EXT])
        const openBySystemExt = new Set(this.config.OPEN_BY_SYSTEM_EXT.filter(ext => !this.config.OPEN_BY_TYPORA_EXT.includes(ext)).map(ext => `.${ext}`))

        File.SupportedFiles.push(...displayExt)

        // Delay decoration to ensure this beforeFn runs first, this beforeFn may return a stopCallError
        this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.allPluginsHadInjected, () => {
            this.utils.decorate(() => File?.editor?.library, "openFile", (toOpenFile) => {
                const ext = this.utils.Package.Path.extname(toOpenFile)
                if (openBySystemExt.has(ext)) {
                    this.utils.openPath(toOpenFile)
                    return this.utils.stopCallError
                }
            })
        })
    }

    _customizeSidebarIcons = () => {
        const ICONS = new Map(
            this.config.SIDEBAR_ICONS
                .filter(item => item.enable && item.extensions.length && item.extensions.every(ext => !!ext))
                .flatMap(item => item.extensions.map(ext => [`.${ext.trim()}`, item.icon.trim()]))
        )
        this.utils.decorate(() => File?.editor?.library?.fileTree, "renderNode", null, ($node, info) => {
            if (!info.isFile) return
            const ext = this.utils.Package.Path.extname(info.name)
            const icon = ICONS.get(ext)
            if (icon) {
                $node.find(".file-node-icon").removeClass("fa fa-file-text-o").addClass(icon)
            }
        })
        this.utils.eventHub.once(this.utils.eventHub.eventType.fileOpened, () => File.editor.library.refreshPanelCommand())
    }

    _keepOutlineFoldState = () => {
        const [arm, fire] = this.utils.oneShot()
        const hasOpenClass = "outline-item-open"
        const singleItemClass = this.utils.isBetaVersion ? "outline-item-signle" : "outline-item-single"  // `signle` is Typora's typo
        this.utils.stateRecorder.register({
            name: this.fixedName,
            selector: `#outline-content .outline-item-wrapper:not(.${singleItemClass})`,
            stateGetter: el => el.classList.contains(hasOpenClass),
            stateRestorer: (el, isOpen) => isOpen && el.classList.add(hasOpenClass),
            delayFn: (task) => arm(task),
        })
        this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.outlineUpdated, fire)
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
