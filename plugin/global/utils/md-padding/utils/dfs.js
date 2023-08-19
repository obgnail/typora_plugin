"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.preOrder = void 0;
function preOrder(root, visitor) {
    visitor(root);
    for (const child of root.children) {
        preOrder(child, visitor);
    }
}
exports.preOrder = preOrder;