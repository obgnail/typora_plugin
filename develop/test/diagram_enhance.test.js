const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const test = require("node:test")

global.BasePlugin = class {
  i18n = { t: key => key }
}

const { plugin: DiagramEnhancePlugin } = require("../../plugin/diagram_enhance")

const makeInstance = config => {
  const instance = new DiagramEnhancePlugin()
  instance.config = config || {}
  instance.prepare()
  return instance
}

test("renders default-on wheel toggle, controls, scale, and fullscreen action", () => {
  const instance = makeInstance()
  const html = instance._toolbarHTML()

  assert.match(html, /data-action="wheel-toggle"/)
  assert.match(html, /aria-pressed="true"/)
  assert.match(html, /data-action="zoom-in"/)
  assert.match(html, /data-action="zoom-out"/)
  assert.match(html, /data-action="reset"/)
  assert.match(html, /data-role="percent"[^>]*>100%/)
  assert.match(html, /data-action="fullscreen"/)
})

test("creates handles for four edges and four corners", () => {
  const html = makeInstance()._resizeHandlesHTML()
  const positions = Array.from(html.matchAll(/data-position="([^"]+)"/g), match => match[1])
  assert.deepEqual(positions, [
    "top-left", "top", "top-right", "right",
    "bottom-right", "bottom", "bottom-left", "left",
  ])
})

test("targets the shared diagram panel and hides interaction chrome from exports", () => {
  const instance = makeInstance()
  assert.match(instance.style(), /\.plugin-diagram-content/)
  assert.match(instance.style(), /transform-origin: 0 0/)
  assert.match(instance.style(), /:fullscreen/)
  assert.match(instance.style(), /touch-action: none/)
  assert.match(instance.style(), /\.plugin-diagram-surface:hover/)
  assert.match(instance.style(), /\.plugin-diagram-resizing-active/)
  assert.match(instance.style(), /box-shadow: inset 0 0 0 1px/)
  assert.match(instance._exportStyle(), /transform: none !important/)
  assert.match(instance._exportStyle(), /plugin-diagram-resize-handle/)
  assert.match(instance._exportStyle(), /box-shadow: none !important/)
})

test("registers non-passive wheel and pointer gesture handlers", () => {
  const source = fs.readFileSync(path.join(__dirname, "../../plugin/diagram_enhance/index.js"), "utf8")
  assert.match(source, /addEventListener\("wheel", this\._handleWheel, \{ passive: false/)
  assert.match(source, /addEventListener\("pointerdown", this\._handlePointerDown/)
  assert.match(source, /pinchTransform\(/)
  assert.match(source, /resizeRect\(/)
  assert.match(source, /if \(!state \|\| !state\.wheelZoomEnabled \|\| event\.deltaY === 0\) return/)
  assert.match(source, /isDoubleClickCandidate\(state\.lastHostClick, point, Date\.now\(\)\)/)
  assert.match(source, /if \(blockHostFocus\) \{\s*event\.preventDefault\(\)\s*event\.stopPropagation\(\)/)
  assert.match(source, /requestFullscreen/)
  assert.doesNotMatch(source, /_openModal|cloneNode|_copyCanvasPixels/)
})

test("can disable fullscreen and resize surfaces through existing config", () => {
  const instance = makeInstance({ SHOW_FULLSCREEN: false, RESIZABLE: false })
  assert.doesNotMatch(instance._toolbarHTML(), /data-action="fullscreen"/)
  assert.equal(instance.options.resizable, false)
})

test("exposes reset as a dynamic action and dispatches it through call", () => {
  const instance = makeInstance()
  instance.i18n = { t: key => key }
  const preview = {}
  const panel = { querySelector: () => preview }
  const anchor = { closest: () => panel }
  const state = {}
  const meta = {}
  let resetState
  instance.states.set(preview, state)
  instance._reset = value => { resetState = value }

  assert.deepEqual(instance.getDynamicActions(anchor, meta), [{
    act_name: "act.reset",
    act_value: "reset",
    act_disabled: false,
  }])
  instance.call("reset", meta)
  assert.equal(resetState, state)
})
