"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.padBetweenNodes = void 0;
const blank_1 = require("../nodes/blank");
const type_guards_1 = require("../nodes/type-guards");
function padBetweenNodes(tokens) {
    if (tokens.length < 2)
        return tokens;
    const padded = [tokens[0]];
    for (let i = 1; i < tokens.length; i++) {
        if (needPadding(tokens[i - 1], tokens[i])) {
            padded.push(new blank_1.Blank(' '));
        }
        padded.push(tokens[i]);
    }
    return padded;
}
exports.padBetweenNodes = padBetweenNodes;
function needPadding(lhs, rhs) {
    if ((0, type_guards_1.isBlank)(lhs) || (0, type_guards_1.isBlank)(rhs))
        return false;
    if ((0, type_guards_1.isRaw)(lhs) || (0, type_guards_1.isRaw)(rhs))
        return false;
    if ((0, type_guards_1.isDocument)(lhs) || (0, type_guards_1.isDocument)(rhs))
        return false;
    if ((0, type_guards_1.isPunctuation)(lhs))
        return lhs.needPaddingAfter(rhs);
    if ((0, type_guards_1.isPunctuation)(rhs))
        return rhs.needPaddingBefore(lhs);
    if ((0, type_guards_1.isAlphabetNumeric)(lhs))
        return !(0, type_guards_1.isAlphabetNumeric)(rhs);
    if ((0, type_guards_1.isUnicodeString)(lhs))
        return !(0, type_guards_1.isUnicodeString)(rhs);
    return true;
}