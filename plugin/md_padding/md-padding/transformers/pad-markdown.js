"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.padMarkdown = void 0;
const parse_1 = require("../parser/parse");
const pad_markdown_options_1 = require("./pad-markdown-options");
const pad_recursively_1 = require("./pad-recursively");
function padMarkdown(input, options) {
    const opts = (0, pad_markdown_options_1.normalize)(options);
    const doc = (0, parse_1.parse)(input, opts);
    (0, pad_recursively_1.padRecursively)(doc);
    return doc.toMarkdown();
}
exports.padMarkdown = padMarkdown;