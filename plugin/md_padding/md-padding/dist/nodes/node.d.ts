import { NodeKind } from './node-kind';
export interface Node {
    kind: NodeKind;
    children: Node[];
    toMarkdown(): string;
}
