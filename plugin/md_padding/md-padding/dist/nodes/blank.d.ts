import { NodeKind } from './node-kind';
import { Node } from './node';
export declare class Blank implements Node {
    children: Node[];
    char: string;
    kind: NodeKind;
    constructor(char: string);
    toMarkdown(): string;
    static is(char: any): char is ' ' | '\t' | '\r' | '\n';
}
