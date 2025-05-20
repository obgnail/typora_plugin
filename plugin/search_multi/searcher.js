const { Parser } = require("./parser")

class QualifierMixin {
    static _normalizeDate = date => new Date(date).setHours(0, 0, 0, 0)

    static OPERATOR = {
        ":": (a, b) => a.includes(b),
        "=": (a, b) => a === b,
        "!=": (a, b) => a !== b,
        ">=": (a, b) => a >= b,
        "<=": (a, b) => a <= b,
        ">": (a, b) => a > b,
        "<": (a, b) => a < b,
    }

    static UNITS = {
        k: 1 << 10,
        m: 1 << 20,
        g: 1 << 30,
        kb: 1 << 10,
        mb: 1 << 20,
        gb: 1 << 30,
    }

    static PREPROCESS = {
        noop: (scope, operator, operand, operandType) => operand,
        resolveNumber: (scope, operator, operand, operandType) => {
            if (operandType === "REGEXP") {
                return operand
            }
            return operand.replace(/[_,]/g, "")  // supports thousands separator
        },
        resolveBoolean: (scope, operator, operand, operandType) => {
            if (operandType === "REGEXP") {
                return operand
            }
            switch (operand.toLowerCase()) {
                case "y":
                case "yes":
                    return "true"
                case "n":
                case "no":
                    return "false"
                default:
                    return operand
            }
        },
        resolveDate: (scope, operator, operand, operandType) => {
            if (operandType === "REGEXP") {
                return operand
            }
            const oneDay = 24 * 60 * 60 * 1000
            const today = new Date()
            const tomorrow = new Date(today.getTime() + oneDay)
            const yesterday = new Date(today.getTime() - oneDay)
            const predefined = { today, tomorrow, yesterday }
            const replacement = predefined[operand.toLowerCase()]
            return replacement ? replacement.toISOString().slice(0, 10) : operand
        },
    }

    static VALIDATE = {
        isStringOrRegexp: (scope, operator, operand, operandType) => {
            if (operandType === "REGEXP") {
                if (operator !== ":") {
                    throw new Error(`In ${scope}: Regex operands only support the ":" operator`)
                }
                try {
                    new RegExp(operand)
                } catch (e) {
                    throw new Error(`In ${scope}: Invalid regex: "${operand}"`)
                }
            }
            if (operator !== ":" && operator !== "=" && operator !== "!=") {
                throw new Error(`In ${scope}: Only supports "=", "!=", and ":" operators`)
            }
        },
        isComparable: (scope, operator, operand, operandType) => {
            if (operandType === "REGEXP") {
                throw new Error(`In ${scope}: Regex operands are not valid for numerical comparisons`)
            }
            if (operator === ":") {
                throw new Error(`In ${scope}: The ":" operator is not valid for numerical comparisons`)
            }
        },
        isBoolean: (scope, operator, operand, operandType) => {
            if (operator !== "=" && operator !== "!=") {
                throw new Error(`In ${scope}: Only supports "=" and "!=" operators for logical comparisons`)
            }
            if (operandType === "REGEXP") {
                throw new Error(`In ${scope}: Regex operands are not valid for logical comparisons`)
            }
            if (operand !== "true" && operand !== "false") {
                throw new Error(`In ${scope}: Operand must be "true" or "false"`)
            }
        },
        isSize: (scope, operator, operand, operandType) => {
            this.VALIDATE.isComparable(scope, operator, operand, operandType)
            const units = [...Object.keys(this.UNITS)].sort((a, b) => b.length - a.length).join("|")
            const regex = new RegExp(`^\\d+(\\.\\d+)?(${units})$`, "i")
            if (!regex.test(operand)) {
                throw new Error(`In ${scope}: Operand must be a number followed by a unit: ${units}`)
            }
        },
        isNumber: (scope, operator, operand, operandType) => {
            this.VALIDATE.isComparable(scope, operator, operand, operandType)
            if (isNaN(operand)) {
                throw new Error(`In ${scope}: Operand must be a valid number`)
            }
        },
        isDate: (scope, operator, operand, operandType) => {
            this.VALIDATE.isComparable(scope, operator, operand, operandType)
            if (isNaN(new Date(operand).getTime())) {
                throw new Error(`In ${scope}: Operand must be a valid date string`)
            }
        },
    }

    static CAST = {
        toStringOrRegexp: (operand, operandType) => operandType === "REGEXP" ? new RegExp(operand) : operand.toString(),
        toNumber: operand => Number(operand),
        toBoolean: operand => operand.toLowerCase() === "true",
        toBytes: operand => {
            const units = [...Object.keys(this.UNITS)].sort((a, b) => b.length - a.length).join("|")
            const match = operand.match(/^(\d+(\.\d+)?)([a-z]+)$/i)
            if (!match) {
                throw new Error(`Operand must be a number followed by a unit: ${units}`)
            }
            const unit = match[3].toLowerCase()
            if (!this.UNITS.hasOwnProperty(unit)) {
                throw new Error(`Only supports unit: ${units}`)
            }
            return parseFloat(match[1]) * this.UNITS[unit]
        },
        toDate: this._normalizeDate,
    }

