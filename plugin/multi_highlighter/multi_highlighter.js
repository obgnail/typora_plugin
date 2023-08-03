const dirname = global.dirname || global.__dirname;
const filepath = reqnode('path').join(dirname, "plugin", "multi_highlighter", "highlighter.js");
const {InstantSearch} = reqnode(filepath);

class multiHighlighter {
    constructor() {
        this.highlighterList = []
    }

    _newHighlighter(root, key, caseSensitive, className) {
        return new InstantSearch(
            root, // root
            {text: key, caseSensitive: caseSensitive, className: className}, //token
            true, // scrollToResult
            className, // defaultClassName
            caseSensitive, // defaultCaseSensitive
        )
    }

    new(keyArr, root, caseSensitive, className) {
        this.highlighterList = keyArr.map((key, idx) => this._newHighlighter(root, key, caseSensitive, className + idx));
    }

    highlight() {
        this.highlighterList.forEach(highlighter => highlighter.highlight());
    }

    removeHighlight() {
        this.highlighterList.forEach(highlighter => highlighter.removeHighlight());
    }

    clear() {
        this.removeHighlight();
        this.highlighterList = [];
    }

    length() {
        return this.highlighterList.length
    }

    getList() {
        return this.highlighterList
    }

    getHighlighter(idx) {
        return this.highlighterList[idx]
    }

    getTokens() {
        return this.highlighterList.map(highlighter => highlighter.token.text)
    }
}

module.exports = {multiHighlighter};
