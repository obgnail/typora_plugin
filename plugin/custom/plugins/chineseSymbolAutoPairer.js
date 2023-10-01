class chineseSymbolAutoPairerPlugin extends BaseCustomPlugin {
    selector = () => this.utils.disableForeverSelector

    init = () => {
        this.pairMap = new Map(this.config.auto_pair_symbols);
        this.reversePairMap = this.reverseMap(this.pairMap);
        // 旧版本的Typora是延迟加载的
        this.utils.loopDetector(
            () => File && File.editor && File.editor.undo && File.editor.undo.UndoManager && File.editor.undo.UndoManager.SnapFlag,
            () => this.undoSnapType = File.editor.undo.UndoManager.SnapFlag
        )
    }

    process = () => {
        const setPair = this.utils.throttle(ev => {
            const inputSymbol = ev.data;
            const pairSymbol = this.pairMap.get(inputSymbol);
            if (pairSymbol) {
                this.insertText(inputSymbol, pairSymbol);
            } else if (this.config.auto_skip && this.reversePairMap.get(inputSymbol)) {
                this.skipSymbol(inputSymbol);
            }
        }, 30)

        document.querySelector("#write").addEventListener("input", setPair);
    }

    insertText = (symbol, pairSymbol) => {
        const range = File.editor.selection.getRangy();
        const markElem = File.editor.getMarkElem(range.anchorNode);
        const node = File.editor.findNodeByElem(markElem);

        const textNode = document.createTextNode(pairSymbol);
        range.insertNode(textNode);
        // range.setStart(textNode, symbol.length);
        // range.setEnd(textNode, symbol.length);
        // range.select();
        File.editor.undo.addSnap(node.cid, this.undoSnapType.REPLACE);
    }

    skipSymbol = inputSymbol => {
        const range = File.editor.selection.getRangy();
        const markElem = File.editor.getMarkElem(range.anchorNode);
        const node = File.editor.findNodeByElem(markElem);
        const bookmark = range.getBookmark(markElem[0]);

        File.editor.undo.endSnap();
        File.editor.undo.addSnap(node.cid, this.undoSnapType.NONE);
        const rawText = File.editor.findElemById(node.cid).rawText();
        if (inputSymbol === rawText.substring(bookmark.start, bookmark.start + 1)) {
            const newRange = File.editor.selection.rangy.createRange();
            bookmark.end += 1;
            newRange.moveToBookmark(bookmark);
            newRange.deleteContents();
        }
    }

    reverseMap = map => {
        const result = new Map();
        map.forEach((value, key) => result.set(value, key));
        return result
    }
}

module.exports = {
    plugin: chineseSymbolAutoPairerPlugin
};