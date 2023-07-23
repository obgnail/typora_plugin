"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isStartCharacter = exports.isEndCharacter = exports.isWordBoundary = exports.isAlphabet = exports.isBlank = exports.isFullwidthPunctuation = exports.isNumeric = exports.isPunctuationCharacter = void 0;
// * General Punctuation: https://en.wikipedia.org/wiki/General_Punctuation
// * Supplemental Punctuation: https://en.wikipedia.org/wiki/Supplemental_Punctuation
// * ASCII Punctuations
const rPunctuation = /^[\u2000-\u206F\u2E00-\u2E7F\\'!"#$%&()*+,\-./:;<=>?@[\]^_`{|}~]$/;
// These Punctuations generally should not be padded,
// and not neccessarily included by rPunctuation
// Unfortunately it's not well defined in Unicode,
// see https://en.wikipedia.org/wiki/Chinese_punctuation for reference
const rFullwidthPunctuation = /^[、，：。？！；：【】（）「」﹁﹂『』《》〈〉“”‘’﹏…—～‧]$/;
function isPunctuationCharacter(char) {
    if (typeof char !== 'string')
        return false;
    if (rPunctuation.exec(char))
        return true;
    if (isFullwidthPunctuation(char))
        return true;
    return false;
}
exports.isPunctuationCharacter = isPunctuationCharacter;
function isNumeric(char) {
    return char >= '0' && char <= '9';
}
exports.isNumeric = isNumeric;
function isFullwidthPunctuation(char) {
    return !!rFullwidthPunctuation.exec(char);
}
exports.isFullwidthPunctuation = isFullwidthPunctuation;
function isBlank(char) {
    // full list see https://en.wikipedia.org/wiki/Whitespace_character#cite_note-11
    return !!/^\s$/.exec(char);
}
exports.isBlank = isBlank;
function isAlphabet(char) {
    return (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z');
}
exports.isAlphabet = isAlphabet;
function isWordBoundary(char) {
    return char === undefined || isBlank(char) || isPunctuationCharacter(char);
}
exports.isWordBoundary = isWordBoundary;
function isEndCharacter(char) {
    // single quote may not be end character: `what's this`
    // dot may not be end character: `harttle.land`
    return ',;:"!'.includes(char);
}
exports.isEndCharacter = isEndCharacter;
function isStartCharacter(char) {
    // single quote may be not end character: `what's this`
    return '"'.includes(char);
}
exports.isStartCharacter = isStartCharacter;