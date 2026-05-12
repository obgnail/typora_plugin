const RAD_TO_DEG = 180 / Math.PI

class BaseGestureStrategy {
  _state = { changed: false, newDirection: null, paths: [] }

  constructor(options = {}, calcDirection) {
    this.options = { macroRadius: 35, tailRadius: 15, ...options }
    this.macroRadiusSq = this.options.macroRadius ** 2
    this.tailRadiusSq = this.options.tailRadius ** 2
    this.calcDirection = calcDirection
  }

  initialize = (x, y) => {
    this.anchorX = x
    this.anchorY = y
    this.paths = []

    this._state.changed = true
    this._state.newDirection = null
    this._state.paths = this.paths
    return this._state
  }

  _processPoint = (x, y, thresholdSq) => {
    let changed = false
    let newDirection = null
    if (this.anchorX === undefined) {
      this._state.changed = changed
      this._state.newDirection = newDirection
      this._state.paths = this.paths
      return this._state
    }

    const dx = x - this.anchorX
    const dy = y - this.anchorY
    const distSq = dx * dx + dy * dy
    if (distSq >= thresholdSq) {
      const angle = Math.atan2(dy, dx) * RAD_TO_DEG
      const direction = this.calcDirection(angle, this.paths)
      if (this.paths.length === 0 || this.paths[this.paths.length - 1] !== direction) {
        this.paths.push(direction)
        changed = true
        newDirection = direction
      }
      this.anchorX = x
      this.anchorY = y
    }

    this._state.changed = changed
    this._state.newDirection = newDirection
    this._state.paths = this.paths
    return this._state
  }
  processMove = (x, y) => this._processPoint(x, y, this.macroRadiusSq)
  processEnd = (x, y) => this._processPoint(x, y, this.tailRadiusSq)
  isActive = () => this.paths.length > 0
}

class Strategy4Way extends BaseGestureStrategy {
  constructor(options = {}) {
    const calcDirection = (angle) => (angle >= -45 && angle < 45) ? "→" : (angle >= 45 && angle < 135) ? "↓" : (angle >= -135 && angle < -45) ? "↑" : "←"
    super(options, calcDirection)
  }
}

class Strategy8Way extends BaseGestureStrategy {
  constructor(options = {}) {
    const calcDirection = (angle) => (angle >= -22.5 && angle < 22.5) ? "→" : (angle >= 22.5 && angle < 67.5) ? "↘" : (angle >= 67.5 && angle < 112.5) ? "↓" : (angle >= 112.5 && angle < 157.5) ? "↙" : (angle >= 157.5 || angle < -157.5) ? "←" : (angle >= -157.5 && angle < -112.5) ? "↖" : (angle >= -112.5 && angle < -67.5) ? "↑" : "↗"
    super(options, calcDirection)
  }
}

class Strategy4WayHysteresis extends BaseGestureStrategy {
  constructor(options = {}) {
    const h = options.hysteresis ?? 15
    super(options, (angle, paths) => {
      let sR = Math.abs(angle)
      let sD = Math.abs(angle - 90)
      let sL = Math.abs(Math.abs(angle) - 180)
      let sU = Math.abs(angle + 90)

      const last = paths.length > 0 ? paths[paths.length - 1] : null
      if (last === "→") sR -= h
      else if (last === "↓") sD -= h
      else if (last === "←") sL -= h
      else if (last === "↑") sU -= h

      if (sR <= sD && sR <= sL && sR <= sU) return "→"
      if (sD <= sR && sD <= sL && sD <= sU) return "↓"
      if (sL <= sR && sL <= sD && sL <= sU) return "←"
      return "↑"
    })
  }
}

class Strategy8WayHysteresis extends BaseGestureStrategy {
  constructor(options = {}) {
    const h = options.hysteresis ?? 8
    super(options, (angle, paths) => {
      let sR = Math.abs(angle)
      let sDR = Math.abs(angle - 45)
      let sD = Math.abs(angle - 90)
      let sDL = Math.abs(angle - 135)
      let sL = Math.abs(Math.abs(angle) - 180)
      let sUL = Math.abs(angle + 135)
      let sU = Math.abs(angle + 90)
      let sUR = Math.abs(angle + 45)

      const last = paths.length > 0 ? paths[paths.length - 1] : null
      if (last === "→") sR -= h
      else if (last === "↘") sDR -= h
      else if (last === "↓") sD -= h
      else if (last === "↙") sDL -= h
      else if (last === "←") sL -= h
      else if (last === "↖") sUL -= h
      else if (last === "↑") sU -= h
      else if (last === "↗") sUR -= h

      let min = sR, dir = "→"
      if (sDR < min) {
        min = sDR
        dir = "↘"
      }
      if (sD < min) {
        min = sD
        dir = "↓"
      }
      if (sDL < min) {
        min = sDL
        dir = "↙"
      }
      if (sL < min) {
        min = sL
        dir = "←"
      }
      if (sUL < min) {
        min = sUL
        dir = "↖"
      }
      if (sU < min) {
        min = sU
        dir = "↑"
      }
      if (sUR < min) {
        min = sUR
        dir = "↗"
      }
      return dir
    })
  }
}

