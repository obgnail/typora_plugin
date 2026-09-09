const { describe, it, beforeEach } = require("node:test")
const assert = require("node:assert")
const { Lexer, Parser, ASTUtils, TOK, AST } = require("../../plugin/search_multi/parser.js")

const stripMeta = (tokens) => tokens.map(({ start, end, ...rest }) => rest)
const stripRange = (node) => {
  if (!node) return node
  if (Array.isArray(node)) return node.map(stripRange)
  if (typeof node !== "object") return node
  const { range, ...rest } = node
  for (const key in rest) {
    rest[key] = stripRange(rest[key])
  }
  return rest
}

// AST node factories for testing
const literal = (val, isPhrase = false) => ({ type: AST.Literal, value: val, isPhrase })
const regexLit = (val, flags = "") => ({ type: AST.RegexLiteral, pattern: val, flags })
const filterExpr = (scopeName, opValue, valueNode) => ({
  type: AST.FilterExpression,
  scope: { type: AST.Identifier, name: scopeName },
  operator: { type: AST.Operator, value: opValue },
  value: valueNode,
})

let lexer, parser
beforeEach(() => {
  lexer = new Lexer(["default", "file", "path", "ext", "content", "time", "size", "status"], [">=", "<=", ":", "=", ">", "<"])
  parser = new Parser()
})

describe("Search Parser: Lexer (Atomic Tokenization)", () => {
  it("Basic keywords and phrases", () => {
    const tokens = lexer.tokenize(`hello "search world"`)
    assert.deepStrictEqual(stripMeta(tokens), [
      { type: TOK.KEYWORD, value: "hello" },
      { type: TOK.PHRASE, value: "search world" },
    ])
  })

  it("Isolated scopes are correctly typed before downcasting", () => {
    const tokens = lexer.tokenize("size file path")
    assert.deepStrictEqual(stripMeta(tokens), [
      { type: TOK.KEYWORD, value: "size" },
      { type: TOK.KEYWORD, value: "file" },
      { type: TOK.KEYWORD, value: "path" },
    ])
  })

  it("Scope and Operator are strictly separated (Atomic separation)", () => {
    const tokens = lexer.tokenize("size>=100 file:test")
    assert.deepStrictEqual(stripMeta(tokens), [
      { type: TOK.SCOPE, value: "size" },
      { type: TOK.OPERATOR, value: ">=" },
      { type: TOK.KEYWORD, value: "100" },
      { type: TOK.SCOPE, value: "file" },
      { type: TOK.OPERATOR, value: ":" },
      { type: TOK.KEYWORD, value: "test" },
    ])
  })

  it("Regex with escaped slash and flags", () => {
    const tokens = lexer.tokenize("/home\\/user/gi")
    assert.deepStrictEqual(stripMeta(tokens), [
      { type: TOK.REGEX, value: { pattern: "home\\/user", flags: "gi" } },
    ])
  })

  it("Hyphen vs NOT", () => {
    const tokens = lexer.tokenize("-test test-case")
    assert.deepStrictEqual(stripMeta(tokens), [
      { type: TOK.NOT, value: "-" },
      { type: TOK.KEYWORD, value: "test" },
      { type: TOK.KEYWORD, value: "test-case" },
    ])
  })

  it("Boolean operators case sensitivity", () => {
    const tokens = lexer.tokenize("hello and world AND test")
    assert.deepStrictEqual(stripMeta(tokens), [
      { type: TOK.KEYWORD, value: "hello" },
      { type: TOK.AND, value: "AND" },
      { type: TOK.KEYWORD, value: "world" },
      { type: TOK.AND, value: "AND" },
      { type: TOK.KEYWORD, value: "test" },
    ])
  })

  it("Scope and Operator must be contiguous, otherwise fallback to KEYWORD", () => {
    // "size >= 10" (with spaces) should NOT form a valid SCOPE/OPERATOR pair in this strict Lexer design
    const tokens = lexer.tokenize("size >= 10")
    assert.deepStrictEqual(stripMeta(tokens), [
      { type: TOK.KEYWORD, value: "size" },
      { type: TOK.KEYWORD, value: ">=" },
      { type: TOK.KEYWORD, value: "10" },
    ])
  })
})

