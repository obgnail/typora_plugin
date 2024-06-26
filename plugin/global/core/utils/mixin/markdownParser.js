class markdownParser {
    constructor(utils) {
        this.utils = utils;
        const nodeKind = {
            Blank: 1, Punctuation: 1 << 1, AlphabetNumeric: 1 << 2, UnicodeString: 1 << 3, BlockCode: 1 << 4,
            Document: 1 << 5, HTMLTag: 1 << 6, ReferenceLink: 1 << 7, ReferenceDefinition: 1 << 8, InlineLink: 1 << 9,
            OrderedListItem: 1 << 10, Quoted: 1 << 11, SquareQuoted: 1 << 12, Strikethrough: 1 << 13, Strong: 1 << 14,
            Emphasis: 1 << 15, InlineCode: 1 << 16, UnorderedListItem: 1 << 17, InlineImage: 1 << 18,
            ReferenceImage: 1 << 19, Raw: 1 << 20, Math: 1 << 21, BlockquoteItem: 1 << 22,
            CalloutItem: 1 << 23, Highlight: 1 << 24, CJK: 1 << 25,
        }
        this.nodeKind = new Map(Object.entries(nodeKind).map(([key, value]) => [value, key]));
    }

    parse = markdown => {
        this.parser = this.parser || require("../../../../md_padding/md-padding/parser/parse");
        return this.parser.parse(markdown, {ignoreWords: []});
    }
    getNodeKindByNode = node => this.nodeKind.get(node.kind)
    getNodeKindByNum = num => this.nodeKind.get(num)
}

module.exports = {
    markdownParser
}