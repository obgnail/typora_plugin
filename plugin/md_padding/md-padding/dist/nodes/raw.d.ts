import { NodeKind } from './node-kind';
import { Node } from './node';
export declare class Raw implements Node {
    children: Node[];
    content: string;
    kind: NodeKind;
    constructor(content: string);
    toMarkdown(): string;
}
