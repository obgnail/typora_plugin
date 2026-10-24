/**
 * This plugin does not handle CJK symbol under fences.
 * If needed, you can listen to the `afterAddCodeBlock` event and modify `File.editor.fences.queue.n1.state.keyMaps[1]`.
 * You can refer to the `fence_enhance` plugin's editorHotkey for more details.
 */
class CJKSymbolPairingPlugin extends BasePlugin {
  rangyText = ""
  CODES = new Set([
    "Digit1", "Digit2", "Digit3", "Digit4", "Digit5", "Digit6", "Digit7", "Digit8", "Digit9", "Digit0",
    "Backquote", "BracketLeft", "BracketRight", "Backslash", "Semicolon", "Quote", "Comma", "Period", "Slash",
  ])

  prepare = async () => {
    try {
      this.UNDO_SNAP_TYPE = await this.utils.waitUntil(() => File?.editor?.undo?.UndoManager?.SnapFlag)
    } catch (e) {
      return this.utils.PLUGIN_LOAD_ABORT
    }
  }

  init = () => {
    const toMap = (symbols, predicate = s => [s.input, s.output]) => new Map(symbols.filter(s => s.enable === true).map(predicate))
    this.convertMap = toMap(this.config.AUTO_CONVERT_SYMBOLS)
    this.pairMap = toMap(this.config.AUTO_PAIR_SYMBOLS)
    this.reversePairMap = toMap(this.config.AUTO_PAIR_SYMBOLS, s => [s.output, s.input])
  }

  process = () => {
    this.utils.entities.eWrite.addEventListener("input", this.utils.throttle(ev => {
      if (document.activeElement.tagName === "TEXTAREA") return

      const inputSymbol = ev.data
      const pairSymbol = this.pairMap.get(inputSymbol)
      if (pairSymbol) {
        this._insertText(this.rangyText + pairSymbol)
        setTimeout(this._selectRange, 50)
      } else if (this.config.AUTO_SKIP_PAIR && this.reversePairMap.get(inputSymbol)) {
        this.skipSymbol(inputSymbol)
      }
      if (this.config.AUTO_CONVERT_FULL_TO_HALF && this.convertMap.has(inputSymbol)) {
        this.convertSymbol(inputSymbol)
      }
    }, 30))

    if (this.config.AUTO_DELETE_PAIR || this.config.AUTO_SURROUND_PAIR) {
      this.utils.entities.eWrite.addEventListener("keydown", ev => {
        if (document.activeElement.tagName === "TEXTAREA") return

        if (this.config.AUTO_SURROUND_PAIR && this.utils.isIMEActivated(ev) && this.CODES.has(ev.code)) {
          this.rangyText = this.utils.getRangy()?.text ?? ""
        }
        if (this.config.AUTO_DELETE_PAIR && ev.key === "Backspace" && !ev.shiftKey && !ev.altKey && !this.utils.metaKeyPressed(ev)) {
          this.deletePair()
        }
      }, true)
    }
  }

  _selectRange = () => {
    if (this.rangyText) {
      const cursor = this.utils.getRangy()
      cursor.select({ ...cursor.bookmark, end: cursor.bookmark.end + this.rangyText.length })
    }
    this.rangyText = ""
  }

  _insertText = text => {
    const { range, node } = this.utils.getRangy()
    const textNode = document.createTextNode(text)
    range.insertNode(textNode)
    File.editor.undo.addSnap(node.cid, this.UNDO_SNAP_TYPE.REPLACE)
  }

  _getRange = () => {
    const cursor = this.utils.getRangy()
    if (!cursor?.node) return {}

    File.editor.undo.endSnap()
    File.editor.undo.addSnap(cursor.node.cid, this.UNDO_SNAP_TYPE.NONE)
    const el = File.editor.findElemById(cursor.node.cid)
    return el.hasClass("md-fences") ? {} : { rawText: el.rawText(), bookmark: cursor.bookmark }
  }

  skipSymbol = inputSymbol => {
    const { rawText, bookmark } = this._getRange()
    if (!rawText || !bookmark) return
    if (inputSymbol === rawText.substring(bookmark.start, bookmark.start + 1)) {
      this.deleteContent({ ...bookmark, end: bookmark.end + 1 })
    }
  }

  convertSymbol = (inputSymbol, offset = 0, forceStay = false) => {
    const { rawText, bookmark } = this._getRange()
    if (!rawText || !bookmark) return

    const shifted = offset ? { ...bookmark, start: bookmark.start + offset, end: bookmark.end + offset } : bookmark
    const current = rawText[shifted.start - 1]
    const left = rawText[shifted.start - 2]
    const right = rawText[shifted.end]

    if (left && left === current) {
      this._convertSymbol(inputSymbol, { ...shifted, start: shifted.start - 2 }, forceStay)
    } else if (right && right === current) {
      this._convertSymbol(inputSymbol, { ...shifted, start: shifted.start - 1, end: shifted.end + 1 }, forceStay)
    }
  }

  _convertSymbol = async (inputSymbol, bk, forceStay) => {
    await this.utils.sleep(50)
    this.deleteContent(bk)
    this._insertText(this.convertMap.get(inputSymbol))

    await this.utils.sleep(50)
    const cursor = this.utils.getRangy()
    const { start, end } = cursor.bookmark
    const need = (start === end && start !== 1) && !forceStay
    cursor.select(need ? { ...cursor.bookmark, start: start + 1, end: end + 1 } : cursor.bookmark)

    await this.utils.sleep(50)
    const pair = this.pairMap.get(inputSymbol)
    if (pair) {
      this.convertSymbol(pair, 1, true)
    }
  }

  deletePair = () => {
    const { rawText, bookmark } = this._getRange()
    if (!rawText || !bookmark) return
    const pair = rawText.substring(bookmark.start - 1, bookmark.start + 1)
    if (pair.length === 2) {
      const [left, right] = pair
      if (this.reversePairMap.get(right) === left && this.pairMap.get(left) === right) {
        this.deleteContent({ ...bookmark, end: bookmark.end + 1 })
      }
    }
  }

  deleteContent = bookmark => {
    const range = File.editor.selection.rangy.createRange()
    range.moveToBookmark(bookmark)
    range.deleteContents()
  }
}

module.exports = {
  plugin: CJKSymbolPairingPlugin,
}
