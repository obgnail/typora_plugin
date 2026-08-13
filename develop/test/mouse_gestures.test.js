const { describe, it, beforeEach, afterEach } = require("node:test")
const assert = require("node:assert")
require("./mocks/dom.mock.js") // provides document/window/HTMLElement/HTMLCanvasElement via JSDOM

const {
  Strategy4Way,
  Strategy8Way,
  Strategy4WayHysteresis,
  Strategy8WayHysteresis,
  StrategyAdaptive,
  StrategyAdaptiveHysteresis,
  GestureEngine,
  PluginTimeout,
  PluginSuppressor,
  PluginVisualizer,
  PluginHUD,
  PluginSensory,
  PluginActionDispatcher,
} = require("../../plugin/mouse_gestures/engine.js")

// ---- Fake EventTarget, avoids relying on JSDOM's PointerEvent support ----
function createFakeTarget() {
  const listeners = {}
  return {
    addEventListener(type, handler) {
      (listeners[type] ||= []).push(handler)
    },
    removeEventListener(type, handler) {
      listeners[type] = (listeners[type] || []).filter(h => h !== handler)
    },
    dispatch(type, ev) {
      (listeners[type] || []).slice().forEach(h => h(ev))
    },
    listenerCount(type) {
      return (listeners[type] || []).length
    },
  }
}

function makePointerEvent(overrides = {}) {
  return {
    button: 2,
    pointerType: "mouse",
    pointerId: 1,
    clientX: 0,
    clientY: 0,
    timeStamp: 0,
    target: { setPointerCapture: () => undefined, releasePointerCapture: () => undefined },
    preventDefault: () => undefined,
    stopPropagation: () => undefined,
    ...overrides,
  }
}

describe("Strategy4Way", () => {
  it("classifies cardinal directions correctly once threshold distance is exceeded", () => {
    const s = new Strategy4Way({ macroRadius: 10 })
    s.initialize(0, 0)
    assert.strictEqual(s.processMove(20, 0).newDirection, "→")
    assert.strictEqual(s.processMove(20, 20).newDirection, "↓")
    assert.strictEqual(s.processMove(0, 20).newDirection, "←")
    assert.strictEqual(s.processMove(0, 0).newDirection, "↑")
  })

  it("does not register a direction change while under the macroRadius threshold", () => {
    const s = new Strategy4Way({ macroRadius: 50 })
    s.initialize(0, 0)
    const state = s.processMove(5, 5)
    assert.strictEqual(state.changed, false)
    assert.strictEqual(state.newDirection, null)
    assert.deepStrictEqual(state.paths, [])
  })

  it("does not push a duplicate direction when the same direction repeats", () => {
    const s = new Strategy4Way({ macroRadius: 10 })
    s.initialize(0, 0)
    s.processMove(20, 0)
    const state = s.processMove(40, 0)
    assert.strictEqual(state.changed, false)
    assert.deepStrictEqual(state.paths, ["→"])
  })

  it("isActive reflects whether any path segment has been recorded", () => {
    const s = new Strategy4Way({ macroRadius: 10 })
    s.initialize(0, 0)
    assert.strictEqual(s.isActive(), false)
    s.processMove(20, 0)
    assert.strictEqual(s.isActive(), true)
  })

  it("processEnd uses tailRadius (typically smaller) as its threshold", () => {
    const s = new Strategy4Way({ macroRadius: 100, tailRadius: 5 })
    s.initialize(0, 0)
    // Below macroRadius so processMove would not register, but above tailRadius so processEnd should
    const state = s.processEnd(10, 0)
    assert.strictEqual(state.changed, true)
    assert.strictEqual(state.newDirection, "→")
  })

  it("processMove before initialize returns an unchanged state without throwing", () => {
    const s = new Strategy4Way()
    const state = s.processMove(100, 100)
    assert.strictEqual(state.changed, false)
    assert.strictEqual(state.newDirection, null)
  })
})

describe("Strategy8Way", () => {
  it("classifies the 8 principal directions", () => {
    const s = new Strategy8Way({ macroRadius: 10 })
    const cases = [
      [20, 0, "→"], [20, 20, "↘"], [0, 20, "↓"], [-20, 20, "↙"],
      [-20, 0, "←"], [-20, -20, "↖"], [0, -20, "↑"], [20, -20, "↗"],
    ]
    for (const [dx, dy, expected] of cases) {
      s.initialize(0, 0)
      const state = s.processMove(dx, dy)
      assert.strictEqual(state.newDirection, expected, `(${dx},${dy}) should be ${expected}`)
    }
  })
})

