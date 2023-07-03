import { NodeKind } from './node-kind';
import { Node } from './node';
export declare class Document implements Node {
    readonly children: Node[];
    readonly kind: NodeKind;
    readonly isDoc = true;
    constructor(children: Node[]);
    toMarkdown(): string;
}
