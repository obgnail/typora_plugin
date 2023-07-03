import { State } from './state';
import { Node } from '../nodes/node';
export interface Context {
    nodes: Node[];
    state: State;
    begin: number;
}