    static QUERY = {
        normalizeDate: this._normalizeDate,
    }

    static MATCH = {
        primitiveCompare: (scope, operator, operand, queryResult) => this.OPERATOR[operator](queryResult, operand),
        stringRegexp: (scope, operator, operand, queryResult) => operand.test(queryResult),
        arrayCompare: (scope, operator, operand, queryResult) => queryResult.some(data => this.OPERATOR[operator](data, operand)),
        arrayRegexp: (scope, operator, operand, queryResult) => queryResult.some(data => operand.test(data)),
    }

    static ANCESTOR = {
        none: null,
        write: "#write",
    }
}

/**
 * The matching process consists of the following steps: (Steps 1-4 are executed once; steps 5-6 are executed repeatedly)
 *   1. Parse:      Parses the input to generate an Abstract Syntax Tree (AST)
 *   2. Preprocess: Convert certain specific, predefined, and special meaning vocabulary (e.g. converting 'today' in 'mtime=today' to '2024-01-01')
 *   3. Validate:   Validates the AST for correctness
 *   4. Cast:       Converts operand within the AST nodes into a usable format (e.g. converting '2024-01-01' in 'mtime=2024-01-01' to a timestamp for easier matching). The result is `castResult`
 *   5. Query:      Retrieves file data, resulting in `queryResult`
 *   6. Match:      Matches `castResult` (from step 4) with `queryResult` (from step 5)
 *
 * A qualifier has the following attributes:
 *   {string}   scope:          The query scope
 *   {string}   name:           A descriptive name for explanation purposes
 *   {string}   ancestor:       The ancestor Element in DOM. Only available when is_meta=false. Defaults to `QualifierMixin.ANCESTOR.none`
 *   {boolean}  is_meta:        Indicates if the qualifier scope is a metadata property
 *   {boolean}  need_read_file: Determines if the qualifier needs to read file content
 *   {number}   cost:           The performance cost associated with the `query` function. 1: Read file stats; 2: Read file content; 3: Parse file content; Plus 0.5 when the user input is a regex
 *   {function} preprocess:     Convert certain specific, predefined, and special meaning vocabulary from the user input. Defaults to `QualifierMixin.PREPROCESS.noop`
 *   {function} validate:       Checks user input and obtain `validateError`. Defaults to `QualifierMixin.VALIDATE.isStringOrRegexp`
 *   {function} cast:           Converts user input for easier matching and obtain `castResult`. Defaults to `QualifierMixin.CAST.toStringOrRegexp`
 *   {function} query:          Retrieves data from source and obtain `queryResult`
 *   {function} match_keyword:  Matches `castResult` with `queryResult` when the user input is a keyword. Defaults to `QualifierMixin.MATCH.compare`
 *   {function} match_phrase:   Matches `castResult` with `queryResult` when the user input is a phrase. Behaves the same as `match_keyword` by default
 *   {function} match_regexp:   Matches `castResult` with `queryResult` when the user input is a regexp. Defaults to `QualifierMixin.MATCH.regexp`
 */
class Searcher {
    constructor(plugin) {
        this.MIXIN = QualifierMixin
        this.config = plugin.config
        this.utils = plugin.utils
        this.i18n = plugin.i18n
        this.parser = new Parser()
        this.qualifiers = new Map()
    }

    process() {
        const qualifiers = this.buildQualifiers()
        qualifiers.forEach(q => this.qualifiers.set(q.scope, q))
        this.parser.setQualifier(qualifiers.map(q => q.scope), Object.keys(this.MIXIN.OPERATOR))
    }

    buildQualifiers() {
        const qualifiers = [...this.buildBaseQualifiers(), ...this.buildMarkdownQualifiers()]
        qualifiers.forEach(q => {
            q.preprocess = q.preprocess || this.MIXIN.PREPROCESS.noop
            q.validate = q.validate || this.MIXIN.VALIDATE.isStringOrRegexp
            q.anchor = q.anchor || this.MIXIN.ANCESTOR.none
            q.cast = q.cast || this.MIXIN.CAST.toStringOrRegexp
            q.KEYWORD = q.match_keyword || this.MIXIN.MATCH.primitiveCompare
            q.PHRASE = q.match_phrase || q.KEYWORD
            q.REGEXP = q.match_regexp || this.MIXIN.MATCH.stringRegexp
        })
        return qualifiers
    }

