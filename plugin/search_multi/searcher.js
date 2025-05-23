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

    parse(input, optimize = false) {
        input = input.replace(/\r?\n/g, " ")
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
                    throw new Error(`Unknown AST Node「${type}」`)
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

    toMermaid(ast, translate = false, direction = "TB") {
        let idx = 0
        const { KEYWORD, PHRASE, REGEXP, OR, AND, NOT } = this.parser.TYPE
        const t = this.i18n.t
        const i18n = {
            not: t("not"),
            matchRegex: t("matchRegex"),
            ":": t("operator.colon"),
            "=": t("operator.equal"),
            "!=": t("operator.notEqual"),
            ">=": t("operator.gte"),
            "<=": t("operator.lte"),
            ">": t("operator.gt"),
            "<": t("operator.lt"),
        }

        const getName = (node) => {
            if (node._shortName) {
                return node._shortName
            }
            node._shortName = "T" + ++idx

            let longName
            const isRegex = node.type === REGEXP
            const operand = isRegex ? `/${node.operand}/` : node.operand
            const negated = node.negated
            if (translate) {
                const name = this.qualifiers.get(node.scope).name
                if (typeof node.castResult === "boolean") {
                    const finalNegated = node.castResult ? negated : !negated
                    const negatedText = finalNegated ? i18n.not : ""
                    longName = this.i18n.link([negatedText, name])
                } else {
                    const operator = isRegex ? i18n.matchRegex : i18n[node.operator]
                    const negatedText = negated ? i18n.not : ""
                    longName = this.i18n.link([name, negatedText, operator, operand])
                }
            } else {
                const negatedText = negated ? "-" : ""
                longName = [negatedText, node.scope, node.operator, operand].join(" ").trim()
            }

            return `${node._shortName}("${longName}")`
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
                    throw new Error(`Unknown Node Type: ${node.type}`)
            }
        }

        ast = JSON.parse(JSON.stringify(ast))  // deep copy
        const { head, tail, result } = _eval(ast)
        const start = head.map(h => `S --> ${getName(h)}`)
        const end = tail.map(t => `${getName(t)} --> E`)
        return [`graph ${direction}`, "S((Start))", "E((End))", ...result, ...start, ...end].join("\n")
    }

    toExplain(ast) {
        const t = this.i18n.t
        const { KEYWORD, PHRASE, REGEXP, OR, AND, NOT } = this.parser.TYPE
        const i18n = {
            not: t("not"),
            and: t("and"),
            explain: t("explain"),
            matchRegex: t("matchRegex"),
            ":": t("operator.colon"),
            "=": t("operator.equal"),
            "!=": t("operator.notEqual"),
            ">=": t("operator.gte"),
            "<=": t("operator.lte"),
            ">": t("operator.gt"),
            "<": t("operator.lt"),
        }

        const getName = (node) => {
            let negated = node.negated
            const name = this.qualifiers.get(node.scope).name
            const operator = node.type === REGEXP ? i18n.matchRegex : i18n[node.operator]
            const operand = node.type === REGEXP ? `/${node.operand}/` : node.operand
            let content
            if (typeof node.castResult === "boolean") {
                negated = node.castResult ? negated : !negated
                const negatedText = negated ? i18n.not : ""
                content = this.i18n.link([negatedText, name])
            } else {
                const negatedText = negated ? i18n.not : ""
                content = this.i18n.link([name, negatedText, operator, operand])
            }
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
                    throw new Error(`Unknown Node Type: ${node.type}`)
            }
        }

        ast = JSON.parse(JSON.stringify(ast))  // deep copy
        const { result } = _eval(ast)
        const content = result
            .map(path => path.map(getName).join(i18n.and))
            .map((path, idx) => `${idx + 1}. ${path}`)
            .join("\n")
        return `${i18n.explain}：\n${content}`
    }

    async showGrammar() {
        const t = this.i18n.t
        const scope = [...this.qualifiers.values()]
        const metaScope = scope.filter(s => s.is_meta)
        const contentScope = scope.filter(s => !s.is_meta)

        const bold = (cnt) => `<b>${cnt}</b>`
        const emphasis = (cnt) => `<em>${cnt}</em>`
        const genScope = scopes => scopes.map(e => emphasis(e.scope)).join("、")
        const genOperator = (...operators) => operators.map(emphasis).join("、")
        const genUL = (...li) => `<ul style="padding-left: 1.2em; margin: 0; word-break: break-word;">${li.map(e => `<li>${e}</li>`).join("")}</ul>`
        const _scope = [
            bold(t("modal.hintDetail.scope.meta")) + " " + genScope(metaScope),
            bold(t("modal.hintDetail.scope.content")) + " " + genScope(contentScope),
        ]
        const _operator = [
            bold(genOperator(":")) + " " + t("modal.hintDetail.operator.colon"),
            bold(genOperator("=", "!=")) + " " + t("modal.hintDetail.operator.equal"),
            bold(genOperator(">", "<", ">=", "<=")) + " " + t("modal.hintDetail.operator.compare"),
        ]
        const _operand = [
            t("modal.hintDetail.operand.quotes", { eg: emphasis('"sour pear"') }),
            t("modal.hintDetail.operand.regex", { eg: emphasis("/\\bsour\\b/") }),
        ]
        const _combineCond = [
            t("modal.hintDetail.combineCond.and", { eg: emphasis("size>2kb AND ext:txt") }),
            t("modal.hintDetail.combineCond.or", { eg: emphasis("size>2kb OR ext:txt") }),
            t("modal.hintDetail.combineCond.not", { eg: emphasis("NOT size>2kb") }),
            t("modal.hintDetail.combineCond.parentheses", { eg: emphasis("size>2kb OR (ext:txt AND hasimage=true)") }),
        ]
        const hintDetail = {
            syntax: t("modal.hintDetail.syntax", { eg: emphasis("size>2kb") }),
            scope: genUL(..._scope),
            operator: genUL(..._operator),
            operand: genUL(..._operand),
            combineCond: genUL(..._combineCond),
            syntacticSugar: t("modal.hintDetail.syntacticSugar", {
                scope: emphasis("default"),
                operator: emphasis(":"),
                shortCond: emphasis("pear"),
                normalCond: emphasis("default:pear"),
                longCond: emphasis("path:pear OR content:pear"),
            }),
        }

        const example = this.utils.buildTable([
            [t("modal.example.expression"), t("modal.example.query")],
            [emphasis("pear"), `${t("modal.example.desc1")} ${t("modal.example.equivalentTo")} ${emphasis("default:pear")}`],
            [emphasis("-pear"), `${t("modal.example.desc2")} ${t("modal.example.equivalentTo")} ${emphasis("NOT pear")}`],
            [emphasis("-sour pear"), `${t("modal.example.desc3")} ${t("modal.example.equivalentTo")} ${emphasis("sour AND pear")}`],
            [emphasis("sour | pear"), `${t("modal.example.desc4")} ${t("modal.example.equivalentTo")} ${emphasis("sour OR pear")}`],
            [emphasis('"sour pear"'), t("modal.example.desc5")],
            [emphasis("/\\bsour\\b/ pear mtime<2024-05-16"), t("modal.example.desc6")],
            [emphasis("frontmatter:dev | head=plugin | strong:MIT"), t("modal.example.desc7")],
            [emphasis("size>10kb (linenum>=1000 | hasimage=true)"), t("modal.example.desc8")],
            [emphasis("path:(info | warn | err) -ext:md"), t("modal.example.desc9")],
            [emphasis('thead:k8s h2:prometheus blockcode:"kubectl apply"'), t("modal.example.desc10")],
        ])

        const grammar = `
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
<operator> ::= ${[...Object.keys(this.MIXIN.OPERATOR)].map(s => `'${s}'`).join(" | ")}
<scope> ::= ${[...metaScope, ...contentScope].map(s => `'${s.scope}'`).join(" | ")}`

        const _toJSON = (exp, optimize) => {
            try {
                const ast = this.parse(exp, optimize)
                return JSON.stringify(ast, null, "\t")
            } catch (e) {
                return `Syntax Error: ${e.toString().slice(7)}`
            }
        }
        const _toMermaid = async (exp, optimize, translate, direction) => {
            try {
                const ast = this.parse(exp, optimize)
                const mermaid = this.toMermaid(ast, translate, direction)
                const chart = await window.mermaidAPI.render("plugin-search-multi-playground", mermaid)
                const svg = typeof chart === "string" ? chart : chart.svg
                return `<div style="font-size:initial; line-height: initial; text-align:center;">${svg}</div>`
            } catch (e) {
                return `Syntax Error: ${e.toString().slice(7)}`
            }
        }
        const getSchema = async ({ expression = "", optimize = false, translate = true, direction = "LR" }) => {
            const syntaxFields = [
                { type: "hint", hintHeader: t("modal.hintHeader.syntax"), hintDetail: hintDetail.syntax },
                { type: "hint", hintHeader: t("modal.hintHeader.scope"), hintDetail: hintDetail.scope },
                { type: "hint", hintHeader: t("modal.hintHeader.operator"), hintDetail: hintDetail.operator },
                { type: "hint", hintHeader: t("modal.hintHeader.operand"), hintDetail: hintDetail.operand },
                { type: "hint", hintHeader: t("modal.hintHeader.combineCond"), hintDetail: hintDetail.combineCond },
                { type: "hint", hintHeader: t("modal.hintHeader.syntacticSugar"), hintDetail: hintDetail.syntacticSugar },
            ]
            const exampleFields = [{ type: "custom", content: example }]
            const playgroundFields = [
                { key: "expression", type: "textarea", rows: 3 },
                { type: "hint", hintDetail: await _toMermaid(expression, optimize, translate, direction) },
                { key: "optimize", type: "switch", label: t("$label.OPTIMIZE_SEARCH"), tooltip: t("$tooltip.breakOrder") },
                { key: "translate", type: "switch", label: t("modal.playground.translate") },
                { key: "direction", type: "select", label: t("modal.playground.direction"), options: Object.fromEntries(["TB", "BT", "RL", "LR"].map(e => [e, e])) },
                { act: "copyAST", type: "action", label: t("modal.playground.ast") },
            ]
            const grammarFields = [{ key: "grammar", type: "textarea", disabled: true, rows: 20 }]
            return [
                { title: undefined, fields: syntaxFields },
                { title: t("modal.title.example"), fields: exampleFields },
                { title: t("modal.title.playground"), fields: playgroundFields },
                { title: t("modal.title.grammar"), fields: grammarFields },
            ]
        }

        const expression = "head:sour file:pear ( content:foobar | size>10kb )"
        const op = {
            title: t("grammar"),
            schema: await getSchema({ expression }),
            data: {
                grammar,
                expression,
                optimize: false,
                translate: true,
                direction: "LR",
            },
            action: {
                copyAST: async (data) => {
                    const text = _toJSON(data.expression, data.optimize)
                    await navigator.clipboard.writeText(text)
                    this.utils.notification.show(this.i18n._t("global", "success.copy"))
                },
            },
            listener: ({ key, value }) => {
                this.utils.formDialog.updateModal(async op => {
                    op.data[key] = value
                    op.schema = await getSchema(op.data)
                })
            },
        }
        await this.utils.formDialog.modal(op)
    }
}

module.exports = {
    Searcher
}
