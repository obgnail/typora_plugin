"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReferenceDefinition = void 0;
class ReferenceDefinition {
    constructor(children, target) {
        this.children = [];
        this.kind = 256 /* ReferenceDefinition */;
        this.children = children;
        this.target = target;
    }
    text() {
        return this.children.map(x => x.toMarkdown()).join('');
    }
    toMarkdown() {
        return `[${this.text()}]:${this.target}`;
    }
}
exports.ReferenceDefinition = ReferenceDefinition;