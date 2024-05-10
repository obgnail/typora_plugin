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
        if (needPadding(tokens[i - 1], tokens[i], tokens[i - 2], tokens[i + 1])) {
            padded.push(new blank_1.Blank(' '));
        }
        padded.push(tokens[i]);
    }
    return padded;
}
exports.padBetweenNodes = padBetweenNodes;
function needPadding(lhs, rhs, prev, next) {
    if ((0, type_guards_1.isBlank)(lhs) || (0, type_guards_1.isBlank)(rhs))
        return false;
    if ((0, type_guards_1.isRaw)(lhs) || (0, type_guards_1.isRaw)(rhs))
        return false;
    if ((0, type_guards_1.isDocument)(lhs) || (0, type_guards_1.isDocument)(rhs))
        return false;
    if ((0, type_guards_1.isPunctuation)(lhs))
        return lhs.needPaddingAfter(rhs, prev);
    if ((0, type_guards_1.isPunctuation)(rhs))
        return rhs.needPaddingBefore(lhs, next);
    if ((0, type_guards_1.isCJK)(lhs))
        return !(0, type_guards_1.isCJK)(rhs);
    if ((0, type_guards_1.isLatin)(lhs))
        return !(0, type_guards_1.isLatin)(rhs);
    // By default, add space between different constructs
    return true;
}