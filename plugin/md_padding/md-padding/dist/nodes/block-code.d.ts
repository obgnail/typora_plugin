import { NodeKind } from './node-kind';
import { Node } from './node';
export declare type BlockCodeDelimiter = '---' | '```';
export declare class BlockCode implements Node {
    readonly children: Node[];
    readonly lang: string;
    readonly kind: NodeKind;
    readonly closed: boolean;
    readonly langClosed: boolean;
    readonly delimiter: BlockCodeDelimiter;
    constructor(lang: string, delimiter: BlockCodeDelimiter, children: Node[], closed?: boolean, langClosed?: boolean);
    getCode(): string;
    toMarkdown(): string;
}
