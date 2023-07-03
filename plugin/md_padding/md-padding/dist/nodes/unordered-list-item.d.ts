import { NodeKind } from './node-kind';
import { Node } from './node';
export declare class UnorderedListItem implements Node {
    readonly children: Node[];
    readonly prefix: string;
    readonly kind: NodeKind;
    constructor(prefix: string, children: Node[]);
    toMarkdown(): string;
    static isValidPrefix(str: string): boolean;
}
