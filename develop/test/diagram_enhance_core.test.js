const assert = require("node:assert/strict")
const test = require("node:test")

const {
  distanceBetween,
  formatPercent,
  isDoubleClickCandidate,
  midpoint,
  nextScale,
  normalizeOptions,
  panFromStart,
  pinchTransform,
  resizeRect,
  zoomAtPoint,
} = require("../../plugin/diagram_enhance/core")

test("normalizes reference-aligned interaction defaults", () => {
  assert.deepEqual(normalizeOptions({}), {
    minScale: 0.1,
    maxScale: 5,
    zoomStep: 0.1,
    wheelZoomDefault: true,
    doubleClickToEdit: true,
    showFullscreen: true,
    enablePan: true,
    enableTouch: true,
    resizable: true,
    minContainerWidth: 180,
    minContainerHeight: 120,
  })
})
test("preserves existing config keys and clamps unsafe values", () => {
  assert.deepEqual(normalizeOptions({
    MIN_SCALE: 0,
    MAX_SCALE: 99,
    ZOOM_STEP: "0.25",
    WHEEL_ZOOM_DEFAULT: "false",
    DOUBLE_CLICK_TO_EDIT: "false",
    SHOW_FULLSCREEN: "false",
    ENABLE_PAN: false,
    ENABLE_TOUCH: "false",
    RESIZABLE: false,
    MIN_CONTAINER_WIDTH: 10,
    MIN_CONTAINER_HEIGHT: 5000,
  }), {
    minScale: 0.05,
    maxScale: 10,
    zoomStep: 0.25,
    wheelZoomDefault: false,
    doubleClickToEdit: false,
    showFullscreen: false,
    enablePan: false,
    enableTouch: false,
    resizable: false,
    minContainerWidth: 100,
    minContainerHeight: 1000,
  })
})
test("increments, clamps, and formats scale", () => {
  const options = normalizeOptions({ MIN_SCALE: 0.5, MAX_SCALE: 2, ZOOM_STEP: 0.25 })
  assert.equal(nextScale(1, 1, options), 1.25)
  assert.equal(nextScale(0.6, -1, options), 0.5)
  assert.equal(nextScale(1.9, 1, options), 2)
  assert.equal(formatPercent(1.25), "125%")
})

test("zooms around the requested cursor anchor", () => {
  const options = normalizeOptions({ MIN_SCALE: 0.1, MAX_SCALE: 5 })
  assert.deepEqual(
    zoomAtPoint({ scale: 1, translateX: 10, translateY: 20 }, 2, { x: 110, y: 120 }, options),
    { scale: 2, translateX: -90, translateY: -80 },
  )
})

test("computes mouse pan and two-pointer geometry", () => {
  assert.deepEqual(
    panFromStart({ x: 10, y: 20 }, { x: 100, y: 100 }, { x: 135, y: 70 }),
    { translateX: 45, translateY: -10 },
  )
  assert.equal(distanceBetween({ x: 0, y: 0 }, { x: 3, y: 4 }), 5)
  assert.deepEqual(midpoint({ x: 0, y: 10 }, { x: 20, y: 30 }), { x: 10, y: 20 })
})

test("recognizes only nearby clicks inside the double-click window", () => {
  const previous = { time: 1000, point: { x: 100, y: 100 } }
  assert.equal(isDoubleClickCandidate(previous, { x: 105, y: 103 }, 1300), true)
  assert.equal(isDoubleClickCandidate(previous, { x: 105, y: 103 }, 1400), false)
  assert.equal(isDoubleClickCandidate(previous, { x: 120, y: 100 }, 1200), false)
  assert.equal(isDoubleClickCandidate(null, { x: 100, y: 100 }, 1200), false)
})

test("pinch zoom keeps the content point under the gesture center", () => {
  assert.deepEqual(pinchTransform({
    startScale: 1,
    startTranslate: { x: 0, y: 0 },
    startCenter: { x: 100, y: 100 },
    startDistance: 100,
    currentCenter: { x: 120, y: 110 },
    currentDistance: 200,
    minScale: 0.1,
    maxScale: 5,
  }), {
    scale: 2,
    translateX: -80,
    translateY: -90,
  })
})

test("resizes from every edge while respecting minimum dimensions", () => {
  const base = {
    startWidth: 400,
    startHeight: 300,
    startMarginLeft: 10,
    startMarginTop: 20,
    minWidth: 180,
    minHeight: 120,
  }
  assert.deepEqual(resizeRect({ ...base, position: "bottom-right", deltaX: 50, deltaY: 30 }), {
    width: 450,
    height: 330,
    marginLeft: 10,
    marginTop: 20,
  })
  assert.deepEqual(resizeRect({ ...base, position: "top-left", deltaX: 300, deltaY: 250 }), {
    width: 180,
    height: 120,
    marginLeft: 230,
    marginTop: 200,
  })
})
