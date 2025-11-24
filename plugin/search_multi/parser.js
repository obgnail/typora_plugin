/**
 * grammar:
 *   <query> ::= <expression>
 *   <expression> ::= <term> ( <or> <term> )*
 *   <term> ::= <factor> ( <conjunction> <factor> )*
 *   <factor> ::= <qualifier>? <match>
 *   <qualifier> ::= <scope> <operator>
 *   <match> ::= <keyword> | '"'<keyword>'"' | '/'<regexp>'/' | '('<expression>')'
 *   <conjunction> ::= <and> | <not>
 *   <and> ::= 'AND' | ' '
 *   <or> ::= 'OR' | '|'
 *   <not> ::= 'NOT' | '-'
 *   <keyword> ::= [^\\s"()|]+
 *   <regexp> ::= [^/]+
 *   <operator> ::= ':' | '=' | '>=' | '<=' | '>' | '<'
 *   <scope> ::= 'default' | 'file' | 'path' | 'ext' | 'content' | 'size' | 'time'
 * */
class Parser {
    constructor() {
        const TYPE = {
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
        this.TYPE = TYPE
        const { OR, AND, NOT, QUALIFIER, PAREN_OPEN, PAREN_CLOSE } = TYPE
        this.INVALID_POSITION = {
            FIRST: new Set([OR, AND, PAREN_CLOSE]),
            LAST: new Set([OR, AND, NOT, PAREN_OPEN, QUALIFIER]),
            FOLLOW: {
                [OR]: new Set([OR, AND, PAREN_CLOSE]),
                [AND]: new Set([OR, AND, PAREN_CLOSE]),
                [NOT]: new Set([OR, AND, NOT, PAREN_CLOSE]),
                [PAREN_OPEN]: new Set([OR, AND, PAREN_CLOSE]),
                [QUALIFIER]: new Set([OR, AND, NOT, PAREN_CLOSE, QUALIFIER]),
            },
            AND: {
                PREV: new Set([OR, AND, NOT, PAREN_OPEN, QUALIFIER]),
                NEXT: new Set([OR, AND, NOT, PAREN_CLOSE]),
            },
        }
        this.setQualifier()
    }

    setQualifier(scope = ["default", "file", "path", "ext", "content", "time", "size"], operator = [">=", "<=", ":", "=", ">", "<"]) {
        const byLength = (a, b) => b.length - a.length
        const _scope = [...scope].sort(byLength).join("|")
        const _operator = [...operator].sort(byLength).join("|")
        this.regex = new RegExp(
            [
                `(?<AND>(\\s|\\bAND\\b)+)`,
                `(?<NOT>-|\\bNOT\\b)`,
                `"(?<PHRASE>[^"]*)"`,
                `(?<PAREN_OPEN>\\()`,
                `(?<PAREN_CLOSE>\\))`,
                `(?<OR>\\||\\bOR\\b)`,
                `(?<QUALIFIER>(?<SCOPE>${_scope})(?<OPERATOR>${_operator}))`,
                `\\/(?<REGEXP>.*?)(?<!\\\\)\\/`,
                `(?<KEYWORD>[^\\s"()|]+)`,
            ].join("|"),
            "gi"
        )
    }

    tokenize(query) {
        return [...query.trim().matchAll(this.regex)]
            .map(_tokens => {
                const [qualifier, operand = ""] = Object.entries(_tokens.groups).find(([_, v]) => v != null)
                const type = this.TYPE[qualifier] || this.TYPE.KEYWORD
                return qualifier === this.TYPE.QUALIFIER
                    ? { type, scope: _tokens.groups.SCOPE, operator: _tokens.groups.OPERATOR }
                    : { type, operand }
            })
            .filter((token, i, tokens) => {
                if (token.type !== this.TYPE.AND) {
                    return true
                }
                const prev = tokens[i - 1]
                const next = tokens[i + 1]
                let result = true
                if (prev) {
                    result = result && !this.INVALID_POSITION.AND.PREV.has(prev.type)
                }
                if (next) {
                    result = result && !this.INVALID_POSITION.AND.NEXT.has(next.type)
                }
                return result
            })
    }

    check(tokens) {
        // check first
        const first = tokens[0]
        if (this.INVALID_POSITION.FIRST.has(first.type)) {
            throw new Error(`Invalid First Token:「${first.type}」`)
        }

        // check last
        const last = tokens[tokens.length - 1]
        if (this.INVALID_POSITION.LAST.has(last.type)) {
            throw new Error(`Invalid Last Token:「${last.type}」`)
        }

        // check follow
        tokens.slice(0, -1).forEach((token, i) => {
            const follow = tokens[i + 1]
            if (this.INVALID_POSITION.FOLLOW[token.type]?.has(follow.type)) {
                throw new Error(`Invalid Token Sequence:「${token.type}」followed by「${follow.type}」`)
            }
        })

        // check parentheses
        let balance = 0
        tokens.forEach(token => {
            if (token.type === this.TYPE.PAREN_OPEN) {
                balance++
            } else if (token.type === this.TYPE.PAREN_CLOSE) {
                balance--
                if (balance < 0) {
                    throw new Error(`Unmatched「${this.TYPE.PAREN_CLOSE}」`)
                }
            }
        })
        if (balance !== 0) {
            throw new Error(`Unmatched「${this.TYPE.PAREN_OPEN}」`)
        }
    }

    _parseExpression(tokens) {
        let node = this._parseTerm(tokens)
        while (tokens.length > 0) {
            const type = tokens[0].type
            if (type === this.TYPE.OR) {
                tokens.shift()
                const right = this._parseTerm(tokens)
                node = { type, left: node, right }
            } else {
                break
            }
        }
        return node
    }

    _parseTerm(tokens) {
        let node = this._parseFactor(tokens)
        while (tokens.length > 0) {
            const type = tokens[0].type
            if (type === this.TYPE.NOT || type === this.TYPE.AND) {
                tokens.shift()
                const right = this._parseFactor(tokens)
                node = { type, left: node, right }
            } else {
                break
            }
        }
        return node
    }

    _parseFactor(tokens) {
        const qualifier = (tokens[0].type === this.TYPE.QUALIFIER)
            ? tokens.shift()
            : { type: this.TYPE.QUALIFIER, scope: "default", operator: ":" }
        const node = this._parseMatch(tokens)
        return this._setQualifier(node, qualifier)
    }

    _parseMatch(tokens) {
        const type = tokens[0].type
        if (type === this.TYPE.PHRASE || type === this.TYPE.KEYWORD || type === this.TYPE.REGEXP) {
            return { type, operand: tokens.shift().operand }
        } else if (type === this.TYPE.PAREN_OPEN) {
            tokens.shift()
            const node = this._parseExpression(tokens)
            if (tokens.shift().type !== this.TYPE.PAREN_CLOSE) {
                throw new Error(`Unmatched「${this.TYPE.PAREN_OPEN}」`)
            }
            return node
        }
    }

    _setQualifier(node, qualifier) {
        if (!node) return
        const type = node.type
        const isLeaf = type === this.TYPE.PHRASE || type === this.TYPE.KEYWORD || type === this.TYPE.REGEXP
        const isDefault = !node.scope || node.scope === "default"
        if (isLeaf && isDefault) {
            node.scope = qualifier.scope
            node.operator = qualifier.operator
        } else {
            this._setQualifier(node.left, qualifier)
            this._setQualifier(node.right, qualifier)
        }
        return node
    }

    parse(query) {
        query = query.trim()
        const tokens = this.tokenize(query)
        if (tokens.length === 0) {
            // return { type: this.TYPE.KEYWORD, scope: "default", operator: ":", operand: "" }
            throw new Error(`Empty Tokens`)
        }
        this.check(tokens)
        const ast = this._parseExpression(tokens)
        if (tokens.length !== 0) {
            throw new Error(`Failed to Parse Tokens: ${tokens.join(" ")}`)
        }
        return ast
    }

    evaluate(ast, callback) {
        const { KEYWORD, PHRASE, REGEXP, OR, AND, NOT } = this.TYPE

        function _eval(node) {
            const { type, left, right } = node
            switch (type) {
                case KEYWORD:
                case PHRASE:
                case REGEXP:
                    return callback(node)
                case OR:
                    return _eval(left) || _eval(right)
                case AND:
                    return _eval(left) && _eval(right)
                case NOT:
                    return (left ? _eval(left) : true) && !_eval(right)
                default:
                    throw new Error(`Unknown AST Node「${type}」`)
            }
        }

        return _eval(ast)
    }

    walk(ast, callback) {
        const { KEYWORD, PHRASE, REGEXP, OR, AND, NOT } = this.TYPE

        function _eval(node) {
            const { type, left, right } = node
            switch (type) {
                case KEYWORD:
                case PHRASE:
                case REGEXP:
                    callback(node)
                    break
                case OR:
                case AND:
                    _eval(left)
                    _eval(right)
                    break
                case NOT:
                    if (left) _eval(left)
                    _eval(right)
                    break
                default:
                    throw new Error(`Unknown AST Node「${type}」`)
            }
        }

        return _eval(ast)
    }
}

module.exports = Parser
