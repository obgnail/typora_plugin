"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlockCode = void 0;
class BlockCode {
    constructor(lang, delimiter, children, closed = true, langClosed = true) {
        this.children = [];
        this.kind = 16 /* BlockCode */;
        this.delimiter = delimiter;
        this.lang = lang;
        this.children = children;
        this.closed = closed;
        this.langClosed = langClosed;
    }
    getCode() {
        return this.children.map(x => x.toMarkdown()).join('');
    }
    toMarkdown() {
        return this.delimiter + this.lang +
            (this.langClosed ? '\n' : '') +
            this.getCode() +
            (this.closed ? this.delimiter : '');
    }
}
exports.BlockCode = BlockCode;