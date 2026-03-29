class CursorHistoryPlugin extends BasePlugin {
    hotkey = () => [
        { hotkey: this.config.HOTKEY_GO_FORWARD, callback: this.goForward },
        { hotkey: this.config.HOTKEY_GO_BACK, callback: this.goBack },
    ]

    init = () => {
        this.cursorHelper = this._createCursorHelper()
    }

    process = () => {
        $("#write").on("cursorChange", (ev) => {
            const cmd = File.editor.selection.buildUndo()
            if (!cmd || cmd.type !== "cursor") return
            this.cursorHelper.push({ type: cmd.type, id: cmd.id, start: cmd.start, pos: cmd.pos, timeStamp: ev.timeStamp })
        })
    }

    goBack = () => this._jump(this.cursorHelper.goBack())

    goForward = () => this._jump(this.cursorHelper.goForward())

    _jump = (cursor) => {
        if (!cursor) return
        File.editor.undo.exeCommand(cursor)
        this.utils.scroll(cursor.id, { focus: false, moveCursor: false, showHiddenEls: false })
    }

    _createCursorHelper = () => {
        const maxEntries = this.config.MAX_HISTORY_ENTRIES || 100
        let history = []
        let idx = -1

        const isSame = (c1, c2) => {
            if (!c1 || !c2) return false
            const isSameID = c1.id === c2.id
            const isSameStart = c1.start && c2.start && c1.start === c2.start
            const isSamePos = c1.pos && c2.pos && c1.pos.line === c2.pos.line && c1.pos.ch === c2.pos.ch
            return isSameID && (isSameStart || isSamePos)
        }

        return {
            push: (cursor) => {
                if (history.length > 0 && isSame(cursor, history[idx])) return

                // If the current pointer is not at the end of the history record,
                // it indicates that the user has performed a "back" operation.
                // At this time, adding a new record requires removing subsequent history records
                if (idx < history.length - 1) {
                    history = history.slice(0, idx + 1)
                }
                if (history.length >= maxEntries) {
                    history = history.slice(1)
                }

                cursor = cursor.start
                    ? { id: cursor.id, type: cursor.type, start: cursor.start }
                    : { id: cursor.id, type: "fences-pos", pos: cursor.pos }

                history.push(cursor)
                idx = history.length - 1
            },
            goBack: () => {
                if (history.length <= 0) return null
                if (idx > 0) idx--
                return history[idx]
            },
            goForward: () => {
                if (history.length <= 0) return null
                if (idx < history.length - 1) idx++
                return history[idx]
            },
            get currentCursor() {
                return (history.length <= 0 || idx === -1) ? null : history[idx]
            },
            get currentIndex() {
                return idx
            },
            get history() {
                return history
            },
        }
    }
}

module.exports = {
    plugin: CursorHistoryPlugin
}
