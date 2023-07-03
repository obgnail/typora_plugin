import { NodeKind } from './node-kind';
import { Node } from './node';
export declare class ReferenceImage implements Node {
    readonly children: Node[];
    readonly target: string;
    readonly attributes?: string | undefined;
    readonly kind: NodeKind;
    constructor(children: Node[], target: string, attributes?: string | undefined);
    text(): string;
    toMarkdown(): string;
}
