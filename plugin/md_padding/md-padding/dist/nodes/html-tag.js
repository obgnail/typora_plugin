"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HTMLTag = void 0;
class HTMLTag {
    constructor(text) {
        this.children = [];
        this.kind = 64 /* HTMLTag */;
        this.text = text;
    }
    toMarkdown() {
        return `<${this.text}>`;
    }
}
exports.HTMLTag = HTMLTag;