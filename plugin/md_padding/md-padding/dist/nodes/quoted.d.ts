import { NodeKind } from './node-kind';
import { Node } from './node';
import { Delimited } from './delimited';
export declare class Quoted extends Delimited implements Node {
    readonly kind: NodeKind;
    constructor(children: Node[]);
}
