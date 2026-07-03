const FsExtra = require("fs-extra")
const Parser = require("./parser")
const { OPERATORS, getQualifiers } = require("./qualifiers")

class Source {
  _contentPromise = null
  _cache = Object.create(null)

  constructor(path, file, dir, stats) {
    this.path = path
    this.file = file
    this.dir = dir
    this.stats = stats
  }

  getContent() {
    if (!this._contentPromise) this._contentPromise = FsExtra.readFile(this.path, "utf-8")
    return this._contentPromise
  }

  compute(key, fn) {
    if (!(key in this._cache)) {
      this._cache[key] = fn(this)
    }
    return this._cache[key]
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
 *   {string}   scope:         The query scope
 *   {string}   name:          A descriptive name for explanation purposes
 *   {string}   ancestor:      The ancestor Element in DOM. Only available when is_meta=false
 *   {boolean}  is_meta:       Indicates if the qualifier scope is a metadata property
 *   {number}   cost:          The performance cost associated with the `query` function. 1: Read file stats; 2: Read file content; 3: Parse file content; Plus 0.5 when the user input is a regex
 *   {function} normalize:     Convert certain specific, predefined, and special meaning vocabulary from the user input
 *   {function} validate:      Checks user input and obtain `validateError`
 *   {function} cast:          Converts user input for easier matching and obtain `castResult`
 *   {function} query:         Retrieves data from source and obtain `queryResult`
 *   {function} match.KEYWORD: Matches `castResult` with `queryResult` when the user input is a keyword
 *   {function} match.PHRASE:  Matches `castResult` with `queryResult` when the user input is a phrase. Behaves the same as `match.KEYWORD` by default
 *   {function} match.REGEX:   Matches `castResult` with `queryResult` when the user input is a regex
 */
class Searcher {
  parser = new Parser()
  qualifiers = new Map()

  constructor(ctx) {
    this.ctx = ctx
    this.config = ctx.config
  }

  process = () => {
    this.registerQualifiers(getQualifiers(this.ctx))
  }

  registerQualifiers = (qualifierDefinitions) => {
    qualifierDefinitions.forEach(q => this.qualifiers.set(q.scope, q))
    this.parser.setQualifier([...this.qualifiers.keys()], Object.keys(OPERATORS))
  }

  parse = (input, optimize = false) => {
    input = input.replace(/\r?\n/g, " ")
    const ast = this.parser.parse(input)
    this.postParse(ast)
    return optimize ? this.optimize(ast) : ast
  }

  postParse = (ast) => {
    const { REGEX } = this.parser.TYPE
    const castOptions = { caseSensitive: this.config.CASE_SENSITIVE }
    this.parser.walkLeaves(ast, node => {
      node.scope = node.scope.toLowerCase()
      const qualifier = this.qualifiers.get(node.scope)
      node.operand = qualifier.normalize(node.operand, node.type)
      const errorMsg = qualifier.validate(node.operator, node.operand, node.type)
      if (errorMsg) {
        throw new Error(`In ${node.scope.toUpperCase()}: ${errorMsg}`)
      }
      node.cost = qualifier.cost + (node.type === REGEX ? 0.5 : 0)
      node.anchor = qualifier.anchor
      node.castResult = qualifier.cast(node.operand, node.type, castOptions)
    })
    return ast
  }

  /**
   * Re-balances OR/AND trees to execute cheaper conditions first (Short-circuiting)
   * Process OR/AND nodes by:
   * 1. Gathering data child nodes into `dataNodes`
   * 2. Sorting `dataNodes` by `cost`
   * 3. Rebuilding the subtree based on `dataNodes` to favor low-cost operations
   */
  optimize = (ast) => {
    if (!ast) return

    const { OR, AND, NOT } = this.parser.TYPE
    const calcCost = (node) => {
      if (!node) return 0
      if (node.cost !== undefined && node.type !== OR && node.type !== AND && node.type !== NOT) {
        return node.cost
      }
      if (node.type === NOT) {
        node.cost = calcCost(node.right)
        return node.cost
      }
      const leftCost = calcCost(node.left)
      const rightCost = calcCost(node.right)
      node.cost = Math.max(leftCost, rightCost)
      return node.cost
    }
    const rebuild = (node) => {
      if (!node) return
      if (node.type === NOT) {
        rebuild(node.right)
        return
      }
      if (node.type !== OR && node.type !== AND) return

      rebuild(node.left)
      rebuild(node.right)

      const dataNodes = getDataNodes(node, node.type)
      if (dataNodes.length > 1) {
        dataNodes.sort((a, b) => (a.cost || 0) - (b.cost || 0))
        let newNode = dataNodes.shift()
        while (dataNodes.length) {
          const right = dataNodes.shift()
          newNode = { type: node.type, left: newNode, right: right, cost: Math.max(newNode.cost, right.cost) }
        }
        node.left = newNode.left
        node.right = newNode.right
        node.cost = newNode.cost
      }
    }
    const getDataNodes = (node, type, ret = []) => {
      if (node.type === type) {
        getDataNodes(node.left, type, ret)
        getDataNodes(node.right, type, ret)
      } else {
        ret.push(node)
      }
      return ret
    }

    calcCost(ast)
    rebuild(ast)
    return ast
  }

  /**
   * Compiles the AST into a highly optimized, asynchronous query execution plan
   *
   * Architectural optimizations applied:
   * 1. AOT Compilation: Eliminates runtime AST traversal and dynamic dictionary lookups
   * 2. De Morgan's Laws: Pushes `NOT` operations down to leaf nodes via `reduce`
   * 3. Zero-Allocation Caching: Inlines a POJO cache per execution to minimize GC pauses
   * 4. Short-Circuiting: Preserves native `&&` and `||` evaluation paths
   *
   * @param {Object} ast - The optimized AST to compile
   * @returns {function(Object): Promise<boolean>} A pure, encapsulated async matcher
   */
  compile = (ast) => {
    if (!ast) return async (source) => true

    const transform = this.config.CASE_SENSITIVE
      ? v => v
      : v => {
        if (typeof v === "string") return v.toLowerCase()
        if (Array.isArray(v)) return v.map(s => typeof s === "string" ? s.toLowerCase() : s)
        return v
      }

    return this.parser.reduce(ast, {
      empty: () => async (source) => false,
      and: (left, right) => async (source, cache) => (await left(source, cache)) && (await right(source, cache)),
      or: (left, right) => async (source, cache) => (await left(source, cache)) || (await right(source, cache)),
      not: node => node,
      terminal: (node, negated) => {
        const { scope, operator, castResult, type } = node
        const qualifier = this.qualifiers.get(scope)
        const matchFn = qualifier.match[type]
        return async (source) => {
          const queryResult = await source.compute(scope, async () => transform(await qualifier.query(source)))
          const isMatch = matchFn(operator, castResult, queryResult)
          return negated ? !isMatch : isMatch
        }
      },
    })
  }

  getFileParamsProvider = (ast) => {
    return (path, file, dir, stats) => new Source(path, file, dir, stats)
  }

  getPositiveContentTokens = (ast) => {
    const isMeta = new Set([...this.qualifiers.values()].filter(q => q.is_meta).map(q => q.scope))
    const contentNodes = new Set()
    this.parser.walkLeaves(ast, (node, negated) => {
      if (!negated && !isMeta.has(node.scope)) {
        contentNodes.add(node)
      }
    })
    return [...contentNodes]
      .map(n => n.type === this.parser.TYPE.REGEX ? n.operand : n.operand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .filter(Boolean)
  }

  toDNF = (ast) => {
    const rawDNF = this.parser.toDNF(ast)
    return rawDNF.map(path => path.map(({ node, negated }) => {
      const isBoolean = typeof node.castResult === "boolean"
      const finalNegated = isBoolean ? (node.castResult === negated) : negated
      return { node, negated: finalNegated, isBoolean }
    }))
  }

  getGrammar = () => `
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
<operator> ::= ${[...Object.keys(OPERATORS)].map(s => `'${s}'`).join(" | ")}
<scope> ::= ${[...this.qualifiers.values()].map(s => `'${s.scope}'`).join(" | ")}`.trim()
}

module.exports = Searcher
