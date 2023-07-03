import { NodeKind } from './node-kind';
import { Node } from './node';
export declare class HTMLTag implements Node {
    readonly children: Node[];
    readonly text: string;
    readonly kind: NodeKind;
    constructor(text: string);
    toMarkdown(): string;
}
