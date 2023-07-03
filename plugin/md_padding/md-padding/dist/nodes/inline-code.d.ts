import { NodeKind } from './node-kind';
import { Node } from './node';
export declare type InlineCodeDelimiter = '`' | '``';
export declare class InlineCode implements Node {
    readonly children: Node[];
    readonly code: string;
    readonly kind: NodeKind;
    readonly delimiter: string;
    constructor(code: string, delimiter: InlineCodeDelimiter);
    toMarkdown(): string;
}
