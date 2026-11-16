"use strict"

const test = require("node:test")
const assert = require("node:assert/strict")
const path = require("node:path")

const entrypoint = require.resolve("../../plugin/index.js")

function loadAt(readyState) {
  const calls = []
  let loadHandler
  const originalWindow = global.window
  const originalDocument = global.document
  const originalDirname = global.dirname
  const originalReqnode = global.reqnode
  const fakeWindow = {
    addEventListener(type, handler, options) {
      calls.push({ type, options })
      loadHandler = handler
    },
  }
  const fakeDocument = { readyState }
  const fakeReqnode = request => request === "path" ? path : () => calls.push({ entry: request })
  global.window = fakeWindow
  global.document = fakeDocument
  global.dirname = "/fixture"
  global.reqnode = fakeReqnode
  delete require.cache[entrypoint]
  try {
    require(entrypoint)
    return {
      calls,
      fireLoad: () => {
        const current = { window: global.window, document: global.document, dirname: global.dirname, reqnode: global.reqnode }
        Object.assign(global, { window: fakeWindow, document: fakeDocument, dirname: "/fixture", reqnode: fakeReqnode })
        try { loadHandler?.() } finally { Object.assign(global, current) }
      },
    }
  } finally {
    global.window = originalWindow
    global.document = originalDocument
    global.dirname = originalDirname
    global.reqnode = originalReqnode
    delete require.cache[entrypoint]
  }
}

test("plugin entrypoint starts immediately when WKWebView already completed loading", () => {
  const { calls } = loadAt("complete")
  assert.equal(calls.filter(call => call.entry).length, 1)
  assert.equal(calls.filter(call => call.type === "load").length, 0)
})

test("plugin entrypoint starts during the deferred interactive phase", () => {
  const { calls } = loadAt("interactive")
  assert.equal(calls.filter(call => call.entry).length, 1)
  assert.equal(calls.filter(call => call.type).length, 0)
})

test("plugin entrypoint waits for DOMContentLoaded only while parsing", () => {
  const state = loadAt("loading")
  assert.equal(state.calls.filter(call => call.entry).length, 0)
  assert.deepEqual(state.calls[0], { type: "DOMContentLoaded", options: { once: true } })
  state.fireLoad()
  assert.equal(state.calls.filter(call => call.entry).length, 1)
})
