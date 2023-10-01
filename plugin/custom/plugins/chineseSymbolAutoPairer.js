class chineseSymbolAutoPairerPlugin extends BaseCustomPlugin {
    selector = () => this.utils.disableForeverSelector

    init = () => {
        this.pairMap = new Map(this.config.auto_pair_symbols);
        this.undoSnapType = File.editor.undo.UndoManager.SnapFlag;
    }

    process = () => {
        const setPair = this.utils.throttle(ev => {
            const symbol = ev.data;
            const pairSymbol = this.pairMap.get(symbol);
            pairSymbol && this.insertText(symbol, pairSymbol);
        }, 30)

        document.querySelector("#write").addEventListener("input", setPair);
    }

    insertText = (symbol, pairSymbol) => {
        const range = File.editor.selection.getRangy();
        const node = this.utils.findActiveNode(range);

        const textNode = document.createTextNode(pairSymbol);
        range.insertNode(textNode);
        range.setStart(textNode, symbol.length);
        range.setEnd(textNode, symbol.length);
        range.select();
        File.editor.undo.addSnap(node.cid, this.undoSnapType.REPLACE);
    }
}

module.exports = {
    plugin: chineseSymbolAutoPairerPlugin
};