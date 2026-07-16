const { Lexer, Parser, AST, ASTUtils } = require("./parser")
const { OPERATORS, getQualifiers } = require("./qualifiers")

/**
 * The Data Pipeline Engine:
 * 1. String -> [ Lexer ] -> Tokens
 * 2. Tokens -> [ Parser ] -> Raw AST
 * 3. Raw AST -> [ Semantic Analyzer ] -> Annotated AST
 * 4. Annotated AST -> [ Optimizer ] -> Balanced AST
 * 5. Balanced AST -> [ Compiler ] -> Async Execution Closures
 */
class Searcher {
  constructor(ctx) {
    this.options = { caseSensitive: ctx.config.CASE_SENSITIVE }
    this.qualifiers = new Map(getQualifiers(ctx).map(q => [q.scope, q]))
    this.lexer = new Lexer([...this.qualifiers.keys()], Object.keys(OPERATORS))
    this.parser = new Parser()
  }

  /** Phase 1 & 2 & 3: Parse and Analyze */
  parse(input) {
    input = input.replace(/\r?\n/g, " ")
    const tokens = this.lexer.tokenize(input)
    const rawAST = this.parser.parse(tokens, input.length)
    return this.analyze(rawAST)
  }

  /** Phase 3: Semantic Analysis & Binding */
  analyze(ast) {
    ASTUtils.walkLeaves(ast, node => node.semantic = this._resolveSemantics(node))
    return ast
  }

  _resolveSemantics(node) {
    const isFilter = node.type === AST.FilterExpression
    const scope = isFilter ? node.scope.name : "default"
    const operator = isFilter ? node.operator.value : ":"

    const valNode = isFilter ? node.value : node
    const isRegex = valNode.type === AST.RegexLiteral
    const matchType = isRegex ? "REGEX" : (valNode.isPhrase ? "PHRASE" : "KEYWORD")
    const operand = isRegex ? { pattern: valNode.pattern, flags: valNode.flags } : valNode.value

    const qualifier = this.qualifiers.get(scope)
    if (!qualifier) {
      throw new Error(`Unknown scope: ${scope}`)
    }
    const normalizedOperand = qualifier.normalize(operand, matchType)
    const errorMsg = qualifier.validate(operator, normalizedOperand, matchType)
    if (errorMsg) {
      throw new Error(`In ${scope}: ${errorMsg}`)
    }

    return {
      scope,
      operator,
      operand: normalizedOperand,
      matchType,
      qualifier,
      cost: qualifier.cost + (matchType === "REGEX" ? 0.5 : 0),
      castResult: qualifier.cast(normalizedOperand, matchType, this.options),
      anchor: qualifier.anchor,
    }
  }

  /** Phase 4: Optimization & Tree Rebalancing */
  optimize(ast) {
    if (!ast) return null

    const getCost = n => n?.semantic?.cost || 0
    const rebuild = (node) => {
      if (!node) return null
      if (node.type === AST.UnaryExpression) {
        const argument = rebuild(node.argument)
        return argument ? { ...node, argument, semantic: { cost: getCost(argument) } } : null
      }

      if (node.type !== AST.LogicalExpression) {
        return node
      }

      const dataNodes = []
      const extract = (n) => {
        if (!n) return
        if (n.type === node.type && n.operator === node.operator) {
          extract(n.left)
          extract(n.right)
        } else {
          dataNodes.push(rebuild(n))
        }
      }

      extract(node.left)
      extract(node.right)

      const nodes = dataNodes.filter(Boolean)
      if (nodes.length === 0) return null
      if (nodes.length === 1) return nodes[0]

      const rebuiltSubTree = nodes
        .sort((a, b) => getCost(a) - getCost(b))
        .reduceRight((right, left) => ({
          type: AST.LogicalExpression,
          operator: node.operator,
          left,
          right,
          semantic: { cost: Math.max(getCost(left), getCost(right)) },
        }))
      return { ...node, ...rebuiltSubTree }
    }

    return rebuild(ast)
  }

  /** Phase 5: Code Generation (Execution Closures) */
  compile(ast) {
    if (!ast) return async (ctx) => true

    const transform = this.options.caseSensitive
      ? v => v
      : v => {
        if (typeof v === "string") return v.toLowerCase()
        if (Array.isArray(v)) return v.map(s => typeof s === "string" ? s.toLowerCase() : s)
        return v
      }

    return ASTUtils.reduce(ast, {
      empty: () => async (ctx) => false,
      and: (left, right) => async (ctx) => (await left(ctx)) && (await right(ctx)),
      or: (left, right) => async (ctx) => (await left(ctx)) || (await right(ctx)),
      not: node => node,
      terminal: (node, negated) => {
        const { scope, operator, castResult, matchType, qualifier } = node.semantic
        const matchFn = qualifier.match[matchType]
        return async (ctx) => {
          const queryResult = await ctx.compute(scope, async () => transform(await qualifier.query(ctx)))
          const isMatch = matchFn(operator, castResult, queryResult)
          return negated ? !isMatch : isMatch
        }
      },
    })
  }

  extractHighlightConditions = (ast) => {
    const isMeta = new Set([...this.qualifiers.values()].filter(q => q.is_meta).map(q => q.scope))
    const conds = []
    ASTUtils.walkLeaves(ast, (node, negated) => {
      if (negated || isMeta.has(node.semantic.scope)) return
      const { matchType, operand, anchor } = node.semantic
      const isRegex = matchType === "REGEX"
      const rawPattern = isRegex ? operand.pattern : String(operand)
      const pattern = isRegex ? operand.pattern : rawPattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      const flags = isRegex ? operand.flags : ""
      const strictReg = isRegex ? new RegExp(`^(${pattern})$`, flags.replace(/[gy]/ig, "")) : null
      conds.push({ id: conds.length, name: rawPattern, anchor, isRegex, rawPattern, pattern, flags, strictReg })
    })
    return conds
  }

  toDNF = (ast) => {
    const rawDNF = ASTUtils.toDNF(ast)
    return rawDNF.map(path => path.map(({ node, negated }) => {
      const isBoolean = typeof node.semantic.castResult === "boolean"
      const finalNegated = isBoolean ? (node.semantic.castResult === negated) : negated
      return { node, negated: finalNegated, isBoolean }
    }))
  }

  getGrammar = () => `
<query> ::= <expression>
<expression> ::= <term> ( <or> <term> )*
<term> ::= <factor> ( <and> <factor> )*
<factor> ::= <not>? <primary>
<primary> ::= '(' <expression> ')' | <filter_expr> | <literal> | <regex_literal>
<filter_expr> ::= <scope> <operator> ( <literal> | <regex_literal> )
<literal> ::= <keyword> | <phrase>
<regex_literal> ::= '/' <regex> '/' <flags>?
<or> ::= 'OR' | '|'
<and> ::= 'AND' | ' '
<not> ::= 'NOT' | '-'
<keyword> ::= [^\\s"()|]+
<phrase> ::= '"' [^"]* '"'
<regex> ::= [^/]+
<flags> ::= [a-z]*
<operator> ::= ${Object.keys(OPERATORS).map(s => `'${s}'`).join(" | ")}
<scope> ::= ${[...this.qualifiers.keys()].map(s => `'${s}'`).join(" | ")}`.trim()
}

module.exports = Searcher
