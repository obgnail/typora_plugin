/**
 * This plugin does not handle CJK symbol under fences.
 * If needed, you can listen to the `afterAddCodeBlock` event and modify `File.editor.fences.queue.n1.state.keyMaps[1]`.
 * You can refer to the `fence_enhance` plugin's editorHotkey for more details.
 */
class CJKSymbolPairingPlugin extends BasePlugin {
    // Older versions of Typora delay setting noPairingMatch.
    // Therefore, to maintain compatibility with older versions, this configuration will be checked again later.
    beforeProcess = () => File.option.noPairingMatch ? this.utils.stopLoadPluginError : undefined

    init = () => {
        const toMap = (symbols, predicate = s => [s.input, s.output]) => new Map(symbols.filter(s => s.enable === true).map(predicate))

        this.rangyText = ""
        this.codeSet = new Set([
            "Digit1", "Digit2", "Digit3", "Digit4", "Digit5", "Digit6", "Digit7", "Digit8", "Digit9", "Digit0",
            "Backquote", "BracketLeft", "BracketRight", "Backslash", "Semicolon", "Quote", "Comma", "Period", "Slash",
        ])
        this.convertMap = toMap(this.config.AUTO_CONVERT_SYMBOLS)
        this.pairMap = toMap(this.config.AUTO_PAIR_SYMBOLS)
        this.reversePairMap = toMap(this.config.AUTO_PAIR_SYMBOLS, s => [s.output, s.input])

        const until = () => File?.editor?.undo?.UndoManager?.SnapFlag
        const after = () => this.UNDO_SNAP_TYPE = File.editor.undo.UndoManager.SnapFlag
        this.utils.pollUntil(until, after)
    }

    process = () => {
        this.utils.entities.eWrite.addEventListener("input", this.utils.throttle(ev => {
            if (File.option.noPairingMatch || document.activeElement.tagName === "TEXTAREA") return

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
                if (File.option.noPairingMatch || document.activeElement.tagName === "TEXTAREA") return

                if (this.config.AUTO_SURROUND_PAIR && this.utils.isIMEActivated(ev) && this.codeSet.has(ev.code)) {
                    this.rangyText = this.utils.getRangyText()
                }
                if (this.config.AUTO_DELETE_PAIR && ev.key === "Backspace" && !ev.shiftKey && !ev.altKey && !this.utils.metaKeyPressed(ev)) {
                    this.deletePair()
                }
            }, true)
        }
    }

    _selectRange = () => {
        if (this.rangyText) {
            const { range, bookmark } = this.utils.getRangy()
            bookmark.end += this.rangyText.length
            range.moveToBookmark(bookmark)
            range.select()
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
        const { node, bookmark } = this.utils.getRangy()
        if (!node) return {}

        File.editor.undo.endSnap()
        File.editor.undo.addSnap(node.cid, this.UNDO_SNAP_TYPE.NONE)
        const ele = File.editor.findElemById(node.cid)
        if (ele.hasClass("md-fences")) return {}

        const rawText = ele.rawText()
        return { rawText, bookmark }
    }

    skipSymbol = inputSymbol => {
        const { rawText, bookmark } = this._getRange()
        if (!rawText || !bookmark) return
        if (inputSymbol === rawText.substring(bookmark.start, bookmark.start + 1)) {
            bookmark.end += 1
            this.deleteContent(bookmark)
        }
    }

    convertSymbol = (inputSymbol, offset = 0, forceStay = false) => {
        const { rawText, bookmark } = this._getRange()
        if (!rawText || !bookmark) return

        if (offset) {
            bookmark.start += offset
            bookmark.end += offset
        }

        const current = rawText[bookmark.start - 1]
        const left = rawText[bookmark.start - 2]
        const right = rawText[bookmark.end]

        if (left && left === current) {
            bookmark.start -= 2
            this._convertSymbol(inputSymbol, bookmark, forceStay)
        } else if (right && right === current) {
            bookmark.start -= 1
            bookmark.end += 1
            this._convertSymbol(inputSymbol, bookmark, forceStay)
        }
    }

    _convertSymbol = async (inputSymbol, bk, forceStay) => {
        await this.utils.sleep(50)
        this.deleteContent(bk)
        this._insertText(this.convertMap.get(inputSymbol))

        await this.utils.sleep(50)
        const { range, bookmark } = this.utils.getRangy()
        const need = (bookmark.start === bookmark.end && bookmark.start !== 1) && !forceStay
        if (need) {
            bookmark.start += 1
            bookmark.end += 1
        }
        range.moveToBookmark(bookmark)
        range.select()

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
                bookmark.end += 1
                this.deleteContent(bookmark)
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
    plugin: CJKSymbolPairingPlugin
}