describe("Search Parser: Parser (ESTree-like AST Generation)", () => {
  const parse = (query) => stripRange(parser.parse(lexer.tokenize(query), query.length))

  it("Implicit AND", () => {
    const ast = parse("a b c")
    assert.deepStrictEqual(ast, {
      type: AST.LogicalExpression,
      operator: "AND",
      left: {
        type: AST.LogicalExpression,
        operator: "AND",
        left: literal("a"),
        right: literal("b"),
      },
      right: literal("c"),
    })
  })

  it("Operator Precedence & Associativity", () => {
    const ast = parse("a OR b AND c")
    assert.deepStrictEqual(ast, {
      type: AST.LogicalExpression,
      operator: "OR",
      left: literal("a"),
      right: {
        type: AST.LogicalExpression,
        operator: "AND",
        left: literal("b"),
        right: literal("c"),
      },
    })
  })

  it("Grouping with Parentheses & NOT", () => {
    const ast = parse("NOT (a OR b)")
    assert.deepStrictEqual(ast, {
      type: AST.UnaryExpression,
      operator: "NOT",
      argument: {
        type: AST.LogicalExpression,
        operator: "OR",
        left: literal("a"),
        right: literal("b"),
      },
    })
  })

  it("FilterExpressions with standard targets", () => {
    assert.deepStrictEqual(parse(`content:"hello"`), filterExpr("content", ":", literal("hello", true)))
    assert.deepStrictEqual(parse(`path:/api\\/v1/`), filterExpr("path", ":", regexLit("api\\/v1")))
  })

  it("Contextual Downcasting: Scopes without operators become Literals", () => {
    const ast = parse(`ext:size`)
    // "size" is a known scope, but appears as a value here. Should downcast to Literal.
    assert.deepStrictEqual(ast, filterExpr("ext", ":", literal("size")))
  })

  it("Contextual Downcasting: Isolated operators become Literals", () => {
    const ast = parse(`> 10`)
    assert.deepStrictEqual(ast, {
      type: AST.LogicalExpression,
      operator: "AND",
      left: literal(">"),
      right: literal("10"),
    })
  })

  it("Qualifiers in Phrase", () => {
    const ast = parse(`"content:hello"`)
    assert.deepStrictEqual(ast, literal("content:hello", true))
  })

  it("Mixed Complex Query", () => {
    const ast = parse("(status:active OR status:pending) AND -file:temp.js")
    assert.deepStrictEqual(ast, {
      type: AST.LogicalExpression,
      operator: "AND",
      left: {
        type: AST.LogicalExpression,
        operator: "OR",
        left: filterExpr("status", ":", literal("active")),
        right: filterExpr("status", ":", literal("pending")),
      },
      right: {
        type: AST.UnaryExpression,
        operator: "NOT",
        argument: filterExpr("file", ":", literal("temp.js")),
      },
    })
  })

  it("Qualifier with regex", () => {
    const ast = parse("path:/api\\/v1/")
    assert.deepStrictEqual(ast, filterExpr("path", ":", regexLit("api\\/v1")))
  })
})

describe("Search Parser: Error Handling & Tolerant Mode", () => {
  const doParse = (query) => parser.parse(lexer.tokenize(query), query.length)

  it("Strict Mode: Unclosed Quotes & Parens throw", () => {
    assert.throws(() => doParse(`"incomplete`), /Unclosed quote/)
    assert.throws(() => doParse("(a AND b"), /Missing closing parenthesis/)
    assert.throws(() => doParse("a AND"), /Unexpected token 'EOF'/)
  })

  it("Strict Mode: Unclosed Quote with Qualifiers", () => {
    assert.throws(() => doParse(`content:"incomplete`), /Unclosed quote/)
  })

  it("Strict Mode: Unmatched Closing Parenthesis", () => {
    assert.throws(() => doParse("a AND b)"), /Unexpected token '\)'/)
  })

  it("Strict Mode: Empty Parentheses", () => {
    assert.throws(() => doParse("()"), /Unexpected token '\)'/)
  })

  it("Strict Mode: Operator without Left Operand", () => {
    assert.throws(() => doParse("OR b"), /Unexpected token 'OR'/)
  })

  it("Tolerant Mode: Incomplete FilterExpressions fallback to concatenated Literal", () => {
    parser = new Parser()
    const tokens = lexer.tokenize("size>")
    const ast = stripRange(parser.parse(tokens, 5))
    // Highly specific for autocomplete UX: "size>" becomes literal "size>" to allow continuous typing
    assert.deepStrictEqual(ast, literal("size>"))
  })
})

