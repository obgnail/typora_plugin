// Mock File environment dependencies
global.File = { option: { wordsPerMinute: 300 } }

const { describe, before, beforeEach, it } = require("node:test")
const assert = require("node:assert")
const proxyquire = require("proxyquire")
const Searcher = proxyquire("../../plugin/search_multi/searcher.js", {
  "fs-extra": { ...require("fs-extra"), "@noCallThru": true },
})
const { ExplainPresenter, GrammarPresenter } = require("../../plugin/search_multi/presenters.js")

const mockPlugin = {
  utils: require("./mocks/utils.mock.js"),
  config: { CASE_SENSITIVE: false },
  i18n: { t: (key) => key, link: (arr) => arr.join(" ") },
}

// --- "Torture Level" Data Construction ---
const tortureContent = `---
title: Torture Test
category: Testing
tags: [extreme, boundary]
---
# Main **Bold** ==High== \u200B🚀
# 1 &lt; 2 \\*star\\*

## Sub 中文测试

> Quote list:
> - [ ] Todo **urgent**
> - [x] Done ~~stale~~
> - [?] Invalid task
> - > \`123\` [NestedLink](https://nested.com)

\`\`\`javascript
const a = 1;
console.log("hello");
\`\`\`

<img src="html_img.png">

| 姓名 | Age |
| --- | --- |
| 张三 | 18 |

Paragraph with *Italic*, \`InlineCode\`, and a [LinkText](https://example.com).
Markdown Image: ![AltImage](img.png)

1. Ordered 1
2. Ordered 2

### H3
#### H4
##### H5
###### H6
`.replace(/\n/g, "\r\n")

function getMockFiles() {
  function compute(key, fn) {
    if (!Object.hasOwn(this, key)) this[key] = fn(this)
    return this[key]
  }

  return {
    torture: {
      path: "/docs/torture.md",
      file: "torture.md",
      getContent: async () => tortureContent,
      stats: {
        size: Buffer.byteLength(tortureContent, "utf8"),
        mtime: new Date("2024-05-20T10:00:00Z"),
        birthtime: new Date("2023-01-01T10:00:00Z"),
        atime: new Date("2024-01-02T10:00:00Z"),
      },
      compute,
    },
    statsFile: {
      path: "/stats.txt",
      file: "stats.txt",
      getContent: async () => "x".repeat(2000),
      stats: { size: 2048, mtime: new Date(), birthtime: new Date(), atime: new Date() },
      compute,
    },
    script: {
      path: "/src/script.js",
      file: "script.js",
      getContent: async () => "console.log('Hello World')",
      stats: { size: 50, mtime: new Date(), birthtime: new Date(), atime: new Date() },
      compute,
    },
    empty: {
      path: "/empty.txt",
      file: "empty.txt",
      getContent: async () => "",
      stats: { size: 0, mtime: new Date(), birthtime: new Date(), atime: new Date() },
      compute,
    },
  }
}

let searcher, explainPresenter, grammarPresenter, mockFiles

// Fetch fileKey dynamically to avoid L1 Cache pollution across scopes
const assertMatch = async (query, fileKey, expected = true) => {
  const file = mockFiles[fileKey]
  const ast = searcher.parse(query, true)
  const match = searcher.compile(ast)
  const result = await match(file)
  assert.strictEqual(result, expected, `Query ["${query}"] failed for file [${file.file}]. Expected ${expected}`)
}

const assertError = (query, errorRegex) => {
  assert.throws(() => searcher.parse(query), errorRegex, `Query ["${query}"] did not throw expected error`)
}

before(() => {
  mockFiles = getMockFiles()
  searcher = new Searcher(mockPlugin)
  searcher.process()
  explainPresenter = new ExplainPresenter({ ...mockPlugin, searcher: searcher })
  grammarPresenter = new GrammarPresenter({ ...mockPlugin, searcher: searcher })
})

beforeEach(() => {
  mockFiles = getMockFiles()
})

describe("Searcher: Dual-Index Architecture & Rendered Text Defense", () => {
  it("should preserve Dual-Index searching (Raw Markdown vs Unescaped Text)", async () => {
    await assertMatch(`h1:"1 < 2 *star*"`, "torture", true)
    await assertMatch(`h1:"1 &lt; 2 \\*star\\*"`, "torture", true)
  })
  it("should intentionally extract inner micro-fragments due to Dual-Index design", async () => {
    await assertMatch(`h1:/^Bold$/`, "torture", true)
    await assertMatch(`h1:/^Bold/`, "torture", true)
    await assertMatch(`blockquote:/^NestedLink$/`, "torture", true)
  })
  it("should correctly handle specific Transformer regex limitations", async () => {
    await assertMatch(`tasktodo:/^Todo \\*\\*urgent\\*\\*$/`, "torture", true)
    await assertMatch(`tasktodo:/^urgent$/`, "torture", false)
  })
  it("should correctly handle specific Filter limitations", async () => {
    await assertMatch(`image:img.png`, "torture", true)
    await assertMatch(`image:AltImage`, "torture", true)
    await assertMatch(`image:/^AltImage$/`, "torture", false)
  })
})

