import { NodeKind } from './node-kind';
import { Node } from './node';
export declare class AlphabetNumeric implements Node {
    readonly children: Node[];
    readonly text: string;
    readonly kind: NodeKind;
    private static cache;
    private constructor();
    toMarkdown(): string;
    static is(char: any): char is string;
    static create(char: string): AlphabetNumeric;
}