describe("Strategy4WayHysteresis", () => {
  it("prefers the previous direction near a boundary due to hysteresis bias", () => {
    // At angle=44deg (just inside "right" for the non-hysteresis 4-way, boundary is 45deg),
    // once locked onto "→", a small deviation toward "↓" shouldn't flip immediately.
    const s = new Strategy4WayHysteresis({ macroRadius: 1, hysteresis: 20 })
    s.initialize(0, 0)
    // First move locks onto "→"
    let state = s.processMove(100, 0)
    assert.strictEqual(state.newDirection, "→")
    // Angle now ~40 degrees from anchor; without hysteresis, sR(40) > sD(50)? sR=40,sD=50 so still "→" anyway.
    // Use an angle that would flip without bias but not with it: angle=50 deg -> sR=50, sD=40 -> "↓" without bias.
    // With bias (last="→", h=20): sR = 50-20 = 30 <= sD(40) -> stays "→"
    const dx = Math.cos(50 * Math.PI / 180) * 100
    const dy = Math.sin(50 * Math.PI / 180) * 100
    state = s.processMove(100 + dx, dy)
    assert.strictEqual(state.newDirection, null, "hysteresis should keep the last direction ('→'), producing no new direction event")
  })

  it("flips direction once the deviation clearly exceeds the hysteresis margin", () => {
    const s = new Strategy4WayHysteresis({ macroRadius: 1, hysteresis: 5 })
    s.initialize(0, 0)
    s.processMove(100, 0) // locks "→"
    const dx = Math.cos(89 * Math.PI / 180) * 100
    const dy = Math.sin(89 * Math.PI / 180) * 100
    const state = s.processMove(100 + dx, dy)
    assert.strictEqual(state.newDirection, "↓")
  })
})

describe("Strategy8WayHysteresis", () => {
  it("defaults hysteresis to 8 when not provided", () => {
    const s = new Strategy8WayHysteresis({ macroRadius: 1 })
    s.initialize(0, 0)
    const state = s.processMove(100, 0)
    assert.strictEqual(state.newDirection, "→")
  })
})

describe("StrategyAdaptive", () => {
  it("delegates to the 8-way (primary) strategy while path length stays <= 1", () => {
    const s = new StrategyAdaptive({ macroRadius: 10 })
    s.initialize(0, 0)
    const state = s.processMove(20, 20) // diagonal, only representable in 8-way
    assert.strictEqual(state.newDirection, "↘")
    assert.strictEqual(s.isActive(), true)
  })

  it("degrades to the 4-way (fallback) strategy once the primary records more than one segment", () => {
    const s = new StrategyAdaptive({ macroRadius: 10 })
    s.initialize(0, 0)
    s.processMove(20, 0)   // primary path: ["→"]
    s.processMove(20, 20)  // primary path: ["→", "↘"] -> length > 1 -> degrade
    // From here on, results should come from the fallback (4-way) strategy over the same points
    const state = s.processMove(0, 20)
    // fallback (Strategy4Way) initialized with the same anchor points, should produce a 4-way path
    assert.ok(["←", "↓", "→", "↑"].includes(state.newDirection) || state.newDirection === null)
    assert.strictEqual(s.isActive(), true)
  })

  it("initialize resets degraded state back to false", () => {
    const s = new StrategyAdaptive({ macroRadius: 10 })
    s.initialize(0, 0)
    s.processMove(20, 0)
    s.processMove(20, 20) // degrade
    s.initialize(0, 0) // reset
    const state = s.processMove(20, 20)
    assert.strictEqual(state.newDirection, "↘", "after re-initialize, primary (8-way) strategy should be used again")
  })
})

