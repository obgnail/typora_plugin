"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalize = void 0;
function normalize(options = {}) {
    return {
        ignoreWords: new Set(options.ignoreWords)
    };
}
exports.normalize = normalize;