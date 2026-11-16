"use strict"

const assert = require("node:assert/strict")
const { JSDOM } = require("jsdom")
const test = require("node:test")

global.BasePlugin = class {}
const { plugin: CalloutsPlugin } = require("../../plugin/callouts/index.js")

function createPlugin(html) {
  const dom = new JSDOM(`<main id="write">${html}</main>`)
  const plugin = new CalloutsPlugin()
  plugin.utils = {
    entities: {
      querySelectorAllInWrite: selector => dom.window.document.querySelectorAll(`#write ${selector}`),
    },
  }
  return { dom, plugin }
}

test("callouts decorates legacy blockquote markup", () => {
  const { dom, plugin } = createPlugin('<blockquote><p><span>[!TIP]-</span></p><p>Body</p></blockquote>')
  plugin.setCallouts()
  const quote = dom.window.document.querySelector("blockquote")
  assert.equal(quote.classList.contains("plugin-callout"), true)
  assert.equal(quote.classList.contains("callout-folded"), true)
  assert.equal(quote.getAttribute("callout-type"), "tip")
})

test("callouts decorates Typora 1.14 native alert markup", () => {
  const { dom, plugin } = createPlugin('<div mdtype="blockquote" class="md-alert md-alert-note"><div>Title</div><div>Body</div></div>')
  plugin.setCallouts()
  const quote = dom.window.document.querySelector(".md-alert")
  assert.equal(quote.classList.contains("plugin-callout"), true)
  assert.equal(quote.getAttribute("callout-type"), "note")
})
