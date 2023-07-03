import { NodeKind } from './node-kind';
import { Node } from './node';
export declare type MathDelimiter = '$' | '$$';
export declare class Math implements Node {
    readonly children: Node[];
    readonly code: string;
    readonly kind: NodeKind;
    readonly delimiter: string;
    constructor(code: string, delimiter: MathDelimiter);
    toMarkdown(): string;
}