class BaseAdaptiveStrategy {
  _wasDegraded = false
  _state = { changed: false, newDirection: null, paths: [] }

  constructor(fallbackStrategy, primaryStrategy) {
    this._fallback = fallbackStrategy
    this._primary = primaryStrategy
  }

  initialize = (x, y) => {
    this._fallback.initialize(x, y)
    this._primary.initialize(x, y)
    this._wasDegraded = false

    this._state.changed = true
    this._state.newDirection = null
    this._state.paths = []
    return this._state
  }

  _dispatch = (x, y, methodName) => {
    const stateFallback = this._fallback[methodName](x, y)
    if (this._wasDegraded) return stateFallback
    const statePrimary = this._primary[methodName](x, y)
    if (this._primary.paths.length > 1) {
      this._wasDegraded = true

      this._state.changed = stateFallback.changed
      this._state.paths = stateFallback.paths
      this._state.newDirection = stateFallback.changed ? stateFallback.newDirection : null
      return this._state
    }
    return statePrimary
  }

  processMove = (x, y) => this._dispatch(x, y, "processMove")
  processEnd = (x, y) => this._dispatch(x, y, "processEnd")
  isActive = () => this._wasDegraded ? this._fallback.isActive() : this._primary.isActive()
}

class StrategyAdaptive extends BaseAdaptiveStrategy {
  constructor(options = {}) {
    super(new Strategy4Way(options), new Strategy8Way(options))
  }
}

class StrategyAdaptiveHysteresis extends BaseAdaptiveStrategy {
  constructor(options = {}) {
    super(new Strategy4WayHysteresis(options), new Strategy8WayHysteresis(options))
  }
}

const STATES = { IDLE: "idle", TRACKING: "tracking", PAUSED: "paused", DESTROYED: "destroyed" }
const ACTIONS = { DOWN: "down", UP: "up", ABORT: "abort", PAUSE: "pause", RESUME: "resume", DESTROY: "destroy" }

class GestureEngine {
  plugins = new Map()
  hasMovedSinceStart = false
  lastMoveTimestamp = 0
  currentTriggerButton = null
  currentState = STATES.IDLE
  _transitions = {
    [STATES.IDLE]: { [ACTIONS.DOWN]: STATES.TRACKING, [ACTIONS.PAUSE]: STATES.PAUSED, [ACTIONS.DESTROY]: STATES.DESTROYED },
    [STATES.TRACKING]: { [ACTIONS.UP]: STATES.IDLE, [ACTIONS.ABORT]: STATES.IDLE, [ACTIONS.PAUSE]: STATES.PAUSED, [ACTIONS.DESTROY]: STATES.DESTROYED },
    [STATES.PAUSED]: { [ACTIONS.RESUME]: STATES.IDLE, [ACTIONS.DESTROY]: STATES.DESTROYED },
    [STATES.DESTROYED]: {},
  }
  _sharedMovePayload = {
    point: { x: 0, y: 0 },
    paths: null,
    triggerButton: null,
    originalEvent: null,
  }

  constructor(options = {}) {
    this.options = {
      targetElement: document,
      triggerButtons: [2],
      allowedPointerTypes: ["mouse", "pen"],
      strategy: null,
      ...options,
    }
    this.setStrategy(this.options.strategy)
    this._bindEvents()
  }

  get isIdle() {
    return this.currentState === STATES.IDLE
  }

  get isTracking() {
    return this.currentState === STATES.TRACKING
  }

  get isPaused() {
    return this.currentState === STATES.PAUSED
  }

  get isDestroyed() {
    return this.currentState === STATES.DESTROYED
  }

  hasMoved = () => this.hasMovedSinceStart
  getLastMoveTimestamp = () => this.lastMoveTimestamp

  updateConfig = (newConfig) => this.options = { ...this.options, ...newConfig }

  setStrategy = (strategyImpl) => {
    this._validateStrategy(strategyImpl)
    this.activeStrategy = strategyImpl
  }