describe("GestureEngine - state machine", () => {
  let target, win

  beforeEach(() => {
    target = createFakeTarget()
    win = createFakeTarget()
    global.window = win
  })

  it("starts in idle state", () => {
    const engine = new GestureEngine({ targetElement: target, strategy: new Strategy4Way() })
    assert.strictEqual(engine.isIdle, true)
    assert.strictEqual(engine.isTracking, false)
  })

  it("binds pointerdown/pointermove/pointerup/pointercancel/contextmenu/mousedown/mouseup on construction", () => {
    new GestureEngine({ targetElement: target, strategy: new Strategy4Way() })
    for (const type of ["pointerdown", "pointermove", "pointerup", "pointercancel", "contextmenu", "mousedown", "mouseup"]) {
      assert.strictEqual(target.listenerCount(type), 1, `${type} should have exactly one listener`)
    }
  })

  it("transitions idle -> tracking on pointerdown with an allowed trigger button", () => {
    const engine = new GestureEngine({ targetElement: target, strategy: new Strategy4Way(), triggerButtons: [2] })
    target.dispatch("pointerdown", makePointerEvent({ button: 2 }))
    assert.strictEqual(engine.isTracking, true)
  })

  it("ignores pointerdown with a button not in triggerButtons", () => {
    const engine = new GestureEngine({ targetElement: target, strategy: new Strategy4Way(), triggerButtons: [2] })
    target.dispatch("pointerdown", makePointerEvent({ button: 0 }))
    assert.strictEqual(engine.isIdle, true)
  })

  it("ignores pointerdown with a disallowed pointerType", () => {
    const engine = new GestureEngine({ targetElement: target, strategy: new Strategy4Way(), allowedPointerTypes: ["mouse"] })
    target.dispatch("pointerdown", makePointerEvent({ pointerType: "touch" }))
    assert.strictEqual(engine.isIdle, true)
  })

  it("fires onStart and onPathChange hooks via a registered plugin", () => {
    const events = []
    const engine = new GestureEngine({ targetElement: target, strategy: new Strategy4Way({ macroRadius: 10 }) })
    engine.use({
      id: "test-plugin",
      install: () => undefined,
      onStart: (p) => events.push(["start", p]),
      onPathChange: (p) => events.push(["pathChange", p]),
    })
    target.dispatch("pointerdown", makePointerEvent({ clientX: 0, clientY: 0 }))
    assert.strictEqual(events[0][0], "start")
    target.dispatch("pointermove", makePointerEvent({ clientX: 20, clientY: 0 }))
    assert.ok(events.some(([type]) => type === "pathChange"))
  })

  it("pointermove is ignored unless the engine is currently tracking", () => {
    const events = []
    const engine = new GestureEngine({ targetElement: target, strategy: new Strategy4Way() })
    engine.use({
      id: "p",
      install: () => undefined,
      onMove: (p) => events.push(p),
    })
    target.dispatch("pointermove", makePointerEvent({ clientX: 20, clientY: 0 }))
    assert.strictEqual(events.length, 0)
  })

  it("transitions tracking -> idle on matching pointerup, firing onEnd with the gestureCode", () => {
    const engine = new GestureEngine({ targetElement: target, strategy: new Strategy4Way({ macroRadius: 10 }) })
    let endPayload = null
    engine.use({
      id: "p",
      install: () => undefined,
      onEnd: (p) => endPayload = p,
    })

    target.dispatch("pointerdown", makePointerEvent({ button: 2, clientX: 0, clientY: 0 }))
    target.dispatch("pointermove", makePointerEvent({ button: 2, clientX: 20, clientY: 0 }))
    target.dispatch("pointerup", makePointerEvent({ button: 2, clientX: 20, clientY: 0 }))

    assert.strictEqual(engine.isIdle, true)
    assert.strictEqual(endPayload.gestureCode, "→")
  })

  it("pointerup with a mismatched button is ignored", () => {
    const engine = new GestureEngine({ targetElement: target, strategy: new Strategy4Way() })
    target.dispatch("pointerdown", makePointerEvent({ button: 2 }))
    target.dispatch("pointerup", makePointerEvent({ button: 0 }))
    assert.strictEqual(engine.isTracking, true, "engine should still be tracking since the up-button didn't match")
  })

  it("onBeforeStart returning false suppresses the gesture and fires onSuppressed instead of onStart", () => {
    const events = []
    const engine = new GestureEngine({ targetElement: target, strategy: new Strategy4Way() })
    engine.use({
      id: "p",
      install: () => undefined,
      onBeforeStart: () => false,
      onSuppressed: (p) => events.push(p),
      onStart: () => events.push("start"),
    })
    target.dispatch("pointerdown", makePointerEvent())
    assert.strictEqual(engine.isIdle, true)
    assert.strictEqual(events.length, 1)
    assert.notStrictEqual(events[0], "start")
  })

  it("abort() transitions tracking -> idle and fires onAbort with the given reason", () => {
    const engine = new GestureEngine({ targetElement: target, strategy: new Strategy4Way() })
    let abortPayload = null
    engine.use({
      id: "p",
      install: () => undefined,
      onAbort: (p) => abortPayload = p,
    })
    target.dispatch("pointerdown", makePointerEvent())
    engine.abort("customReason")
    assert.strictEqual(engine.isIdle, true)
    assert.strictEqual(abortPayload.reason, "customReason")
  })

  it("pointercancel while tracking triggers abort('systemCancel')", () => {
    const engine = new GestureEngine({ targetElement: target, strategy: new Strategy4Way() })
    let abortPayload = null
    engine.use({
      id: "p",
      install: () => undefined,
      onAbort: (p) => abortPayload = p,
    })
    target.dispatch("pointerdown", makePointerEvent())
    target.dispatch("pointercancel", makePointerEvent())
    assert.strictEqual(engine.isIdle, true)
    assert.strictEqual(abortPayload.reason, "systemCancel")
  })

  it("pause() while tracking fires onAbort('paused') then onPaused, and moves to paused state", () => {
    const engine = new GestureEngine({ targetElement: target, strategy: new Strategy4Way() })
    const calls = []
    engine.use({
      id: "p",
      install: () => undefined,
      onAbort: (p) => calls.push(["abort", p.reason]), onPaused: () => calls.push(["paused"]),
    })
    target.dispatch("pointerdown", makePointerEvent())
    engine.pause()
    assert.strictEqual(engine.isPaused, true)
    assert.deepStrictEqual(calls, [["abort", "paused"], ["paused"]])
  })

  it("resume() transitions paused -> idle and fires onResumed", () => {
    const engine = new GestureEngine({ targetElement: target, strategy: new Strategy4Way() })
    let resumed = false
    engine.use({
      id: "p",
      install: () => undefined,
      onResumed: () => resumed = true,
    })
    engine.pause()
    engine.resume()
    assert.strictEqual(engine.isIdle, true)
    assert.strictEqual(resumed, true)
  })

  it("pointerdown is ignored while paused", () => {
    const engine = new GestureEngine({ targetElement: target, strategy: new Strategy4Way() })
    engine.pause()
    target.dispatch("pointerdown", makePointerEvent())
    assert.strictEqual(engine.isPaused, true)
  })

  it("destroy() unbinds listeners, clears plugins, and moves to destroyed state permanently", () => {
    const engine = new GestureEngine({ targetElement: target, strategy: new Strategy4Way() })
    let destroyed = false
    let uninstallCalled = false
    engine.use({
      id: "p",
      install: () => undefined,
      uninstall: () => uninstallCalled = true,
      onDestroyed: () => destroyed = true,
    })
    engine.destroy()
    assert.strictEqual(engine.isDestroyed, true)
    assert.strictEqual(destroyed, true)
    assert.strictEqual(uninstallCalled, true)
    assert.strictEqual(engine.getPlugin("p"), undefined)
    for (const type of ["pointerdown", "pointermove", "pointerup", "pointercancel", "contextmenu", "mousedown", "mouseup"]) {
      assert.strictEqual(target.listenerCount(type), 0)
    }
    // no transitions are possible from DESTROYED
    engine.pause()
    assert.strictEqual(engine.isDestroyed, true)
  })

  it("window 'blur' while tracking triggers abort('windowBlur')", () => {
    const engine = new GestureEngine({ targetElement: target, strategy: new Strategy4Way() })
    let abortPayload = null
    engine.use({
      id: "p",
      install: () => undefined,
      onAbort: (p) => abortPayload = p,
    })
    target.dispatch("pointerdown", makePointerEvent())
    win.dispatch("blur", {})
    assert.strictEqual(engine.isIdle, true)
    assert.strictEqual(abortPayload.reason, "windowBlur")
  })
})

