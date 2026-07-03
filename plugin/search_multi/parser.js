class Parser {
  TYPE = {
    OR: "OR",
    AND: "AND",
    NOT: "NOT",
    PAREN_OPEN: "PAREN_OPEN",
    PAREN_CLOSE: "PAREN_CLOSE",
    KEYWORD: "KEYWORD",
    PHRASE: "PHRASE",
    REGEX: "REGEX",
    QUALIFIER: "QUALIFIER",
  }

  constructor() {
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

      if (char === `"`) {
        const endQuoteIdx = input.indexOf(`"`, cursor + 1)
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
          tokens.push({ type: this.TYPE.REGEX, value, index: cursor })
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
    if (token.type === this.TYPE.KEYWORD || token.type === this.TYPE.PHRASE || token.type === this.TYPE.REGEX) {
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
      type === this.TYPE.REGEX ||
      type === this.TYPE.QUALIFIER ||
      type === this.TYPE.PAREN_OPEN ||
      type === this.TYPE.NOT
    )
  }

  evaluate(ast, callback) {
    const { OR, AND, NOT, KEYWORD, PHRASE, REGEX } = this.TYPE
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
        case REGEX:
          return callback(node)
        default:
          throw new Error(`Unknown AST Node Type: ${node.type}`)
      }
    }

    return recurse(ast)
  }

  walk(ast, visitor) {
    const { OR, AND, NOT } = this.TYPE
    const recurse = (node, depth, negated) => {
      if (!node) return
      visitor.onEnter?.(node, depth, negated)
      if (node.type === OR || node.type === AND) {
        recurse(node.left, depth + 1, negated)
        recurse(node.right, depth + 1, negated)
      } else if (node.type === NOT) {
        recurse(node.right, depth + 1, !negated)
      }
      visitor.onLeave?.(node, depth, negated)
    }
    recurse(ast, 0, false)
  }

  walkLeaves(ast, callback) {
    const { KEYWORD, PHRASE, REGEX } = this.TYPE
    this.walk(ast, {
      onEnter: (node, depth, negated) => {
        if (node.type === KEYWORD || node.type === PHRASE || node.type === REGEX) {
          callback(node, negated, depth)
        }
      },
    })
  }

  reduce(ast, reducer, negated = false) {
    if (!ast) return reducer.empty ? reducer.empty() : null
    const { OR, AND, NOT, KEYWORD, PHRASE, REGEX } = this.TYPE
    switch (ast.type) {
      case AND:
      case OR: {
        const l = this.reduce(ast.left, reducer, negated)
        const r = this.reduce(ast.right, reducer, negated)
        const fn = (ast.type === AND) !== negated ? "and" : "or"  // XOR
        return reducer[fn](l, r)
      }
      case NOT:
        return reducer.not(this.reduce(ast.right, reducer, !negated))
      case KEYWORD:
      case PHRASE:
      case REGEX:
        return reducer.terminal(ast, negated)
      default:
        throw new Error(`Unknown AST Node Type: ${ast.type}`)
    }
  }

  toDNF(ast) {
    return this.reduce(ast, {
      empty: () => [],
      and: (left, right) => {
        if (!left?.length) return right || []
        if (!right?.length) return left || []
        return left.flatMap(l => right.map(r => [...l, ...r]))
      },
      or: (left, right) => [...(left || []), ...(right || [])],
      not: child => child,
      terminal: (node, negated) => [[{ node, negated }]],
    })
  }
}

module.exports = Parser
