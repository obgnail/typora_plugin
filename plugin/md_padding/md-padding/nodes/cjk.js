"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CJK = void 0;
const char_1 = require("../utils/char");
class CJK {
    constructor(char) {
        this.children = [];
        this.kind = 33554432 /* CJK */;
        this.text = char;
    }
    toMarkdown() {
        return this.text;
    }
    static is(char) {
        if (typeof char !== 'string')
            return false;
        return (0, char_1.isCJK)(char);
    }
    static create(char) {
        if (char.length > 1)
            return new CJK(char);
        // create a flyweight ascii character
        if (!CJK.cache.has(char)) {
            CJK.cache.set(char, new CJK(char));
        }
        return CJK.cache.get(char);
    }
}
exports.CJK = CJK;
CJK.cache = new Map();
