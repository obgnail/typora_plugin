const { describe, it } = require("node:test")
const assert = require("node:assert")
const markdownlint = require("../../plugin/markdownlint/markdownlint.min.js")
const helpers = require("../../plugin/markdownlint/markdownlint-rule-helpers.min.js")
const customRulesFactory = require("../../plugin/markdownlint/custom-rules.js")

const customRules = customRulesFactory(helpers)

async function lint(content, config = {}) {
  const result = await markdownlint.lint({
    strings: { content },
    config: { default: false, ...config },
    customRules,
  })
  return result.content ?? []
}

function lineNumbers(errors) {
  return errors.map(e => e.lineNumber).sort((a, b) => a - b)
}


describe("MD101 - math-surrounded-by-blank-lines", () => {
  const ON = { MD101: true }

  describe("valid cases (no errors)", () => {
    it("math block surrounded by blank lines on both sides", async () => {
      const content = "text\n\n$$\nx^2\n$$\n\ntext"
      assert.strictEqual((await lint(content, ON)).length, 0)
    })

    it("math block at start of document — no preceding line", async () => {
      // lines[-1] === undefined; isBlankLine(undefined) 应视为空行，不报错
      const content = "$$\nx^2\n$$\n\ntext"
      assert.strictEqual((await lint(content, ON)).length, 0)
    })

    it("math block at end of document — no following line", async () => {
      // lines[endLine] === undefined，同上
      const content = "text\n\n$$\nx^2\n$$"
      assert.strictEqual((await lint(content, ON)).length, 0)
    })

    it("math block is the only content in document", async () => {
      const content = "$$\nx^2\n$$"
      assert.strictEqual((await lint(content, ON)).length, 0)
    })

    it("multiple math blocks all properly surrounded", async () => {
      const content = "text\n\n$$\na\n$$\n\ntext\n\n$$\nb\n$$\n\ntext"
      assert.strictEqual((await lint(content, ON)).length, 0)
    })

    it("math block after heading with blank line", async () => {
      const content = "# Title\n\n$$\nx\n$$\n\ntext"
      assert.strictEqual((await lint(content, ON)).length, 0)
    })

    it("math block in ordered list skipped when list_items=false", async () => {
      const content = "1. item\n\n   $$\n   x^2\n   $$\n\n   more"
      const errors = await lint(content, { MD101: { list_items: false } })
      assert.strictEqual(errors.length, 0)
    })

    it("math block in unordered list skipped when list_items=false", async () => {
      const content = "- item\n\n  $$\n  x^2\n  $$\n\n  more"
      const errors = await lint(content, { MD101: { list_items: false } })
      assert.strictEqual(errors.length, 0)
    })

    it("math block with multiline content surrounded by blank lines", async () => {
      const content = "text\n\n$$\na + b\n= c\n$$\n\ntext"
      assert.strictEqual((await lint(content, ON)).length, 0)
    })
  })

  describe("invalid cases (errors expected)", () => {
    it("no blank line above math block", async () => {
      // startLine=2, lines[startLine-2]=lines[0]="text" → not blank
      const content = "text\n$$\nx^2\n$$\n\ntext"
      const errors = await lint(content, ON)
      assert.strictEqual(errors.length, 1)
      assert.strictEqual(errors[0].lineNumber, 2)
    })

    it("no blank line below math block", async () => {
      // endLine=5 (closing $$), lines[5]="text" → not blank
      const content = "text\n\n$$\nx^2\n$$\ntext"
      const errors = await lint(content, ON)
      assert.strictEqual(errors.length, 1)
      assert.strictEqual(errors[0].lineNumber, 5)
    })

    it("no blank lines on either side — two errors", async () => {
      const content = "text\n$$\nx^2\n$$\ntext"
      const errors = await lint(content, ON)
      assert.strictEqual(errors.length, 2)
      assert.deepStrictEqual(lineNumbers(errors), [2, 4])
    })

    it("math block immediately after heading (no blank line above)", async () => {
      const content = "# Title\n$$\nx\n$$\n\ntext"
      const errors = await lint(content, ON)
      assert.strictEqual(errors.length, 1)
      assert.strictEqual(errors[0].lineNumber, 2)
    })

    it("multiple math blocks both missing surrounding blank lines", async () => {
      const content = "text\n$$\na\n$$\ntext\n$$\nb\n$$\ntext"
      const errors = await lint(content, ON)
      // 每个块各缺上下空行，至少 2 个错误
      assert.ok(errors.length >= 2)
    })

    it("math block in list checked when list_items=true (default)", async () => {
      const content = "- item\n$$\nx^2\n$$\ntext"
      const errors = await lint(content, { MD101: { list_items: true } })
      assert.ok(errors.length > 0)
    })

    it("math block in list checked when list_items is omitted (default=true)", async () => {
      const content = "- item\n$$\nx^2\n$$\ntext"
      const errors = await lint(content, ON)
      assert.ok(errors.length > 0)
    })
  })

  describe("fix info", () => {
    it("provides fixInfo with insertText ending in newline (above)", async () => {
      const content = "text\n$$\nx^2\n$$\n\ntext"
      const errors = await lint(content, ON)
      assert.ok(errors[0].fixInfo, "should provide fixInfo")
      assert.ok(typeof errors[0].fixInfo.insertText === "string")
      assert.ok(errors[0].fixInfo.insertText.endsWith("\n"))
    })

    it("provides fixInfo for missing blank line below", async () => {
      const content = "text\n\n$$\nx^2\n$$\ntext"
      const errors = await lint(content, ON)
      assert.ok(errors[0].fixInfo, "should provide fixInfo")
    })

    it("fixInfo lineNumber is the insertion point (above: same line as $$)", async () => {
      const content = "text\n$$\nx^2\n$$\n\ntext"
      const errors = await lint(content, ON)
      // top=true → fixInfo.lineNumber = mathBlock.startLine (= 2)
      assert.strictEqual(errors[0].fixInfo.lineNumber, 2)
    })

    it("fixInfo lineNumber is the insertion point (below: line after closing $$)", async () => {
      const content = "text\n\n$$\nx^2\n$$\ntext"
      const errors = await lint(content, ON)
      // top=false → fixInfo.lineNumber = mathBlock.endLine + 1 (= 6)
      assert.strictEqual(errors[0].fixInfo.lineNumber, 6)
    })
  })
})

