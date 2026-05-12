const createCursorManager = (maxEntries = 100) => {
  let history = []
  let idx = -1

  const isSame = (c1, c2) => {
    if (!c1 || !c2 || c1.id !== c2.id) return false
    const isSameStart = c1.start !== undefined && c1.start === c2.start
    const isSamePos = c1.pos?.line === c2.pos?.line && c1.pos?.ch === c2.pos?.ch
    return isSameStart || isSamePos
  }

  return {
    get history() {
      return history
    },
    get currentIndex() {
      return idx
    },
    get currentCursor() {
      return (history.length <= 0 || idx === -1) ? null : history[idx]
    },
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
  }
}

class CursorHistoryPlugin extends BasePlugin {
  cursorManager = createCursorManager(this.config.MAX_HISTORY_ENTRIES)

  hotkey = () => [
    { hotkey: this.config.HOTKEY_GO_FORWARD, callback: this.goForward },
    { hotkey: this.config.HOTKEY_GO_BACK, callback: this.goBack },
  ]

  process = () => {
    $("#write").on("cursorChange", (ev) => {
      const cmd = File.editor.selection.buildUndo()
      if (cmd?.type === "cursor") {
        this.cursorManager.push({ type: cmd.type, id: cmd.id, start: cmd.start, pos: cmd.pos, timeStamp: ev.timeStamp })
      }
    })
  }

  goBack = () => this.jump(this.cursorManager.goBack())
  goForward = () => this.jump(this.cursorManager.goForward())
  jump = (cursor) => {
    if (!cursor) return
    File.editor.undo.exeCommand(cursor)
    this.utils.scroll(cursor.id, { focus: false, moveCursor: false, showHiddenEls: false })
  }
}

module.exports = {
  plugin: CursorHistoryPlugin,
}
