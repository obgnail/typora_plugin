const { describe, it, beforeEach } = require("node:test")
const assert = require("node:assert")
const ThirdPartyDiagramParser = require("../../plugin/global/core/utils/thirdPartyDiagramParser")

const wrapBlock = lines => [
  "// ==BlockCodeConfig==",
  ...lines,
  "// ==/BlockCodeConfig==",
].join("\n")

describe("ThirdPartyDiagramParser.createConfigParser", () => {
  let parser
  beforeEach(() => parser = new ThirdPartyDiagramParser({}))

  it("is exposed as an instance function", () => {
    assert.strictEqual(typeof parser.createConfigParser, "function")
    const parse = parser.createConfigParser({})
    assert.strictEqual(typeof parse, "function")
  })

  it("returns defaults and original content when there is no BlockCodeConfig block", () => {
    const parse = parser.createConfigParser({
      width: { type: "string", default: "100%" },
      count: { type: "number", default: 1 },
    })
    const { meta, content } = parse("no config block here")
    assert.deepStrictEqual(meta, { width: "100%", count: 1 })
    assert.strictEqual(content, "no config block here")
  })

  it("parses simple string/number/boolean fields from the config block", () => {
    const parse = parser.createConfigParser({
      title: { type: "string" },
      hscale: { type: "number" },
      interactive: { type: "boolean" },
    })
    const code = wrapBlock([
      "// @title Hello World",
      "// @hscale 2",
      "// @interactive true",
    ])
    const { meta } = parse(code)
    assert.deepStrictEqual(meta, { title: "Hello World", hscale: 2, interactive: true })
  })

  it("casts boolean 'false' and '0' to false, everything else to true", () => {
    const parse = parser.createConfigParser({ flagA: "boolean", flagB: "boolean", flagC: "boolean" })
    const code = wrapBlock([
      "// @flagA false",
      "// @flagB 0",
      "// @flagC yes",
    ])
    const { meta } = parse(code)
    assert.deepStrictEqual(meta, { flagA: false, flagB: false, flagC: true })
  })

  it("supports array type, collecting repeated @key lines", () => {
    const parse = parser.createConfigParser({ tags: { type: "array", items: "string" } })
    const code = wrapBlock([
      "// @tags foo",
      "// @tags bar",
      "// @tags baz",
    ])
    const { meta } = parse(code)
    assert.deepStrictEqual(meta.tags, ["foo", "bar", "baz"])
  })

  it("last value wins for non-array fields when the key repeats", () => {
    const parse = parser.createConfigParser({ align: { type: "string" } })
    const code = wrapBlock([
      "// @align left",
      "// @align right",
    ])
    const { meta } = parse(code)
    assert.strictEqual(meta.align, "right")
  })

  it("applies valueAliases before casting", () => {
    const parse = parser.createConfigParser({ align: { type: "string", valueAliases: { l: "left", c: "center", r: "right" } } })
    const code = wrapBlock(["// @align l"])
    const { meta } = parse(code)
    assert.strictEqual(meta.align, "left")
  })

  it("resolves keys via aliases", () => {
    const parse = parser.createConfigParser({ backgroundColor: { type: "string", aliases: ["gbc", "background-color"] } })
    const code = wrapBlock(["// @gbc red"])
    const { meta } = parse(code)
    assert.strictEqual(meta.backgroundColor, "red")
  })

  it("falls back to literal fallback (not default) when required field is missing, and records an error", () => {
    const parse = parser.createConfigParser({ name: { type: "string", required: true } })
    assert.throws(() => parse(wrapBlock([])), /Missing Required.*@name/s)
  })

  it("does not require a field if a default is provided, even if 'required' is set", () => {
    const parse = parser.createConfigParser({ name: { type: "string", required: true, default: "anon" } })
    const { meta } = parse(wrapBlock([]))
    assert.strictEqual(meta.name, "anon")
  })

  it("rejects values not in enum and falls back to default", () => {
    const parse = parser.createConfigParser({ align: { type: "string", enum: ["left", "center", "right"], default: "left" } })
    assert.throws(() => parse(wrapBlock(["// @align middle"])), /Enum Error.*@align/s)
  })

  it("rejects values failing a pattern and falls back to default", () => {
    const parse = parser.createConfigParser({ color: { type: "string", pattern: /^#[0-9a-f]{6}$/i, default: "#000000" } })
    assert.throws(() => parse(wrapBlock(["// @color notacolor"])), /Pattern Error.*@color/s)
  })

  it("rejects values failing a custom validator", () => {
    const parse = parser.createConfigParser({ count: { type: "number", validator: v => v > 0, default: 1 } })
    assert.throws(() => parse(wrapBlock(["// @count -5"])), /Validation Error.*@count/s)
  })

  it("enforces minItems/maxItems on array fields", () => {
    const parseMax = parser.createConfigParser({ tags: { type: "array", items: "string", maxItems: 2, default: [] } })
    assert.throws(() => parseMax(wrapBlock(["// @tags a", "// @tags b", "// @tags c"])), /Exceeds maximum/)

    const parseMin = parser.createConfigParser({ tags: { type: "array", items: "string", minItems: 2, default: [] } })
    assert.throws(() => parseMin(wrapBlock(["// @tags a"])), /Requires at least/)
  })

  it("applies a custom transform to each processed value", () => {
    const parse = parser.createConfigParser({ tags: { type: "array", items: "string", transform: v => v.toUpperCase() } })
    const { meta } = parse(wrapBlock(["// @tags foo"]))
    assert.deepStrictEqual(meta.tags, ["FOO"])
  })

  it("passes through unknown keys found in the block that are not part of the schema", () => {
    const parse = parser.createConfigParser({})
    const { meta } = parse(wrapBlock(["// @custom something"]))
    assert.strictEqual(meta.custom, "something")
  })

  it("ignores empty-valued @key lines", () => {
    const parse = parser.createConfigParser({ title: { type: "string", default: "fallback" } })
    const { meta } = parse(wrapBlock(["// @title   "]))
    assert.strictEqual(meta.title, "fallback")
  })

  it("ignores lines outside the BlockCodeConfig markers and correctly outputs pure content", () => {
    const parse = parser.createConfigParser({ title: { type: "string", default: "none" } })
    const code = [
      "// @title outside",
      "// ==BlockCodeConfig==",
      "// @title inside",
      "// ==/BlockCodeConfig==",
      "graph TD;",
    ].join("\n")
    const { meta, content } = parse(code)
    assert.strictEqual(meta.title, "inside")
    assert.strictEqual(content, "// @title outside\ngraph TD;")
  })

  it("strictly removes the config block AND its trailing newline from the pure content", () => {
    const parse = parser.createConfigParser({})
    const code = [
      "// ==BlockCodeConfig==",
      "// @dummy 123",
      "// ==/BlockCodeConfig==",
      "const a = 1;",
    ].join("\n")

    const { content } = parse(code)
    assert.strictEqual(content, "const a = 1;")
  })

  it("returns empty object for meta and empty string for content when code is null/undefined", () => {
    const parse = parser.createConfigParser({})
    assert.deepStrictEqual(parse(null), { meta: {}, content: "" })
    assert.deepStrictEqual(parse(undefined), { meta: {}, content: "" })
  })
})