describe("Search Parser: ASTUtils (Stateless Traversal & Reduction)", () => {
  const ast = filterExpr("size", ">=", literal("10kb"))

  it("evaluate()", () => {
    const cb = (node) => node.value.value === "10kb"
    assert.strictEqual(ASTUtils.evaluate(ast, cb), true)
  })

  it("walkLeaves()", () => {
    let hits = 0
    ASTUtils.walkLeaves(ast, (node, negated, depth) => {
      assert.strictEqual(node.type, AST.FilterExpression)
      hits++
    })
    assert.strictEqual(hits, 1)
  })

  it("toDNF() (Disjunctive Normal Form)", () => {
    const tokens = lexer.tokenize("a AND (b OR c)")
    const complexAst = parser.parse(tokens, 14)
    const dnf = stripRange(ASTUtils.toDNF(complexAst))

    // Should yield [[a, b], [a, c]]
    assert.strictEqual(dnf.length, 2)
    assert.strictEqual(dnf[0][0].node.value, "a")
    assert.strictEqual(dnf[0][1].node.value, "b")
    assert.strictEqual(dnf[1][1].node.value, "c")
  })

  it("Complex Logic Evaluation", () => {
    const query = "(A OR B) AND -C"
    const parsedAst = parser.parse(lexer.tokenize(query), query.length)

    // Scenario 1: A=true, B=false, C=false => (t|f) & !f => t & t => TRUE
    assert.strictEqual(ASTUtils.evaluate(parsedAst, n => {
      if (n.value === "A") return true
      if (n.value === "B") return false
      if (n.value === "C") return false
      return false
    }), true)

    // Scenario 2: A=false, B=false => (f|f) & ... => FALSE
    assert.strictEqual(ASTUtils.evaluate(parsedAst, n => {
      return false
    }), false)

    // Scenario 3: A=true, C=true => (t|...) & !t => t & f => FALSE
    assert.strictEqual(ASTUtils.evaluate(parsedAst, n => {
      if (n.value === "A") return true
      if (n.value === "C") return true
      return false
    }), false)
  })
})

