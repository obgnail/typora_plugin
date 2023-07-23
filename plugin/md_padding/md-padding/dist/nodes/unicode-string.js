"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnicodeString = void 0;
class UnicodeString {
    constructor(str) {
        this.children = [];
        this.kind = 8 /* UnicodeString */;
        this.text = str;
    }
    toMarkdown() {
        return this.text;
    }
    static is(str) {
        if (typeof str !== 'string')
            return false;
        for (let i = 0; i < str.length; i++) {
            if (str.charCodeAt(i) < 256)
                return false;
        }
        return true;
    }
}
exports.UnicodeString = UnicodeString;