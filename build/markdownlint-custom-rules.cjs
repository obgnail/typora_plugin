/**
 * Credit: https://github.com/obgnail/markdownlint-custom-rules
 * Issue: https://github.com/obgnail/typora_plugin/issues/957
 *        https://github.com/obgnail/typora_plugin/issues/1046
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

const MD101 = {
    names: ["MD101", "math-surrounded-by-blank-lines"],
    description: "Math Blocks should be surrounded by blank lines",
    tags: ["math", "blank_lines"],
    parser: "micromark",
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

function checkFullyEmphasize(token, headContentToken, onError) {
    const isEmphasis = token.type === "emphasis"
    const isStrong = token.type === "strong"

    if (isEmphasis || isStrong) {
        const type = isEmphasis ? "emphasisText" : "strongText"
        const textToken = token.children.find(t => t.type === type)
        if (textToken?.children.length === 1) {
            checkFullyEmphasize(textToken.children[0], headContentToken, onError)
            return
        }
        token = textToken
    }

    const column = headContentToken.startColumn
    const length = headContentToken.endColumn - column
    addErrorContext(
        onError,
        headContentToken.startLine,
        headContentToken.text.trim(),
        undefined,
        undefined,
        [column, length],
        {
            editColumn: column,
            deleteCount: length,
            insertText: token.text,
        }
    )
}

const MD102 = {
    names: ["MD102", "no-fully-emphasized-heading"],
    description: "Headings should not be fully emphasized",
    tags: ["headings", "emphasis", "strong"],
    parser: "micromark",
    "function": function MD102(params, onError) {
        const headings = filterByTypes(params.parsers.micromark.tokens, ["atxHeading"])
        for (const heading of headings) {
            const headingTextToken = heading.children.find(t => t.type === "atxHeadingText")
            if (!headingTextToken || headingTextToken.children.length !== 1) continue

            const headContentToken = headingTextToken.children[0]
            if (headContentToken.type === "emphasis" || headContentToken.type === "strong") {
                checkFullyEmphasize(headContentToken, headContentToken, onError)
            }
        }
    }
}

module.exports = [MD101, MD102]
