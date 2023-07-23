"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Raw = void 0;
class Raw {
    constructor(content) {
        this.children = [];
        this.kind = 1048576 /* Raw */;
        this.content = content;
    }
    toMarkdown() {
        return this.content;
    }
}
exports.Raw = Raw;