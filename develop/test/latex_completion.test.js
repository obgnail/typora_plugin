const test = require("node:test")
const assert = require("node:assert/strict")
const NativeFile = global.File
const NativeEvent = global.Event
const commands = require("../../plugin/latex_completion/commands.json")
const { extractPrefix, findCandidates, getCursorIndex, availablePackages, placeMenu, replaceInCodeMirror, replaceInTextarea } = require("../../plugin/latex_completion/core")

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
  assert.deepEqual(findCandidates("\\Gamma", commands, 10).map(command => command.key), ["\\Gamma", "\\varGamma"])
  assert.ok(findCandidates("\\gamma", commands, 10).some(command => command.key === "\\gamma"))
  assert.deepEqual(findCandidates("\\bma2", commands, 1).map(command => command.key), ["\\bma2"])
  assert.equal(findCandidates("\\frac", commands, 10)[0].key, "\\frac")
  assert.deepEqual(findCandidates("\\", commands, 3).map(command => command.key), ["\\frac", "\\sqrt", "\\sum"])
})

test("command fragments match after exact and prefix results", () => {
  const fixtures = ["\\leftarrow", "\\arrowvert", "\\rightarrow", "\\Arrow"]
    .map(key => ({ key }))
  assert.deepEqual(findCandidates("\\arrow", fixtures).map(command => command.key),
    ["\\arrowvert", "\\leftarrow", "\\rightarrow"])
  assert.deepEqual(findCandidates("\\Arrow", fixtures).map(command => command.key), ["\\Arrow"])
  assert.ok(findCandidates("\\arrow", commands, 50).some(command => command.key === "\\leftarrow"))
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

test("menu placement keeps the formula preview visible and stays inside the viewport", () => {
  const anchor = { left: 100, top: 100, bottom: 120 }
  const preview = { left: 90, top: 125, right: 220, bottom: 170 }
  const result = placeMenu(anchor, { width: 280, height: 150 }, preview, { width: 900, height: 700 })
  assert.ok(result.top >= preview.bottom || result.left >= preview.right || result.left + 280 <= preview.left || result.top + 150 <= preview.top)
  const edge = placeMenu({ left: 790, top: 640, bottom: 660 }, { width: 280, height: 150 }, null, { width: 900, height: 700 })
  assert.ok(edge.left >= 8 && edge.left + 280 <= 892)
  assert.ok(edge.top >= 8 && edge.top + 150 <= 692)
  const formula = { left: 100, top: 100, right: 220, bottom: 120 }
  const first = placeMenu(anchor, { width: 280, height: 150 }, preview, { width: 900, height: 700 }, null, formula)
  const later = placeMenu(anchor, { width: 280, height: 70 }, preview, { width: 900, height: 700 }, first.side, formula)
  assert.equal(later.side, first.side)
  assert.ok(later.top >= formula.bottom || later.left >= formula.right || later.left + 280 <= formula.left || later.top + 70 <= formula.top)
})

test("CodeMirror insertion replaces only the prefix and places the cursor in the snippet", () => {
  let value = "x+\\fra+y"
  let cursor = { line: 0, ch: 6 }
  const cm = {
    getCursor: () => cursor,
    indexFromPos: pos => pos.ch,
    posFromIndex: ch => ({ line: 0, ch }),
    operation: fn => fn(),
    replaceRange: (text, from, to) => { value = value.slice(0, from.ch) + text + value.slice(to.ch) },
    setCursor: pos => { cursor = pos },
    focus: () => {},
  }
  const command = commands.find(item => item.key === "\\frac")
  replaceInCodeMirror(cm, "\\fra", command)
  assert.equal(value, "x+\\frac{}{}+y")
  assert.equal(cursor.ch, 8)
})

test("textarea insertion replaces the selected prefix and dispatches input", () => {
  let notified = 0
  const input = {
    value: "x+\\fra+y", selectionStart: 6,
    setRangeText: (text, start, end) => { input.value = input.value.slice(0, start) + text + input.value.slice(end); input.selectionStart = start + text.length },
    setSelectionRange: start => { input.selectionStart = start },
    dispatchEvent: () => { notified++ },
    focus: () => {},
  }
  global.Event = class {}
  replaceInTextarea(input, "\\fra", commands.find(item => item.key === "\\frac"))
  assert.equal(input.value, "x+\\frac{}{}+y")
  assert.equal(input.selectionStart, 8)
  assert.equal(notified, 1)
  global.Event = NativeEvent
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
      state: { type: "slash", match: [], index: -1 },
      hide: () => calls.push("hide"),
      initState: () => { File.editor.autoComplete.state = { type: "", match: [], index: -1 } },
      attachToRange: () => calls.push("attach"),
      show: (...args) => { calls.push(args); File.editor.autoComplete.state.type = args[3].type; File.editor.autoComplete.state.match = ["\\frac"] },
      updateActive: () => calls.push("active"),
    },
  } }
  plugin._onEdit()
  assert.deepEqual(calls.slice(0, 2), ["hide", "attach"])
  assert.equal(calls[2][1].start, 4)
  assert.equal(calls[2][2], "frac")
  assert.equal(calls[2][3], plugin.handler)
  assert.equal(File.editor.autoComplete.state.index, 0)
  document.activeElement.tagName = "TEXTAREA"
  plugin._onEdit()
  assert.equal(calls.length, 4)
  global.File = NativeFile
  delete global.$
  delete global.document
  delete global.BasePlugin
})

