"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Math = void 0;
class Math {
    constructor(code, delimiter) {
        this.children = [];
        this.kind = 2097152 /* Math */;
        this.delimiter = delimiter;
        this.code = code;
    }
    toMarkdown() {
        return this.delimiter + this.code + this.delimiter;
    }
}
exports.Math = Math;