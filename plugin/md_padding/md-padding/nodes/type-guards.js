"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isBlockCode = exports.isReferenceLink = exports.isInlineCode = exports.isMath = exports.isLatin = exports.isUnicodeString = exports.isRaw = exports.isBlank = exports.isQuoted = exports.isPunctuation = exports.isCJK = exports.isAlphabetNumeric = exports.isDocument = void 0;
function isDocument(node) {
    return node.kind === 32 /* Document */;
}
exports.isDocument = isDocument;
function isAlphabetNumeric(node) {
    return node.kind === 4 /* AlphabetNumeric */;
}
exports.isAlphabetNumeric = isAlphabetNumeric;
function isCJK(node) {
    return node.kind === 33554432 /* CJK */;
}
exports.isCJK = isCJK;
function isPunctuation(node) {
    return node.kind === 2 /* Punctuation */;
}
exports.isPunctuation = isPunctuation;
function isQuoted(node) {
    return node.kind === 2048 /* Quoted */;
}
exports.isQuoted = isQuoted;
function isBlank(node) {
    return node.kind === 1 /* Blank */;
}
exports.isBlank = isBlank;
function isRaw(node) {
    return node.kind === 1048576 /* Raw */;
}
exports.isRaw = isRaw;
function isUnicodeString(node) {
    return node.kind === 8 /* UnicodeString */;
}
exports.isUnicodeString = isUnicodeString;
function isLatin(node) {
    return isUnicodeString(node) || isAlphabetNumeric(node);
}
exports.isLatin = isLatin;
function isMath(node) {
    return node.kind === 2097152 /* Math */;
}
exports.isMath = isMath;
function isInlineCode(node) {
    return node.kind === 65536 /* InlineCode */;
}
exports.isInlineCode = isInlineCode;
function isReferenceLink(node) {
    return node.kind === 128 /* ReferenceLink */;
}
exports.isReferenceLink = isReferenceLink;
function isBlockCode(node) {
    return node.kind === 16 /* BlockCode */;
}
exports.isBlockCode = isBlockCode;