describe("Search Parser: ASTUtils.collectSameOperatorChildren()", () => {
  const parse = (query) => stripRange(parser.parse(lexer.tokenize(query), query.length))

  it("Leaf node (non-LogicalExpression) returns itself wrapped in array", () => {
    const leaf = literal("a")
    assert.deepStrictEqual(ASTUtils.collectSameOperatorChildren(leaf, "AND"), [leaf])
  })

  it("FilterExpression leaf returns itself wrapped in array", () => {
    const leaf = filterExpr("size", ">=", literal("10kb"))
    assert.deepStrictEqual(ASTUtils.collectSameOperatorChildren(leaf, "AND"), [leaf])
  })

  it("UnaryExpression (NOT) is treated as an opaque leaf, not recursed into", () => {
    const node = { type: AST.UnaryExpression, operator: "NOT", argument: literal("a") }
    assert.deepStrictEqual(ASTUtils.collectSameOperatorChildren(node, "AND"), [node])
  })

  it("Single-level same-operator AND flattens both sides", () => {
    const ast = parse("a AND b")
    const children = ASTUtils.collectSameOperatorChildren(ast, "AND")
    assert.deepStrictEqual(children, [literal("a"), literal("b")])
  })

  it("Single-level same-operator OR flattens both sides", () => {
    const ast = parse("a OR b")
    const children = ASTUtils.collectSameOperatorChildren(ast, "OR")
    assert.deepStrictEqual(children, [literal("a"), literal("b")])
  })

  it("Left-leaning chain AND(AND(a,b),c) flattens to [a,b,c]", () => {
    // Implicit AND via "a b c" produces a left-leaning tree
    const ast = parse("a b c")
    const children = ASTUtils.collectSameOperatorChildren(ast, "AND")
    assert.deepStrictEqual(children, [literal("a"), literal("b"), literal("c")])
  })

  it("Right-leaning chain AND(a,AND(b,c)) flattens to [a,b,c]", () => {
    const ast = {
      type: AST.LogicalExpression,
      operator: "AND",
      left: literal("a"),
      right: {
        type: AST.LogicalExpression,
        operator: "AND",
        left: literal("b"),
        right: literal("c"),
      },
    }
    const children = ASTUtils.collectSameOperatorChildren(ast, "AND")
    assert.deepStrictEqual(children, [literal("a"), literal("b"), literal("c")])
  })

  it("Deep 4-term chain flattens fully regardless of nesting shape", () => {
    const ast = {
      type: AST.LogicalExpression,
      operator: "AND",
      left: {
        type: AST.LogicalExpression,
        operator: "AND",
        left: literal("a"),
        right: literal("b"),
      },
      right: {
        type: AST.LogicalExpression,
        operator: "AND",
        left: literal("c"),
        right: literal("d"),
      },
    }
    const children = ASTUtils.collectSameOperatorChildren(ast, "AND")
    assert.deepStrictEqual(children, [literal("a"), literal("b"), literal("c"), literal("d")])
  })

  it("Stops flattening at an operator boundary (mixed AND/OR)", () => {
    // AND(OR(a,b), c) -- collecting "AND" children should NOT descend into the OR subtree
    const ast = parse("(a OR b) AND c")
    const children = ASTUtils.collectSameOperatorChildren(ast, "AND")
    assert.strictEqual(children.length, 2)
    assert.deepStrictEqual(children[0], {
      type: AST.LogicalExpression,
      operator: "OR",
      left: literal("a"),
      right: literal("b"),
    })
    assert.deepStrictEqual(children[1], literal("c"))
  })

  it("Stops flattening at a NOT boundary inside an AND chain", () => {
    const ast = parse("a AND -b")
    const children = ASTUtils.collectSameOperatorChildren(ast, "AND")
    assert.strictEqual(children.length, 2)
    assert.deepStrictEqual(children[0], literal("a"))
    assert.deepStrictEqual(children[1], {
      type: AST.UnaryExpression,
      operator: "NOT",
      argument: literal("b"),
    })
  })

  it("Requesting a different operator than the node's own operator does not flatten", () => {
    // Node itself is OR, but we ask to collect "AND" children -> node itself is returned unflattened
    const ast = parse("a OR b")
    const children = ASTUtils.collectSameOperatorChildren(ast, "AND")
    assert.deepStrictEqual(children, [ast])
  })

  it("Original example (789 OR 12) - ABC preserves nested structure per level", () => {
    const ast = parse(`(789 OR 12) - ABC`)
    // Top level is AND: [OR(789, 12), NOT(ABC)]
    const topChildren = ASTUtils.collectSameOperatorChildren(ast, "AND")
    assert.strictEqual(topChildren.length, 2)
    // Descending one more level into the OR branch flattens 789/12
    const orChildren = ASTUtils.collectSameOperatorChildren(topChildren[0], "OR")
    assert.deepStrictEqual(orChildren, [literal("789"), literal("12")])
    // NOT branch remains a single UnaryExpression, unaffected by AND-flattening
    assert.deepStrictEqual(topChildren[1], {
      type: AST.UnaryExpression,
      operator: "NOT",
      argument: literal("ABC"),
    })
  })

  it("Idempotence: collecting on an already-flat leaf array element returns itself", () => {
    const ast = parse("a b c")
    const children = ASTUtils.collectSameOperatorChildren(ast, "AND")
    children.forEach(child => {
      assert.deepStrictEqual(ASTUtils.collectSameOperatorChildren(child, "AND"), [child])
    })
  })
})

describe("Search Parser: Edge Cases", () => {
  const parse = (query) => stripRange(parser.parse(lexer.tokenize(query), query.length))

  it("Keyword containing special chars", () => {
    const exp = "user@email.com"
    const ast = parse(exp)
    assert.deepStrictEqual(ast, literal(exp))
  })

  it("Regex looks like comment", () => {
    const ast = parse("/src/")
    assert.deepStrictEqual(ast, regexLit("src"))
  })
})
