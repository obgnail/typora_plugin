import { NodeKind } from './node-kind';
import { Node } from './node';
export declare class Punctuation implements Node {
    readonly children: Node[];
    readonly char: string;
    readonly kind: NodeKind;
    private static cache;
    private constructor();
    needPaddingAfter(next: Node): boolean;
    needPaddingBefore(prev: Node): boolean;
    isFullSize(): boolean;
    toMarkdown(): string;
    static create(char: string): Punctuation;
    static is(char: any): char is string;
}
