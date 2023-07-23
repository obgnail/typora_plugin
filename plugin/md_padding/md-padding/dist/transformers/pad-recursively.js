"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.padRecursively = void 0;
const pad_between_nodes_1 = require("./pad-between-nodes");
function padRecursively(node) {
    for (const child of node.children) {
        padRecursively(child);
    }
    node.children = (0, pad_between_nodes_1.padBetweenNodes)(node.children);
}
exports.padRecursively = padRecursively;