"use strict"

const assert = require("node:assert/strict")
const test = require("node:test")
const { BLOCK, inject, remove } = require("../../plugin/macos/lib/html")

test("macOS HTML injection is ordered, idempotent, and reversible", () => {
  const html = '<html><head><script src="./appsrc/main.js" defer></script></head><body>ok</body></html>'
  const installed = inject(html)
  assert.equal(installed.indexOf(BLOCK) < installed.indexOf("</body>"), true)
  assert.equal(inject(installed), installed)
  assert.equal(remove(installed), html)
  assert.equal(remove(html), html)
})

test("macOS HTML injection rejects unsafe inputs", () => {
  assert.throws(() => inject("<html></html>"), /body/)
  assert.throws(() => inject("<!-- typora-plugin-macos:start --></body>"), /malformed/)
})
