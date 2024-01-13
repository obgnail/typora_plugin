"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Callout = void 0;
class Callout {
    constructor(text) {
        this.children = [];
        this.kind = 8388608 /* CalloutItem */;
        this.text = text;
    }
    toMarkdown() {
        return `[!${this.text}]`;
    }
}
exports.Callout = Callout;
