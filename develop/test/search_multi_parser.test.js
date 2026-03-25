const { describe, it, beforeEach } = require("node:test")
const assert = require("node:assert")
const Parser = require("../../plugin/search_multi/parser.js")

const stripMeta = (tokens) => tokens.map(({ index, ...rest }) => rest)
const keywordNode = (val, scope = "default", op = ":") => ({
    type: "KEYWORD",
    scope: scope,
    operator: op,
    operand: val
})
const phraseNode = (val, scope = "default", op = ":") => ({
    type: "PHRASE",
    scope: scope,
    operator: op,
    operand: val
})
const regexpNode = (val, scope = "default", op = ":") => ({
    type: "REGEXP",
    scope: scope,
    operator: op,
    operand: val
})

let parser
beforeEach(() => parser = new Parser())

describe("Search Parser: Tokenizer (Lexical Analysis)", () => {
    it("Basic keywords and phrases", () => {
        const tokens = parser.tokenize('hello "search world"')
        assert.deepStrictEqual(stripMeta(tokens), [
            { type: parser.TYPE.KEYWORD, value: "hello" },
            { type: parser.TYPE.PHRASE, value: "search world" }
        ])
    })

    it("Qualifiers with different operators", () => {
        const tokens = parser.tokenize("size>=100 file:test")
        assert.deepStrictEqual(stripMeta(tokens), [
            { type: parser.TYPE.QUALIFIER, scope: "size", operator: ">=" },
            { type: parser.TYPE.KEYWORD, value: "100" },
            { type: parser.TYPE.QUALIFIER, scope: "file", operator: ":" },
            { type: parser.TYPE.KEYWORD, value: "test" }
        ])
    })

    it("Regex with escaped slash", () => {
        const tokens = parser.tokenize("/home\\/user/")
        assert.deepStrictEqual(stripMeta(tokens), [
            { type: parser.TYPE.REGEXP, value: "home\\/user" }
        ])
    })

    it("Boolean operators case sensitivity", () => {
        const tokens = parser.tokenize("hello and world AND test")
        assert.deepStrictEqual(stripMeta(tokens), [
            { type: parser.TYPE.KEYWORD, value: "hello" },
            { type: parser.TYPE.AND, value: "AND" },
            { type: parser.TYPE.KEYWORD, value: "world" },
            { type: parser.TYPE.AND, value: "AND" },
            { type: parser.TYPE.KEYWORD, value: "test" }
        ])
    })

    it("Hyphen vs NOT", () => {
        const tokens = parser.tokenize("-test test-case")
        assert.deepStrictEqual(stripMeta(tokens), [
            { type: parser.TYPE.NOT, value: "-" },
            { type: parser.TYPE.KEYWORD, value: "test" },
            { type: parser.TYPE.KEYWORD, value: "test-case" }
        ])
    })
})

