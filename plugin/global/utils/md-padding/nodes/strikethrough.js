"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Strikethrough = void 0;
const delimited_1 = require("./delimited");
class Strikethrough extends delimited_1.Delimited {
    constructor(children) {
        super('~~', '~~');
        this.children = [];
        this.kind = 8192 /* Strikethrough */;
        this.children = children;
    }
}
exports.Strikethrough = Strikethrough;