  use = (plugin) => {
    if (!plugin || typeof plugin.id !== "string") {
      throw new TypeError("[GestureEngine] plugin must have a valid 'id'.")
    }
    if (typeof plugin.install !== "function") {
      throw new TypeError(`[GestureEngine] plugin '${plugin.id}' must have an 'install' method.`)
    }
    if (!this.plugins.has(plugin.id)) {
      plugin.install(this)
      this.plugins.set(plugin.id, plugin)
    } else {
      console.warn(`[GestureEngine] Plugin with id '${plugin.id}' is already installed.`)
    }
    return this
  }

  unuse = (pluginOrId) => {
    const id = typeof pluginOrId === "string" ? pluginOrId : pluginOrId?.id
    if (id && this.plugins.has(id)) {
      this.plugins.get(id)?.uninstall?.()
      this.plugins.delete(id)
    }
    return this
  }

  getPlugin = (id) => this.plugins.get(id)

  pause = () => {
    const wasTracking = this.currentState === STATES.TRACKING
    if (this._next(ACTIONS.PAUSE)) {
      if (wasTracking) {
        this._invokeHook("onAbort", { reason: "paused" })
      }
      this._invokeHook("onPaused", null)
    }
  }

  resume = () => {
    if (this._next(ACTIONS.RESUME)) {
      this._invokeHook("onResumed", null)
    }
  }

  abort = (reason = "aborted") => {
    if (this._next(ACTIONS.ABORT)) {
      this._invokeHook("onAbort", { reason })
    }
  }

  destroy = () => {
    if (this._next(ACTIONS.DESTROY)) {
      this._unbindEvents()
      this._invokeHook("onDestroyed", null)
      this.plugins.forEach(p => p.uninstall?.())
      this.plugins.clear()
    }
  }

  _next = (action) => {
    const nextState = this._transitions[this.currentState]?.[action]
    if (!nextState) return false
    if (this.currentState === STATES.TRACKING && nextState !== STATES.TRACKING) {
      this.currentTriggerButton = null
    }
    this.currentState = nextState
    return true
  }

  _invokeHook = (hookName, payload) => {
    for (const plugin of this.plugins.values()) plugin[hookName]?.(payload)
  }

  _invokeBailoutHook = (hookName, payload) => {
    for (const plugin of this.plugins.values()) {
      if (plugin[hookName]?.(payload) === false) return false
    }
    return true
  }

  _validateStrategy = (strategyImpl) => {
    if (!strategyImpl) throw new Error("A valid strategy instance must be provided.")
    const requiredMethods = ["initialize", "processMove", "processEnd", "isActive"]
    for (const method of requiredMethods) {
      if (typeof strategyImpl[method] !== "function") throw new TypeError(`Missing method: '${method}'`)
    }
  }

  _toggleEvents = (enable) => {
    const fn = enable ? "addEventListener" : "removeEventListener"
    const target = this.options.targetElement
    const blockOpts = { capture: true, passive: false }
    const passiveOpts = { capture: true, passive: true }
    target[fn]("pointerdown", this._onPointerDown, blockOpts)
    target[fn]("pointermove", this._onPointerMove, passiveOpts)
    target[fn]("pointerup", this._onPointerUp, passiveOpts)
    target[fn]("pointercancel", this._onPointerCancel, passiveOpts)
    target[fn]("contextmenu", this._onNativeBehavior, blockOpts)
    target[fn]("mousedown", this._onNativeBehavior, blockOpts)
    target[fn]("mouseup", this._onNativeBehavior, blockOpts)
    // target[fn]("auxclick", this._onNativeBehavior, blockOpts)
    window.addEventListener("blur", this._onWindowLostFocus)
  }

  _bindEvents = () => this._toggleEvents(true)
  _unbindEvents = () => this._toggleEvents(false)

  _onNativeBehavior = (ev) => {
    if (this.currentState === STATES.PAUSED || this.currentState === STATES.DESTROYED) return
    if (!this.options.triggerButtons.includes(ev.button)) return
    if (ev.button === 1 && ev.type === "mousedown") {
      ev.preventDefault()
      return
    }
    if (this.hasMovedSinceStart) {
      ev.preventDefault()
      ev.stopPropagation()
    }
  }