describe("Searcher: Full Stats & Metadata Matchers", () => {
  it("should match File Properties", async () => {
    await assertMatch("ext:md", "torture")
    await assertMatch("ext:js", "script")
    await assertMatch("ext:txt", "torture", false)
    await assertMatch("path:/docs/", "torture")
    await assertMatch("dir:/docs", "torture")
    await assertMatch("folder:/docs", "torture")
    await assertMatch("file:torture.md", "torture")
    await assertMatch("name:torture", "torture")
  })
  it("should match File Size & Dates", async () => {
    await assertMatch("size>0.1kb", "torture")
    await assertMatch("size<10mb", "torture")
    await assertMatch("mtime=2024-05-20", "torture")
    await assertMatch("birthtime<2024-01-01", "torture")
    await assertMatch("atime>=2024-01-02", "torture")
  })
  it("should match Text Statistics (number)", async () => {
    await assertMatch("linenum>10", "torture")
    await assertMatch("charnum>100", "torture")
    await assertMatch("wordnum>=1", "torture")
    await assertMatch("readminutes>0", "torture")
    await assertMatch("chinesenum>=4", "torture")
    await assertMatch("imagenum=1", "torture")
    await assertMatch("imgtagnum=1", "torture")
  })
  it("should match Content Flags (boolean)", async () => {
    await assertMatch("hasimage=true", "torture")
    await assertMatch("hasimage=false", "script")
    await assertMatch("hasimgtag=true", "torture")
    await assertMatch("haschinese=true", "torture")
    await assertMatch("hasemoji=true", "torture")
    await assertMatch("hasinvisiblechar=true", "torture")
    await assertMatch("isempty=true", "empty")
    await assertMatch("isempty=false", "torture")
    await assertMatch("crlf=true", "torture")
  })
})

describe("Searcher: Full Markdown Block Matchers", () => {
  it("should match Basic Blocks", async () => {
    await assertMatch("frontmatter:extreme", "torture")
    await assertMatch("frontmatter:Testing", "torture")
    await assertMatch("default:Torture", "torture")
    await assertMatch("content:中文测试", "torture")
    await assertMatch("line:张三", "torture")
  })
  it("should match Code Blocks", async () => {
    await assertMatch("blockcodelang:javascript", "torture")
    await assertMatch("blockcodebody:hello", "torture")
    await assertMatch("blockcodeline:const a = 1;", "torture")
    await assertMatch("blockcode:console.log", "torture")
  })
  it("should match Tables and Quotes", async () => {
    await assertMatch("table:张三", "torture")
    await assertMatch("thead:姓名", "torture")
    await assertMatch("tbody:18", "torture")
    await assertMatch("blockquote:Quote list", "torture")
  })
  it("should match Lists & Tasks", async () => {
    await assertMatch("ol:Ordered 1", "torture")
    await assertMatch("ul:Todo", "torture")
    await assertMatch("task:Invalid", "torture", false)
    await assertMatch("tasktodo:Todo", "torture")
    await assertMatch("taskdone:stale", "torture")
  })
  it("should match all Heading levels", async () => {
    await assertMatch("head:H3", "torture")
    await assertMatch("h2:中文", "torture")
    await assertMatch("h3:H3", "torture")
    await assertMatch("h4:H4", "torture")
    await assertMatch("h5:H5", "torture")
    await assertMatch("h6:H6", "torture")
  })
})

describe("Searcher: Full Markdown Inline Matchers", () => {
  it("should match Formatting and Inline elements", async () => {
    await assertMatch("strong:Bold", "torture")
    await assertMatch("highlight:High", "torture")
    await assertMatch("em:Italic", "torture")
    await assertMatch("del:stale", "torture")
    await assertMatch("code:InlineCode", "torture")
    await assertMatch("link:example.com", "torture")
    await assertMatch("image:AltImage", "torture")
    await assertMatch("blockhtml:html_img", "torture")
  })
})