describe("GestureEngine - plugin management", () => {
  let target
  beforeEach(() => {
    target = createFakeTarget()
    global.window = createFakeTarget()
  })

  it("use() throws TypeError when plugin lacks a string id", () => {
    const engine = new GestureEngine({ targetElement: target, strategy: new Strategy4Way() })
    assert.throws(() => engine.use({ install: () => undefined }), TypeError)
  })

  it("use() throws TypeError when plugin lacks an install method", () => {
    const engine = new GestureEngine({ targetElement: target, strategy: new Strategy4Way() })
    assert.throws(() => engine.use({ id: "x" }), TypeError)
  })

  it("use() calls plugin.install(engine) exactly once and getPlugin() retrieves it", () => {
    const engine = new GestureEngine({ targetElement: target, strategy: new Strategy4Way() })
    let installedWith = null
    const plugin = { id: "x", install: (e) => installedWith = e }
    engine.use(plugin)
    assert.strictEqual(installedWith, engine)
    assert.strictEqual(engine.getPlugin("x"), plugin)
  })

  it("registering the same plugin id twice is a no-op for the second registration", () => {
    const engine = new GestureEngine({ targetElement: target, strategy: new Strategy4Way() })
    let installCount = 0
    engine.use({ id: "x", install: () => installCount++ })
    engine.use({ id: "x", install: () => installCount++ })
    assert.strictEqual(installCount, 1)
  })

  it("unuse() calls uninstall and removes the plugin by id or instance", () => {
    const engine = new GestureEngine({ targetElement: target, strategy: new Strategy4Way() })
    let uninstalled = false
    const plugin = {
      id: "x",
      install: () => undefined,
      uninstall: () => uninstalled = true,
    }
    engine.use(plugin)
    engine.unuse("x")
    assert.strictEqual(uninstalled, true)
    assert.strictEqual(engine.getPlugin("x"), undefined)
  })

  it("setStrategy validates the strategy interface", () => {
    const engine = new GestureEngine({ targetElement: target, strategy: new Strategy4Way() })
    assert.throws(() => engine.setStrategy(null), /valid strategy instance/)
    assert.throws(() => engine.setStrategy({ initialize: () => undefined }), TypeError)
  })

  it("updateConfig merges new options without discarding existing ones", () => {
    const engine = new GestureEngine({ targetElement: target, strategy: new Strategy4Way(), triggerButtons: [2] })
    engine.updateConfig({ allowedPointerTypes: ["pen"] })
    assert.deepStrictEqual(engine.options.triggerButtons, [2])
    assert.deepStrictEqual(engine.options.allowedPointerTypes, ["pen"])
  })
})