    buildBaseQualifiers() {
        const {
            PREPROCESS: { resolveDate, resolveNumber, resolveBoolean },
            VALIDATE: { isSize, isDate, isNumber, isBoolean },
            CAST: { toBytes, toDate, toNumber, toBoolean },
            MATCH: { arrayCompare, arrayRegexp },
            QUERY: { normalizeDate },
            ANCESTOR: { none, write },
        } = this.MIXIN
        const { splitFrontMatter, Package: { Path } } = this.utils
        const QUERY = {
            default: ({ path, file, stats, content }) => `${content}\n${path}`,
            path: ({ path, file, stats, content }) => path,
            dir: ({ path, file, stats, content }) => Path.dirname(path),
            file: ({ path, file, stats, content }) => file,
            name: ({ path, file, stats, content }) => Path.parse(file).name,
            ext: ({ path, file, stats, content }) => Path.extname(file),
            size: ({ path, file, stats, content }) => stats.size,
            atime: ({ path, file, stats, content }) => normalizeDate(stats.atime),
            mtime: ({ path, file, stats, content }) => normalizeDate(stats.mtime),
            birthtime: ({ path, file, stats, content }) => normalizeDate(stats.birthtime),
            content: ({ path, file, stats, content }) => content,
            linenum: ({ path, file, stats, content }) => content.split("\n").length,
            charnum: ({ path, file, stats, content }) => content.length,
            crlf: ({ path, file, stats, content }) => content.includes("\r\n"),
            hasimage: ({ path, file, stats, content }) => /!\[.*?\]\(.*\)|<img.*?src=".*?"/.test(content),
            hasimg: ({ path, file, stats, content }) => /<img.*?src=".*?"/.test(content),
            haschinese: ({ path, file, stats, content }) => /\p{sc=Han}/u.test(content),
            hasemoji: ({ path, file, stats, content }) => /\p{Emoji_Modifier_Base}\p{Emoji_Modifier}?|\p{Emoji_Presentation}|\p{Emoji}\uFE0F/u.test(content),
            hasinvisiblechar: ({ path, file, stats, content }) => /[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200D\uFEFF]/.test(content),
            line: ({ path, file, stats, content }) => content.split("\n"),
            frontmatter: ({ path, file, stats, content }) => {
                const { yamlObject } = splitFrontMatter(content)
                return yamlObject ? JSON.stringify(yamlObject) : ""
            },
            chinesenum: ({ path, file, stats, content }) => {
                let count = 0
                for (const _ of content.matchAll(/\p{sc=Han}/gu)) {
                    count++
                }
                return count
            },
        }
        const PROCESS = {
            size: { validate: isSize, cast: toBytes },
            date: { preprocess: resolveDate, validate: isDate, cast: toDate },
            number: { preprocess: resolveNumber, validate: isNumber, cast: toNumber },
            boolean: { preprocess: resolveBoolean, validate: isBoolean, cast: toBoolean },
            stringArray: { match_keyword: arrayCompare, match_regexp: arrayRegexp },
        }
        const buildQualifier = (scope, is_meta, need_read_file, cost, anchor, process) => ({
            scope, name: this.i18n.t(`scope.${scope}`), is_meta, need_read_file, cost, anchor, query: QUERY[scope], ...process,
        })
        return [
            buildQualifier("default", false, true, 2, write),
            buildQualifier("path", true, false, 1, none),
            buildQualifier("dir", true, false, 1, none),
            buildQualifier("file", true, false, 1, none),
            buildQualifier("name", true, false, 1, none),
            buildQualifier("ext", true, false, 1, none),
            buildQualifier("content", false, true, 2, write),
            buildQualifier("frontmatter", false, true, 3, 'pre[mdtype="meta_block"]'),
            buildQualifier("size", true, false, 1, none, PROCESS.size),
            buildQualifier("birthtime", true, false, 1, none, PROCESS.date),
            buildQualifier("mtime", true, false, 1, none, PROCESS.date),
            buildQualifier("atime", true, false, 1, none, PROCESS.date),
            buildQualifier("linenum", true, true, 2, none, PROCESS.number),
            buildQualifier("charnum", true, true, 2, none, PROCESS.number),
            buildQualifier("chinesenum", true, true, 2, none, PROCESS.number),
            buildQualifier("crlf", true, true, 2, none, PROCESS.boolean),
            buildQualifier("hasimage", true, true, 2, none, PROCESS.boolean),
            buildQualifier("hasimg", true, true, 2, none, PROCESS.boolean),
            buildQualifier("haschinese", true, true, 2, none, PROCESS.boolean),
            buildQualifier("hasemoji", true, true, 2, none, PROCESS.boolean),
            buildQualifier("hasinvisiblechar", true, true, 2, none, PROCESS.boolean),
            buildQualifier("line", false, true, 2, write, PROCESS.stringArray),
        ]
    }

