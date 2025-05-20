class sortableOutlinePlugin extends BaseCustomPlugin {
    process = () => {
        const that = this
        const outline = document.querySelector("#outline-content")

        this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.outlineUpdated, () => {
            outline.querySelectorAll(".outline-item").forEach(e => e.draggable = true)
        })

        let dragItem, dropItem
        const getCid = item => item.querySelector(":scope > .outline-label").dataset.ref
        $(outline).on("dragstart", ".outline-item", function (ev) {
            dragItem = this
            ev.originalEvent.dataTransfer.effectAllowed = "move"
            ev.originalEvent.dataTransfer.dropEffect = "move"
        }).on("dragend", ".outline-item", async function () {
            if (!dragItem || !dropItem) return
            await that.utils.editCurrentFile(content => {
                const tokens = that.utils.parseMarkdownBlock(content).filter(token => token.type === "heading_open")
                const dragSection = that._getSection(getCid(dragItem), tokens)
                const dropSection = that._getSection(getCid(dropItem), tokens)
                const illegal = (
                    dragSection.length === 0
                    || dropSection.length === 0
                    || (dragSection[0] <= dropSection[0] && dropSection[1] <= dragSection[1])  // dropSection cannot be included in dragSection
                )
                return illegal
                    ? content
                    : that._moveSections(content.split("\n"), dragSection, dropSection).join("\n")
            })
        }).on("dragover", ".outline-item", function () {
            dropItem = this
            return false
        }).on("dragenter", ".outline-item", function () {
            dropItem = this
            return false
        })
    }

    // TODO: Need smarter move sections algorithms.
    //   Moving at the same header level or across header levels may require different strategies.
    //   Restricting movement to only parts of the same header level may be a good solution.
    _moveSections = (arr, [s1, e1], [s2, e2]) => {
        const legalize = idx => Math.max(0, Math.min(idx, arr.length - 1))
        s1 = legalize(s1)
        s2 = legalize(s2)
        e1 = legalize(e1)
        e2 = legalize(e2)

        const len = e1 - s1
        const removed = arr.splice(s1, len)
        const idx = s1 < s2 ? s2 - len + 1 : s2
        arr.splice(idx, 0, ...removed)
        return arr
    }

    _getSection = (cid, tokens) => {
        const { headers = [] } = File.editor.nodeMap.toc
        const start = headers.findIndex(h => h.cid === cid)
        if (start === -1 || !headers[start].attributes) {
            return []
        }
        let end = start + 1
        const depth = headers[start].attributes.depth
        while (end < headers.length) {
            const header = headers[end]
            const _depth = header.attributes && header.attributes.depth
            if (_depth && _depth <= depth) {
                break
            }
            end++
        }
        const startLine = tokens[start].map[0]
        const endLine = tokens.length === end ? Number.MAX_SAFE_INTEGER : tokens[end].map[0]
        return [startLine, endLine]
    }
}

module.exports = {
    plugin: sortableOutlinePlugin
}