  _onPointerDown = (ev) => {
    if (!this._transitions[this.currentState]?.[ACTIONS.DOWN]) return
    if (this.options.allowedPointerTypes && !this.options.allowedPointerTypes.includes(ev.pointerType)) return
    if (!this.options.triggerButtons.includes(ev.button)) return

    this.hasMovedSinceStart = false

    const payload = { originalEvent: ev, triggerButton: ev.button }
    if (this._invokeBailoutHook("onBeforeStart", payload) === false) {
      this._invokeHook("onSuppressed", payload)
      return
    }

    if (!this._next(ACTIONS.DOWN)) return

    ev.target.setPointerCapture?.(ev.pointerId)
    this.currentTriggerButton = ev.button
    this.lastMoveTimestamp = ev.timeStamp

    const x = ev.clientX
    const y = ev.clientY
    const state = this.activeStrategy.initialize(x, y)
    this._invokeHook("onStart", { point: { x, y }, triggerButton: this.currentTriggerButton, originalEvent: ev })
    if (state.changed) {
      this._invokeHook("onPathChange", { paths: state.paths, newDirection: state.newDirection, triggerButton: this.currentTriggerButton })
    }
  }

  _onPointerMove = (ev) => {
    if (this.currentState !== STATES.TRACKING) return
    this.hasMovedSinceStart = true
    this.lastMoveTimestamp = ev.timeStamp

    const x = ev.clientX
    const y = ev.clientY
    const state = this.activeStrategy.processMove(x, y)

    this._sharedMovePayload.point.x = x
    this._sharedMovePayload.point.y = y
    this._sharedMovePayload.paths = state.paths
    this._sharedMovePayload.triggerButton = this.currentTriggerButton
    this._sharedMovePayload.originalEvent = ev
    this._invokeHook("onMove", this._sharedMovePayload)

    if (state.changed) {
      this._invokeHook("onPathChange", { paths: state.paths, newDirection: state.newDirection, triggerButton: this.currentTriggerButton })
    }
  }

  _onPointerUp = (ev) => {
    if (ev.button !== this.currentTriggerButton) return

    ev.target.releasePointerCapture?.(ev.pointerId)
    const triggeredBtn = this.currentTriggerButton
    if (!this._next(ACTIONS.UP)) return
    const state = this.activeStrategy.processEnd(ev.clientX, ev.clientY)
    if (state.changed) {
      this._invokeHook("onPathChange", { paths: state.paths, newDirection: state.newDirection, triggerButton: triggeredBtn })
    }
    this._invokeHook("onEnd", { paths: state.paths, gestureCode: state.paths.join(""), triggerButton: triggeredBtn, originalEvent: ev })
  }

  _onPointerCancel = (ev) => {
    if (this.currentState === STATES.TRACKING) {
      ev.target.releasePointerCapture?.(ev.pointerId)
      this.abort("systemCancel")
    }
  }

  _onWindowLostFocus = () => {
    if (this.currentState === STATES.TRACKING) this.abort("windowBlur")
  }
}

class PluginTimeout {
  id = "timeout"
  timer = null

  constructor(options = {}) {
    this.options = { startTimeout: 1000, idleTimeout: 2000, pollInterval: 100, ...options }
  }

  updateConfig = (newConfig) => this.options = { ...this.options, ...newConfig }

  install = (engine) => {
    if (this.engine) this.uninstall()
    this.engine = engine
  }

  uninstall = () => {
    this._clearWatchdog()
    this.engine = null
  }

  _clearWatchdog = () => {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  onStart = () => {
    this._clearWatchdog()

    const { startTimeout, idleTimeout, pollInterval } = this.options
    const enableStart = startTimeout > 0
    const enableIdle = idleTimeout > 0
    if (!enableStart && !enableIdle) return

    this.timer = setInterval(() => {
      const elapsed = performance.now() - this.engine.getLastMoveTimestamp()
      if (this.engine.hasMoved()) {
        if (enableIdle && elapsed > idleTimeout) this.engine.abort("idleTimeout")
      } else {
        if (enableStart && elapsed > startTimeout) this.engine.abort("startTimeout")
      }
    }, pollInterval)
  }

  onEnd = () => this._clearWatchdog()
  onAbort = () => this._clearWatchdog()
  onDestroyed = () => this._clearWatchdog()
}

class PluginSuppressor {
  id = "suppressor"

  constructor(options = {}) {
    this.options = {
      suppressorFn: (ev, triggerButton) => ev.altKey === true,
      ...options,
    }
  }

  updateConfig = (newConfig) => this.options = { ...this.options, ...newConfig }

  install = (engine) => {
    if (this.engine) this.uninstall()
    this.engine = engine
  }

  uninstall = () => {
    this.engine = null
  }

