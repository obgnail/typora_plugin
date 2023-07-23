"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReferenceImage = void 0;
class ReferenceImage {
    constructor(children, target, attributes) {
        this.children = children;
        this.target = target;
        this.attributes = attributes;
        this.kind = 524288 /* ReferenceImage */;
    }
    text() {
        return this.children.map(x => x.toMarkdown()).join('');
    }
    toMarkdown() {
        const attr = this.attributes === undefined ? '' : `{${this.attributes}}`;
        return `![${this.text()}][${this.target}]${attr}`;
    }
}
exports.ReferenceImage = ReferenceImage;