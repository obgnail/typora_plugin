"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlphabetNumeric = void 0;
const char_1 = require("../utils/char");
class AlphabetNumeric {
    constructor(char) {
        this.children = [];
        this.kind = 4 /* AlphabetNumeric */;
        this.text = char;
    }
    toMarkdown() {
        return this.text;
    }
    static is(char) {
        if (typeof char !== 'string')
            return false;
        return (0, char_1.isAlphabet)(char) || (0, char_1.isNumeric)(char);
    }
    static create(char) {
        if (char.length > 1)
            return new AlphabetNumeric(char);
        // create a flyweight ascii character
        if (!AlphabetNumeric.cache.has(char)) {
            AlphabetNumeric.cache.set(char, new AlphabetNumeric(char));
        }
        return AlphabetNumeric.cache.get(char);
    }
}
exports.AlphabetNumeric = AlphabetNumeric;
AlphabetNumeric.cache = new Map();