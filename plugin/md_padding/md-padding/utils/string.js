"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.matchSubstring = void 0;
function matchSubstring(code, begin, pattern) {
    return code.substr(begin, pattern.length) === pattern;
}
exports.matchSubstring = matchSubstring;