const MD101 = ({ helpers, micromark }) => {
    const { addErrorContext, isBlankLine } = helpers
    const { getParentOfType, filterByTypes } = micromark

    const mathBlockPrefixRe = /^(.*?)[$]/

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

    return {
        names: ["MD101", "math-surrounded-by-blank-lines"],
        description: "Math Blocks should be surrounded by blank lines",
        tags: ["math", "blank_lines"],
        parser: "micromark",
        "function": (params, onError) => {
            const { lines } = params
            const listItems = params.config.list_items
            const includeListItems = (listItems === undefined) ? true : !!listItems

            const mathBlocks = filterByTypes(params.parsers.micromark.tokens, ["mathFlow"])
            for (const mathBlock of mathBlocks) {
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
}

const MD102 = ({ helpers, micromark }) => {
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
        const fixInfo = token ? { editColumn: column, deleteCount: length, insertText: token.text } : undefined
        helpers.addErrorContext(
            onError,
            headContentToken.startLine,
            headContentToken.text.trim(),
            true,
            true,
            [column, length],
            fixInfo,
        )
    }

    return {
        names: ["MD102", "no-fully-emphasized-heading"],
        description: "Headings should not be fully emphasized",
        tags: ["headings", "emphasis", "strong"],
        parser: "micromark",
        "function": (params, onError) => {
            const headings = micromark.filterByTypes(params.parsers.micromark.tokens, ["atxHeading"])
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
}

const MD103 = ({ helpers, micromark }) => ({
    names: ["MD103", "inline-math-delimiter"],
    description: "inline math delimiter style",
    tags: ["math"],
    parser: "micromark",
    "function": (params, onError) => {
        let style = String(params.config.style || "consistent").trim()
        const mathTexts = micromark.filterByTypes(params.parsers.micromark.tokens, ["mathText"])
        for (const token of mathTexts) {
            const seqToken = token.children.find(c => c.type === "mathTextSequence")
            if (!seqToken) continue

            const styleForToken = (seqToken.text.length === 1) ? "single" : (seqToken.text.length === 2) ? "double" : String(seqToken.text.length)
            if (style === "consistent") {
                style = styleForToken
            }
            const text = token.children.find(c => c.type === "mathTextData")?.text ?? ""
            const seq = "$".repeat(style === "double" ? 2 : 1)
            helpers.addErrorDetailIf(
                onError,
                token.startLine,
                style,
                styleForToken,
                undefined,
                token.text.trim(),
                undefined,
                {
                    editColumn: token.startColumn,
                    deleteCount: token.endColumn - token.startColumn,
                    insertText: seq + text + seq,
                }
            )
        }
    }
})

const allRules = [MD101, MD102, MD103]

module.exports = (dependency) => allRules.map(fn => fn(dependency))
