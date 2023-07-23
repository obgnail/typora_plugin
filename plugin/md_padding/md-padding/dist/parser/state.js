"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.State = void 0;
var State;
(function (State) {
    // markdown syntax
    State[State["LinkText"] = 0] = "LinkText";
    State[State["ReferingUrl"] = 1] = "ReferingUrl";
    State[State["ReferingID"] = 2] = "ReferingID";
    State[State["ReferenceLinkUrl"] = 3] = "ReferenceLinkUrl";
    State[State["ImageText"] = 4] = "ImageText";
    State[State["ImageReferingUrl"] = 5] = "ImageReferingUrl";
    State[State["ImageReferingID"] = 6] = "ImageReferingID";
    State[State["ImageAttributes"] = 7] = "ImageAttributes";
    State[State["HTMLTag"] = 8] = "HTMLTag";
    State[State["Emphasis"] = 9] = "Emphasis";
    State[State["Strong"] = 10] = "Strong";
    State[State["Strikethrough"] = 11] = "Strikethrough";
    State[State["InlineCode"] = 12] = "InlineCode";
    State[State["BlockCodeLang"] = 13] = "BlockCodeLang";
    State[State["Math"] = 14] = "Math";
    State[State["BlockCodeBody"] = 15] = "BlockCodeBody";
    State[State["OrderedListItem"] = 16] = "OrderedListItem";
    State[State["UnorderedListItem"] = 17] = "UnorderedListItem";
    // natural language syntax
    State[State["Quoted"] = 18] = "Quoted";
    State[State["Init"] = 19] = "Init";
})(State = exports.State || (exports.State = {}));