    buildMarkdownQualifiers() {
        // Prevent re-parsing of the same file in a SINGLE query
        const cache = fn => {
            let cached, result
            return arg => {
                if (arg !== cached) {
                    result = fn(arg)
                    cached = arg
                }
                return result
            }
        }

        const PARSER = {
            inline: cache(this.utils.parseMarkdownInline),
            block: cache(this.utils.parseMarkdownBlock),
        }

        const FILTER = {
            is: type => node => node.type === type,
            wrappedBy: type => {
                const openType = `${type}_open`
                const closeType = `${type}_close`
                let balance = 0
                return node => {
                    if (node.type === openType) {
                        balance++
                    } else if (node.type === closeType) {
                        balance--
                    }
                    return balance > 0
                }
            },
            wrappedByTag: (type, tag) => {
                const openType = `${type}_open`
                const closeType = `${type}_close`
                let balance = 0
                return node => {
                    if (node.type === openType && node.tag === tag) {
                        balance++
                    } else if (node.type === closeType && node.tag === tag) {
                        balance--
                    }
                    return balance > 0
                }
            },
            wrappedByMulti: (...types) => {
                let wrapped = false
                const balances = new Uint8Array(types.length).fill(0)
                const flags = new Map(
                    types.flatMap((type, idx) => [
                        [`${type}_open`, [idx, 1]],
                        [`${type}_close`, [idx, -1]],
                    ])
                )
                return node => {
                    const hit = flags.get(node.type)
                    if (hit) {
                        const [idx, addend] = hit
                        balances[idx] += addend
                        balances.fill(0, idx + 1)
                        wrapped = balances.every(val => val > 0)
                    }
                    return wrapped
                }
            }
        }

        const TRANSFORMER = {
            content: node => node.content,
            info: node => node.info,
            infoAndContent: node => `${node.info}\n${node.content}`,
            attrAndContent: node => {
                const attrs = node.attrs || []
                const attrContent = attrs.map(l => l[l.length - 1]).join(" ")
                return `${attrContent}${node.content}`
            },
            regexpContent: regex => {
                return node => {
                    const content = node.content.trim()
                    const result = [...content.matchAll(regex)]
                    return result.map(([_, text]) => text).join(" ")
                }
            },
            contentLine: node => node.content.split("\n"),
            taskContent: (selectType = 0) => {
                const regexp = /^\[(x|X| )\]\s+(.+)/
                return node => {
                    const content = node.content.trim()
                    const hit = content.match(regexp)
                    if (!hit) {
                        return ""
                    }
                    const [_, selectText, taskText] = hit
                    // 0:both, 1:selected, -1:unselected
                    switch (selectType) {
                        case 0:
                            return taskText
                        case 1:
                            return (selectText === "x" || selectText === "X") ? taskText : ""
                        case -1:
                            return selectText === " " ? taskText : ""
                        default:
                            return ""
                    }
                }
            },
        }

        const preorder = (ast = [], filter) => {
            const output = []
            const recurse = ast => {
                for (const node of ast) {
                    if (filter(node)) {
                        output.push(node)
                    }
                    const c = node.children
                    if (c && c.length) {
                        recurse(c)
                    }
                }
            }
            recurse(ast)
            return output
        }

        const buildQuery = (parser, filter, transformer) => {
            return source => {
                const ast = parser(source.content)
                const nodes = preorder(ast, filter)
                return nodes.flatMap(transformer).filter(Boolean)
            }
        }

        const buildQualifier = (scope, anchor, parser, filter, transformer) => ({
            scope,
            name: this.i18n.t(`scope.${scope}`),
            anchor,
            is_meta: false,
            need_read_file: true,
            cost: 3,
            preprocess: this.MIXIN.PREPROCESS.noop,
            validate: this.MIXIN.VALIDATE.isStringOrRegexp,
            cast: this.MIXIN.CAST.toStringOrRegexp,
            match_keyword: this.MIXIN.MATCH.arrayCompare,
            match_phrase: this.MIXIN.MATCH.arrayCompare,
            match_regexp: this.MIXIN.MATCH.arrayRegexp,
            query: buildQuery(parser, filter, transformer),
        })

        return [
            buildQualifier("blockcode", "pre.md-fences", PARSER.block, FILTER.is("fence"), TRANSFORMER.infoAndContent),
            buildQualifier("blockcodelang", ".ty-cm-lang-input", PARSER.block, FILTER.is("fence"), TRANSFORMER.info),
            buildQualifier("blockcodebody", "pre.md-fences", PARSER.block, FILTER.is("fence"), TRANSFORMER.content),
            buildQualifier("blockcodeline", "pre.md-fences", PARSER.block, FILTER.is("fence"), TRANSFORMER.contentLine),
            buildQualifier("blockhtml", ".md-html-inline,.md-htmlblock", PARSER.block, FILTER.is("html_block"), TRANSFORMER.content),
            buildQualifier("blockquote", '[mdtype="blockquote"]', PARSER.block, FILTER.wrappedBy("blockquote"), TRANSFORMER.content),
            buildQualifier("table", '[mdtype="table"]', PARSER.block, FILTER.wrappedBy("table"), TRANSFORMER.content),
            buildQualifier("thead", '[mdtype="table"] thead', PARSER.block, FILTER.wrappedBy("thead"), TRANSFORMER.content),
            buildQualifier("tbody", '[mdtype="table"] tbody', PARSER.block, FILTER.wrappedBy("tbody"), TRANSFORMER.content),
            buildQualifier("ol", 'ol[mdtype="list"]', PARSER.block, FILTER.wrappedBy("ordered_list"), TRANSFORMER.content),
            buildQualifier("ul", 'ul[mdtype="list"]', PARSER.block, FILTER.wrappedBy("bullet_list"), TRANSFORMER.content),
            buildQualifier("task", ".task-list-item", PARSER.block, FILTER.wrappedByMulti("bullet_list", "list_item", "paragraph"), TRANSFORMER.taskContent(0)),
            buildQualifier("taskdone", ".task-list-item.task-list-done", PARSER.block, FILTER.wrappedByMulti("bullet_list", "list_item", "paragraph"), TRANSFORMER.taskContent(1)),
            buildQualifier("tasktodo", ".task-list-item.task-list-not-done", PARSER.block, FILTER.wrappedByMulti("bullet_list", "list_item", "paragraph"), TRANSFORMER.taskContent(-1)),
            buildQualifier("head", '[mdtype="heading"]', PARSER.block, FILTER.wrappedBy("heading"), TRANSFORMER.content),
            buildQualifier("h1", 'h1[mdtype="heading"]', PARSER.block, FILTER.wrappedByTag("heading", "h1"), TRANSFORMER.content),
            buildQualifier("h2", 'h2[mdtype="heading"]', PARSER.block, FILTER.wrappedByTag("heading", "h2"), TRANSFORMER.content),
            buildQualifier("h3", 'h3[mdtype="heading"]', PARSER.block, FILTER.wrappedByTag("heading", "h3"), TRANSFORMER.content),
            buildQualifier("h4", 'h4[mdtype="heading"]', PARSER.block, FILTER.wrappedByTag("heading", "h4"), TRANSFORMER.content),
            buildQualifier("h5", 'h5[mdtype="heading"]', PARSER.block, FILTER.wrappedByTag("heading", "h5"), TRANSFORMER.content),
            buildQualifier("h6", 'h6[mdtype="heading"]', PARSER.block, FILTER.wrappedByTag("heading", "h6"), TRANSFORMER.content),
            buildQualifier("highlight", '[md-inline="highlight"]', PARSER.block, FILTER.is("text"), TRANSFORMER.regexpContent(/==(.+)==/g)),
            buildQualifier("image", '[md-inline="image"]', PARSER.inline, FILTER.is("image"), TRANSFORMER.attrAndContent),
            buildQualifier("code", '[md-inline="code"]', PARSER.inline, FILTER.is("code_inline"), TRANSFORMER.content),
            buildQualifier("link", '[md-inline="link"]', PARSER.inline, FILTER.wrappedBy("link"), TRANSFORMER.attrAndContent),
            buildQualifier("strong", '[md-inline="strong"]', PARSER.inline, FILTER.wrappedBy("strong"), TRANSFORMER.content),
            buildQualifier("em", '[md-inline="em"]', PARSER.inline, FILTER.wrappedBy("em"), TRANSFORMER.content),
            buildQualifier("del", '[md-inline="del"]', PARSER.inline, FILTER.wrappedBy("s"), TRANSFORMER.content),
        ]
    }

