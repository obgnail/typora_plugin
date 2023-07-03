export declare class Stack<T> {
    private data;
    pop(): T | undefined;
    top(): T;
    [Symbol.iterator](): IterableIterator<T>;
    size(): number;
    push(item: T): void;
}
