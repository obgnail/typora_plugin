"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stateMasks = void 0;
const state_1 = require("./state");
exports.stateMasks = {
    [state_1.State.InlineCode]: ~33554447 /* Text */,
    [state_1.State.Math]: ~33554447 /* Text */,
    [state_1.State.BlockCodeBody]: ~33554447 /* Text */,
    [state_1.State.Emphasis]: ~53344975 /* Inline */ | 32768 /* Emphasis */,
    [state_1.State.Strong]: ~53344975 /* Inline */ | 16384 /* Strong */,
    [state_1.State.Strikethrough]: ~53344975 /* Inline */ | 8192 /* Strikethrough */,
    [state_1.State.LinkText]: ~53344975 /* Inline */ | 640 /* Link */,
    [state_1.State.ReferingUrl]: ~33554447 /* Text */,
    [state_1.State.ImageText]: ~53344975 /* Inline */ | 786432 /* Image */,
    [state_1.State.ImageReferingUrl]: ~33554447 /* Text */,
    [state_1.State.ReferenceLinkUrl]: ~33554447 /* Text */,
    [state_1.State.HTMLTag]: ~33554447 /* Text */,
    [state_1.State.ReferingID]: ~33554447 /* Text */,
    [state_1.State.BlockCodeLang]: ~33554447 /* Text */,
    [state_1.State.OrderedListItem]: -53344976 /* Block */,
    [state_1.State.UnorderedListItem]: -53344976 /* Block */,
    [state_1.State.Init]: 0 /* None */
};