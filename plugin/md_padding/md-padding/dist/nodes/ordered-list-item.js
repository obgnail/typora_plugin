"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderedListItem = void 0;
const char_1 = require("../utils/char");
class OrderedListItem {
    constructor(prefix, children) {
        this.children = [];
        this.kind = 1024 /* OrderedListItem */;
        this.prefix = prefix;
        this.children = children;
    }
    toMarkdown() {
        return this.prefix + this.children.map(x => x.toMarkdown()).join('');
    }
    static isValidPrefix(str) {
        return (0, char_1.isNumeric)(str[0]) && str[1] === '.' && str[2] === '';
    }
}
exports.OrderedListItem = OrderedListItem;