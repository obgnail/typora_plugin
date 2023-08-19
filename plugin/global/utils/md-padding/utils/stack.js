"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Stack = void 0;
class Stack {
    constructor() {
        this.data = [];
    }
    pop() {
        return this.data.pop();
    }
    top() {
        return this.data[this.size() - 1];
    }
    [Symbol.iterator]() {
        return this.data[Symbol.iterator]();
    }
    size() {
        return this.data.length;
    }
    push(item) {
        this.data.push(item);
    }
}
exports.Stack = Stack;