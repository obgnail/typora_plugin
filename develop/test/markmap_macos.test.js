"use strict"

const assert = require("node:assert/strict")
const test = require("node:test")
const { inlineLocalStyles } = require("../../plugin/markmap/loader.js")

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
