"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Strong = void 0;
const delimited_1 = require("./delimited");
class Strong extends delimited_1.Delimited {
    constructor(children, separator) {
        super(separator, separator);
        this.children = [];
        this.kind = 16384 /* Strong */;
        this.children = children;
        this.separator = separator;
    }
}
exports.Strong = Strong;