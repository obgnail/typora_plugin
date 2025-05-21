class sortableOutlinePlugin extends BaseCustomPlugin {
    process = () => {
        const that = this
        const outline = document.querySelector("#outline-content")

        this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.outlineUpdated, () => {
            outline.querySelectorAll(".outline-item").forEach(e => e.draggable = true)
        })

        const getCid = item => item.querySelector(":scope > .outline-label").dataset.ref
        $(outline).on("dragstart", ".outline-item", function (ev) {
            const { dataTransfer } = ev.originalEvent
            dataTransfer.setData("text/plain", getCid(this))
            dataTransfer.effectAllowed = "move"
            dataTransfer.dropEffect = "move"
        }).on("dragover", ".outline-item", function () {
            return false
        }).on("dragenter", ".outline-item", function () {
            return false
        }).on("drop", ".outline-item", async function (ev) {
            const dragCid = ev.originalEvent.dataTransfer.getData("text/plain")
            const dropCid = getCid(this)
            if (!dragCid || !dropCid) return

            await that.utils.editCurrentFile(content => {
                const tokens = that.utils.parseMarkdownBlock(content).filter(token => token.type === "heading_open")
                const drag = that._getHeader(dragCid, tokens)
                const drop = that._getHeader(dropCid, tokens)
                const isValid = that._checkHeaders(drag, drop)
                return isValid
                    ? that._moveSections(content.split("\n"), drag, drop).join("\n")
                    : content
            })
        })
    }

    _checkHeaders = (drag, drop) => (
        drop
        && drop
        // Drop section cannot be included in drag section
        && !(drag.section[0] <= drop.section[0] && drag.section[1] <= drop.section[1])
    )

    // TODO: Need smarter move sections algorithms.
    _moveSections = (lines, dragHeader, dropHeader) => {
        const clamp = idx => Math.max(0, Math.min(idx, lines.length - 1))
        const { depth: d1, header: h1, section: section1 } = dragHeader
        const { depth: d2, header: h2, section: section2 } = dropHeader
        const [s1, e1] = section1.map(e => clamp(e))
        const [s2, e2] = section2.map(e => clamp(e))
        const length = e1 - s1

        if (d1 === d2) {
            const removed = lines.splice(s1, length)
            const idx = s1 < s2 ? e2 - length : e2
            lines.splice(idx, 0, ...removed)
        } else if (d1 > d2) {
            // TODO
        } else {
            // TODO
        }

        return lines
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
        const section = [startLine, endLine]

        return { depth, section, header }
    }
}

module.exports = {
    plugin: sortableOutlinePlugin
}
