/**
 * Credit: https://github.com/obgnail/markdownlint-rule-math
 * Issue: https://github.com/obgnail/typora_plugin/issues/957
 */
const { addErrorContext, isBlankLine } = require("markdownlint-rule-helpers")
const { getParentOfType, filterByTypes } = require("markdownlint-rule-helpers/micromark")

const mathBlockPrefixRe = /^(.*?)[$\[]/

// eslint-disable-next-line jsdoc/valid-types
/** @typedef {readonly string[]} ReadonlyStringArray */

/**
 * Adds an error for the top or bottom of a math fence.
 *
 * @param {import("markdownlint").RuleOnError} onError Error-reporting callback.
 * @param {ReadonlyStringArray} lines Lines of Markdown content.
 * @param {number} lineNumber Line number.
 * @param {boolean} top True if top math.
 * @returns {void}
 */
function addError(onError, lines, lineNumber, top) {
    const line = lines[lineNumber - 1]
    const [, prefix] = line.match(mathBlockPrefixRe) || []
    const fixInfo = (prefix === undefined) ?
        undefined :
        {
            "lineNumber": lineNumber + (top ? 0 : 1),
            "insertText": `${prefix.replace(/[^>]/g, " ").trim()}\n`
        }
    addErrorContext(
        onError,
        lineNumber,
        line.trim(),
        undefined,
        undefined,
        undefined,
        fixInfo
    )
}

module.exports = {
    "names": ["MD101", "math-surrounded-by-blank-lines"],
    "description": "Math Blocks should be surrounded by blank lines",
    "tags": ["math", "blank_lines"],
    "parser": "micromark",
    "function": (params, onError) => {
        const listItems = params.config.list_items
        const includeListItems = (listItems === undefined) ? true : !!listItems
        const { lines } = params

        for (const mathBlock of filterByTypes(params.parsers.micromark.tokens, ["mathFlow"])) {
            if (includeListItems || !(getParentOfType(mathBlock, ["listOrdered", "listUnordered"]))) {
                if (!isBlankLine(lines[mathBlock.startLine - 2])) {
                    addError(onError, lines, mathBlock.startLine, true)
                }
                if (!isBlankLine(lines[mathBlock.endLine]) && !isBlankLine(lines[mathBlock.endLine - 1])) {
                    addError(onError, lines, mathBlock.endLine, false)
                }
            }
        }
    }
}
