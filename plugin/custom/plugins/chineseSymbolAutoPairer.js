// This plugin does not handle Chinese input under fences.
// If needed, you can listen to the afterAddCodeBlock event and modify File.editor.fences.queue.n90.state.keyMaps[1].
// You can refer to the fence_enhance plugin's editorHotkey for more details.
class ChineseSymbolAutoPairerPlugin extends BaseCustomPlugin {
    // Older versions of Typora delay setting noPairingMatch.
    // Therefore, to maintain compatibility with older versions, this configuration will be checked again later.
    beforeProcess = () => File.option.noPairingMatch ? this.utils.stopLoadPluginError : undefined

    selector = () => this.utils.disableForeverSelector

    init = () => {
        this.rangyText = ""

        this.swapMap = new Map(this.config.auto_swap_symbols)
        this.pairMap = new Map(this.config.auto_pair_symbols)
        this.reversePairMap = new Map(this.config.auto_pair_symbols.map(([k, v]) => [v, k]))
        this.codeSet = new Set([
            "Digit1", "Digit2", "Digit3", "Digit4", "Digit5", "Digit6", "Digit7", "Digit8", "Digit9", "Digit0",
            "Backquote", "BracketLeft", "BracketRight", "Backslash", "Semicolon", "Quote", "Comma", "Period", "Slash",
        ])

        const until = () => File?.editor?.undo?.UndoManager?.SnapFlag
        const after = () => this.undoSnapType = File.editor.undo.UndoManager.SnapFlag
        this.utils.pollUntil(until, after)
    }

    process = () => {
        this.utils.entities.eWrite.addEventListener("input", this.utils.throttle(ev => {
            if (File.option.noPairingMatch || document.activeElement.tagName === "TEXTAREA") return

            const inputSymbol = ev.data
            const pairSymbol = this.pairMap.get(inputSymbol)
            if (pairSymbol) {
                this.insertText(this.rangyText + pairSymbol)
                setTimeout(this.selectText, 50)
            } else if (this.config.auto_skip && this.reversePairMap.get(inputSymbol)) {
                this.skipSymbol(inputSymbol)
            }
            if (this.config.auto_swap && this.swapMap.has(inputSymbol)) {
                this.swapSymbol(inputSymbol)
            }
        }, 30))

        if (this.config.auto_delete_pair || this.config.auto_surround_pair) {
            this.utils.entities.eWrite.addEventListener("keydown", ev => {
                if (File.option.noPairingMatch || document.activeElement.tagName === "TEXTAREA") return

                if (this.config.auto_surround_pair && this.utils.isIMEActivated(ev) && this.codeSet.has(ev.code)) {
                    this.rangyText = this.utils.getRangyText()
                }
                if (this.config.auto_delete_pair && ev.key === "Backspace" && !ev.shiftKey && !ev.altKey && !this.utils.metaKeyPressed(ev)) {
                    this.deletePair()
                }
            }, true)
        }
    }

    selectText = () => {
        if (this.config.auto_select_after_surround || this.rangyText) {
            const { range, bookmark } = this.utils.getRangy()
            bookmark.end += this.rangyText.length
            range.moveToBookmark(bookmark)
            range.select()
        }
        this.rangyText = ""
    }

    insertText = symbol => {
        const { range, node } = this.utils.getRangy()
        const textNode = document.createTextNode(symbol)
        range.insertNode(textNode)
        File.editor.undo.addSnap(node.cid, this.undoSnapType.REPLACE)
    }

    _getRange = () => {
        const { node, bookmark } = this.utils.getRangy()
        if (!node) return {}

        File.editor.undo.endSnap()
        File.editor.undo.addSnap(node.cid, this.undoSnapType.NONE)
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

    swapSymbol = (inputSymbol, offset = 0, forceStay = false) => {
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
            this._swapSymbol(inputSymbol, bookmark, forceStay)
        } else if (right && right === current) {
            bookmark.start -= 1
            bookmark.end += 1
            this._swapSymbol(inputSymbol, bookmark, forceStay)
        }
    }

    _swapSymbol = async (inputSymbol, bk, forceStay) => {
        await this.utils.sleep(50)
        this.deleteContent(bk)
        this.insertText(this.swapMap.get(inputSymbol))

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
            this.swapSymbol(pair, 1, true)
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
    plugin: ChineseSymbolAutoPairerPlugin
}