    parse(input, optimize) {
        input = this.config.CASE_SENSITIVE ? input : input.toLowerCase()
        const ast = this.parser.parse(input)
        this.postParse(ast)
        return optimize ? this.optimize(ast) : ast
    }

    postParse(ast) {
        const { REGEXP } = this.parser.TYPE
        this.parser.walk(ast, node => {
            const qualifier = this.qualifiers.get(node.scope.toLowerCase())
            node.operand = qualifier.preprocess(node.scope, node.operator, node.operand, node.type)
            node.validateError = qualifier.validate(node.scope.toUpperCase(), node.operator, node.operand, node.type)
            node.cost = qualifier.cost + (node.type === REGEXP ? 0.5 : 0)
            node.anchor = qualifier.anchor
            node.castResult = qualifier.cast(node.operand, node.type)
        })
        return ast
    }

    /**
     * Process OR/AND nodes by:
     *   1. Gathering data child nodes into `dataNodes`
     *   2. Sorting `dataNodes` by `cost`
     *   3. Rebuilding the subtree based on `dataNodes` to favor low-cost operations
     */
    optimize(ast) {
        if (!ast) return

        const { OR, AND } = this.parser.TYPE
        const setCost = node => {
            if (!node) return

            setCost(node.left)
            setCost(node.right)

            const rootCost = node.cost || 1
            const leftCost = (node.left && node.left.cost) || 1
            const rightCost = (node.right && node.right.cost) || 1
            node.cost = Math.max(rootCost, leftCost, rightCost)
        }
        const getDataNodes = (cur, root, dataNodes = []) => {
            if (cur.type === root.type) {
                if (cur.right) {
                    getDataNodes(cur.right, root, dataNodes)
                }
                if (cur.left) {
                    getDataNodes(cur.left, root, dataNodes)
                }
            } else {
                dataNodes.push(cur)
            }
            return dataNodes
        }
        const rebuild = node => {
            if (!node) return

            if (node.type === OR || node.type === AND) {
                const dataNodes = getDataNodes(node, node)
                if (dataNodes.length > 1) {
                    dataNodes.sort((a, b) => a.cost - b.cost)
                    let newNode = dataNodes.shift()
                    while (dataNodes.length) {
                        const right = dataNodes.shift()
                        newNode = { type: node.type, left: newNode, right: right, cost: right.cost }
                    }
                    node.left = newNode.left
                    node.right = newNode.right
                    node.cost = newNode.cost
                }
            }

            rebuild(node.right)
            rebuild(node.left)
        }

        setCost(ast)
        rebuild(ast)
        return ast
    }