describe("Searcher: Preprocessing & Syntactic Sugar", () => {
  it("should handle thousands separators in numbers", async () => {
    await assertMatch("charnum=2,000", "statsFile")
    await assertMatch("charnum=2_000", "statsFile")
    await assertMatch("charnum>1,999", "statsFile")
  })
  it("should handle boolean abbreviations", async () => {
    await assertMatch("hasimage=yes", "torture")
    await assertMatch("hasimage=y", "torture")
    await assertMatch("hasimage=no", "torture", false)
    await assertMatch("hasimage=n", "script")
    await assertMatch("hasimage=no", "script")
  })

  it("should handle date aliases", async () => {
    const realDate = global.Date
    const fixedDate = new Date("2024-05-20T12:00:00Z")

    global.Date = class extends realDate {
      constructor(date) {
        return date ? super(date) : fixedDate
      }
    }

    mockFiles.torture.stats.mtime = new Date("2024-05-20T10:00:00Z")
    mockFiles.torture.stats.birthtime = new Date("2024-05-19T10:00:00Z")

    try {
      await assertMatch("mtime=today", "torture")
      await assertMatch("birthtime=yesterday", "torture")
    } finally {
      global.Date = realDate
    }
  })
})

describe("Searcher: Syntax Edge Cases & Logic", () => {
  it("should handle case sensitivity configuration", async () => {
    mockPlugin.config.CASE_SENSITIVE = true
    await assertMatch("h1:Main", "torture")
    await assertMatch("h1:main", "torture", false)
    mockPlugin.config.CASE_SENSITIVE = false
  })
  it("should allow regex in structural search", async () => {
    await assertMatch("h1:/^Main/", "torture")
  })
  it("should apply implicit AND correctly", async () => {
    await assertMatch("Header Item", "torture", false)
    await assertMatch("Torture extreme", "torture", true)
  })
  it("should process complex logic and parentheses", async () => {
    await assertMatch("(ext:md OR size>10mb) AND tasktodo:urgent", "torture")
    await assertMatch("-(ext:js OR isempty=true) AND h2:中文", "torture")
    await assertMatch("ext:js AND tasktodo:Todo", "torture", false)
  })
  it("should reorder AST based on optimization costs", () => {
    const ast = searcher.parse("content:Header AND ext:md", true)
    assert.strictEqual(ast.left.scope, "ext")
    assert.strictEqual(ast.right.scope, "content")
  })
})

describe("Searcher: Validation & Error Guards", () => {
  it("should throw on invalid unit format", () => {
    assertError("size=10xyz", /Operand must be a number followed by a unit/)
    assertError("size=10", /Operand must be a number followed by a unit/)
  })
  it("should throw on invalid boolean operators", () => {
    assertError("isempty>true", /Only supports "=" and "!="/)
    assertError("isempty=maybe", /Operand must be "true" or "false"/)
    assertError("isempty=/regex/", /Regex operands are not valid for logical comparisons/)
  })
  it("should throw on invalid numerical comparisons", () => {
    assertError("linenum:10", /operator is not valid for numerical comparisons/)
    assertError("linenum=abc", /Operand must be a valid number/)
    assertError("linenum>=/regex/", /Regex operands are not valid for numerical comparisons/)
  })
  it("should throw on invalid date inputs", () => {
    assertError("mtime=notadate", /Operand must be a valid date string/)
  })
  it("should throw on invalid regex operators for strings", () => {
    assertError("ext>=/regex/", /Regex operands only support the ":" operator/)
  })
  it("should throw on invalid regex syntax", () => {
    assertError("ext:/[unclosed/", /Invalid regex/)
  })
})

describe("Presenter: Visualization Methods", () => {
  it("should generate localized explain text", () => {
    const ast = searcher.parse("size>10k -ext:md")
    const explanation = grammarPresenter.buildExplainText(ast)
    assert.ok(explanation.includes("explain"))
    assert.ok(explanation.includes("size"))
    assert.ok(explanation.includes("operator.gt"))
    assert.ok(explanation.includes("10k"))
    assert.ok(explanation.includes("not"))
  })
  it("should generate Mermaid graph definition", () => {
    const ast = searcher.parse("a AND b OR c")
    const mermaid = grammarPresenter.buildMermaid(ast, true, false, "TB")
    assert.ok(mermaid.startsWith("graph TB"))
    assert.ok(mermaid.includes("S((START))"))
    assert.ok(mermaid.includes("E((END))"))
  })
  it("should generate Mermaid graph without crash on complex structures", () => {
    const ast = searcher.parse("(a OR b) AND (c OR d) AND NOT e")
    const mermaid = grammarPresenter.buildMermaid(ast, true, false, "TB")
    assert.ok(mermaid.startsWith("graph TB"))
  })
})
