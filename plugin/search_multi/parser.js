const TOK = {
  OR: "OR",
  AND: "AND",
  NOT: "NOT",
  PAREN_OPEN: "PAREN_OPEN",
  PAREN_CLOSE: "PAREN_CLOSE",
  SCOPE: "SCOPE",
  OPERATOR: "OPERATOR",
  KEYWORD: "KEYWORD",
  PHRASE: "PHRASE",
  REGEX: "REGEX",
  UNKNOWN: "UNKNOWN",
  EOF: "EOF",
}

const AST = {
  LogicalExpression: "LogicalExpression",
  UnaryExpression: "UnaryExpression",
  FilterExpression: "FilterExpression",
  Identifier: "Identifier",
  Operator: "Operator",
  Literal: "Literal",
  RegexLiteral: "RegexLiteral",
}

class Lexer {
  constructor(
    scopes = ["default", "file", "path", "ext", "content", "time", "size", "status"],
    operators = [">=", "<=", ":", "=", ">", "<"],
  ) {
    this.scopes = new Set(scopes.map(s => s.toLowerCase()))
    this.operators = operators

    const toRegex = arr => `^(${Array.from(arr).sort((a, b) => b.length - a.length).join("|")})`
    this.scopeRegex = new RegExp(toRegex(this.scopes), "i")
    this.opRegex = new RegExp(toRegex(this.operators))
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

      const start = cursor
      const remainder = input.slice(cursor)

      if (char === "(") {
        tokens.push({ type: TOK.PAREN_OPEN, value: "(", start, end: ++cursor })
        continue
      }
      if (char === ")") {
        tokens.push({ type: TOK.PAREN_CLOSE, value: ")", start, end: ++cursor })
        continue
      }
      if (/^OR\b/i.test(remainder) || char === "|") {
        const value = char === "|" ? "|" : remainder.slice(0, 2)
        cursor += value.length
        tokens.push({ type: TOK.OR, value: value.toUpperCase(), start, end: cursor })
        continue
      }
      if (/^AND\b/i.test(remainder)) {
        cursor += 3
        tokens.push({ type: TOK.AND, value: "AND", start, end: cursor })
        continue
      }
      if (/^NOT\b/i.test(remainder) || char === "-") {
        const value = char === "-" ? "-" : remainder.slice(0, 3)
        cursor += value.length
        tokens.push({ type: TOK.NOT, value: value.toUpperCase(), start, end: cursor })
        continue
      }

      const scopeMatch = remainder.match(this.scopeRegex)
      if (scopeMatch) {
        const scopeStr = scopeMatch[0]
        const afterScope = remainder.slice(scopeStr.length)
        const opMatch = afterScope.match(this.opRegex)
        if (opMatch) {
          tokens.push({ type: TOK.SCOPE, value: scopeStr, start, end: cursor + scopeStr.length })
          cursor += scopeStr.length
          tokens.push({ type: TOK.OPERATOR, value: opMatch[0], start: cursor, end: cursor + opMatch[0].length })
          cursor += opMatch[0].length
          continue
        }
      }

      if (char === `"`) {
        const endQuoteIdx = input.indexOf(`"`, cursor + 1)
        if (endQuoteIdx === -1) {
          throw new Error(`Unclosed quote at index ${cursor}`)
        }
        const value = input.slice(cursor + 1, endQuoteIdx)
        tokens.push({ type: TOK.PHRASE, value, start, end: endQuoteIdx + 1 })
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
          const pattern = input.slice(cursor + 1, endIdx)
          const flagsMatch = input.slice(endIdx + 1).match(/^[a-z]+/i)
          const flags = flagsMatch ? flagsMatch[0] : ""
          const fullLen = endIdx + 1 + flags.length - cursor
          tokens.push({ type: TOK.REGEX, value: { pattern, flags }, start, end: cursor + fullLen })
          cursor += fullLen
          continue
        }
      }

      const keywordMatch = remainder.match(/^[^ \t\r\n()|]+/)
      if (keywordMatch) {
        const word = keywordMatch[0]
        tokens.push({ type: TOK.KEYWORD, value: word, start, end: cursor + word.length })
        cursor += word.length
        continue
      }

      throw new Error(`Unexpected character '${char}' at index ${cursor}`)
    }

    return tokens
  }
}

class Parser {
  parse(tokens, inputLength = 0) {
    if (tokens.length === 0) {
      throw new Error("Empty query")
    }

    this.tokens = tokens
    this.pos = 0
    this.inputLength = inputLength

    const ast = this._parseExpression()
    if (this.pos < this.tokens.length) {
      const token = this._peek()
      throw new Error(`Unexpected token '${token.value || token.type}' at index ${token.start}`)
    }

    return ast
  }

  _parseExpression() {
    let left = this._parseTerm()
    while (this._match(TOK.OR)) {
      const right = this._parseTerm()
      left = { type: AST.LogicalExpression, operator: "OR", left, right, range: [left.range[0], right.range[1]] }
    }
    return left
  }

  _parseTerm() {
    let left = this._parseFactor()
    while (true) {
      if (this._match(TOK.AND) || this._isStartOfFactor()) {
        const right = this._parseFactor()
        left = { type: AST.LogicalExpression, operator: "AND", left, right, range: [left.range[0], right.range[1]] }
      } else {
        break
      }
    }
    return left
  }

  _parseFactor() {
    if (this._match(TOK.NOT)) {
      const start = this.tokens[this.pos - 1].start
      const argument = this._parseFactor()
      return { type: AST.UnaryExpression, operator: "NOT", argument, range: [start, argument.range[1]] }
    }
    return this._parsePrimary()
  }