  onBeforeStart = (payload) => !this.options.suppressorFn?.(payload.originalEvent, payload.triggerButton)
}

class PluginVisualizer {
  id = "visualizer"
  currentColor = ""
  currentRect = { left: 0, top: 0, width: 0, height: 0 }
  rafId = null
  timeoutId = null

  constructor(el, options = {}) {
    if (!(el instanceof HTMLCanvasElement)) throw new TypeError(`Prop 'el' must be HTMLCanvasElement`)
    this.canvasEl = el
    this.ctx = el.getContext("2d")
    this.options = {
      lineWidth: 5,
      cleanupDelay: 200,
      minDrawDistance: 2,
      maxPoints: 1000,
      autoUpdateSize: true,
      colorFormatter: (paths, button) => "#7dcfff",
      ...options,
    }
    this.minDistSq = this.options.minDrawDistance ** 2
    this.pointBuffer = new Float32Array(this.options.maxPoints * 2)
    this.pointCount = 0
  }

  updateConfig = (newConfig = {}) => {
    this.options = { ...this.options, ...newConfig }
    if (newConfig.minDrawDistance !== undefined) {
      this.minDistSq = this.options.minDrawDistance ** 2
    }
    if (newConfig.maxPoints !== undefined && newConfig.maxPoints !== this.pointBuffer.length / 2) {
      this.pointBuffer = new Float32Array(this.options.maxPoints * 2)
      this._clearCanvas()
    }
  }

  install = (engine) => {
    if (this.engine) this.uninstall()
    this.engine = engine
  }

  uninstall = () => {
    this._clearTimers()
    this._clearCanvas()
    this.engine = null
  }

  _clearTimers = () => {
    if (this.rafId) cancelAnimationFrame(this.rafId)
    if (this.timeoutId) clearTimeout(this.timeoutId)
    this.rafId = this.timeoutId = null
  }

  _clearCanvas = () => {
    this.pointCount = 0
    this.ctx.setTransform(1, 0, 0, 1, 0, 0)
    this.ctx.clearRect(0, 0, this.canvasEl.width, this.canvasEl.height)
  }

  resize = (externalRect) => {
    const dpr = window.devicePixelRatio || 1
    this.currentRect = externalRect || this.canvasEl.getBoundingClientRect()
    this.canvasEl.width = this.currentRect.width * dpr
    this.canvasEl.height = this.currentRect.height * dpr
    this.ctx.scale(dpr, dpr)
  }

  _applyContextStyle = () => {
    this.ctx.lineWidth = this.options.lineWidth
    this.ctx.lineCap = this.ctx.lineJoin = "round"
    this.ctx.strokeStyle = this.currentColor
  }

  _renderBezier = () => {
    this.rafId = null
    const len = this.pointCount
    if (len < 6) return

    this.ctx.beginPath()
    this.ctx.moveTo(this.pointBuffer[0], this.pointBuffer[1])

    let midX, midY
    for (let i = 2; i < len - 2; i += 2) {
      const ctrlX = this.pointBuffer[i]
      const ctrlY = this.pointBuffer[i + 1]
      const nextX = this.pointBuffer[i + 2]
      const nextY = this.pointBuffer[i + 3]
      midX = (ctrlX + nextX) / 2
      midY = (ctrlY + nextY) / 2
      this.ctx.quadraticCurveTo(ctrlX, ctrlY, midX, midY)
    }
    this.ctx.stroke()

    this.pointBuffer[0] = midX
    this.pointBuffer[1] = midY
    this.pointBuffer[2] = this.pointBuffer[len - 2]
    this.pointBuffer[3] = this.pointBuffer[len - 1]
    this.pointCount = 4
  }

  onStart = (payload) => {
    if (!payload?.point) return
    this._clearTimers()

    this.canvasEl.classList.add("active")
    this.currentColor = this.options.colorFormatter(payload.paths || [], payload.triggerButton)
    if (this.options.autoUpdateSize) this.resize()
    this._applyContextStyle()

    this.pointCount = 0
    this.pointBuffer[this.pointCount++] = payload.point.x - this.currentRect.left
    this.pointBuffer[this.pointCount++] = payload.point.y - this.currentRect.top
  }

  onMove = (payload) => {
    if (!payload?.point) return
    if (this.pointCount >= this.pointBuffer.length - 1) return

    const x = payload.point.x - this.currentRect.left
    const y = payload.point.y - this.currentRect.top
    if (this.pointCount >= 4) {
      const dx = x - this.pointBuffer[this.pointCount - 2]
      const dy = y - this.pointBuffer[this.pointCount - 1]
      if (dx * dx + dy * dy < this.minDistSq) return
    }

    this.pointBuffer[this.pointCount++] = x
    this.pointBuffer[this.pointCount++] = y
    const newColor = this.options.colorFormatter(payload.paths || [], payload.triggerButton)
    if (this.currentColor !== newColor) {
      this.currentColor = newColor
      this.ctx.strokeStyle = newColor
    }

    if (!this.rafId) this.rafId = requestAnimationFrame(this._renderBezier)
  }

