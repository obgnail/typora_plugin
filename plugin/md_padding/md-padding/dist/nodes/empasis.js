"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Emphasis = void 0;
const delimited_1 = require("./delimited");
class Emphasis extends delimited_1.Delimited {
    constructor(children, separator = '*') {
        super(separator, separator);
        this.children = [];
        this.kind = 32768 /* Emphasis */;
        this.children = children;
        this.separator = separator;
    }
}
exports.Emphasis = Emphasis;