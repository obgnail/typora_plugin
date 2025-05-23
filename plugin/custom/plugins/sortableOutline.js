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

        return { depth, startLine, endLine, header }
    }

    _checkHeaders = (drag, drop) => (
        drag
        && drop
        && !(drag.startLine <= drop.startLine && drop.endLine <= drag.endLine)
    )

    _clampIndex = (lines, drag, drop) => {
        const clampIndex = (arr, idx) => Math.max(0, Math.min(idx, arr.length - 1))
        for (const h of [drag, drop]) {
            h.startLine = clampIndex(lines, h.startLine)
            h.endLine = clampIndex(lines, h.endLine)
        }
    }

    _moveSections = (lines, drag, drop) => {
        this._clampIndex(lines, drag, drop)

        const ahead = drag.startLine < drop.startLine
        const lineNum = drag.endLine - drag.startLine

        if (drag.depth === drop.depth) {
            const removed = lines.splice(drag.startLine, lineNum)
            const idx = ahead ? drop.endLine - lineNum : drop.endLine
            lines.splice(idx, 0, ...removed)
        } else if (drag.depth > drop.depth) {
            // TODO
        } else {
            // TODO
        }

        return lines
    }
}

module.exports = {
    plugin: sortableOutlinePlugin
}
