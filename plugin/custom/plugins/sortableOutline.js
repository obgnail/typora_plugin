class sortableOutlinePlugin extends BaseCustomPlugin {
    styleTemplate = () => true

    process = () => {
        const outline = document.querySelector("#outline-content")

        const fresh = this.utils.debounce(() => outline.querySelectorAll(".outline-item").forEach(e => e.draggable = true), 200)
        this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.outlineUpdated, fresh)
        this.utils.decorate(() => File, "freshMenu", null, fresh)
        this.utils.decorate(() => File && File.editor && File.editor.library && File.editor.library.outline, "renderOutline", null, fresh)

        let dragItem
        const that = this
        const classAbove = "plugin-sortable-outline-above"
        const classBelow = "plugin-sortable-outline-below"
        const classSource = "plugin-sortable-outline-source"
        const autoSaveFile = this.config.auto_save_file
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
            .on("drop", ".outline-item", async function () {
                if (isAncestorOf(dragItem, this)) return
                const dragCid = getCid(dragItem)
                const dropCid = getCid(this)
                if (!dragCid || !dropCid) return

                await that.utils.editCurrentFile(content => {
                    const tokens = that.utils.parseMarkdownBlock(content).filter(token => token.type === "heading_open")
                    const drag = that._getHeader(dragCid, tokens)
                    const drop = that._getHeader(dropCid, tokens)
                    return (drag && drop)
                        ? that._moveSections(content.split("\n"), drag, drop).join("\n")
                        : content
                }, autoSaveFile)
            })
            .on("dragend", clearStyle)
    }

    _getHeader = (cid, tokens) => {
        const { headers = [] } = File.editor.nodeMap.toc
        const start = headers.findIndex(h => h.cid === cid)
        if (start === -1) return

        const header = headers[start]
        if (!header.attributes) return

        let end = start + 1
        const depth = header.attributes.depth
        while (end < headers.length) {
            const { attributes } = headers[end]
            const _depth = attributes && attributes.depth
            if (_depth && _depth <= depth) {
                break
            }
            end++
        }

        const startLine = tokens[start].map[0]
        const endLine = tokens.length === end ? Number.MAX_SAFE_INTEGER : tokens[end].map[0]
        return { depth, startLine, endLine }
    }

    _moveSections = (lines, drag, drop) => {
        const clampIndex = (arr, idx) => Math.max(0, Math.min(idx, arr.length - 1))
        drag.startLine = clampIndex(lines, drag.startLine)
        drag.endLine = clampIndex(lines, drag.endLine)
        drop.startLine = clampIndex(lines, drop.startLine)
        drop.endLine = clampIndex(lines, drop.endLine)

        const dragLength = drag.endLine - drag.startLine
        const removed = lines.splice(drag.startLine, dragLength)
        const isDragDown = drag.startLine < drop.startLine
        const insertIdx = isDragDown ? drop.endLine - dragLength : drop.startLine
        lines.splice(insertIdx, 0, ...removed)

        return lines
    }
}

module.exports = {
    plugin: sortableOutlinePlugin
}
