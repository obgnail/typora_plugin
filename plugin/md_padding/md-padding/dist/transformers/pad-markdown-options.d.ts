export interface PadMarkdownOptions {
    ignoreWords?: string[];
}
export interface NormalizedPadMarkdownOptions {
    ignoreWords: Set<string>;
}
export declare function normalize(options?: PadMarkdownOptions): NormalizedPadMarkdownOptions;
