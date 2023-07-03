import { NodeKind } from './node-kind';
import { Node } from './node';
import { Delimited } from './delimited';
export declare type StrongDelimiter = '**' | '__';
export declare class Strong extends Delimited implements Node {
    readonly children: Node[];
    readonly separator: string;
    readonly kind: NodeKind;
    constructor(children: Node[], separator: StrongDelimiter);
}