  _parsePrimary() {
    if (this._match(TOK.PAREN_OPEN)) {
      const start = this.tokens[this.pos - 1].start
      const node = this._parseExpression()
      if (!this._match(TOK.PAREN_CLOSE)) throw new Error(`Missing closing parenthesis for '(' at index ${start}`)
      return { ...node, range: [start, this.tokens[this.pos - 1].end] }
    }

    if (this._peek().type === TOK.SCOPE) {
      return this._parseFilterExpression()
    }

    const token = this._peek()
    if ([TOK.KEYWORD, TOK.PHRASE, TOK.REGEX].includes(token.type)) {
      this._consume()
      return this._createValueNode(token)
    }

    throw new Error(`Unexpected token '${token.value || token.type}' at index ${token.start || 0}`)
  }

  _parseFilterExpression() {
    const scopeTok = this._consume()
    const opTok = this._consume()
    const nextTok = this._peek()

    if (nextTok.type === TOK.SCOPE) {
      throw new Error(`Unexpected nested scope '${nextTok.value}' at index ${nextTok.start}`)
    }

    if ([TOK.KEYWORD, TOK.PHRASE, TOK.REGEX].includes(nextTok.type)) {
      const valueTok = this._consume()
      return {
        type: AST.FilterExpression,
        scope: { type: AST.Identifier, name: scopeTok.value.toLowerCase(), range: [scopeTok.start, scopeTok.end] },
        operator: { type: AST.Operator, value: opTok.value, range: [opTok.start, opTok.end] },
        value: this._createValueNode(valueTok),
        range: [scopeTok.start, valueTok.end],
      }
    }

    return {
      type: AST.Literal,
      value: scopeTok.value + opTok.value,
      isPhrase: false,
      range: [scopeTok.start, opTok.end],
    }
  }

  _createValueNode(token) {
    if (token.type === TOK.REGEX) {
      return { type: AST.RegexLiteral, pattern: token.value.pattern, flags: token.value.flags, range: [token.start, token.end] }
    }
    return { type: AST.Literal, value: token.value, isPhrase: token.type === TOK.PHRASE, range: [token.start, token.end] }
  }

  _peek(offset = 0) {
    const token = this.tokens[this.pos + offset]
    if (token) return token
    const last = this.tokens[this.tokens.length - 1]
    const idx = last ? last.end : this.inputLength
    return { type: TOK.EOF, value: "EOF", start: idx, end: idx }
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
    const t = this._peek().type
    return [TOK.KEYWORD, TOK.PHRASE, TOK.REGEX, TOK.SCOPE, TOK.PAREN_OPEN, TOK.NOT].includes(t)
  }
}

const ASTUtils = {
  evaluate(ast, callback) {
    const recurse = (node) => {
      if (!node) return false
      switch (node.type) {
        case AST.LogicalExpression:
          if (node.operator === "OR") {
            return recurse(node.left) || recurse(node.right)
          }
          if (node.operator === "AND") {
            return recurse(node.left) && recurse(node.right)
          }
          throw new Error(`Unknown logical operator: ${node.operator}`)
        case AST.UnaryExpression:
          if (node.operator === "NOT") {
            return !recurse(node.argument)
          }
          throw new Error(`Unknown unary operator: ${node.operator}`)
        case AST.FilterExpression:
        case AST.Literal:
        case AST.RegexLiteral:
          return callback(node)
        default:
          throw new Error(`Unknown AST Node Type: ${node.type}`)
      }
    }
    return recurse(ast)
  },

  walk(ast, visitor) {
    const recurse = (node, depth, negated) => {
      if (!node) return
      visitor.onEnter?.(node, depth, negated)
      if (node.type === AST.LogicalExpression) {
        recurse(node.left, depth + 1, negated)
        recurse(node.right, depth + 1, negated)
      } else if (node.type === AST.UnaryExpression) {
        recurse(node.argument, depth + 1, !negated)
      }
      visitor.onLeave?.(node, depth, negated)
    }
    recurse(ast, 0, false)
  },

  walkLeaves(ast, callback) {
    this.walk(ast, {
      onEnter: (node, depth, negated) => {
        if ([AST.FilterExpression, AST.Literal, AST.RegexLiteral].includes(node.type)) {
          callback(node, negated, depth)
        }
      },
    })
  },

  reduce(ast, reducer, negated = false) {
    if (!ast) return reducer.empty?.() ?? null
    switch (ast.type) {
      case AST.LogicalExpression: {
        const l = this.reduce(ast.left, reducer, negated)
        const r = this.reduce(ast.right, reducer, negated)
        const fn = (ast.operator === "AND") !== negated ? "and" : "or"
        return reducer[fn](l, r)
      }
      case AST.UnaryExpression:
        return reducer.not(this.reduce(ast.argument, reducer, !negated))
      case AST.FilterExpression:
      case AST.Literal:
      case AST.RegexLiteral:
        return reducer.terminal(ast, negated)
      default:
        throw new Error(`Unknown AST Node Type: ${ast.type}`)
    }
  },

  toDNF(ast) {
    return this.reduce(ast, {
      empty: () => [],
      and: (left, right) => {
        if (!left?.length) return right || []
        if (!right?.length) return left || []
        return left.flatMap(l => right.map(r => [...l, ...r]))
      },
      or: (left, right) => [...(left || []), ...(right || [])],
      not: node => node,
      terminal: (node, negated) => [[{ node, negated }]],
    })
  },
}

module.exports = { Lexer, Parser, ASTUtils, TOK, AST }