describe("MD102 - no-fully-emphasized-heading", () => {
  const ON = { MD102: true }

  describe("valid cases (no errors)", () => {
    it("plain heading without any emphasis", async () => {
      assert.strictEqual((await lint("# Hello World", ON)).length, 0)
    })

    it("heading with partial bold — not fully emphasized", async () => {
      assert.strictEqual((await lint("# Hello **World**", ON)).length, 0)
    })

    it("heading with partial italic", async () => {
      assert.strictEqual((await lint("# Hello *World*", ON)).length, 0)
    })

    it("heading with multiple emphasized children (length !== 1)", async () => {
      // headingTextToken.children.length === 2 → skipped
      assert.strictEqual((await lint("# **Hello** **World**", ON)).length, 0)
    })

    it("heading with bold prefix and plain suffix", async () => {
      assert.strictEqual((await lint("# **Hello** World", ON)).length, 0)
    })

    it("heading with inline code only", async () => {
      assert.strictEqual((await lint("# `code`", ON)).length, 0)
    })

    it("empty heading", async () => {
      assert.strictEqual((await lint("# ", ON)).length, 0)
    })

    it("heading with link", async () => {
      assert.strictEqual((await lint("# [link](https://example.com)", ON)).length, 0)
    })

    it("heading with image", async () => {
      assert.strictEqual((await lint("# ![alt](img.png)", ON)).length, 0)
    })

    it("setext heading (not ATX) is not checked", async () => {
      const content = "**Hello**\n========="
      assert.strictEqual((await lint(content, ON)).length, 0)
    })
  })

  describe("invalid cases (errors expected)", () => {
    it("fully bold heading with **", async () => {
      const errors = await lint("# **Hello World**", ON)
      assert.strictEqual(errors.length, 1)
      assert.strictEqual(errors[0].lineNumber, 1)
    })

    it("fully italic heading with *", async () => {
      const errors = await lint("# *Hello World*", ON)
      assert.strictEqual(errors.length, 1)
      assert.strictEqual(errors[0].lineNumber, 1)
    })

    it("fully bold heading with __ (underscore syntax)", async () => {
      const errors = await lint("# __Hello World__", ON)
      assert.strictEqual(errors.length, 1)
    })

    it("fully italic heading with _ (underscore syntax)", async () => {
      const errors = await lint("# _Hello World_", ON)
      assert.strictEqual(errors.length, 1)
    })

    it("fully bold-italic heading with ***", async () => {
      // *** → strong wrapping emphasis (or vice versa), recursive check catches it
      const errors = await lint("# ***Hello World***", ON)
      assert.strictEqual(errors.length, 1)
    })

    it("all heading levels h1–h6 trigger error when fully bold", async () => {
      for (let level = 1; level <= 6; level++) {
        const content = `${"#".repeat(level)} **Heading ${level}**`
        const errors = await lint(content, ON)
        assert.strictEqual(errors.length, 1, `h${level} should trigger error`)
      }
    })

    it("multiple headings — only fully emphasized ones error", async () => {
      const content = "# **Bad**\n\n## Good\n\n### **Also Bad**"
      const errors = await lint(content, ON)
      assert.strictEqual(errors.length, 2)
      assert.deepStrictEqual(lineNumbers(errors), [1, 5])
    })

    it("fully emphasized heading on non-first line", async () => {
      const content = "# Normal\n\n## *Fully Italic*"
      const errors = await lint(content, ON)
      assert.strictEqual(errors.length, 1)
      assert.strictEqual(errors[0].lineNumber, 3)
    })
  })

  describe("fix info", () => {
    it("provides fixInfo to strip ** markers", async () => {
      const errors = await lint("# **Hello World**", ON)
      assert.ok(errors[0].fixInfo, "should provide fixInfo")
      // insertText should be the inner text without emphasis markers
      assert.ok(errors[0].fixInfo.insertText.includes("Hello World"))
      assert.ok(!errors[0].fixInfo.insertText.includes("**"))
    })

    it("provides fixInfo to strip * markers", async () => {
      const errors = await lint("# *Hello World*", ON)
      assert.ok(errors[0].fixInfo)
      assert.ok(errors[0].fixInfo.insertText.includes("Hello World"))
      assert.ok(!errors[0].fixInfo.insertText.includes("*"))
    })

    it("fixInfo editColumn and deleteCount cover the full emphasis span", async () => {
      const errors = await lint("# **Hello**", ON)
      const fix = errors[0].fixInfo
      assert.ok(fix.editColumn > 0)
      assert.ok(fix.deleteCount > 0)
    })
  })
})