  onEnd = () => {
    this._clearTimers()
    if (this.pointCount >= 6) this._renderBezier()
    if (this.pointCount === 4) {
      this.ctx.beginPath()
      this.ctx.moveTo(this.pointBuffer[0], this.pointBuffer[1])
      this.ctx.lineTo(this.pointBuffer[2], this.pointBuffer[3])
      this.ctx.stroke()
    }

    this.canvasEl.classList.remove("active")
    this.timeoutId = setTimeout(() => {
      this._clearCanvas()
      this.timeoutId = null
    }, this.options.cleanupDelay)
  }

  onAbort = () => {
    this._clearTimers()
    this._clearCanvas()
    this.canvasEl.classList.remove("active")
  }
}

class PluginHUD {
  id = "hud"
  el = null
  hideElTimer = null

  constructor(el, options = {}) {
    if (!(el instanceof HTMLElement)) throw new TypeError(`Prop 'el' must be HTMLElement`)
    this.el = el
    this.options = {
      cleanupDelay: 200,
      textFormatter: (paths, button) => paths.join(""),
      colorFormatter: (paths, button) => "#7dcfff",
      ...options,
    }
  }

  updateConfig = (newConfig = {}) => this.options = { ...this.options, ...newConfig }

  install = (engine) => {
    if (this.engine) this.uninstall()
    this.engine = engine
  }

  uninstall = () => {
    if (this.hideElTimer) clearTimeout(this.hideElTimer)
    this.engine = null
  }

  onStart = () => {
    if (this.hideElTimer) clearTimeout(this.hideElTimer)
    this.el.classList.add("active")
  }

  onPathChange = (payload) => {
    this.el.textContent = this.options.textFormatter(payload.paths, payload.triggerButton)
    this.el.style.color = this.options.colorFormatter(payload.paths, payload.triggerButton)
  }

  onEnd = () => {
    this.el.classList.remove("active")
    this.hideElTimer = setTimeout(() => {
      this.el.textContent = ""
      this.el.style.removeProperty("color")
    }, this.options.cleanupDelay)
  }

  onAbort = () => {
    if (this.hideElTimer) clearTimeout(this.hideElTimer)
    this.el.classList.remove("active")
    this.el.textContent = ""
    this.el.style.removeProperty("color")
  }
}

class PluginSensory {
  id = "sensory"
  _lastPathLength = 0

  constructor(options = {}) {
    this.options = {
      enableAudio: true,
      enableHaptic: true,
      hapticProfile: (type, paths) => {
        const profiles = { tick: 10, success: [15, 30, 20], error: [40, 30, 40], abort: [30, 40, 30] }
        return profiles[type] ?? 0
      },
      audioProfile: (type, paths) => {
        if (type === "tick") {
          const dir = paths[paths.length - 1]
          const f = { "↑": 1200, "↗": 1050, "→": 900, "↘": 750, "↓": 600, "↙": 450, "←": 300, "↖": 750 }[dir] || 600
          return [{ freq: f, wave: "triangle", duration: 0.02, vol: 0.1 }]
        }
        if (type === "success") return [
          { freq: 600, wave: "sine", duration: 0.1, vol: 0.1 },
          { freq: 900, wave: "sine", duration: 0.15, vol: 0.1, delay: 80 },
        ]
        if (type === "error") return [{ freq: 200, wave: "square", duration: 0.15, vol: 0.05 }]
        if (type === "abort") return [{ freq: 150, wave: "sawtooth", duration: 0.15, vol: 0.08 }]
        return []
      },
      ...options,
    }
    const AudioContext = window.AudioContext || window.webkitAudioContext
    this.audioCtx = this.options.enableAudio && AudioContext ? new AudioContext() : null
  }

  updateConfig = (newConfig = {}) => this.options = { ...this.options, ...newConfig }

  install = (engine) => {
    if (this.engine) this.uninstall()
    this.engine = engine
  }

  uninstall = () => {
    this.engine = null
  }

  onStart = () => {
    this._initAudio()
    this._lastPathLength = 0
  }

  onPathChange = (payload) => {
    if (payload.paths && payload.paths.length > this._lastPathLength) {
      this._lastPathLength = payload.paths.length
      this.play("tick", payload.paths)
    }
  }

