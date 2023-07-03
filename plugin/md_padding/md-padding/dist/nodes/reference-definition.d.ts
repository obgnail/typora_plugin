import { NodeKind } from './node-kind';
import { Node } from './node';
export declare class ReferenceDefinition implements Node {
    readonly children: Node[];
    readonly target: string;
    readonly kind: NodeKind;
    constructor(children: Node[], target: string);
    text(): string;
    toMarkdown(): string;
}