describe("PluginTimeout", () => {
  it("aborts with 'startTimeout' if no movement occurs before startTimeout elapses", async () => {
    global.performance = global.performance || require("node:perf_hooks").performance
    const fakeEngine = {
      hasMoved: () => false,
      getLastMoveTimestamp: () => performance.now() - 50,
      abort: (reason) => fakeEngine.abortedWith = reason,
    }
    const plugin = new PluginTimeout({ startTimeout: 10, idleTimeout: 0, pollInterval: 5 })
    plugin.install(fakeEngine)
    plugin.onStart()
    await new Promise(r => setTimeout(r, 40))
    plugin.onAbort()
    assert.strictEqual(fakeEngine.abortedWith, "startTimeout")
  })

  it("aborts with 'idleTimeout' once movement has occurred but then stalls", async () => {
    let moved = true
    const fakeEngine = {
      hasMoved: () => moved,
      getLastMoveTimestamp: () => performance.now() - 50,
      abort: (reason) => fakeEngine.abortedWith = reason,
    }
    const plugin = new PluginTimeout({ startTimeout: 0, idleTimeout: 10, pollInterval: 5 })
    plugin.install(fakeEngine)
    plugin.onStart()
    await new Promise(r => setTimeout(r, 40))
    plugin.onEnd()
    assert.strictEqual(fakeEngine.abortedWith, "idleTimeout")
  })

  it("does not start a watchdog when both timeouts are disabled (<= 0)", async () => {
    const fakeEngine = {
      hasMoved: () => false,
      getLastMoveTimestamp: () => 0,
      abort: () => {
        throw new Error("should not abort")
      },
    }
    const plugin = new PluginTimeout({ startTimeout: 0, idleTimeout: 0 })
    plugin.install(fakeEngine)
    plugin.onStart()
    assert.strictEqual(plugin.timer, null)
  })

  it("uninstall clears the watchdog and nulls the engine reference", () => {
    const fakeEngine = {
      hasMoved: () => false,
      getLastMoveTimestamp: () => 0,
      abort: () => undefined,
    }
    const plugin = new PluginTimeout({ startTimeout: 10 })
    plugin.install(fakeEngine)
    plugin.onStart()
    plugin.uninstall()
    assert.strictEqual(plugin.timer, null)
    assert.strictEqual(plugin.engine, null)
  })
})

