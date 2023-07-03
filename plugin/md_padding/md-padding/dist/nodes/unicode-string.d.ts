import { NodeKind } from './node-kind';
import { Node } from './node';
export declare class UnicodeString implements Node {
    readonly children: Node[];
    readonly text: string;
    readonly kind: NodeKind;
    constructor(str: string);
    toMarkdown(): string;
    static is(str: any): str is string;
}
