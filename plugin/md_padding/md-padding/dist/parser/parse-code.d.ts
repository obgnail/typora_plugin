import { Document } from '../nodes/document';
import { NormalizedPadMarkdownOptions } from '../transformers/pad-markdown-options';
declare type documentParser = (content: string, options: NormalizedPadMarkdownOptions) => Document;
export declare function parseCode(code: string, lang: string, parseMarkdown: documentParser, options: NormalizedPadMarkdownOptions): any[];
export {};