    match(ast, source) {
        return this.parser.evaluate(ast, node => this._match(node, source))
    }

    _match(node, source) {
        const { scope, operator, castResult, type } = node
        const qualifier = this.qualifiers.get(scope)
        let queryResult = qualifier.query(source)
        if (!this.config.CASE_SENSITIVE) {
            if (typeof queryResult === "string") {
                queryResult = queryResult.toLowerCase()
            } else if (Array.isArray(queryResult) && typeof queryResult[0] === "string") {
                queryResult = queryResult.map(s => s.toLowerCase())
            }
        }
        const match = qualifier[type]
        return match(scope, operator, castResult, queryResult)
    }

    getReadFileScope(ast) {
        const scope = new Set()
        const needRead = new Set([...this.qualifiers.values()].filter(q => q.need_read_file).map(q => q.scope))
        this.parser.walk(ast, node => {
            if (needRead.has(node.scope)) {
                scope.add(node.scope)
            }
        })
        return [...scope]
    }

    getContentTokens(ast) {
        const { KEYWORD, PHRASE, REGEXP, OR, AND, NOT } = this.parser.TYPE
        const isMeta = new Set([...this.qualifiers.values()].filter(q => q.is_meta).map(q => q.scope))
        const contentNodes = new Set()
        const _eval = (node, negated) => {
            const { type, left, right, scope } = node
            switch (type) {
                case KEYWORD:
                case PHRASE:
                case REGEXP:
                    if (!isMeta.has(scope)) {
                        node._negated = negated
                        contentNodes.add(node)
                    }
                    break
                case OR:
                case AND:
                    _eval(left, negated)
                    _eval(right, negated)
                    break
                case NOT:
                    if (left) {
                        _eval(left, negated)
                    }
                    _eval(right, !negated)
                    break
                default:
                    throw new Error(`Unknown AST node「${type}」`)
            }
        }

        _eval(ast)
        return [...contentNodes]
            .filter(n => !n._negated)
            .map(n => {
                const operand = n.operand
                return n.type === REGEXP ? operand : operand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
            })
    }

    // Converts to a mermaid graph. However, the generated graph is too large and there is no place to put it, so it is not used for now.
    toMermaid(ast) {
        let idx = 0
        const { KEYWORD, PHRASE, REGEXP, OR, AND, NOT } = this.parser.TYPE

        function getName(node) {
            if (node._shortName) {
                return node._shortName
            }
            node._shortName = "T" + ++idx
            const prefix = node.negated ? "-" : ""
            const operand = node.type === REGEXP ? `/${node.operand}/` : node.operand
            return `${node._shortName}("${prefix}${node.scope}${node.operator} ${operand}")`
        }

        function link(left, right) {
            return left.tail.flatMap(t => right.head.map(h => `${getName(t)} --> ${getName(h)}`))
        }

        function _eval(node, negated) {
            let left, right
            switch (node.type) {
                case AND:
                    left = _eval(node.left, negated)
                    right = _eval(node.right, negated)
                    node.head = left.head
                    node.tail = right.tail
                    node.result = [...left.result, ...link(left, right), ...right.result]
                    return node
                case OR:
                    left = _eval(node.left, negated)
                    right = _eval(node.right, negated)
                    node.head = [...left.head, ...right.head]
                    node.tail = [...left.tail, ...right.tail]
                    node.result = [...left.result, ...right.result]
                    return node
                case NOT:
                    left = node.left ? _eval(node.left, negated) : { result: [], head: [], tail: [] }
                    right = _eval(node.right, !negated)
                    node.head = node.left ? left.head : right.head
                    node.tail = right.tail
                    node.result = [...left.result, ...link(left, right), ...right.result]
                    return node
                case KEYWORD:
                case PHRASE:
                case REGEXP:
                    node.negated = negated
                    node.head = [node]
                    node.tail = [node]
                    node.result = []
                    return node
                default:
                    throw new Error(`Unknown node type: ${node.type}`)
            }
        }

        ast = JSON.parse(JSON.stringify(ast))  // deep copy
        const { head, tail, result } = _eval(ast)
        const start = head.map(h => `S --> ${getName(h)}`)
        const end = tail.map(t => `${getName(t)} --> E`)
        return ["graph LR", "S(Start)", "E(End)", ...result, ...start, ...end].join("\n")
    }