  onAbort = () => this.play("abort", [])

  play = (type, paths = []) => {
    if (this.options.enableHaptic) {
      const hapticData = this.options.hapticProfile(type, paths)
      if (hapticData) navigator.vibrate?.(hapticData)
    }
    if (this.options.enableAudio && this.audioCtx) {
      this._initAudio()
      const audioSequence = this.options.audioProfile(type, paths) || []
      audioSequence.forEach(tone => {
        if (tone.delay) setTimeout(() => this._playTone(tone), tone.delay)
        else this._playTone(tone)
      })
    }
  }
  playSuccess = (paths = []) => this.play("success", paths)
  playError = (paths = []) => this.play("error", paths)

  _initAudio = () => {
    if (this.audioCtx?.state === "suspended") {
      this.audioCtx.resume()
    }
  }

  _playTone = ({ freq, wave, duration, vol }) => {
    if (!this.audioCtx || vol <= 0) return
    const osc = this.audioCtx.createOscillator()
    const gain = this.audioCtx.createGain()
    osc.type = wave

    const now = this.audioCtx.currentTime
    osc.frequency.setValueAtTime(freq, now)
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(vol, now + 0.005)
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration)

    osc.connect(gain)
    gain.connect(this.audioCtx.destination)
    osc.start(now)
    osc.stop(now + duration)
  }
}

class PluginActionDispatcher {
  id = "actionDispatcher"
  actionRegistry = new Map()  // Map<String(Button), Map<String(Path), Action>>
  lastTriggerTimes = new WeakMap()
  static BUTTON_MAP = { middle: 1, right: 2, x1: 3, x2: 4 }

  constructor({ actions = [], ...options } = {}) {
    this.options = {
      globalCooldown: 0,
      onBeforeAction: (ctx) => true,
      onAfterAction: (ctx, result) => null,
      onMissed: (ctx) => null,
      onCooldown: (ctx, remain) => console.warn(`[Cooldown] ${ctx.action?.name} wait ${remain}ms.`),
      onConditionFailed: (ctx) => null,
      onError: (ctx, err) => console.error(`[Error] ${ctx.action?.name}:`, err),
      ...options,
    }
    actions.forEach(act => this.register(act))
  }

  install = (engine) => {
    if (this.engine) this.uninstall()
    this.engine = engine
  }

  uninstall = () => {
    this.engine = null
  }

  _getBtnKey = (button) => {
    if (button == null || String(button).toLowerCase() === "any") return "any"
    const strBtn = String(button).toLowerCase()
    return String(this.constructor.BUTTON_MAP[strBtn] || strBtn)
  }

  register = (actionDef) => {
    if (typeof actionDef.execute !== "function") {
      throw new TypeError(`[Gesture Error] Action missing 'execute' function.`)
    }
    if (!actionDef.path || typeof actionDef.path !== "string") {
      throw new TypeError(`[Gesture Error] Action requires a valid 'path' string.`)
    }

    const btnKey = this._getBtnKey(actionDef.button)
    if (!this.actionRegistry.has(btnKey)) {
      this.actionRegistry.set(btnKey, new Map())
    }
    this.actionRegistry.get(btnKey).set(actionDef.path, actionDef)
    return this
  }

  unregister = (actionDef) => {
    const btnKey = this._getBtnKey(actionDef.button)
    const innerMap = this.actionRegistry.get(btnKey)
    if (innerMap) {
      innerMap.delete(actionDef.path)
      if (innerMap.size === 0) this.actionRegistry.delete(btnKey)
    }
    return this
  }

  _resolveAction = (button, code) => {
    if (!code) return null
    const strBtn = String(button)
    return this.actionRegistry.get(strBtn)?.get(code) || this.actionRegistry.get("any")?.get(code) || null
  }

  hasMatchedAction = (button, code) => !!this._resolveAction(button, code)

  onEnd = (payload) => {
    const action = this._resolveAction(payload.triggerButton, payload.gestureCode)
    const context = { payload, action, engine: this.engine, manager: this }
    if (!context.action) {
      return this.options.onMissed(context)
    }
    this._executePipeline(context)
  }

  _executePipeline = (context) => {
    const { action } = context
    const now = Date.now()
    const cooldown = action.cooldown ?? this.options.globalCooldown
    if (cooldown > 0) {
      const lastTime = this.lastTriggerTimes.get(action) || 0
      const remain = cooldown - (now - lastTime)
      if (remain > 0) {
        return this.options.onCooldown(context, remain)
      }
    }
    if (typeof action.condition === "function" && !action.condition(context)) {
      return this.options.onConditionFailed(context)
    }
    try {
      if (this.options.onBeforeAction(context) === false) return
      this.lastTriggerTimes.set(action, now)
      const result = action.execute(context)
      this.options.onAfterAction(context, result)
    } catch (error) {
      this.options.onError(context, error)
    }
  }
}

