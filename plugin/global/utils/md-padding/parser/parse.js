"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parse = void 0;
const char_1 = require("../utils/char");
const type_guards_1 = require("../nodes/type-guards");
const inline_image_1 = require("../nodes/inline-image");
const reference_image_1 = require("../nodes/reference-image");
const alphabet_numeric_1 = require("../nodes/alphabet-numeric");
const unicode_string_1 = require("../nodes/unicode-string");
const square_quoted_1 = require("../nodes/square-quoted");
const empasis_1 = require("../nodes/empasis");
const quoted_1 = require("../nodes/quoted");
const strong_1 = require("../nodes/strong");
const strikethrough_1 = require("../nodes/strikethrough");
const document_1 = require("../nodes/document");
const compact_1 = require("../transformers/compact");
const html_tag_1 = require("../nodes/html-tag");
const punctuation_1 = require("../nodes/punctuation");
const reference_link_1 = require("../nodes/reference-link");
const reference_definition_1 = require("../nodes/reference-definition");
const inline_link_1 = require("../nodes/inline-link");
const inline_code_1 = require("../nodes/inline-code");
const math_1 = require("../nodes/math");
const block_code_1 = require("../nodes/block-code");
const blank_1 = require("../nodes/blank");
const raw_1 = require("../nodes/raw");
const ordered_list_item_1 = require("../nodes/ordered-list-item");
const unordered_list_item_1 = require("../nodes/unordered-list-item");
const state_1 = require("./state");
const stack_1 = require("../utils/stack");
const mask_1 = require("./mask");
const state_masks_1 = require("./state-masks");
const parse_code_1 = require("./parse-code");
const string_1 = require("../utils/string");
function parse(str, options) {
    const stack = new stack_1.Stack();
    const mask = new mask_1.Mask();
    let i = 0;
    let blankLine = true;
    let listPrefix = '';
    let codeLang = '';
    let strongDelimiter = '**';
    let emphasisDelimiter = '*';
    let inlineCodeDelimiter = '`';
    let blockCodeDelimiter = '```';
    let mathDelimiter = '$';
    let linkText = [];
    let imageText = [];
    let imageHref;
    let imageId;
    push(state_1.State.Init);
    while (i < str.length) {
        const state = stack.top().state;
        const c = str[i];
        const c2 = str.substr(i, 2);
        const c3 = str.substr(i, 3);
        if (c === '\n') {
            while (forceCloseInlineNodes() !== false)
                ; // expand all inline nodes
        }
        // Inline Code
        if (state === state_1.State.InlineCode && (0, string_1.matchSubstring)(str, i, inlineCodeDelimiter)) {
            resolve(new inline_code_1.InlineCode(popMarkdown(), inlineCodeDelimiter));
            i += inlineCodeDelimiter.length;
        }
        // Code Blocks
        else if (state === state_1.State.BlockCodeLang && str[i] === '\n') {
            codeLang = popMarkdown();
            push(state_1.State.BlockCodeBody);
            i++;
        }
        else if (state === state_1.State.BlockCodeBody && c3 === blockCodeDelimiter) {
            resolve(new block_code_1.BlockCode(codeLang, blockCodeDelimiter, (0, parse_code_1.parseCode)(popMarkdown(), codeLang, parse, options)));
            i += 3;
        }
        // Math
        else if (state === state_1.State.Math && (0, string_1.matchSubstring)(str, i, mathDelimiter)) {
            resolve(new math_1.Math(popMarkdown(), mathDelimiter));
            i += mathDelimiter.length;
        }
        // Images
        else if (state === state_1.State.ImageAttributes && c === '}') {
            const attr = popMarkdown();
            if (imageId !== undefined) {
                resolve(new reference_image_1.ReferenceImage(imageText, imageId, attr));
                imageId = undefined;
            }
            else {
                resolve(new inline_image_1.InlineImage(imageText, imageHref, attr));
                imageHref = undefined;
            }
            i++;
        }
        else if (state === state_1.State.ImageReferingID && c === ']') {
            if (c2 === ']{') {
                imageId = popMarkdown();
                push(state_1.State.ImageAttributes);
                i += 2;
            }
            else {
                resolve(new reference_image_1.ReferenceImage(imageText, popMarkdown()));
                i++;
            }
        }
        else if (state === state_1.State.ImageReferingUrl && c === ')') {
            if (c2 === '){') {
                imageHref = popMarkdown();
                push(state_1.State.ImageAttributes);
                i += 2;
            }
            else {
                resolve(new inline_image_1.InlineImage(imageText, popMarkdown()));
                i++;
            }
        }
        else if (state === state_1.State.ImageText && c === ']') {
            imageText = popNodes();
            if (c2 === '][') {
                i += 2;
                push(state_1.State.ImageReferingID);
            }
            else if (c2 === '](') {
                i += 2;
                push(state_1.State.ImageReferingUrl);
            }
            else {
                resolve(punctuation_1.Punctuation.create('!'), new square_quoted_1.SquareQuoted(imageText));
                i++;
            }
        }
        // Links
        else if (state === state_1.State.ReferingID && c === ']') {
            resolve(new reference_link_1.ReferenceLink(linkText, popMarkdown()));
            i++;
        }
        else if (state === state_1.State.ReferingUrl && c === ')') {
            resolve(new inline_link_1.InlineLink(linkText, popMarkdown()));
            i++;
        }
        else if (state === state_1.State.ReferenceLinkUrl && c === '\n') {
            resolve(new reference_definition_1.ReferenceDefinition(linkText, popMarkdown()));
            resolve(new blank_1.Blank(c));
            i++;
        }
        else if (state === state_1.State.LinkText && c === ']') {
            linkText = popNodes();
            if (c2 === ']:') {
                i += 2;
                push(state_1.State.ReferenceLinkUrl);
            }
            else if (c2 === '][') {
                i += 2;
                push(state_1.State.ReferingID);
            }
            else if (c2 === '](') {
                i += 2;
                push(state_1.State.ReferingUrl);
            }
            else {
                resolve(new square_quoted_1.SquareQuoted(linkText));
                i++;
            }
        }
        // HTML Tags
        else if (state === state_1.State.HTMLTag && c === '>') {
            resolve(new html_tag_1.HTMLTag(popMarkdown()));
            i++;
        }
        // Strong, Emphasis, Strikethrough
        else if (state === state_1.State.Emphasis && c === emphasisDelimiter && c === '_' && (0, char_1.isWordBoundary)(str[i + 1])) {
            resolve(new empasis_1.Emphasis(popNodes(), emphasisDelimiter));
            i++;
        }
        else if (state === state_1.State.Emphasis && c === emphasisDelimiter && c === '*') {
            resolve(new empasis_1.Emphasis(popNodes(), emphasisDelimiter));
            i++;
        }
        else if (state === state_1.State.Strong && c2 === strongDelimiter) {
            resolve(new strong_1.Strong(popNodes(), strongDelimiter));
            i += 2;
        }
        else if (state === state_1.State.Strikethrough && c2 === '~~') {
            resolve(new strikethrough_1.Strikethrough(popNodes()));
            i += 2;
        }
        // ListItems
        else if (state === state_1.State.UnorderedListItem && c === '\n') {
            resolve(new unordered_list_item_1.UnorderedListItem(listPrefix, popNodes()), new blank_1.Blank(c));
            i++;
        }
        else if (state === state_1.State.OrderedListItem && c === '\n') {
            resolve(new ordered_list_item_1.OrderedListItem(listPrefix, popNodes()), new blank_1.Blank(c));
            i++;
        }
        // Quoted
        else if (state === state_1.State.Quoted && c === '"') {
            resolve(new quoted_1.Quoted(popNodes()));
            i++;
        }
        // state === State.Text
        else if (c === '[' && allow(640 /* Link */)) {
            push(state_1.State.LinkText);
            i++;
        }
        else if (c2 === '![' && allow(786432 /* Image */)) {
            push(state_1.State.ImageText);
            i += 2;
        }
        else if (c === '<' && allow(64 /* HTMLTag */)) {
            push(state_1.State.HTMLTag);
            i++;
        }
        else if (c3 === '```' && allow(16 /* BlockCode */)) {
            push(state_1.State.BlockCodeLang);
            i += 3;
        }
        else if (c3 === '---' && allowFrontMatter()) {
            push(state_1.State.BlockCodeLang);
            blockCodeDelimiter = c3;
            i += 3;
        }
        else if (c2 === '``' && allow(65536 /* InlineCode */)) {
            inlineCodeDelimiter = c2;
            push(state_1.State.InlineCode);
            i += 2;
        }
        else if (c === '`' && allow(65536 /* InlineCode */)) {
            inlineCodeDelimiter = c;
            push(state_1.State.InlineCode);
            i++;
        }
        else if (c2 === '$$' && allow(2097152 /* Math */)) {
            mathDelimiter = c2;
            push(state_1.State.Math);
            i += 2;
        }
        else if (c === '$' && allow(2097152 /* Math */)) {
            mathDelimiter = c;
            push(state_1.State.Math);
            i++;
        }
        else if (blankLine && unordered_list_item_1.UnorderedListItem.isValidPrefix(c2) && allow(131072 /* UnorderedListItem */)) {
            push(state_1.State.UnorderedListItem);
            listPrefix = c2;
            i += 2;
        }
        else if (blankLine && ordered_list_item_1.OrderedListItem.isValidPrefix(c3) && allow(1024 /* OrderedListItem */)) {
            push(state_1.State.OrderedListItem);
            listPrefix = c3;
            i += 3;
        }
        else if (c2 === '~~' && allow(8192 /* Strikethrough */)) {
            push(state_1.State.Strikethrough);
            i += 2;
        }
        else if ((c2 === '**' || c2 === '__') && allow(16384 /* Strong */)) {
            strongDelimiter = c2;
            i += 2;
            push(state_1.State.Strong);
        }
        else if (c === '*' && allow(32768 /* Emphasis */)) {
            emphasisDelimiter = c;
            i++;
            push(state_1.State.Emphasis);
        }
        else if (c === '_' && (0, char_1.isWordBoundary)(str[i - 1]) && allow(32768 /* Emphasis */)) {
            emphasisDelimiter = c;
            i++;
            push(state_1.State.Emphasis);
        }
        else if (c === '"' && allow(2048 /* Quoted */)) {
            push(state_1.State.Quoted);
            i++;
        }
        else if (blank_1.Blank.is(c)) {
            resolve(new blank_1.Blank(c));
            i++;
        }
        else if (handleIgnores()) {
            // do nothing, already handled
        }
        else if (alphabet_numeric_1.AlphabetNumeric.is(c)) {
            resolve(alphabet_numeric_1.AlphabetNumeric.create(c));
            i++;
        }
        else if ((0, string_1.matchSubstring)(str, i, '@import') && allow(16 /* BlockCode */)) {
            const j = str.indexOf('\n', i);
            const end = j === -1 ? str.length : j;
            resolve(new raw_1.Raw(str.slice(i, end)));
            i = end;
        }
        else if (punctuation_1.Punctuation.is(c)) {
            resolve(punctuation_1.Punctuation.create(c));
            i++;
        }
        else {
            resolve(new unicode_string_1.UnicodeString(c));
            i++;
        }
        if (c === '\n') {
            blankLine = true;
        }
        if (blankLine && !(0, char_1.isBlank)(c)) {
            blankLine = false;
        }
    }
    while (stack.size() > 1) {
        // close block nodes if all inline nodes are closed
        if (forceCloseInlineNodes() === false) {
            if (forceCloseBlockNodes() === false) {
                throw new Error(`closing ${stack.top().state} is not implemented`);
            }
        }
    }
    return (0, compact_1.compactTree)(new document_1.Document(popNodes()));
    function handleIgnores() {
        for (const ignore of options.ignoreWords) {
            if ((0, string_1.matchSubstring)(str, i, ignore)) {
                resolve(new raw_1.Raw(ignore));
                i += ignore.length;
                return true;
            }
        }
        return false;
    }
    function forceCloseInlineNodes() {
        switch (stack.top().state) {
            case state_1.State.Quoted:
                resolve(punctuation_1.Punctuation.create('"'), ...popNodes());
                break;
            case state_1.State.Strikethrough:
                resolve(punctuation_1.Punctuation.create('~'), punctuation_1.Punctuation.create('~'), ...popNodes());
                break;
            case state_1.State.Emphasis:
                resolve(punctuation_1.Punctuation.create(emphasisDelimiter), ...popNodes());
                break;
            case state_1.State.Strong:
                resolve(...[...strongDelimiter].map(c => punctuation_1.Punctuation.create(c)), ...popNodes());
                break;
            case state_1.State.InlineCode:
                resolve(...[...inlineCodeDelimiter].map(c => punctuation_1.Punctuation.create(c)), ...popNodes());
                break;
            case state_1.State.Math:
                resolve(...[...mathDelimiter].map(c => punctuation_1.Punctuation.create(c)), ...popNodes());
                break;
            case state_1.State.LinkText:
                resolve(punctuation_1.Punctuation.create('['), ...popNodes());
                break;
            case state_1.State.ReferingUrl:
                resolve(new square_quoted_1.SquareQuoted(linkText), punctuation_1.Punctuation.create('('), ...popNodes());
                break;
            case state_1.State.ReferingID:
                resolve(new square_quoted_1.SquareQuoted(linkText), punctuation_1.Punctuation.create('['), ...popNodes());
                break;
            case state_1.State.ImageText:
                resolve(punctuation_1.Punctuation.create('!'), punctuation_1.Punctuation.create('['), ...popNodes());
                break;
            case state_1.State.ImageReferingUrl:
                resolve(punctuation_1.Punctuation.create('!'), new square_quoted_1.SquareQuoted(imageText), punctuation_1.Punctuation.create('('), ...popNodes());
                break;
            case state_1.State.ImageReferingID:
                resolve(punctuation_1.Punctuation.create('!'), new square_quoted_1.SquareQuoted(imageText), punctuation_1.Punctuation.create('['), ...popNodes());
                break;
            case state_1.State.HTMLTag:
                resolve(punctuation_1.Punctuation.create('<'), ...popNodes());
                break;
            default:
                return false;
        }
    }
    function forceCloseBlockNodes() {
        switch (stack.top().state) {
            case state_1.State.ReferenceLinkUrl:
                resolve(new reference_definition_1.ReferenceDefinition(linkText, popMarkdown()));
                break;
            case state_1.State.OrderedListItem:
                resolve(new ordered_list_item_1.OrderedListItem(listPrefix, popNodes()));
                break;
            case state_1.State.UnorderedListItem:
                resolve(new unordered_list_item_1.UnorderedListItem(listPrefix, popNodes()));
                break;
            case state_1.State.BlockCodeBody:
                resolve(new block_code_1.BlockCode(codeLang, blockCodeDelimiter, (0, parse_code_1.parseCode)(popMarkdown(), codeLang, parse, options), false));
                break;
            case state_1.State.BlockCodeLang:
                codeLang = popMarkdown();
                resolve(new block_code_1.BlockCode(codeLang, blockCodeDelimiter, [], false, false));
                break;
            default:
                return false;
        }
    }
    function push(state) {
        stack.push({ state, nodes: [], begin: i });
        mask.add(state_masks_1.stateMasks[state]);
    }
    function resolve(...nodes) {
        stack.top().nodes.push(...nodes);
    }
    function pop() {
        if (!stack.size())
            return undefined;
        const top = stack.pop();
        mask.remove(state_masks_1.stateMasks[top.state]);
        return top;
    }
    function popNodes() {
        return pop().nodes;
    }
    function popMarkdown() {
        return popNodes().map(x => x.toMarkdown()).join('');
    }
    function allow(kind) {
        return !(mask.mask & kind);
    }
    function allowFrontMatter() {
        if (!allow(16 /* BlockCode */))
            return false;
        for (const block of stack) {
            for (const node of block.nodes) {
                if (!(0, type_guards_1.isBlank)(node)) {
                    return false;
                }
            }
        }
        return true;
    }
}
exports.parse = parse;