    toExplain(ast) {
        const notText = this.i18n.t("not")
        const andText = this.i18n.t("and")
        const explain = this.i18n.t("explain")
        const matchRegexText = this.i18n.t("matchRegex")
        const operatorNames = {
            ":": this.i18n.t("operator.colon"),
            "=": this.i18n.t("operator.equal"),
            "!=": this.i18n.t("operator.notEqual"),
            ">=": this.i18n.t("operator.gte"),
            "<=": this.i18n.t("operator.lte"),
            ">": this.i18n.t("operator.gt"),
            "<": this.i18n.t("operator.lt"),
        }

        const { KEYWORD, PHRASE, REGEXP, OR, AND, NOT } = this.parser.TYPE

        const getName = node => {
            const name = this.qualifiers.get(node.scope).name
            const negated = node.negated ? notText : ""
            const operator = node.type === REGEXP ? matchRegexText : operatorNames[node.operator]
            const operand = node.type === REGEXP ? `/${node.operand}/` : node.operand
            const content = this.i18n.link([name, negated, operator, operand])
            return `「${content}」`
        }

        const link = (left, right) => {
            return left.result.flatMap(lPath => right.result.map(rPath => [...lPath, ...rPath]))
        }

        const _eval = (node, negated) => {
            let left, right
            switch (node.type) {
                case AND:
                    left = _eval(node.left, negated)
                    right = _eval(node.right, negated)
                    node.result = link(left, right)
                    return node
                case OR:
                    left = _eval(node.left, negated)
                    right = _eval(node.right, negated)
                    node.result = [...left.result, ...right.result]
                    return node
                case NOT:
                    left = node.left ? _eval(node.left, negated) : { result: [[]], head: [], tail: [] }
                    right = _eval(node.right, !negated)
                    node.result = link(left, right)
                    return node
                case KEYWORD:
                case PHRASE:
                case REGEXP:
                    node.negated = negated
                    node.result = [[node]]
                    return node
                default:
                    throw new Error(`Unknown node type: ${node.type}`)
            }
        }

        ast = JSON.parse(JSON.stringify(ast))  // deep copy
        const { result } = _eval(ast)
        const content = result
            .map(path => path.map(getName).join(andText))
            .map((path, idx) => `${idx + 1}. ${path}`)
            .join("\n")
        return `${explain}：\n${content}`
    }

