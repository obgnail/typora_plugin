class Parser {
    constructor() {
        this.TYPE = {
            OR: "OR",
            AND: "AND",
            NOT: "NOT",
            PAREN_OPEN: "PAREN_OPEN",
            PAREN_CLOSE: "PAREN_CLOSE",
            KEYWORD: "KEYWORD",
            PHRASE: "PHRASE",
            REGEXP: "REGEXP",
            QUALIFIER: "QUALIFIER",
        }
        this.setQualifier()
    }

    setQualifier(
        scopes = ["default", "file", "path", "ext", "content", "time", "size", "status"],
        operators = [">=", "<=", ":", "=", ">", "<"],
    ) {
        const sortByLen = (a, b) => b.length - a.length
        this.scopes = new Set(scopes)
        this.scopeRegex = new RegExp(`^(${[...scopes].sort(sortByLen).join("|")})`, "i")
        this.opRegex = new RegExp(`^(${[...operators].sort(sortByLen).join("|")})`)
    }

    tokenize(input) {
        const tokens = []
        let cursor = 0
        const length = input.length

        while (cursor < length) {
            const char = input[cursor]
            if (/\s/.test(char)) {
                cursor++
                continue
            }

            const remainder = input.slice(cursor)
            if (char === "(") {
                tokens.push({ type: this.TYPE.PAREN_OPEN, value: "(", index: cursor })
                cursor++
                continue
            }
            if (char === ")") {
                tokens.push({ type: this.TYPE.PAREN_CLOSE, value: ")", index: cursor })
                cursor++
                continue
            }
            if (/^OR\b/i.test(remainder) || char === "|") {
                const value = (char === "|") ? "|" : "OR"
                tokens.push({ type: this.TYPE.OR, value, index: cursor })
                cursor += value.length
                continue
            }
            if (/^AND\b/i.test(remainder)) {
                tokens.push({ type: this.TYPE.AND, value: "AND", index: cursor })
                cursor += 3
                continue
            }
            if (/^NOT\b/i.test(remainder) || char === "-") {
                const value = char === "-" ? "-" : "NOT"
                tokens.push({ type: this.TYPE.NOT, value, index: cursor })
                cursor += value.length
                continue
            }

            const scopeMatch = remainder.match(this.scopeRegex)
            if (scopeMatch) {
                const scopeStr = scopeMatch[0]
                const afterScope = remainder.slice(scopeStr.length)
                const opMatch = afterScope.match(this.opRegex)
                if (opMatch) {
                    const opStr = opMatch[0]
                    tokens.push({ type: this.TYPE.QUALIFIER, scope: scopeStr, operator: opStr, index: cursor })
                    cursor += (scopeStr.length + opStr.length)
                    continue
                }
            }

            if (char === '"') {
                const endQuoteIdx = input.indexOf('"', cursor + 1)
                if (endQuoteIdx === -1) {
                    throw new Error(`Unclosed quote at index ${cursor}`)
                }
                const value = input.slice(cursor + 1, endQuoteIdx)
                tokens.push({ type: this.TYPE.PHRASE, value, index: cursor })
                cursor = endQuoteIdx + 1
                continue
            }

            if (char === "/") {
                let endIdx = -1
                let isEscaped = false
                for (let i = cursor + 1; i < length; i++) {
                    if (isEscaped) {
                        isEscaped = false
                        continue
                    }
                    if (input[i] === "\\") {
                        isEscaped = true
                        continue
                    }
                    if (input[i] === "/") {
                        endIdx = i
                        break
                    }
                }
                if (endIdx !== -1) {
                    const value = input.slice(cursor + 1, endIdx)
                    tokens.push({ type: this.TYPE.REGEXP, value, index: cursor })
                    cursor = endIdx + 1
                    continue
                }
            }

            const keywordMatch = remainder.match(/^[^ \t\r\n()|]+/)
            if (keywordMatch) {
                tokens.push({ type: this.TYPE.KEYWORD, value: keywordMatch[0], index: cursor })
                cursor += keywordMatch[0].length
                continue
            }

            throw new Error(`Unexpected character '${char}' at index ${cursor}`)
        }

        return tokens
    }

    parse(query) {
        if (!query || !query.trim()) {
            throw new Error("Empty Tokens")
        }

        this.tokens = this.tokenize(query)
        this.pos = 0

        const ast = this._parseExpression()
        if (this.pos < this.tokens.length) {
            const token = this._peek()
            throw new Error(`Unexpected token '${token.value || token.type}' at index ${token.index}`)
        }

        return ast
    }

    // Expression ::= Term { OR Term }
    _parseExpression() {
        let left = this._parseTerm()

        while (this._match(this.TYPE.OR)) {
            const right = this._parseTerm()
            left = { type: this.TYPE.OR, left, right }
        }

        return left
    }

    // Term ::= Factor { [AND] Factor }
    _parseTerm() {
        let left = this._parseFactor()

        while (true) {
            if (this._match(this.TYPE.AND)) {
                const right = this._parseFactor()
                left = { type: this.TYPE.AND, left, right }
            } else if (this._isStartOfFactor()) {
                // Implicit AND
                const right = this._parseFactor()
                left = { type: this.TYPE.AND, left, right }
            } else {
                break
            }
        }

        return left
    }

    // Factor ::= NOT Factor | Primary
    _parseFactor() {
        if (this._match(this.TYPE.NOT)) {
            const right = this._parseFactor()
            return { type: this.TYPE.NOT, right }
        }
        return this._parsePrimary()
    }

    // Primary ::= ( Expression ) | Qualifier? Match
    _parsePrimary() {
        if (this._match(this.TYPE.PAREN_OPEN)) {
            const node = this._parseExpression()
            if (!this._match(this.TYPE.PAREN_CLOSE)) {
                throw new Error("Missing closing parenthesis")
            }
            return node
        }

        let scope = "default"
        let operator = ":"
        if (this._peek().type === this.TYPE.QUALIFIER) {
            const qToken = this._consume()
            scope = qToken.scope
            operator = qToken.operator
        }

        const token = this._peek()
        if (token.type === this.TYPE.KEYWORD || token.type === this.TYPE.PHRASE || token.type === this.TYPE.REGEXP) {
            this._consume()
            return { type: token.type, scope, operator, operand: token.value }
        }

        throw new Error(`Unexpected token '${token.value || token.type}' at index ${token.index || 0}`)
    }

    _peek() {
        return this.tokens[this.pos] || { type: "EOF" }
    }

    _consume() {
        return this.tokens[this.pos++]
    }

    _match(type) {
        if (this._peek().type === type) {
            this._consume()
            return true
        }
        return false
    }

    _isStartOfFactor() {
        const type = this._peek().type
        return (
            type === this.TYPE.KEYWORD ||
            type === this.TYPE.PHRASE ||
            type === this.TYPE.REGEXP ||
            type === this.TYPE.QUALIFIER ||
            type === this.TYPE.PAREN_OPEN ||
            type === this.TYPE.NOT
        )
    }

    evaluate(ast, callback) {
        const { OR, AND, NOT, KEYWORD, PHRASE, REGEXP } = this.TYPE
        const recurse = (node) => {
            if (!node) return false
            switch (node.type) {
                case OR:
                    return recurse(node.left) || recurse(node.right)
                case AND:
                    return recurse(node.left) && recurse(node.right)
                case NOT:
                    return !recurse(node.right)
                case KEYWORD:
                case PHRASE:
                case REGEXP:
                    return callback(node)
                default:
                    throw new Error(`Unknown AST Node Type: ${node.type}`)
            }
        }

        return recurse(ast)
    }

    walkLeaves(ast, callback) {
        const { OR, AND, NOT, KEYWORD, PHRASE, REGEXP } = this.TYPE
        const recurse = (node) => {
            if (!node) return
            switch (node.type) {
                case OR:
                case AND:
                    recurse(node.left)
                    recurse(node.right)
                    break
                case NOT:
                    recurse(node.right)
                    break
                case KEYWORD:
                case PHRASE:
                case REGEXP:
                    callback(node)
                    break
                default:
                    throw new Error(`Unknown AST Node Type: ${node.type}`)
            }
        }
        recurse(ast)
    }
}

module.exports = Parser
