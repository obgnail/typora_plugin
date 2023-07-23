"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReferenceLink = void 0;
class ReferenceLink {
    constructor(children, target) {
        this.children = [];
        this.kind = 128 /* ReferenceLink */;
        this.children = children;
        this.target = target;
    }
    text() {
        return this.children.map(x => x.toMarkdown()).join('');
    }
    toMarkdown() {
        return `[${this.text()}][${this.target}]`;
    }
}
exports.ReferenceLink = ReferenceLink;