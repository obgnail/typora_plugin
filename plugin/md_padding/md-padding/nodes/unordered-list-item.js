"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnorderedListItem = void 0;
class UnorderedListItem {
    constructor(prefix, children) {
        this.children = [];
        this.kind = 131072 /* UnorderedListItem */;
        this.prefix = prefix;
        this.children = children;
    }
    toMarkdown() {
        return this.prefix + this.children.map(x => x.toMarkdown()).join('');
    }
    static isValidPrefix(str) {
        return '-+*'.includes(str[0]) && str[1] === ' ';
    }
}
exports.UnorderedListItem = UnorderedListItem;