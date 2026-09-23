const test = require("node:test")
const assert = require("node:assert/strict")
const commands = require("../../plugin/latex_completion/commands.json")
const { extractPrefix, findCandidates, getCursorIndex, availablePackages } = require("../../plugin/latex_completion/core")

test("catalog preserves 232 source commands and extends MathJax symbols", () => {
  const originals = require("../../plugin/latex_completion/commands.original.json")
  assert.equal(originals.length, 232)
  assert.equal(commands.length, 600)
  assert.equal(new Set(commands.map(command => command.key)).size, commands.length)
  for (const original of originals) assert.ok(commands.some(command => command.key === original.key))
  for (const locale of ["en", "zh-CN", "zh-TW"]) {
    const hints = require(`../../plugin/global/locales/${locale}.json`).latex_completion
    for (const command of commands) {
      assert.ok(hints[`hint.${command.key.slice(1)}`] || hints[`category.${command.category}`], `${locale}: ${command.key}`)
      assert.equal(Number.isInteger(command.cursorOffset), true)
      assert.ok(command.cursorOffset <= 0 && command.cursorOffset >= -command.snippet.length)
      assert.ok(!command.snippet.includes("$0"))
    }
  }
})

test("prefix extraction supports nested input, numeric aliases and punctuation", () => {
  assert.equal(extractPrefix("{x+{\\bma2"), "\\bma2")
  assert.equal(extractPrefix("\\,"), "\\,")
  assert.equal(extractPrefix("text \\fra"), "\\fra")
  assert.equal(extractPrefix("text \\\\fra"), null)
  assert.equal(extractPrefix("ordinary text"), null)
})

test("matching is case sensitive and ranks exact and common commands", () => {
  assert.deepEqual(findCandidates("\\Gamma", commands, 10).map(command => command.key), ["\\Gamma"])
  assert.ok(findCandidates("\\gamma", commands, 10).some(command => command.key === "\\gamma"))
  assert.deepEqual(findCandidates("\\bma2", commands, 1).map(command => command.key), ["\\bma2"])
  assert.equal(findCandidates("\\frac", commands, 10)[0].key, "\\frac")
  assert.deepEqual(findCandidates("\\", commands, 3).map(command => command.key), ["\\frac", "\\sqrt", "\\sum"])
})

test("snippet cursor positions are valid, including the removed tab stop", () => {
  const fraction = commands.find(command => command.key === "\\frac")
  assert.equal(getCursorIndex(fraction.snippet, fraction.cursorOffset), 6)
  const begin = commands.find(command => command.key === "\\begin")
  assert.ok(begin.snippet.includes("\\begin{}"))
  assert.ok(getCursorIndex(begin.snippet, begin.cursorOffset) < begin.snippet.length)
  assert.equal(availablePackages({ config: { tex: { packages: ["base", "ams", "cancel"] } } }).includes("cancel"), true)
  assert.equal(availablePackages({ config: { tex: { packages: { "+": ["physics"] } } } }).includes("physics"), true)
})

test("extension commands appear only for confirmed MathJax packages", () => {
  global.BasePlugin = class {}
  const Plugin = require("../../plugin/latex_completion").plugin
  const plugin = new Plugin()
  plugin.config = { MAX_RESULTS: 50 }
  global.window = { MathJax: { config: { tex: { packages: ["base", "ams"] } } } }
  assert.equal(plugin._find("\\ket").length, 0)
  window.MathJax.config.tex.packages.push("braket")
  assert.equal(plugin._find("\\ket")[0].key, "\\ket")
  delete global.window
  delete global.BasePlugin
})

test("inline math invokes Typora's native completion with the matched range", () => {
  global.BasePlugin = class {}
  const Plugin = require("../../plugin/latex_completion").plugin
  const plugin = new Plugin()
  plugin.config = { MAX_RESULTS: 10 }
  const container = { tagName: "SCRIPT" }
  const range = {
    collapsed: true,
    startContainer: {},
    getBookmark: () => ({ start: 9, end: 9 }),
    cloneRange: () => ({ setStartBefore: () => {}, toString: () => "{x+\\frac" }),
  }
  const calls = []
  global.document = { activeElement: { tagName: "DIV" } }
  global.$ = () => ({ closest: () => [container] })
  global.File = { editor: {
    selection: { getRangy: () => range },
    autoComplete: {
      attachToRange: () => calls.push("attach"),
      show: (...args) => calls.push(args),
    },
  } }
  plugin._onEdit()
  assert.equal(calls[0], "attach")
  assert.equal(calls[1][1].start, 4)
  assert.equal(calls[1][2], "frac")
  assert.equal(calls[1][3], plugin.handler)
  document.activeElement.tagName = "TEXTAREA"
  plugin._onEdit()
  assert.equal(calls.length, 2)
  delete global.File
  delete global.$
  delete global.document
  delete global.BasePlugin
})

test("slash commands defer a matching backslash to LaTeX completion", () => {
  global.BasePlugin = class {
    constructor(name, config) {
      this.config = config
      this.utils = { escape: text => text, getPlugin: () => ({ hasCandidate: () => true }) }
    }
  }
  const SlashPlugin = require("../../plugin/slash_commands").plugin
  const plugin = new SlashPlugin("slash_commands", {
    TRIGGER_REGEXP: "[\\\\/](?<kw>\\w*)$",
    MATCH_STRATEGY: "prefix",
    ORDER_STRATEGY: "predefined",
    COMMANDS: [{ enable: true, keyword: "frac", scope: "inline_math", type: "snippet", callback: "x" }],
    FUNC_PARAM_SEPARATOR: "_",
  })
  let shows = 0
  global.document = { activeElement: { tagName: "DIV" } }
  global.File = { editor: { autoComplete: { attachToRange: () => {}, show: () => { shows++ } } } }
  plugin._getTextAround = () => ["\\frac", "", { start: 5 }, plugin.SCOPE.INLINE_MATH]
  plugin._onEdit()
  assert.equal(shows, 0)
  plugin.utils.getPlugin = () => undefined
  plugin._onEdit()
  assert.equal(shows, 1)
  plugin._getTextAround = () => ["/frac", "", { start: 5 }, plugin.SCOPE.INLINE_MATH]
  plugin._onEdit()
  assert.equal(shows, 2)
  delete global.File
  delete global.document
  delete global.BasePlugin
})