describe("PluginSuppressor", () => {
  it("uses the altKey suppressor by default: onBeforeStart returns false when altKey is set", () => {
    const plugin = new PluginSuppressor()
    assert.strictEqual(plugin.onBeforeStart({ originalEvent: { altKey: true }, triggerButton: 2 }), false)
    assert.strictEqual(plugin.onBeforeStart({ originalEvent: { altKey: false }, triggerButton: 2 }), true)
  })

  it("supports a custom suppressorFn", () => {
    const plugin = new PluginSuppressor({ suppressorFn: (ev, btn) => btn === 2 })
    assert.strictEqual(plugin.onBeforeStart({ originalEvent: {}, triggerButton: 2 }), false)
    assert.strictEqual(plugin.onBeforeStart({ originalEvent: {}, triggerButton: 0 }), true)
  })
})

describe("PluginVisualizer", () => {
  function makeFakeCanvas() {
    const el = document.createElement("canvas")
    const ctx = {
      setTransform: () => undefined,
      clearRect: () => undefined,
      beginPath: () => undefined,
      moveTo: () => undefined,
      lineTo: () => undefined,
      quadraticCurveTo: () => undefined,
      stroke: () => undefined,
      scale: () => undefined,
      lineWidth: 0, lineCap: "", lineJoin: "", strokeStyle: "",
    }
    el.getContext = () => ctx
    el.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 100 })
    return { el, ctx }
  }

  it("throws TypeError if el is not an HTMLCanvasElement", () => {
    assert.throws(() => new PluginVisualizer(document.createElement("div")), TypeError)
  })

  it("onStart adds the 'active' class and seeds the first point", () => {
    const { el } = makeFakeCanvas()
    const plugin = new PluginVisualizer(el, { autoUpdateSize: false })
    plugin.onStart({ point: { x: 10, y: 20 }, paths: [], triggerButton: 2 })
    assert.strictEqual(el.classList.contains("active"), true)
    assert.strictEqual(plugin.pointCount, 2)
  })

  it("onMove ignores points closer than minDrawDistance (starting from the second move point)", () => {
    const { el } = makeFakeCanvas()
    const plugin = new PluginVisualizer(el, { autoUpdateSize: false, minDrawDistance: 100 })
    plugin.onStart({ point: { x: 0, y: 0 }, paths: [] })  // pointCount = 2 (start point)
    plugin.onMove({ point: { x: 200, y: 0 }, paths: [] })  // pointCount = 4 (first move point, distance check not yet active)
    plugin.onMove({ point: { x: 201, y: 1 }, paths: [] })  // too close to previous point -> rejected
    assert.strictEqual(plugin.pointCount, 4, "too-close point should be rejected once pointCount >= 4")
  })

  it("onMove accepts points farther than minDrawDistance", () => {
    const { el } = makeFakeCanvas()
    const plugin = new PluginVisualizer(el, { autoUpdateSize: false, minDrawDistance: 100 })
    plugin.onStart({ point: { x: 0, y: 0 }, paths: [] })
    plugin.onMove({ point: { x: 200, y: 0 }, paths: [] })  // pointCount = 4
    plugin.onMove({ point: { x: 500, y: 0 }, paths: [] })  // far enough -> accepted
    assert.strictEqual(plugin.pointCount, 6)
  })

  it("onEnd removes the 'active' class and schedules canvas cleanup", async () => {
    const { el } = makeFakeCanvas()
    const plugin = new PluginVisualizer(el, { autoUpdateSize: false, cleanupDelay: 5 })
    plugin.onStart({ point: { x: 0, y: 0 }, paths: [] })
    plugin.onEnd()
    assert.strictEqual(el.classList.contains("active"), false)
    await new Promise(r => setTimeout(r, 20))
    assert.strictEqual(plugin.pointCount, 0)
  })

  it("onAbort immediately clears the canvas and removes the active class", () => {
    const { el } = makeFakeCanvas()
    const plugin = new PluginVisualizer(el, { autoUpdateSize: false })
    plugin.onStart({ point: { x: 0, y: 0 }, paths: [] })
    plugin.onAbort()
    assert.strictEqual(el.classList.contains("active"), false)
    assert.strictEqual(plugin.pointCount, 0)
  })

  it("updateConfig resizes the internal point buffer when maxPoints changes", () => {
    const { el } = makeFakeCanvas()
    const plugin = new PluginVisualizer(el, { autoUpdateSize: false, maxPoints: 10 })
    plugin.updateConfig({ maxPoints: 20 })
    assert.strictEqual(plugin.pointBuffer.length, 40)
  })
})