describe("MD103 - inline-math-delimiter", () => {
  const ON = { MD103: true }  // 默认 style=consistent

  describe("valid cases (no errors)", () => {
    it("no inline math at all", async () => {
      assert.strictEqual((await lint("No math here", ON)).length, 0)
    })

    it("empty document", async () => {
      assert.strictEqual((await lint("", ON)).length, 0)
    })

    it("all single $ in consistent mode", async () => {
      assert.strictEqual((await lint("$x^2$ and $y^2$", ON)).length, 0)
    })

    it("all double $$ in consistent mode", async () => {
      assert.strictEqual((await lint("$$x^2$$ and $$y^2$$", ON)).length, 0)
    })

    it("all single $ with style=single", async () => {
      assert.strictEqual(
        (await lint("$x^2$ and $y^2$", { MD103: { style: "single" } })).length, 0,
      )
    })

    it("all double $$ with style=double", async () => {
      assert.strictEqual(
        (await lint("$$x^2$$ and $$y^2$$", { MD103: { style: "double" } })).length, 0,
      )
    })

    it("single inline math token — consistent mode has nothing to compare against", async () => {
      assert.strictEqual((await lint("$x^2$", ON)).length, 0)
    })

    it("block math ($$...$$) on its own line is not checked by MD103", async () => {
      // mathFlow tokens are ignored; only mathText (inline) is checked
      const content = "text\n\n$$\nx^2\n$$\n\ntext"
      assert.strictEqual((await lint(content, ON)).length, 0)
    })
  })

  describe("invalid cases (errors expected)", () => {
    it("mixed styles in consistent mode — single first, double second", async () => {
      const errors = await lint("$x^2$ and $$y^2$$", ON)
      assert.strictEqual(errors.length, 1)
    })

    it("mixed styles in consistent mode — double first, single second", async () => {
      const errors = await lint("$$x^2$$ and $y^2$", ON)
      assert.strictEqual(errors.length, 1)
    })

    it("double $$ with style=single", async () => {
      const errors = await lint("$$x^2$$", { MD103: { style: "single" } })
      assert.strictEqual(errors.length, 1)
    })

    it("single $ with style=double", async () => {
      const errors = await lint("$x^2$", { MD103: { style: "double" } })
      assert.strictEqual(errors.length, 1)
    })

    it("multiple double $$ with style=single — all flagged", async () => {
      const errors = await lint("$$a$$ and $$b$$", { MD103: { style: "single" } })
      assert.strictEqual(errors.length, 2)
    })

    it("multiple single $ with style=double — all flagged", async () => {
      const errors = await lint("$a$ and $b$", { MD103: { style: "double" } })
      assert.strictEqual(errors.length, 2)
    })
  })

  describe("consistent mode — first occurrence sets the style", () => {
    it("first is single → subsequent double is flagged", async () => {
      const errors = await lint("$a$ and $$b$$", ON)
      assert.strictEqual(errors.length, 1)
      // $$b$$ 是不一致的那个
      assert.strictEqual(errors[0].lineNumber, 1)
    })

    it("first is double → subsequent single is flagged", async () => {
      const errors = await lint("$$a$$ and $b$", ON)
      assert.strictEqual(errors.length, 1)
    })

    it("all subsequent must match first occurrence", async () => {
      // 第一个 $$，后两个 $ → 两个错误
      const errors = await lint("$$a$$ and $b$ and $c$", ON)
      assert.strictEqual(errors.length, 2)
    })

    it("consistent across multiple lines — first line sets style", async () => {
      const errors = await lint("$a$\n$$b$$", ON)
      assert.strictEqual(errors.length, 1)
      assert.strictEqual(errors[0].lineNumber, 2)
    })

    it("multiple inline math on same line — first sets style", async () => {
      // $a$ 先出现 → $$b$$ 报错 → $c$ 不报错（已经是 single）
      const errors = await lint("$a$ and $$b$$ and $c$", ON)
      assert.strictEqual(errors.length, 1)
    })
  })

  describe("fix info", () => {
    it("provides fixInfo to normalize delimiter", async () => {
      const errors = await lint("$a$ and $$b$$", ON)
      assert.ok(errors[0].fixInfo, "should provide fixInfo")
    })

    it("fix converts double to single when style=single", async () => {
      const errors = await lint("$$x^2$$", { MD103: { style: "single" } })
      assert.ok(errors[0].fixInfo)
      assert.strictEqual(errors[0].fixInfo.insertText, "$x^2$")
    })

    it("fix converts single to double when style=double", async () => {
      const errors = await lint("$x^2$", { MD103: { style: "double" } })
      assert.ok(errors[0].fixInfo)
      assert.strictEqual(errors[0].fixInfo.insertText, "$$x^2$$")
    })

    it("fixInfo editColumn and deleteCount cover the full token span", async () => {
      const errors = await lint("$$x^2$$", { MD103: { style: "single" } })
      const fix = errors[0].fixInfo
      assert.ok(fix.editColumn >= 1)
      assert.ok(fix.deleteCount > 0)
    })
  })
})
