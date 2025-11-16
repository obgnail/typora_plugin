class SortableOutlinePlugin extends BaseCustomPlugin {
    styleTemplate = () => true

    process = () => {
        const outline = document.querySelector("#outline-content")

        const fresh = this.utils.debounce(() => outline.querySelectorAll(".outline-item").forEach(e => e.draggable = true), 200)
        this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.outlineUpdated, fresh)
        this.utils.decorate(() => File, "freshMenu", null, fresh)
        this.utils.decorate(() => File?.editor?.library?.outline, "renderOutline", null, fresh)

        let dragItem
        const that = this
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

                const drag = that._getHeader(dragCid, headers, blocks)
                const drop = that._getHeader(dropCid, headers, blocks)

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

    _getHeader = (cid, headers, blocks) => {
        const start = headers.findIndex(h => h.node.cid === cid)
        if (start === -1) return

        const header = headers[start].node
        if (!header.attributes) return

        let end = start + 1
        const depth = header.attributes.depth
        while (end < headers.length) {
            const { attributes } = headers[end].node
            const _depth = attributes && attributes.depth
            if (_depth && _depth <= depth) {
                break
            }
            end++
        }

        const startIdx = headers[start].idx
        const endIdx = headers.length === end ? blocks.length : headers[end].idx
        return { startIdx, endIdx }
    }
}

module.exports = {
    plugin: SortableOutlinePlugin
}