class MouseGesturesPlugin extends BasePlugin {
  style = () => true

  html = () => {
    const canvasEl = this.config.ENABLE_VISUALIZER ? `<canvas id="plugin-mouse-gestures-visualizer"></canvas>` : ""
    const hudEl = this.config.ENABLE_HUD ? `<div id="plugin-mouse-gestures-hud"></div>` : ""
    return canvasEl + hudEl
  }

  initEngine = () => {
    const BUTTONS = ["left", "middle", "right", "x1", "x2"]
    const ACTIONS = new Map(
      this.config.GESTURES
        .filter(g => g.enable && BUTTONS.includes(g.button) && typeof g.execute === "string" && /^[→←↑↓↘↙↗↖]+$/u.test(g.path))
        .map(g => {
          const fn = eval(g.execute)
          if (typeof fn !== "function") return null
          const key = `${BUTTONS.indexOf(g.button)}:${g.path}`
          return [key, { ...g, execute: fn }]
        })
        .filter(Boolean),
    )
    const getTriggerButtons = (triggers) => triggers.map(btn => BUTTONS.indexOf(btn)).filter(x => x !== -1)
    const getStrategy = (name) => {
      const isLinear = this.config.HYSTERESIS === 0
      const strategies = isLinear
        ? { fourWay: Strategy4Way, eightWay: Strategy8Way, adaptive: StrategyAdaptive }
        : { fourWay: Strategy4WayHysteresis, eightWay: Strategy8WayHysteresis, adaptive: StrategyAdaptiveHysteresis }
      const cfg = { macroRadius: this.config.MACRO_RADIUS, tailRadius: this.config.TAIL_RADIUS }
      const finalCfg = isLinear ? cfg : { ...cfg, hysteresis: this.config.HYSTERESIS }
      return new strategies[name](finalCfg)
    }
    const colorFormatter = (paths, btn) => this.config.DEFAULT_COLOR[BUTTONS[btn]] || "#7dcfff"

    const engine = new GestureEngine({
      triggerButtons: getTriggerButtons(this.config.TRIGGER_BUTTONS),
      strategy: getStrategy(this.config.STRATEGY),
      allowedPointerTypes: this.config.POINTER_TYPES,
    })

    if (this.config.START_TIMEOUT > 0 || this.config.IDLE_TIMEOUT > 0) {
      engine.use(new PluginTimeout({ startTimeout: this.config.START_TIMEOUT, idleTimeout: this.config.IDLE_TIMEOUT }))
    }
    if (this.config.SUPPRESSION_KEY) {
      const key = `${this.config.SUPPRESSION_KEY}Key`
      engine.use(new PluginSuppressor({ suppressorFn: (ev) => ev[key] === true }))
    }
    if (this.config.ENABLE_VISUALIZER) {
      engine.use(new PluginVisualizer(document.getElementById("plugin-mouse-gestures-visualizer"), {
        lineWidth: this.config.TRAJECTORY_LINE_WIDTH,
        colorFormatter,
      }))
    }
    if (this.config.ENABLE_HUD) {
      engine.use(new PluginHUD(document.getElementById("plugin-mouse-gestures-hud"), {
        colorFormatter,
        textFormatter: (paths, btn) => {
          if (paths.length === 0) return ""
          const code = paths.join("")
          return ACTIONS.get(`${btn}:${code}`)?.name || code
        },
      }))
    }
    if (this.config.ENABLE_SENSORY) {
      engine.use(new PluginSensory({ enableAudio: true, enableHaptic: false }))
    }
    if (ACTIONS.size) {
      engine.use(new PluginActionDispatcher({ globalCooldown: this.config.COOLDOWN, actions: [...ACTIONS.values()] }))
    }

    return engine
  }

  process = () => {
    this.engine = this.initEngine()
  }

  getDynamicActions = () => [
    { act_value: "toggle_state", act_state: !this.engine.isPaused, act_name: this.i18n.t("act.toggle_state") },
  ]

  call = (action) => {
    if (action === "toggle_state") {
      const fn = this.engine.isPaused ? "resume" : "pause"
      this.engine[fn]()
    }
  }
}

module.exports = {
  plugin: MouseGesturesPlugin,
}
