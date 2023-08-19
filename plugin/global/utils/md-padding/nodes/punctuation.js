"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Punctuation = void 0;
const char_1 = require("../utils/char");
const type_guards_1 = require("./type-guards");
class Punctuation {
    constructor(char) {
        this.children = [];
        this.kind = 2 /* Punctuation */;
        this.char = char;
    }
    needPaddingAfter(next) {
        if (this.isFullSize())
            return false;
        if ((0, type_guards_1.isPunctuation)(next))
            return false;
        if ((0, type_guards_1.isAlphabetNumeric)(next) && (0, char_1.isNumeric)(next.text[0]) && ',.'.includes(this.char))
            return false;
        if ((0, char_1.isEndCharacter)(this.char))
            return true;
        if ((0, char_1.isStartCharacter)(this.char))
            return false;
        if ('<>='.includes(this.char))
            return true;
        return false;
    }
    needPaddingBefore(prev) {
        if (this.isFullSize())
            return false;
        if ((0, type_guards_1.isPunctuation)(prev))
            return false;
        if ((0, type_guards_1.isAlphabetNumeric)(prev) && (0, char_1.isNumeric)(prev.text.slice(-1)) && ',.'.includes(this.char))
            return false;
        if ((0, char_1.isStartCharacter)(this.char))
            return true;
        if ((0, char_1.isEndCharacter)(this.char))
            return false;
        if ('<>='.includes(this.char))
            return true;
        return false;
    }
    isFullSize() {
        return (0, char_1.isFullwidthPunctuation)(this.char);
    }
    toMarkdown() {
        return this.char;
    }
    // create a flyweight punctuation
    static create(char) {
        if (!Punctuation.cache.has(char)) {
            Punctuation.cache.set(char, new Punctuation(char));
        }
        return Punctuation.cache.get(char);
    }
    static is(char) {
        return (0, char_1.isPunctuationCharacter)(char);
    }
}
exports.Punctuation = Punctuation;
Punctuation.cache = new Map();