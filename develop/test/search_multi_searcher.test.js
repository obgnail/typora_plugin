const { test, describe, before } = require("node:test")
const assert = require("node:assert")
const proxyquire = require("proxyquire")
const Searcher = require("../../plugin/search_multi/searcher.js")

// --- Global Environment Setup ---
Object.assign(global, {
    window: { _options: { appVersion: "1.0.0" } },
    document: { querySelector: () => undefined, querySelectorAll: () => [] },
    CSS: { supports: () => true },
    File: { option: { wordsPerMinute: 300 } },
    $: () => ({}),
})
const mockPlugin = {
    utils: proxyquire("../../plugin/global/core/utils", { "fs-extra": { "@noCallThru": true } }),
    config: { CASE_SENSITIVE: false },
    i18n: { t: (key) => key, link: (arr) => arr.join(" "), },
}

// --- Real Data Construction ---
const complexContent = `---
title: Integration Test Doc
category: Testing
tags: [unit, integration]
---
# Main Header
Some intro text.

## Sub Header
Details here.

> This is a blockquote.

- Normal List Item
- [ ] Todo Item
- [x] Done Item

\`\`\`javascript
const a = 10
console.log("code block content")
\`\`\`

| Col1 | Col2 |
| --- | --- |
| CellA | CellB |

Paragraph with **BoldText**, *ItalicText*, and a [LinkText](https://example.com).
Image here: ![AltImage](img.png)

1. Ordered Item
`

const mockFiles = {
    complex: {
        path: "/docs/complex.md",
        file: "complex.md",
        content: complexContent,
        stats: {
            size: Buffer.byteLength(complexContent, "utf8"),
            mtime: new Date(), // Will be mocked dynamically in tests
            birthtime: new Date("2023-01-01T10:00:00Z"),
            atime: new Date("2024-01-02T10:00:00Z")
        }
    },
    // Mock a file with exactly 2000 lines/chars for number format testing
    statsFile: {
        path: "/stats.txt",
        file: "stats.txt",
        content: "x".repeat(2000), // 2000 chars
        stats: { size: 2048, mtime: new Date(), birthtime: new Date(), atime: new Date() }
    },
    script: {
        path: "/src/script.js",
        file: "script.js",
        content: "console.log('Hello World')",
        stats: { size: 50, mtime: new Date(), birthtime: new Date(), atime: new Date() }
    },
    empty: {
        path: "/empty.txt",
        file: "empty.txt",
        content: "",
        stats: { size: 0, mtime: new Date(), birthtime: new Date(), atime: new Date() }
    }
}

