import { Node } from './node';
export declare abstract class Delimited {
    children: Node[];
    private prefix;
    private postfix;
    constructor(prefix: string, postfix: string);
    text(): string;
    toMarkdown(): string;
}
