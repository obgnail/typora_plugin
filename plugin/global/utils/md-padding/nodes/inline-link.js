"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InlineLink = void 0;
class InlineLink {
    constructor(children, target) {
        this.children = [];
        this.kind = 512 /* InlineLink */;
        this.children = children;
        this.target = target;
    }
    text() {
        return this.children.map(x => x.toMarkdown()).join('');
    }
    toMarkdown() {
        return `[${this.text()}](${this.target})`;
    }
}
exports.InlineLink = InlineLink;