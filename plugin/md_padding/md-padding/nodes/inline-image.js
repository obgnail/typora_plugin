"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InlineImage = void 0;
class InlineImage {
    constructor(children, target, attributes) {
        this.children = children;
        this.target = target;
        this.attributes = attributes;
        this.kind = 262144 /* InlineImage */;
    }
    text() {
        return this.children.map(x => x.toMarkdown()).join('');
    }
    toMarkdown() {
        const attr = this.attributes === undefined ? '' : `{${this.attributes}}`;
        return `![${this.text()}](${this.target})${attr}`;
    }
}
exports.InlineImage = InlineImage;