describe("Searcher Integration Tests", () => {
    let searcher

    const assertMatch = (query, file, expected = true) => {
        const ast = searcher.parse(query, true)
        const result = searcher.match(ast, file)
        assert.strictEqual(result, expected, `Query ["${query}"] failed for file [${file.file}]`)
    }

    const assertError = (query, errorRegex) => {
        assert.throws(() => searcher.parse(query), errorRegex, `Query ["${query}"] did not throw expected error`)
    }

    before(() => {
        searcher = new Searcher(mockPlugin)
        searcher.process()
    })

    describe("1. Basic Metadata Matching", () => {
        const { complex, script } = mockFiles

        test("should match file extension", () => {
            assertMatch("ext:md", complex)
            assertMatch("ext:js", script)
            assertMatch("ext:txt", complex, false)
        })
        test("should match file path and directory", () => {
            assertMatch("path:/docs/", complex)
            assertMatch("dir:/src", script)
            assertMatch("folder:/docs", complex)
        })
        test("should match file size", () => {
            assertMatch("size>0.1kb", complex)
            assertMatch("size<10mb", complex)
        })
        test("should match date attributes", () => {
            complex.stats.mtime = new Date("2024-01-01T10:00:00Z")
            assertMatch("mtime=2024-01-01", complex)
            assertMatch("mtime>2023-12-31", complex)
            assertMatch("birthtime=2023", complex)
        })
    })

    describe("2. Markdown Structure Matching", () => {
        const file = mockFiles.complex

        test("should match Frontmatter (YAML)", () => {
            assertMatch("frontmatter:Integration", file)
            assertMatch("frontmatter:unit", file)
            assertMatch("frontmatter:integration", file)
        })
        test("should match Headings", () => {
            assertMatch("h1:Main", file)
            assertMatch("h2:Sub", file)
        })
        test("should match Tasks", () => {
            assertMatch("tasktodo:Todo", file)
            assertMatch("taskdone:Done", file)
        })
        test("should match Code Blocks", () => {
            assertMatch("blockcodelang:javascript", file)
            assertMatch("blockcode:console.log", file)
        })
        test("should match Tables", () => {
            assertMatch("thead:Col1", file)
            assertMatch("table:CellA", file)
        })
        test("should match Lists & Quotes", () => {
            assertMatch("blockquote:quote", file)
            assertMatch("ul:Normal", file)
            assertMatch("ol:Ordered", file)
        })
    })

    describe("3. Markdown Inline Matching", () => {
        const file = mockFiles.complex

        test("should match Strong/Bold/Link/Image", () => {
            assertMatch("strong:BoldText", file)
            assertMatch("link:LinkText", file)
            assertMatch("link:example.com", file)
            assertMatch("image:AltImage", file)
        })
    })

    describe("4. Content Statistics", () => {
        const { complex, empty, script } = mockFiles

        test("should detect emptiness", () => {
            assertMatch("isempty=true", empty)
            assertMatch("isempty=false", complex)
        })
        test("should detect boolean flags", () => {
            assertMatch("hasimage=true", complex)
            assertMatch("hasimage=false", script)
        })
    })

    describe("5. Logic & Optimizer", () => {
        const file = mockFiles.complex

        test("Optimization Reordering", () => {
            const ast = searcher.parse("content:Header AND ext:md", true)
            assert.strictEqual(ast.left.scope, "ext")
            assert.strictEqual(ast.right.scope, "content")
        })
        test("Complex Logic", () => {
            assertMatch("(ext:md OR size>10mb) AND task:Todo", file)
            assertMatch("ext:js AND task:Todo", file, false)
        })
        test("Negation Logic", () => {
            assertMatch("-taskdone:Todo", file)
        })
    })

    describe("6. Edge Cases", () => {
        test("Case Sensitivity", () => {
            mockPlugin.config.CASE_SENSITIVE = true
            assertMatch("h1:Main", mockFiles.complex)
            assertMatch("h1:main", mockFiles.complex, false)
            mockPlugin.config.CASE_SENSITIVE = false
        })
        test("Regex in structural search", () => {
            assertMatch("h1:/^Main/", mockFiles.complex)
        })
        test("Implicit AND", () => {
            assertMatch("Header Item", mockFiles.complex)
        })
    })

    describe("7. Preprocessing & Syntactic Sugar", () => {
        test("should handle thousands separators in numbers", () => {
            assertMatch("charnum=2,000", mockFiles.statsFile)
            assertMatch("charnum=2_000", mockFiles.statsFile)
            assertMatch("charnum>1,999", mockFiles.statsFile)
        })
        test("should handle boolean abbreviations", () => {
            const file = mockFiles.complex
            assertMatch("hasimage=yes", file)
            assertMatch("hasimage=y", file)
            assertMatch("hasimage=no", file, false)

            const script = mockFiles.script
            assertMatch("hasimage=n", script)
            assertMatch("hasimage=no", script)
        })
        test("should handle date aliases", () => {
            const file = mockFiles.complex
            // Mock Date for consistent testing
            const realDate = global.Date
            const fixedDate = new Date("2024-05-20T12:00:00Z")

            // Override Date constructor to simulate "today"
            global.Date = class extends realDate {
                constructor(date) {
                    return date ? super(date) : fixedDate
                }
            }

            file.stats.mtime = new Date("2024-05-20T10:00:00Z")
            file.stats.birthtime = new Date("2024-05-19T10:00:00Z")

            try {
                assertMatch("mtime=today", file)
                assertMatch("birthtime=yesterday", file)
            } finally {
                // Restore Date
                global.Date = realDate
            }
        })
    })

    describe("8. Validation & Error Handling", () => {
        test("should throw on invalid unit format", () => {
            assertError("size=10xyz", /Operand must be a number followed by a unit/)
            assertError("size=10", /Operand must be a number followed by a unit/) // Missing unit for size
        })
        test("should throw on invalid boolean operators", () => {
            assertError("isempty>true", /Only supports "=" and "!="/)
            assertError("isempty=maybe", /Operand must be "true" or "false"/)
            assertError("isempty=/regex/", /Regex operands are not valid for logical comparisons/)
        })
        test("should throw on invalid numerical comparisons", () => {
            assertError("linenum:10", /operator is not valid for numerical comparisons/)
            assertError("linenum=abc", /Operand must be a valid number/)
            assertError("linenum>=/regex/", /Regex operands are not valid for numerical comparisons/)
        })
        test("should throw on invalid date inputs", () => {
            assertError("mtime=notadate", /Operand must be a valid date string/)
        })
        test("should throw on invalid regex operators for strings", () => {
            assertError("ext>=/regex/", /Regex operands only support the ":" operator/)
        })
        test("should throw on invalid regex syntax", () => {
            assertError("ext:/[unclosed/", /Invalid regex/)
        })
        test("should throw on unsupported units during cast", () => {
            assertError("size=10", /Operand must be a number followed by a unit/)
            assertError("size=10yb", /Operand must be a number followed by a unit/)
        })
    })

    describe("9. Visualization Methods", () => {
        test("toExplain should return localized text", () => {
            const ast = searcher.parse("size>10k -ext:md")
            const explanation = searcher.toExplain(ast)
            assert.ok(explanation.includes("explain"))
            assert.ok(explanation.includes("size"))
            assert.ok(explanation.includes("operator.gt"))
            assert.ok(explanation.includes("10k"))
            assert.ok(explanation.includes("not")) // from negative condition
        })
        test("toMermaid should return graph definition", () => {
            const ast = searcher.parse("a AND b OR c")
            const mermaid = searcher.toMermaid(ast)
            assert.ok(mermaid.startsWith("graph TB"))
            assert.ok(mermaid.includes("S((START))"))
            assert.ok(mermaid.includes("E((END))"))
        })
        test("toMermaid should handle complex nested structures without crash", () => {
            const ast = searcher.parse("(a OR b) AND (c OR d) AND NOT e")
            const mermaid = searcher.toMermaid(ast)
            assert.ok(mermaid.startsWith("graph TB"))
        })
    })
})
