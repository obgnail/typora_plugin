"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Quoted = void 0;
const delimited_1 = require("./delimited");
class Quoted extends delimited_1.Delimited {
    constructor(children) {
        super('"', '"');
        this.kind = 2048 /* Quoted */;
        this.children = children;
    }
}
exports.Quoted = Quoted;