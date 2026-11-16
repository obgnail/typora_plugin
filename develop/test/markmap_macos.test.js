"use strict"

const assert = require("node:assert/strict")
const test = require("node:test")
const { inlineLocalStyles } = require("../../plugin/markmap/loader.js")
const TOCMarkmap = require("../../plugin/markmap/toc.js")

test("markmap inlines file styles for WKWebView and rebases relative assets", async () => {
  const styles = [{ type: "stylesheet", data: { href: "file:///tmp/katex/katex.min.css" } }]
  const utils = {
    Package: {
      FsExtra: {
        readFile: async (file, encoding) => {
          assert.equal(file, "/tmp/katex/katex.min.css")
          assert.equal(encoding, "utf8")
          return '@font-face{src:url("fonts/test.woff2")} .remote{src:url(https://example.test/a)}'
        },
      },
    },
  }

  await inlineLocalStyles(styles, utils)
  assert.equal(styles[0].type, "style")
  assert.match(styles[0].data, /file:\/\/\/tmp\/katex\/fonts\/test\.woff2/)
  assert.match(styles[0].data, /https:\/\/example\.test\/a/)
})

test("markmap ignores outline updates until its async transformer is ready", () => {
  const listeners = {}
  const eventType = {
    afterToggleSidebar: "afterToggleSidebar",
    afterSetSidebarWidth: "afterSetSidebarWidth",
    toggleSettingPage: "toggleSettingPage",
    outlineUpdated: "outlineUpdated",
  }
  const element = { addEventListener() {} }
  const plugin = {
    config: { AUTO_FIT_ON_UPDATE: false },
    i18n: {},
    Lib: {},
    utils: {
      eventHub: { eventType, on: (type, fn) => { listeners[type] = fn } },
      isShown: () => true,
      debounce: fn => fn,
    },
  }
  const toc = new TOCMarkmap(plugin)
  toc.entities = { panel: element, header: element }
  toc.panelCtl = { reposition() {} }
  let draws = 0
  toc.draw = () => { draws++ }

  toc._onEvent()
  listeners.outlineUpdated()
  assert.equal(draws, 0)

  plugin.Lib.transformer = {}
  listeners.outlineUpdated()
  assert.equal(draws, 1)
})
