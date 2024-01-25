"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Highlight = void 0;
const delimited_1 = require("./delimited");
class Highlight extends delimited_1.Delimited {
    constructor(children) {
        super('==', '==');
        this.children = [];
        this.kind = 16777216 /* Highlight */;
        this.children = children;
    }
}
exports.Highlight = Highlight;