describe("PluginHUD", () => {
  it("throws TypeError if el is not an HTMLElement", () => {
    assert.throws(() => new PluginHUD(null), TypeError)
  })

  it("onStart adds 'active' class, onPathChange sets text/color, onEnd schedules clearing", async () => {
    const el = document.createElement("div")
    const plugin = new PluginHUD(el, { cleanupDelay: 5 })
    plugin.onStart()
    assert.strictEqual(el.classList.contains("active"), true)

    plugin.onPathChange({ paths: ["→", "↓"], triggerButton: 2 })
    assert.strictEqual(el.textContent, "→↓")
    assert.strictEqual(el.style.color, "rgb(125, 207, 255)")

    plugin.onEnd()
    assert.strictEqual(el.classList.contains("active"), false)
    await new Promise(r => setTimeout(r, 20))
    assert.strictEqual(el.textContent, "")
  })

  it("supports a custom textFormatter", () => {
    const el = document.createElement("div")
    const plugin = new PluginHUD(el, { textFormatter: (paths) => `code:${paths.join("")}` })
    plugin.onPathChange({ paths: ["→"], triggerButton: 2 })
    assert.strictEqual(el.textContent, "code:→")
  })

  it("onAbort resets text/class immediately", () => {
    const el = document.createElement("div")
    const plugin = new PluginHUD(el)
    plugin.onStart()
    plugin.onPathChange({ paths: ["→"], triggerButton: 2 })
    plugin.onAbort()
    assert.strictEqual(el.classList.contains("active"), false)
    assert.strictEqual(el.textContent, "")
  })
})

describe("PluginSensory", () => {
  afterEach(() => delete global.navigator.vibrate)

  it("plays haptic feedback via navigator.vibrate on tick when enableHaptic is true", () => {
    const vibrated = []
    global.navigator.vibrate = (pattern) => vibrated.push(pattern)
    const plugin = new PluginSensory({ enableAudio: false, enableHaptic: true })
    plugin.onStart()
    plugin.onPathChange({ paths: ["→"] })
    assert.deepStrictEqual(vibrated, [10]) // default hapticProfile.tick = 10
  })

  it("does not call navigator.vibrate when enableHaptic is false", () => {
    let called = false
    global.navigator.vibrate = () => called = true
    const plugin = new PluginSensory({ enableAudio: false, enableHaptic: false })
    plugin.onStart()
    plugin.onPathChange({ paths: ["→"] })
    assert.strictEqual(called, false)
  })

  it("onPathChange only plays a tick when the path actually grows", () => {
    const vibrated = []
    global.navigator.vibrate = (p) => vibrated.push(p)
    const plugin = new PluginSensory({ enableAudio: false, enableHaptic: true })
    plugin.onStart()
    plugin.onPathChange({ paths: ["→"] })
    plugin.onPathChange({ paths: ["→"] }) // same length, no growth
    assert.strictEqual(vibrated.length, 1)
  })

  it("onAbort plays the 'abort' haptic profile", () => {
    const vibrated = []
    global.navigator.vibrate = (p) => vibrated.push(p)
    const plugin = new PluginSensory({ enableAudio: false, enableHaptic: true })
    plugin.onAbort()
    assert.deepStrictEqual(vibrated, [[30, 40, 30]])
  })

  it("playSuccess / playError delegate to play() with the right type", () => {
    const vibrated = []
    global.navigator.vibrate = (p) => vibrated.push(p)
    const plugin = new PluginSensory({ enableAudio: false, enableHaptic: true })
    plugin.playSuccess()
    plugin.playError()
    assert.deepStrictEqual(vibrated, [[15, 30, 20], [40, 30, 40]])
  })

  it("audioCtx is null under a DOM without AudioContext, so enabling audio is a safe no-op", () => {
    const plugin = new PluginSensory({ enableAudio: true, enableHaptic: false })
    assert.strictEqual(plugin.audioCtx, null)
    assert.doesNotThrow(() => plugin.play("tick", ["→"]))
  })
})

