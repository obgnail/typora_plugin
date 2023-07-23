"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isBlockCode = exports.isReferenceLink = exports.isInlineCode = exports.isMath = exports.isUnicodeString = exports.isRaw = exports.isBlank = exports.isPunctuation = exports.isAlphabetNumeric = exports.isDocument = void 0;
function isDocument(node) {
    return node.kind === 32 /* Document */;
}
exports.isDocument = isDocument;
function isAlphabetNumeric(node) {
    return node.kind === 4 /* AlphabetNumeric */;
}
exports.isAlphabetNumeric = isAlphabetNumeric;
function isPunctuation(node) {
    return node.kind === 2 /* Punctuation */;
}
exports.isPunctuation = isPunctuation;
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