"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InlineCode = void 0;
class InlineCode {
    constructor(code, delimiter) {
        this.children = [];
        this.kind = 65536 /* InlineCode */;
        this.delimiter = delimiter;
        this.code = code;
    }
    toMarkdown() {
        return this.delimiter + this.code + this.delimiter;
    }
}
exports.InlineCode = InlineCode;