test("inline fragment suggestions can be accepted with Enter or Tab", () => {
  global.BasePlugin = class {}
  const Plugin = require("../../plugin/latex_completion").plugin
  const plugin = new Plugin()
  plugin.config = { MAX_RESULTS: 10 }
  assert.deepEqual(plugin.handler.search("arrow").slice(0, 2), ["\\leftarrow", "\\rightarrow"])
  const applied = []
  global.File = { editor: { autoComplete: {
    state: { type: "latex_completion", match: ["\\leftarrow"], index: 0 },
    isShown: () => true,
    apply: key => applied.push(key),
  } } }
  for (const key of ["Enter", "Tab"]) {
    let prevented = 0
    plugin._onInlineKeyDown({ key, isComposing: false, preventDefault: () => { prevented++ }, stopPropagation: () => {} })
    assert.equal(prevented, 1)
  }
  assert.deepEqual(applied, ["\\leftarrow", "\\leftarrow"])
  global.File = NativeFile
  delete global.BasePlugin
})

test("block completion follows the active CodeMirror and cleans listeners on switch", () => {
  const { JSDOM } = require("jsdom")
  const dom = new JSDOM('<div class="md-math-block"><div class="CodeMirror"></div><div class="md-mathjax-preview"></div></div>')
  global.document = dom.window.document
  global.window = dom.window
  const wrapper = document.querySelector(".CodeMirror")
  const listeners = new Map()
  let value = "\\fra"
  let cursor = { line: 0, ch: 4 }
  const cm = {
    getWrapperElement: () => wrapper,
    getCursor: () => cursor,
    getLine: () => value,
    somethingSelected: () => false,
    cursorCoords: () => ({ left: 30, top: 30, bottom: 45 }),
    on: (name, fn) => listeners.set(name, fn),
    off: (name, fn) => { if (listeners.get(name) === fn) listeners.delete(name) },
    indexFromPos: pos => pos.ch,
    posFromIndex: ch => ({ line: 0, ch }),
    operation: fn => fn(),
    replaceRange: (snippet, from, to) => { value = value.slice(0, from.ch) + snippet + value.slice(to.ch) },
    setCursor: pos => { cursor = pos },
    focus: () => {},
  }
  global.File = { editor: { mathBlock: { currentCm: cm } } }
  const BlockCompletion = require("../../plugin/latex_completion/block")
  const block = new BlockCompletion({ config: { ENABLE_BLOCK: true }, _find: prefix => findCandidates(prefix, commands, 10), _hint: () => "fraction" })
  block.bindCurrent()
  assert.equal(block.active.candidates[0].key, "\\frac")
  assert.equal(block.active.index, 0)
  assert.equal(block.menu.parentElement, document.querySelector(".md-math-block"))
  assert.equal(block.menu.style.top, "")
  let prevented = 0
  block._onKeyDown({ key: "Enter", preventDefault: () => { prevented++ }, stopPropagation: () => {} })
  assert.equal(value, "\\frac{}{}")
  assert.equal(cursor.ch, 6)
  assert.equal(prevented, 1)
  block.detach()
  assert.equal(block.active, null)
  assert.equal(block.menu.parentElement, document.body)
  assert.equal(listeners.size, 0)
  dom.window.close()
  global.File = NativeFile
  delete global.window
  delete global.document
})

test("textarea fallback responds to Tab, IME state and focus cleanup", () => {
  const { JSDOM } = require("jsdom")
  const dom = new JSDOM('<div class="md-math-block"><textarea></textarea></div>')
  global.document = dom.window.document
  global.window = dom.window
  global.Event = dom.window.Event
  global.getComputedStyle = dom.window.getComputedStyle
  const input = document.querySelector("textarea")
  input.value = "\\sqr"
  input.setSelectionRange(4, 4)
  let composing = false
  let cleaned = false
  global.File = { editor: { mathBlock: { currentCm: null } } }
  const BlockCompletion = require("../../plugin/latex_completion/block")
  const block = new BlockCompletion({
    config: { ENABLE_BLOCK: true },
    _find: prefix => findCandidates(prefix, commands, 10),
    _hint: () => "root",
    utils: { createSmartInputHandler: () => ({ isComposing: () => composing, clean: () => { cleaned = true } }) },
  })
  input.focus()
  assert.equal(block.active.candidates[0].key, "\\sqrt")
  composing = true
  block.updateTextarea(input)
  assert.equal(block.active, null)
  composing = false
  block.updateTextarea(input)
  block._onKeyDown({ key: "Tab", preventDefault: () => {}, stopPropagation: () => {} })
  assert.equal(input.value, "\\sqrt{}")
  assert.equal(input.selectionStart, 6)
  block.detach()
  assert.equal(cleaned, true)
  assert.equal(block.active, null)
  dom.window.close()
  global.File = NativeFile
  global.Event = NativeEvent
  delete global.getComputedStyle
  delete global.window
  delete global.document
})

test("an open block menu repositions after a theme stylesheet change", async () => {
  const { JSDOM } = require("jsdom")
  const dom = new JSDOM("<div></div>")
  global.document = dom.window.document
  global.window = dom.window
  global.MutationObserver = dom.window.MutationObserver
  global.requestAnimationFrame = callback => callback()
  const BlockCompletion = require("../../plugin/latex_completion/block")
  const block = new BlockCompletion({ config: { ENABLE_BLOCK: true } })
  let positions = 0
  block.position = () => { positions++ }
  const stylesheet = document.createElement("link")
  stylesheet.rel = "stylesheet"
  stylesheet.href = "night.css"
  document.head.appendChild(stylesheet)
  await new Promise(resolve => setImmediate(resolve))
  assert.ok(positions > 0)
  dom.window.close()
  delete global.requestAnimationFrame
  delete global.MutationObserver
  delete global.window
  delete global.document
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
  global.File = NativeFile
  delete global.document
  delete global.BasePlugin
})
