// 本插件没有处理fence下的中文输入，如果需要，可以通过监听afterAddCodeBlock事件，修改File.editor.fences.queue.n90.state.keyMaps[1]，可以参考fence_enhance插件的editorHotkey
class chineseSymbolAutoPairerPlugin extends BaseCustomPlugin {
    beforeProcess = () => {
        // 旧版本的Typora是延迟设置noPairingMatch的，导致beforeProcess失效
        // 所以，为了兼容旧版本，后续还有再次判断此配置
        if (File.option.noPairingMatch) {
            return this.utils.stopLoadPluginError
        }
    }

    selector = () => this.utils.disableForeverSelector

    init = () => {
        this.rangyText = "";
        this.pairMap = new Map(this.config.auto_pair_symbols);
        this.reversePairMap = this.reverseMap(this.pairMap);
        this.codeSet = this.getCodeSet();
        // 旧版本Typora是延迟加载SnapFlag的
        const until = () => File && File.editor && File.editor.undo && File.editor.undo.UndoManager && File.editor.undo.UndoManager.SnapFlag
        const after = () => this.undoSnapType = File.editor.undo.UndoManager.SnapFlag
        this.utils.loopDetector(until, after);
    }

    process = () => {
        const write = document.querySelector("#write");
        write.addEventListener("input", this.utils.throttle(ev => {
            if (File.option.noPairingMatch) return;

            const inputSymbol = ev.data;
            const pairSymbol = this.pairMap.get(inputSymbol);
            if (pairSymbol) {
                this.insertText(inputSymbol, this.rangyText + pairSymbol);
                setTimeout(this.selectText, 50);
            } else if (this.config.auto_skip && this.reversePairMap.get(inputSymbol)) {
                this.skipSymbol(inputSymbol);
            }
        }, 30));

        if (this.config.auto_delete_pair || this.config.auto_surround_pair) {
            write.addEventListener("keydown", ev => {
                if (File.option.noPairingMatch) return;

                if (this.config.auto_surround_pair && this.utils.chineseInputMethodActivated(ev) && this.codeSet.has(ev.code)) {
                    this.rangyText = this.utils.getRangyText();
                }
                if (this.config.auto_delete_pair && ev.key === "Backspace" && !ev.shiftKey && !ev.altKey && !this.utils.metaKeyPressed(ev)) {
                    this.deletePair();
                }
            }, true);
        }
    }

    getCodeSet = () => new Set([
        "Digit1", "Digit2", "Digit3", "Digit4", "Digit5", "Digit6", "Digit7", "Digit8", "Digit9", "Digit0",
        "Backquote", "BracketLeft", "BracketRight", "Backslash", "Semicolon", "Quote", "Comma", "Period", "Slash",
    ])

    selectText = () => {
        if (this.config.auto_select_after_surround || this.rangyText) {
            const {range, bookmark} = this.utils.getRangy();
            bookmark.end += this.rangyText.length;
            range.moveToBookmark(bookmark);
            range.select();
        }
        this.rangyText = "";
    }

    insertText = (symbol, pairSymbol) => {
        const {range, node} = this.utils.getRangy();
        const textNode = document.createTextNode(pairSymbol);
        range.insertNode(textNode);
        // range.setStart(textNode, symbol.length);
        // range.setEnd(textNode, symbol.length);
        // range.select();
        File.editor.undo.addSnap(node.cid, this.undoSnapType.REPLACE);
    }

    skipSymbol = inputSymbol => {
        const {node, bookmark} = this.utils.getRangy();

        File.editor.undo.endSnap();
        File.editor.undo.addSnap(node.cid, this.undoSnapType.NONE);
        const ele = File.editor.findElemById(node.cid);
        if (ele.hasClass("md-fences")) return;

        const rawText = ele.rawText();
        if (inputSymbol === rawText.substring(bookmark.start, bookmark.start + 1)) {
            bookmark.end += 1;
            this.deleteContent(bookmark);
        }
    }

    deletePair = () => {
        const {node, bookmark} = this.utils.getRangy();

        File.editor.undo.endSnap();
        File.editor.undo.addSnap(node.cid, this.undoSnapType.NONE);
        const ele = File.editor.findElemById(node.cid);
        if (ele.hasClass("md-fences")) return;

        const rawText = ele.rawText();
        const pair = rawText.substring(bookmark.start - 1, bookmark.start + 1);
        if (pair.length === 2) {
            const [left, right] = pair;
            if (this.reversePairMap.get(right) === left && this.pairMap.get(left) === right) {
                bookmark.end += 1;
                this.deleteContent(bookmark);
            }
        }
    }

    deleteContent = bookmark => {
        const newRange = File.editor.selection.rangy.createRange();
        newRange.moveToBookmark(bookmark);
        newRange.deleteContents();
    }

    reverseMap = map => {
        const result = new Map();
        map.forEach((v, k) => result.set(v, k));
        return result
    }
}

module.exports = {
    plugin: chineseSymbolAutoPairerPlugin
};