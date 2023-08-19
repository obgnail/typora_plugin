"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SquareQuoted = void 0;
const delimited_1 = require("./delimited");
class SquareQuoted extends delimited_1.Delimited {
    constructor(children) {
        super('[', ']');
        this.kind = 4096 /* SquareQuoted */;
        this.children = children;
    }
}
exports.SquareQuoted = SquareQuoted;