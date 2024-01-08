"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlockquoteItem = void 0;
class BlockquoteItem {
    constructor(prefix, children) {
        this.children = [];
        this.kind = 4194304 /* BlockquoteItem */;
        this.prefix = prefix;
        this.children = children;
    }
    toMarkdown() {
        return this.prefix + this.children.map(x => x.toMarkdown()).join('');
    }
    static isValidPrefix(str) {
        return str[0] === '>';
    }
}
exports.BlockquoteItem = BlockquoteItem;
