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

            this.cursorHelper.push({
                type: cmd.type,
                id: cmd.id,
                start: cmd.start,
                pos: cmd.pos,
                timeStamp: ev.timeStamp,
            })
        })
    }

    goBack = () => {
        const cursor = this.cursorHelper.goBack()
        if (cursor) {
            this._jump(cursor)
        }
    }

    goForward = () => {
        const cursor = this.cursorHelper.goForward()
        if (cursor) {
            this._jump(cursor)
        }
    }

    _jump = (cursor) => {
        File.editor.undo.exeCommand(cursor)
        this._scroll(File.editor.findElemById(cursor.id))
    }

    _scroll = ($target, height = -1) => {
        if (height === -1) {
            height = (window.innerHeight || document.documentElement.clientHeight) / 2
        }
        if (File.isTypeWriterMode) {
            File.editor.selection.typeWriterScroll($target)
        } else {
            File.editor.selection.scrollAdjust($target, height)
        }
        if (File.isFocusMode) {
            File.editor.updateFocusMode(false)
        }
    }

    _createCursorHelper = () => {
        const maxEntries = this.config.MAX_HISTORY_ENTRIES || 100
        let history = []
        let idx = -1

        const isSame = (c1, c2) => {
            if (!c1 || !c2) {
                return false
            }
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
                if (history.length <= 0) {
                    return null
                }
                if (idx > 0) {
                    idx--
                }
                return history[idx]
            },
            goForward: () => {
                if (history.length <= 0) {
                    return null
                }
                if (idx < history.length - 1) {
                    idx++
                }
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