describe("Search Parser: Parser (AST Structure)", () => {
    it("Implicit AND", () => {
        const ast = parser.parse("a b c")
        assert.deepStrictEqual(ast, {
            type: parser.TYPE.AND,
            left: {
                type: parser.TYPE.AND,
                left: keywordNode("a"),
                right: keywordNode("b")
            },
            right: keywordNode("c")
        })
    })

    it("Operator Precedence (AND over OR)", () => {
        const ast = parser.parse("a OR b AND c")
        assert.deepStrictEqual(ast, {
            type: parser.TYPE.OR,
            left: keywordNode("a"),
            right: {
                type: parser.TYPE.AND,
                left: keywordNode("b"),
                right: keywordNode("c")
            }
        })
    })

    it("Operator Precedence (Left Associativity)", () => {
        const ast = parser.parse("a AND b AND c")
        assert.deepStrictEqual(ast, {
            type: parser.TYPE.AND,
            left: {
                type: parser.TYPE.AND,
                left: keywordNode("a"),
                right: keywordNode("b")
            },
            right: keywordNode("c")
        })
    })

    it("Grouping with Parentheses", () => {
        const ast = parser.parse("(a OR b) AND c")
        assert.deepStrictEqual(ast, {
            type: parser.TYPE.AND,
            left: {
                type: parser.TYPE.OR,
                left: keywordNode("a"),
                right: keywordNode("b")
            },
            right: keywordNode("c")
        })
    })

    it("Unary NOT", () => {
        const ast = parser.parse("NOT a AND b")
        assert.deepStrictEqual(ast, {
            type: parser.TYPE.AND,
            left: {
                type: parser.TYPE.NOT,
                right: keywordNode("a")
            },
            right: keywordNode("b")
        })
    })

    it("NOT with Parentheses", () => {
        const ast = parser.parse("NOT (a OR b)")
        assert.deepStrictEqual(ast, {
            type: parser.TYPE.NOT,
            right: {
                type: parser.TYPE.OR,
                left: keywordNode("a"),
                right: keywordNode("b")
            }
        })
    })

    it("Qualifiers with Phrase", () => {
        const ast = parser.parse('content:"hello world"')
        assert.deepStrictEqual(ast, phraseNode("hello world", "content", ":"))
    })

    it("Unclosed Quote Qualifiers with Phrase", () => {
        const exp = 'noSuchQualifier:"incomplete'
        const ast = parser.parse(exp)
        assert.deepStrictEqual(ast, keywordNode(exp))
    })

    it("Qualifiers in Phrase", () => {
        const ast = parser.parse('"content:hello"')
        assert.deepStrictEqual(ast, phraseNode('content:hello'))
    })

    it("Mixed Complex Query", () => {
        const ast = parser.parse("(status:active OR status:pending) AND -file:temp.js")
        assert.deepStrictEqual(ast, {
            type: parser.TYPE.AND,
            left: {
                type: parser.TYPE.OR,
                left: keywordNode("active", "status", ":"),
                right: keywordNode("pending", "status", ":")
            },
            right: {
                type: parser.TYPE.NOT,
                right: keywordNode("temp.js", "file", ":")
            }
        })
    })
})

describe("Search Parser: Error Handling", () => {
    it("Unclosed Quote", () => {
        assert.throws(() => parser.parse('"incomplete'), /Unclosed quote/)
    })

    it("Unclosed Quote with Qualifiers", () => {
        assert.throws(() => parser.parse('content:"incomplete'), /Unclosed quote/)
    })

    it("Unmatched Opening Parenthesis", () => {
        assert.throws(() => parser.parse('(a AND b'), /Missing closing parenthesis/)
    })

    it("Unmatched Closing Parenthesis", () => {
        assert.throws(() => parser.parse('a AND b)'), /Unexpected token '\)'/)
    })

    it("Empty Parentheses", () => {
        assert.throws(() => parser.parse('()'), /Unexpected token '\)'/)
    })

    it("Trailing Operator", () => {
        assert.throws(() => parser.parse('a AND'), /Unexpected token 'EOF'|Unexpected end/)
    })

    it("Operator without Left Operand", () => {
        assert.throws(() => parser.parse('OR b'), /Unexpected token 'OR'/)
    })
})

describe("Search Parser: Evaluation Logic", () => {
    it("Complex Logic Evaluation", () => {
        const ast = parser.parse("(A OR B) AND -C")

        // Scenario 1: A=true, B=false, C=false => (t|f) & !f => t & t => TRUE
        assert.strictEqual(parser.evaluate(ast, n => {
            if (n.operand === "A") return true
            if (n.operand === "B") return false
            if (n.operand === "C") return false
            return false
        }), true)

        // Scenario 2: A=false, B=false => (f|f) & ... => FALSE
        assert.strictEqual(parser.evaluate(ast, n => {
            return false
        }), false)

        // Scenario 3: A=true, C=true => (t|...) & !t => t & f => FALSE
        assert.strictEqual(parser.evaluate(ast, n => {
            if (n.operand === "A") return true
            if (n.operand === "C") return true
            return false
        }), false)
    })
})

describe("Search Parser: Edge Cases", () => {
    it("Keyword containing special chars", () => {
        const exp = "user@email.com"
        const ast = parser.parse(exp)
        assert.deepStrictEqual(ast, keywordNode(exp))
    })

    it("Regex looks like comment", () => {
        const ast = parser.parse("/src/")
        assert.deepStrictEqual(ast, regexpNode("src"))
    })

    it("Qualifier with regex", () => {
        const ast = parser.parse("path:/api\\/v1/")
        assert.deepStrictEqual(ast, regexpNode("api\\/v1", "path", ":"))
    })
})
