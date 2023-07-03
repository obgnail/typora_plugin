import { NodeKind } from './node-kind';
import { Delimited } from './delimited';
import { Node } from './node';
export declare type EmphasisDelimiter = '*' | '_';
export declare class Emphasis extends Delimited implements Node {
    readonly children: Node[];
    readonly separator: string;
    readonly kind: NodeKind;
    constructor(children: Node[], separator?: EmphasisDelimiter);
}
