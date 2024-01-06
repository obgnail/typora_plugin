"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlockquoteItem = void 0;
const char_1 = require("../utils/char");
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
        return str[0] === '>' && (0, char_1.isInlineBlank)(str[1]);
    }
}
exports.BlockquoteItem = BlockquoteItem;
