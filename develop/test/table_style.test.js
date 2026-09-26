const assert = require("node:assert/strict")
const test = require("node:test")
require("./mocks/dom.mock.js")

global.BasePlugin = class {
  i18n = { t: key => key, fillActions: actions => actions }
}

const { plugin: TableStylePlugin } = require("../../plugin/table_style")

// The unit tests only need table source ranges, so this intentionally small parser avoids coupling to Typora's runtime parser.
const parseTables = content => {
  const lines = content.split("\n")
  const maps = []
  for (let index = 0; index < lines.length - 1; index++) {
    if (/\|/.test(lines[index]) && /^\s*\|?\s*:?-{3,}/.test(lines[index + 1])) {
      let end = index + 2
      while (end < lines.length && /\|/.test(lines[end]) && lines[end].trim()) end++
      maps.push([index, end])
      index = end - 1
    }
  }
  return maps.map(map => ({ type: "table_open", map }))
}

const makePlugin = () => {
  const plugin = new TableStylePlugin()
  plugin.fixedName = "table_style"
  plugin.config = {
    HEADER_STYLE: false,
    FIRST_COLUMN_STYLE: false,
    HEADER_NOWRAP: false,
    AUTO_WIDTH: false,
    HEADER_BACKGROUND_COLOR: "rgba(0, 0, 0, .06)",
    FIRST_COLUMN_BACKGROUND_COLOR: "rgba(0, 0, 0, .03)",
  }
  plugin.i18n = { t: key => key, fillActions: actions => actions }
  plugin.utils = { getFilePath: () => "" }
  return plugin
}

test("cycles a current table override independently and applies its effective class", () => {
  document.querySelector("#write").innerHTML = "<table class=\"md-table\"><thead><tr><th>H</th></tr></thead><tbody><tr><td>A</td></tr></tbody></table>"
  const plugin = makePlugin()
  const table = document.querySelector("table")
  const meta = {}

  const actions = plugin.getDynamicActions(table.querySelector("td"), meta)
  assert.equal(actions.find(action => action.act_value === "cycle_header").act_disabled, false)

  plugin.call("cycle_header", meta)
  assert.ok(table.classList.contains("plugin-table-style-header-on"))
  assert.equal(plugin.getOverrides(table).header, "on")

  plugin.call("cycle_header", meta)
  assert.ok(!table.classList.contains("plugin-table-style-header-on"))
  assert.equal(plugin.getOverrides(table).header, "off")
})

test("applies global table styles to the current document during startup", () => {
  const content = "| H |\n| --- |\n| A |"
  document.querySelector("#write").innerHTML = "<table class=\"md-table\"><thead><tr><th>H</th></tr></thead><tbody><tr><td>A</td></tr></tbody></table>"
  const plugin = makePlugin()
  plugin.config.HEADER_STYLE = true
  plugin.config.FIRST_COLUMN_STYLE = true
  plugin.config.HEADER_NOWRAP = true
  plugin.utils = {
    getStorage: () => ({ get: () => undefined, set: () => {} }),
    stateRecorder: { register: () => {} },
    eventHub: {
      eventType: { beforeFileOpen: "beforeFileOpen", fileContentLoaded: "fileContentLoaded" },
      on: () => {},
    },
    getFilePath: () => "C:/notes/table.md",
    getCurrentFileContent: () => content,
    parseMarkdownBlock: parseTables,
  }

  plugin.process()

  const table = document.querySelector("table")
  assert.ok(table.classList.contains("plugin-table-style-header-on"))
  assert.ok(table.classList.contains("plugin-table-style-first-column-on"))
  assert.ok(table.classList.contains("plugin-table-style-nowrap-on"))
})

test("keeps manually resized table widths ahead of auto width CSS", () => {
  const plugin = makePlugin()
  assert.match(plugin.style(), /auto-width-on:not\(\[style\*="width"\]\)/)
})

test("does not apply adaptive width to a table with manually resized cells", () => {
  document.querySelector("#write").innerHTML = "<table class=\"md-table\"><thead><tr><th>H</th></tr></thead><tbody><tr><td style=\"width: 120px\">A</td></tr></tbody></table>"
  const plugin = makePlugin()
  plugin.config.AUTO_WIDTH = true
  const table = document.querySelector("table")

  plugin._setOverrides(table, {})

  assert.ok(!table.classList.contains("plugin-table-style-auto-width-on"))
})

test("restores an explicit table override from local storage after reload", () => {
  const content = "| H |\n| --- |\n| A |"
  let data
  const storage = { get: () => data, set: value => data = value }
  const utils = {
    getFilePath: () => "C:/notes/table.md",
    getCurrentFileContent: () => content,
    parseMarkdownBlock: parseTables,
  }
  document.querySelector("#write").innerHTML = "<table class=\"md-table\"><thead><tr><th>H</th></tr></thead><tbody><tr><td>A</td></tr></tbody></table>"
  const first = makePlugin()
  first.config.HEADER_STYLE = true
  first.utils = utils
  first.storage = storage
  const meta = { table: document.querySelector("table") }

  first.call("cycle_header", meta)
  first.call("cycle_header", meta)

  document.querySelector("#write").innerHTML = "<table class=\"md-table\"><thead><tr><th>H</th></tr></thead><tbody><tr><td>A</td></tr></tbody></table>"
  const second = makePlugin()
  second.config.HEADER_STYLE = true
  second.utils = utils
  second.storage = storage
  second._restoreCurrentFile()

  assert.equal(second.getOverrides(document.querySelector("table")).header, "off")
  assert.ok(!document.querySelector("table").classList.contains("plugin-table-style-header-on"))
})

test("clears a cached document when there is no current file to persist", () => {
  const plugin = makePlugin()
  plugin.stateSnapshot = { content: "stale" }

  plugin._persistCurrentFile()

  assert.equal(plugin.stateSnapshot, null)
})