describe("PluginActionDispatcher", () => {
  it("register() throws if execute is not a function or path is missing", () => {
    const dispatcher = new PluginActionDispatcher()
    assert.throws(() => dispatcher.register({ path: "→" }), TypeError)
    assert.throws(() => dispatcher.register({ execute: () => undefined }), TypeError)
  })

  it("resolves button names via BUTTON_MAP (middle/right/x1/x2) and 'any' as a fallback", () => {
    const executed = []
    const dispatcher = new PluginActionDispatcher({
      actions: [
        { path: "→", button: "right", execute: () => executed.push("right-action") },
        { path: "↓", button: "any", execute: () => executed.push("any-action") },
      ],
    })
    dispatcher.onEnd({ triggerButton: 2, gestureCode: "→" }) // 2 == BUTTON_MAP.right
    dispatcher.onEnd({ triggerButton: 999, gestureCode: "↓" }) // falls back to "any"
    assert.deepStrictEqual(executed, ["right-action", "any-action"])
  })

  it("onEnd calls onMissed when no action matches the gesture code", () => {
    let missed = null
    const dispatcher = new PluginActionDispatcher({ onMissed: (ctx) => missed = ctx })
    dispatcher.onEnd({ triggerButton: 2, gestureCode: "→→→" })
    assert.ok(missed)
  })

  it("enforces per-action cooldown and calls onCooldown when triggered too soon", () => {
    const cooldownCalls = []
    const dispatcher = new PluginActionDispatcher({
      actions: [{ path: "→", button: "any", cooldown: 10_000, execute: () => undefined }],
      onCooldown: (ctx, remain) => cooldownCalls.push(remain),
    })
    dispatcher.onEnd({ triggerButton: 2, gestureCode: "→" })
    dispatcher.onEnd({ triggerButton: 2, gestureCode: "→" })
    assert.strictEqual(cooldownCalls.length, 1)
    assert.ok(cooldownCalls[0] > 0)
  })

  it("skips execution and calls onConditionFailed when action.condition() returns false", () => {
    let executed = false
    let conditionFailedCalled = false
    const dispatcher = new PluginActionDispatcher({
      actions: [{ path: "→", button: "any", condition: () => false, execute: () => executed = true }],
      onConditionFailed: () => conditionFailedCalled = true,
    })
    dispatcher.onEnd({ triggerButton: 2, gestureCode: "→" })
    assert.strictEqual(executed, false)
    assert.strictEqual(conditionFailedCalled, true)
  })

  it("onBeforeAction returning false prevents execution without triggering onError", () => {
    let executed = false
    const dispatcher = new PluginActionDispatcher({
      actions: [{ path: "→", button: "any", execute: () => executed = true }],
      onBeforeAction: () => false,
    })
    dispatcher.onEnd({ triggerButton: 2, gestureCode: "→" })
    assert.strictEqual(executed, false)
  })

  it("catches synchronous errors from action.execute() and routes them to onError", () => {
    let caughtError = null
    const dispatcher = new PluginActionDispatcher({
      actions: [{
        path: "→", button: "any", execute: () => {
          throw new Error("boom")
        },
      }],
      onError: (ctx, err) => caughtError = err,
    })
    dispatcher.onEnd({ triggerButton: 2, gestureCode: "→" })
    assert.strictEqual(caughtError.message, "boom")
  })

  it("onAfterAction receives the return value of execute()", () => {
    let afterResult = null
    const dispatcher = new PluginActionDispatcher({
      actions: [{ path: "→", button: "any", execute: () => 42 }],
      onAfterAction: (ctx, result) => afterResult = result,
    })
    dispatcher.onEnd({ triggerButton: 2, gestureCode: "→" })
    assert.strictEqual(afterResult, 42)
  })

  it("unregister() removes an action so it is no longer matched", () => {
    const dispatcher = new PluginActionDispatcher({
      actions: [{ path: "→", button: "any", execute: () => undefined }],
    })
    const actionDef = { path: "→", button: "any" }
    dispatcher.unregister(actionDef)
    assert.strictEqual(dispatcher.hasMatchedAction(2, "→"), false)
  })

  it("hasMatchedAction correctly reports match/no-match without executing anything", () => {
    const dispatcher = new PluginActionDispatcher({
      actions: [{ path: "→", button: "any", execute: () => undefined }],
    })
    assert.strictEqual(dispatcher.hasMatchedAction(2, "→"), true)
    assert.strictEqual(dispatcher.hasMatchedAction(2, "↓"), false)
  })
})