    showGrammar() {
        const t = this.i18n.t
        const i18n = {
            brief: {
                introduce: t("modal.brief.introduce"),
                conditionDesc: t("modal.brief.conditionDesc", { example1: "<em>size>2kb</em>", example2: "<em>ext:txt</em>" }),
                conditionCombination1: t("modal.brief.conditionCombination1", { example: "<em>size>2kb AND ext:txt</em>" }),
                conditionCombination2: t("modal.brief.conditionCombination2", { example: "<em>size>2kb OR ext:txt</em>" }),
                conditionCombination3: t("modal.brief.conditionCombination3", { example: "<em>NOT size>2kb</em>" }),
                conditionCombination4: t("modal.brief.conditionCombination4", { example: "<em>size>2kb AND (ext:txt OR hasimage=true)</em>" }),
                omit: t("modal.brief.omit"),
            },
            example: {
                title: t("modal.example.title"),
                result: t("modal.example.result"),
                equivalentTo: t("modal.example.equivalentTo"),
                desc1: t("modal.example.desc1"),
                desc2: t("modal.example.desc2"),
                desc3: t("modal.example.desc3"),
                desc4: t("modal.example.desc4"),
                desc5: t("modal.example.desc5"),
                desc6: t("modal.example.desc6"),
                desc7: t("modal.example.desc7"),
                desc8: t("modal.example.desc8"),
                desc9: t("modal.example.desc9"),
                desc10: t("modal.example.desc10"),
            },
            usage: {
                keyword: t("modal.usage.keyword"),
                desc: t("modal.usage.desc"),
                whitespace: t("modal.usage.whitespace"),
                whitespaceDesc: t("modal.usage.whitespaceDesc"),
                orDesc: t("modal.usage.orDesc"),
                notDesc: t("modal.usage.notDesc"),
                quotationDesc: t("modal.usage.quotationDesc"),
                regexDesc: t("modal.usage.regexDesc"),
                scopeDesc: t("modal.usage.scopeDesc"),
                operatorDesc: t("modal.usage.operatorDesc"),
                scopeDescMeta: t("modal.usage.scopeDesc.meta"),
                scopeDescContent: t("modal.usage.scopeDesc.content"),
                colonDesc: t("modal.usage.colonDesc"),
                equalDesc: t("modal.usage.equalDesc"),
                compareDesc: t("modal.usage.compareDesc"),
            },
        }

        const scope = [...this.qualifiers.values()]
        const metaScope = scope.filter(s => s.is_meta)
        const contentScope = scope.filter(s => !s.is_meta)
        const operator = [...Object.keys(this.MIXIN.OPERATOR)]
        const genUL = (...li) => `<ul style="padding-left: 1em; word-break: break-word;">${li.map(e => `<li>${e}</li>`).join("")}</ul>`

        // brief
        const conditionCombination = genUL(
            i18n.brief.conditionCombination1,
            i18n.brief.conditionCombination2,
            i18n.brief.conditionCombination3,
            i18n.brief.conditionCombination4,
        )
        const brief = `<b>${i18n.brief.introduce}</b>${i18n.brief.conditionDesc}<br>${conditionCombination}`

        // example
        const example = this.utils.buildTable([
            [i18n.example.title, i18n.example.result],
            ["<em>pear</em>", `${i18n.example.desc1} ${i18n.example.equivalentTo} <em>default:pear</em>`],
            ["<em>-pear</em>", `${i18n.example.desc2} ${i18n.example.equivalentTo} <em>NOT pear</em>`],
            ["<em>sour pear</em>", `${i18n.example.desc3} ${i18n.example.equivalentTo} <em>sour AND pear</em>`],
            ["<em>sour | pear</em>", `${i18n.example.desc4} ${i18n.example.equivalentTo} <em>sour OR pear</em></td>`],
            ['<em>"sour pear"</em>', i18n.example.desc5],
            ["<em>/\\bsour\\b/ pear mtime<2024-05-16</em>", i18n.example.desc6],
            ["<em>frontmatter:dev | head=plugin | strong:MIT</em>", i18n.example.desc7],
            ["<em>size>10kb (linenum>=1000 | hasimage=true)</em>", i18n.example.desc8],
            ["<em>path:(info | warn | err) -ext:md</em>", i18n.example.desc9],
            ['<em>thead:k8s h2:prometheus blockcode:"kubectl apply"</em>', i18n.example.desc10],
        ])

        // usage
        const genScope = scopes => scopes.map(e => `<code title="${e.name}">${e.scope}</code>`).join("、")
        const genOperator = (...operators) => operators.map(op => `<code>${op}</code>`).join("、")
        const scopeDesc = genUL(
            `${i18n.usage.scopeDescMeta}：${genScope(metaScope)}`,
            `${i18n.usage.scopeDescContent}：${genScope(contentScope)}`,
        )
        const operatorDesc = genUL(
            `${genOperator(":")} ${i18n.usage.colonDesc}`,
            `${genOperator("=", "!=")} ${i18n.usage.equalDesc}`,
            `${genOperator(">", "<", ">=", "<=")} ${i18n.usage.compareDesc}`,
        )
        const usage = this.utils.buildTable([
            [i18n.usage.keyword, i18n.usage.desc],
            [i18n.usage.whitespace, i18n.usage.whitespaceDesc],
            ["|", i18n.usage.orDesc],
            ["-", i18n.usage.notDesc],
            ['""', i18n.usage.quotationDesc],
            ["/regex/", i18n.usage.regexDesc],
            ["scope", i18n.usage.scopeDesc + scopeDesc],
            ["operator", i18n.usage.operatorDesc + operatorDesc],
        ])

        // grammar
        const content = `
<query> ::= <expression>
<expression> ::= <term> ( <or> <term> )*
<term> ::= <factor> ( <conjunction> <factor> )*
<factor> ::= <qualifier>? <match>
<qualifier> ::= <scope> <operator>
<match> ::= <keyword> | '"'<keyword>'"' | '/'<regex>'/' | '('<expression>')'
<conjunction> ::= <and> | <not>
<or> ::= 'OR' | '|'
<and> ::= 'AND' | ' '
<not> ::= 'NOT' | '-'
<keyword> ::= [^\\s"()|]+
<regex> ::= [^/]+
<operator> ::= ${operator.map(s => `'${s}'`).join(" | ")}
<scope> ::= ${[...metaScope, ...contentScope].map(s => `'${s.scope}'`).join(" | ")}
`

        const title = this.i18n.t("grammar")
        const components = [
            { label: brief, type: "blockquote", tabIndex: 0 },
            { label: i18n.brief.omit, type: "blockquote" },
            { label: example, type: "p" },
            { label: usage, type: "p" },
            { label: "", type: "textarea", rows: 20, content },
        ]
        this.utils.dialog.modal({ title, components, width: "700px" })
    }
}

module.exports = {
    Searcher
}
