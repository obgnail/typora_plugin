const DEFAULT_OPTIONS = Object.freeze({
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

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
const roundScale = scale => Math.round(scale * 1000) / 1000

const normalizeNumber = (value, fallback, min, max) => {
  const number = Number(value)
  return Number.isFinite(number) ? clamp(number, min, max) : fallback
}

const normalizeBoolean = (value, fallback) => {
  if (typeof value === "boolean") return value
  if (typeof value === "string") {
    if (value.toLowerCase() === "true") return true
    if (value.toLowerCase() === "false") return false
  }
  return fallback
}

const normalizeOptions = (config = {}) => ({
  minScale: normalizeNumber(config.MIN_SCALE, DEFAULT_OPTIONS.minScale, 0.05, 1),
  maxScale: normalizeNumber(config.MAX_SCALE, DEFAULT_OPTIONS.maxScale, 1, 10),
  zoomStep: normalizeNumber(config.ZOOM_STEP, DEFAULT_OPTIONS.zoomStep, 0.05, 1),
  wheelZoomDefault: normalizeBoolean(config.WHEEL_ZOOM_DEFAULT, DEFAULT_OPTIONS.wheelZoomDefault),
  doubleClickToEdit: normalizeBoolean(config.DOUBLE_CLICK_TO_EDIT, DEFAULT_OPTIONS.doubleClickToEdit),
  showFullscreen: normalizeBoolean(config.SHOW_FULLSCREEN, DEFAULT_OPTIONS.showFullscreen),
  enablePan: normalizeBoolean(config.ENABLE_PAN, DEFAULT_OPTIONS.enablePan),
  enableTouch: normalizeBoolean(config.ENABLE_TOUCH, DEFAULT_OPTIONS.enableTouch),
  resizable: normalizeBoolean(config.RESIZABLE, DEFAULT_OPTIONS.resizable),
  minContainerWidth: normalizeNumber(config.MIN_CONTAINER_WIDTH, DEFAULT_OPTIONS.minContainerWidth, 100, 1000),
  minContainerHeight: normalizeNumber(config.MIN_CONTAINER_HEIGHT, DEFAULT_OPTIONS.minContainerHeight, 80, 1000),
})

const formatPercent = scale => `${Math.round(scale * 100)}%`

const nextScale = (current, direction, options) => {
  const next = Number(current) + (options.zoomStep * direction)
  return roundScale(clamp(next, options.minScale, options.maxScale))
}

const zoomAtPoint = (state, requestedScale, point, options) => {
  const oldScale = Number.isFinite(state.scale) && state.scale > 0 ? state.scale : 1
  const scale = roundScale(clamp(requestedScale, options.minScale, options.maxScale))
  const ratio = scale / oldScale
  return {
    scale,
    translateX: point.x - ((point.x - state.translateX) * ratio),
    translateY: point.y - ((point.y - state.translateY) * ratio),
  }
}

const panFromStart = (startTranslate, startPointer, currentPointer) => ({
  translateX: startTranslate.x + currentPointer.x - startPointer.x,
  translateY: startTranslate.y + currentPointer.y - startPointer.y,
})

const distanceBetween = (first, second) => Math.hypot(second.x - first.x, second.y - first.y)

const isDoubleClickCandidate = (previous, point, now, maxInterval = 350, maxDistance = 8) => Boolean(
  previous
  && now - previous.time <= maxInterval
  && distanceBetween(previous.point, point) <= maxDistance,
)

const midpoint = (first, second) => ({
  x: (first.x + second.x) / 2,
  y: (first.y + second.y) / 2,
})

const pinchTransform = ({
  startScale,
  startTranslate,
  startCenter,
  startDistance,
  currentCenter,
  currentDistance,
  minScale,
  maxScale,
}) => {
  const safeScale = startScale > 0 ? startScale : 1
  const ratio = startDistance > 0 ? currentDistance / startDistance : 1
  const scale = roundScale(clamp(safeScale * ratio, minScale, maxScale))
  const contentX = (startCenter.x - startTranslate.x) / safeScale
  const contentY = (startCenter.y - startTranslate.y) / safeScale
  return {
    scale,
    translateX: currentCenter.x - (contentX * scale),
    translateY: currentCenter.y - (contentY * scale),
  }
}

const resizeRect = ({
  position,
  startWidth,
  startHeight,
  startMarginLeft,
  startMarginTop,
  deltaX,
  deltaY,
  minWidth,
  minHeight,
}) => {
  let width = startWidth
  let height = startHeight
  let marginLeft = startMarginLeft
  let marginTop = startMarginTop

  if (position.includes("right")) {
    width = Math.max(minWidth, startWidth + deltaX)
  } else if (position.includes("left")) {
    width = Math.max(minWidth, startWidth - deltaX)
    marginLeft = startMarginLeft + startWidth - width
  }

  if (position.includes("bottom")) {
    height = Math.max(minHeight, startHeight + deltaY)
  } else if (position.includes("top")) {
    height = Math.max(minHeight, startHeight - deltaY)
    marginTop = startMarginTop + startHeight - height
  }

  return { width, height, marginLeft, marginTop }
}

module.exports = {
  DEFAULT_OPTIONS,
  clamp,
  distanceBetween,
  formatPercent,
  isDoubleClickCandidate,
  midpoint,
  nextScale,
  normalizeOptions,
  panFromStart,
  pinchTransform,
  resizeRect,
  roundScale,
  zoomAtPoint,
}
