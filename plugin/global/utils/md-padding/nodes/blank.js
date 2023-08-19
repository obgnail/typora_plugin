"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Blank = void 0;
const char_1 = require("../utils/char");
class Blank {
    constructor(char) {
        this.children = [];
        this.kind = 1 /* Blank */;
        this.char = char;
    }
    toMarkdown() {
        return this.char;
    }
    static is(char) {
        if (typeof char !== 'string')
            return false;
        return (0, char_1.isBlank)(char);
    }
}
exports.Blank = Blank;