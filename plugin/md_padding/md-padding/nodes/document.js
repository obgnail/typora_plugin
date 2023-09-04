"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Document = void 0;
class Document {
    constructor(children) {
        this.kind = 32 /* Document */;
        // serve as a differentiator for Document duck type
        this.isDoc = true;
        this.children = children;
    }
    toMarkdown() {
        return this.children.map(x => x.toMarkdown()).join('');
    }
}
exports.Document = Document;