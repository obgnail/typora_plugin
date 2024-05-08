"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Punctuation = void 0;
const char_1 = require("../utils/char");
const type_guards_1 = require("./type-guards");
class Punctuation {
    constructor(char, raw) {
        this.children = [];
        this.kind = 2 /* Punctuation */;
        this.char = char;
        this.raw = raw !== null && raw !== void 0 ? raw : char;
    }
    needPaddingAfter(next, prev) {
        if (this.isFullSize())
            return false;
        if ((0, type_guards_1.isPunctuation)(next))
            return false;
        if ((0, type_guards_1.isAlphabetNumeric)(next) && (0, char_1.isNumeric)(next.text[0]) && ',.'.includes(this.char))
            return false;
        if (this.char === ':') {
            if ((0, type_guards_1.isAlphabetNumeric)(next) && (0, char_1.isNumeric)(next.text[0]) &&
                prev &&
                (0, type_guards_1.isAlphabetNumeric)(prev) && (0, char_1.isNumeric)(prev.text[prev.text.length - 1])) {
                return false;
            }
        }
        if ((0, char_1.isEndCharacter)(this.char))
            return true;
        if ((0, char_1.isStartCharacter)(this.char))
            return false;
        if ('<>='.includes(this.char))
            return true;
        return false;
    }
    needPaddingBefore(prev, _next) {
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
        return this.raw;
    }
    // create a flyweight punctuation
    static create(char, raw = char) {
        if (!Punctuation.cache.has(raw)) {
            Punctuation.cache.set(raw, new Punctuation(char, raw));
        }
        return Punctuation.cache.get(raw);
    }
    static is(char) {
        return (0, char_1.isPunctuationCharacter)(char);
    }
}
exports.Punctuation = Punctuation;
Punctuation.cache = new Map();