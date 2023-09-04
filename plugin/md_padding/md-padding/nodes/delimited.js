"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Delimited = void 0;
class Delimited {
    constructor(prefix, postfix) {
        this.children = [];
        this.prefix = prefix;
        this.postfix = postfix;
    }
    text() {
        return this.children.map(c => c.toMarkdown()).join('');
    }
    toMarkdown() {
        return this.prefix + this.text() + this.postfix;
    }
}
exports.Delimited = Delimited;