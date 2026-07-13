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
} = require("./core")

const PANEL_SELECTOR = ".md-diagram-panel"
const PREVIEW_SELECTOR = ".md-diagram-panel-preview"
const SURFACE_SELECTOR = ".plugin-diagram-surface"
const CONTENT_SELECTOR = ".plugin-diagram-content"
const TOOLBAR_SELECTOR = ".plugin-diagram-toolbar"
const HANDLE_SELECTOR = ".plugin-diagram-resize-handle"
const { buildExportStyle, buildStyle } = require("./style")

const RESIZE_HANDLES = [
  ["top-left", "nwse-resize"],
  ["top", "ns-resize"],
  ["top-right", "nesw-resize"],
  ["right", "ew-resize"],
  ["bottom-right", "nwse-resize"],
  ["bottom", "ns-resize"],
  ["bottom-left", "nesw-resize"],
  ["left", "ew-resize"],
]

class DiagramEnhancePlugin extends BasePlugin {
  prepare = () => {
    this.options = normalizeOptions(this.config)
    this.states = new WeakMap()
  }

  getDynamicActions = (anchorNode, meta) => {
    const preview = anchorNode?.closest?.(PANEL_SELECTOR)?.querySelector(PREVIEW_SELECTOR)
    const state = preview && this.states.get(preview)
    meta.state = state
    return [{
      act_name: this.i18n.t("act.reset"),
      act_value: "reset",
      act_disabled: !state,
    }]
  }

  call = (action, meta = {}) => {
    if (action === "reset" && meta.state) this._reset(meta.state)
  }

  style = buildStyle

  process = () => {
    this.write = this.utils.entities?.eWrite || document.querySelector("#write")
    if (!this.write) return

    this.utils.exportHelper?.register?.(this.fixedName, this._exportStyle)
    this.utils.exportHelper?.registerNative?.(
      this.fixedName,
      this._beforeNativeExport,
      this._afterNativeExport,
    )

    this._bindInteractionRoot(this.write)
    this._scan(this.write)

    if (typeof MutationObserver === "function") {
      this.observer = new MutationObserver(this._handleMutations)
      this.observer.observe(this.write, { childList: true, subtree: true })
    }

    document.addEventListener("fullscreenchange", this._syncFullscreenButtons)
    document.addEventListener("webkitfullscreenchange", this._syncFullscreenButtons)

    const eventType = this.utils.eventHub?.eventType
    const fileOpened = eventType?.fileOpened
    if (fileOpened) this.utils.eventHub.addEventListener(fileOpened, this._deferScan)
  }

  _bindInteractionRoot = root => {
    root.addEventListener("click", this._handleClick, true)
    root.addEventListener("wheel", this._handleWheel, { passive: false, capture: true })
    root.addEventListener("pointerdown", this._handlePointerDown, true)
    root.addEventListener("pointermove", this._handlePointerMove, true)
    root.addEventListener("pointerup", this._handlePointerEnd, true)
    root.addEventListener("pointercancel", this._handlePointerEnd, true)

    return () => {
      root.removeEventListener("click", this._handleClick, true)
      root.removeEventListener("wheel", this._handleWheel, true)
      root.removeEventListener("pointerdown", this._handlePointerDown, true)
      root.removeEventListener("pointermove", this._handlePointerMove, true)
      root.removeEventListener("pointerup", this._handlePointerEnd, true)
      root.removeEventListener("pointercancel", this._handlePointerEnd, true)
    }
  }

  _toolbarHTML = () => `
    <button type="button" class="plugin-diagram-wheel-toggle" data-action="wheel-toggle" title="${this.i18n.t("toolbar.wheelDisable")}" aria-label="${this.i18n.t("toolbar.wheelDisable")}" aria-pressed="true"><span class="fa fa-mouse-pointer" aria-hidden="true"></span><span>${this.i18n.t("toolbar.wheel")}</span></button>
    <button type="button" data-action="zoom-in" title="${this.i18n.t("toolbar.zoomIn")}" aria-label="${this.i18n.t("toolbar.zoomIn")}"><span class="fa fa-plus" aria-hidden="true"></span></button>
    <button type="button" data-action="zoom-out" title="${this.i18n.t("toolbar.zoomOut")}" aria-label="${this.i18n.t("toolbar.zoomOut")}"><span class="fa fa-minus" aria-hidden="true"></span></button>
    <button type="button" data-action="reset" title="${this.i18n.t("toolbar.reset")}" aria-label="${this.i18n.t("toolbar.reset")}"><span class="fa fa-undo" aria-hidden="true"></span></button>
    <output data-role="percent" aria-live="polite">100%</output>
    ${this.options.showFullscreen ? `<button type="button" data-action="fullscreen" title="${this.i18n.t("toolbar.fullscreenEnter")}" aria-label="${this.i18n.t("toolbar.fullscreenEnter")}" aria-pressed="false"><span class="fa fa-expand" aria-hidden="true"></span></button>` : ""}
  `

  _resizeHandlesHTML = () => RESIZE_HANDLES
    .map(([position, cursor]) => `<span class="plugin-diagram-resize-handle" data-position="${position}" data-cursor="${cursor}" aria-hidden="true"></span>`)
    .join("")

  _exportStyle = buildExportStyle

  _scan = root => {
    if (root.matches?.(PANEL_SELECTOR)) this._ensurePanel(root)
    root.querySelectorAll?.(PANEL_SELECTOR).forEach(this._ensurePanel)
  }

  _ensurePanel = panel => {
    const preview = panel.querySelector(PREVIEW_SELECTOR)
    if (!preview) return

    panel.classList.add("plugin-diagram-enhance")
    preview.classList.add("plugin-diagram-surface")
    preview.classList.toggle("plugin-diagram-pan-enabled", this.options.enablePan)
    preview.classList.toggle("plugin-diagram-touch-enabled", this.options.enableTouch)

    const state = this._ensureState(preview)
    this._ensureContent(preview, state)
    this._ensureToolbar(preview, state)
    this._ensureResizeHandles(preview)
    this._applyTransform(state)
  }

  _ensureState = surface => {
    let state = this.states.get(surface)
    if (!state) {
      state = {
        surface,
        content: null,
        scale: Number(surface.dataset.diagramScale) || 1,
        translateX: Number(surface.dataset.diagramTranslateX) || 0,
        translateY: Number(surface.dataset.diagramTranslateY) || 0,
        wheelZoomEnabled: surface.dataset.diagramWheelZoom === undefined
          ? this.options.wheelZoomDefault
          : surface.dataset.diagramWheelZoom === "true",
        pointers: new Map(),
        gesture: null,
        resize: null,
        lastHostClick: null,
        suppressClick: false,
      }
      this.states.set(surface, state)
    }
    return state
  }

  _ensureContent = (preview, state) => {
    let content = Array.from(preview.children).find(child => child.matches?.(CONTENT_SELECTOR))
    if (!content) {
      content = document.createElement("div")
      content.className = "plugin-diagram-content"
      preview.insertBefore(content, preview.firstChild)
    }

    const overlay = node => node === content
      || node.matches?.(TOOLBAR_SELECTOR)
      || node.matches?.(HANDLE_SELECTOR)

    Array.from(preview.childNodes).forEach(node => {
      if (!overlay(node)) content.appendChild(node)
    })

    state.content = content
  }

  _ensureToolbar = (surface, state) => {
    let toolbar = Array.from(surface.children).find(child => child.matches?.(TOOLBAR_SELECTOR))
    if (!toolbar) {
      toolbar = document.createElement("div")
      toolbar.className = "plugin-diagram-toolbar"
      toolbar.setAttribute("role", "toolbar")
      toolbar.setAttribute("aria-label", this.i18n.t("toolbar.label"))
      toolbar.innerHTML = this._toolbarHTML()
      toolbar.addEventListener("pointerdown", event => event.stopPropagation())
      surface.appendChild(toolbar)
    }
    this._syncToolbar(state)
  }

  _ensureResizeHandles = surface => {
    if (!this.options.resizable) return
    const current = surface.querySelectorAll(`:scope > ${HANDLE_SELECTOR}`)
    if (current.length === RESIZE_HANDLES.length) return
    current.forEach(handle => handle.remove())
    surface.insertAdjacentHTML("beforeend", this._resizeHandlesHTML())
  }

  _handleMutations = mutations => {
    for (const mutation of mutations) {
      const targetPanel = mutation.target?.closest?.(PANEL_SELECTOR)
      if (targetPanel) this._ensurePanel(targetPanel)
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === 1) this._scan(node)
      })
    }
  }

  _handleClick = event => {
    const surface = event.target.closest?.(SURFACE_SELECTOR)
    const state = surface && this.states.get(surface)
    if (!state) return

    const button = event.target.closest?.(`${TOOLBAR_SELECTOR} [data-action]`)
    if (!button) {
      if (state.suppressClick) {
        event.preventDefault()
        event.stopPropagation()
        state.suppressClick = false
      }
      return
    }

    event.preventDefault()
    event.stopPropagation()
    const center = { x: surface.clientWidth / 2, y: surface.clientHeight / 2 }

    switch (button.dataset.action) {
      case "wheel-toggle":
        state.wheelZoomEnabled = !state.wheelZoomEnabled
        this._syncToolbar(state)
        break
      case "zoom-in":
        this._setTransform(state, zoomAtPoint(state, nextScale(state.scale, 1, this.options), center, this.options))
        break
      case "zoom-out":
        this._setTransform(state, zoomAtPoint(state, nextScale(state.scale, -1, this.options), center, this.options))
        break
      case "reset":
        this._reset(state)
        break
      case "fullscreen":
        void this._toggleFullscreen(state)
        break
    }
  }

  _handleWheel = event => {
    const surface = event.target.closest?.(SURFACE_SELECTOR)
    const state = surface && this.states.get(surface)
    if (!state || !state.wheelZoomEnabled || event.deltaY === 0) return

    event.preventDefault()
    event.stopPropagation()
    const point = this._pointInSurface(surface, event.clientX, event.clientY)
    const factor = event.deltaY > 0 ? (1 - this.options.zoomStep) : (1 + this.options.zoomStep)
    this._setTransform(state, zoomAtPoint(state, state.scale * factor, point, this.options))
  }

  _handlePointerDown = event => {
    const handle = event.target.closest?.(HANDLE_SELECTOR)
    const surface = event.target.closest?.(SURFACE_SELECTOR)
    const state = surface && this.states.get(surface)
    if (!state) return

    if (handle) {
      this._startResize(event, state, handle)
      return
    }
    if (event.target.closest?.(TOOLBAR_SELECTOR)) return
    if (event.pointerType === "mouse" && (event.button !== 0 || !this.options.enablePan)) return
    if (event.pointerType !== "mouse" && !this.options.enableTouch) return

    const point = this._pointerPoint(surface, event)
    const allowHostFocus = !this.options.doubleClickToEdit
      || isDoubleClickCandidate(state.lastHostClick, point, Date.now())
    state.pointers.set(event.pointerId, point)
    surface.setPointerCapture?.(event.pointerId)

    if (state.pointers.size === 1) {
      state.gesture = {
        type: "pan",
        pointerId: event.pointerId,
        startPointer: point,
        startTranslate: { x: state.translateX, y: state.translateY },
        allowHostFocus,
        hostClickEligible: true,
        moved: false,
      }
      if (!allowHostFocus) {
        event.preventDefault()
        event.stopPropagation()
      }
    } else if (state.pointers.size === 2) {
      this._startPinch(state)
    }
  }

  _handlePointerMove = event => {
    const surface = event.target.closest?.(SURFACE_SELECTOR)
    const state = surface && this.states.get(surface)
    if (!state) return

    if (state.resize?.pointerId === event.pointerId) {
      this._moveResize(event, state)
      return
    }
    if (!state.pointers.has(event.pointerId)) return

    const point = this._pointerPoint(surface, event)
    state.pointers.set(event.pointerId, point)

    if (state.pointers.size >= 2) {
      if (state.gesture?.type !== "pinch") this._startPinch(state)
      const [first, second] = Array.from(state.pointers.values()).slice(0, 2)
      const currentCenter = midpoint(first, second)
      const currentDistance = distanceBetween(first, second)
      this._setTransform(state, pinchTransform({
        ...state.gesture,
        currentCenter,
        currentDistance,
        minScale: this.options.minScale,
        maxScale: this.options.maxScale,
      }))
      state.gesture.moved = true
      surface.classList.add("plugin-diagram-panning")
      event.preventDefault()
      event.stopPropagation()
      return
    }

    if (state.gesture?.type !== "pan" || state.gesture.pointerId !== event.pointerId) return
    const delta = distanceBetween(state.gesture.startPointer, point)
    if (delta < 3 && !state.gesture.moved) return

    state.gesture.moved = true
    const translation = panFromStart(state.gesture.startTranslate, state.gesture.startPointer, point)
    this._setTransform(state, translation)
    surface.classList.add("plugin-diagram-panning")
    event.preventDefault()
    event.stopPropagation()
  }

  _handlePointerEnd = event => {
    const surface = event.target.closest?.(SURFACE_SELECTOR)
    const state = surface && this.states.get(surface)
    if (!state) return

    if (state.resize?.pointerId === event.pointerId) {
      event.preventDefault()
      event.stopPropagation()
      this._finishResize(state)
      state.lastHostClick = null
      state.suppressClick = true
      setTimeout(() => { state.suppressClick = false }, 0)
      return
    }

    const gesture = state.gesture
    const moved = Boolean(gesture?.moved)
    const hostClickEligible = event.type === "pointerup"
      && gesture?.type === "pan"
      && gesture.hostClickEligible !== false
    const blockHostFocus = moved
      || !hostClickEligible
      || (this.options.doubleClickToEdit && !gesture?.allowHostFocus)
    if (blockHostFocus) {
      event.preventDefault()
      event.stopPropagation()
    }
    if (!hostClickEligible || moved) {
      state.lastHostClick = null
    } else if (this.options.doubleClickToEdit) {
      state.lastHostClick = gesture.allowHostFocus
        ? null
        : { time: Date.now(), point: gesture.startPointer }
    }
    state.pointers.delete(event.pointerId)
    surface.releasePointerCapture?.(event.pointerId)

    if (state.pointers.size === 1) {
      const [pointerId, point] = state.pointers.entries().next().value
      state.gesture = {
        type: "pan",
        pointerId,
        startPointer: point,
        startTranslate: { x: state.translateX, y: state.translateY },
        allowHostFocus: false,
        hostClickEligible: false,
        moved,
      }
    } else if (state.pointers.size === 0) {
      state.gesture = null
      state.suppressClick = blockHostFocus
      if (blockHostFocus) setTimeout(() => { state.suppressClick = false }, 0)
      surface.classList.remove("plugin-diagram-panning")
    }
  }

  _startPinch = state => {
    const [first, second] = Array.from(state.pointers.values()).slice(0, 2)
    state.gesture = {
      type: "pinch",
      startScale: state.scale,
      startTranslate: { x: state.translateX, y: state.translateY },
      startCenter: midpoint(first, second),
      startDistance: distanceBetween(first, second),
      allowHostFocus: false,
      hostClickEligible: false,
      moved: false,
    }
  }

  _startResize = (event, state, handle) => {
    event.preventDefault()
    event.stopPropagation()
    const style = getComputedStyle(state.surface)
    state.resize = {
      pointerId: event.pointerId,
      position: handle.dataset.position,
      cursor: handle.dataset.cursor,
      startX: event.clientX,
      startY: event.clientY,
      startWidth: state.surface.offsetWidth,
      startHeight: state.surface.offsetHeight,
      startMarginLeft: parseFloat(style.marginLeft) || 0,
      startMarginTop: parseFloat(style.marginTop) || 0,
    }
    state.surface.setPointerCapture?.(event.pointerId)
    state.surface.classList.add("plugin-diagram-resizing-active")
    document.body.classList.add("plugin-diagram-resizing", `plugin-diagram-resizing-${this._cursorSuffix(state.resize.cursor)}`)
  }

  _moveResize = (event, state) => {
    event.preventDefault()
    event.stopPropagation()
    const rect = resizeRect({
      ...state.resize,
      deltaX: event.clientX - state.resize.startX,
      deltaY: event.clientY - state.resize.startY,
      minWidth: this.options.minContainerWidth,
      minHeight: this.options.minContainerHeight,
    })
    state.surface.style.width = `${rect.width}px`
    state.surface.style.height = `${rect.height}px`
    state.surface.style.marginLeft = `${rect.marginLeft}px`
    state.surface.style.marginTop = `${rect.marginTop}px`
  }

  _finishResize = state => {
    const { pointerId, cursor } = state.resize
    state.surface.releasePointerCapture?.(pointerId)
    state.surface.classList.remove("plugin-diagram-resizing-active")
    document.body.classList.remove("plugin-diagram-resizing", `plugin-diagram-resizing-${this._cursorSuffix(cursor)}`)
    state.resize = null
  }

  _cursorSuffix = cursor => ({
    "nwse-resize": "nwse",
    "nesw-resize": "nesw",
    "ns-resize": "ns",
    "ew-resize": "ew",
  })[cursor] || "nwse"

  _pointerPoint = (surface, event) => this._pointInSurface(surface, event.clientX, event.clientY)

  _pointInSurface = (surface, clientX, clientY) => {
    const rect = surface.getBoundingClientRect()
    return { x: clientX - rect.left, y: clientY - rect.top }
  }

  _setTransform = (state, patch) => {
    if (Number.isFinite(patch.scale)) state.scale = patch.scale
    if (Number.isFinite(patch.translateX)) state.translateX = patch.translateX
    if (Number.isFinite(patch.translateY)) state.translateY = patch.translateY
    this._applyTransform(state)
  }

  _applyTransform = state => {
    if (!state.content) return
    state.content.style.transform = `translate3d(${state.translateX}px, ${state.translateY}px, 0) scale(${state.scale})`
    state.surface.dataset.diagramScale = String(state.scale)
    state.surface.dataset.diagramTranslateX = String(state.translateX)
    state.surface.dataset.diagramTranslateY = String(state.translateY)
    state.surface.dataset.diagramWheelZoom = String(state.wheelZoomEnabled)
    this._syncToolbar(state)
  }

  _reset = state => this._setTransform(state, { scale: 1, translateX: 0, translateY: 0 })

  _syncToolbar = state => {
    const toolbar = Array.from(state.surface.children).find(child => child.matches?.(TOOLBAR_SELECTOR))
    if (!toolbar) return

    const percent = toolbar.querySelector('[data-role="percent"]')
    const percentText = formatPercent(state.scale)
    if (percent && percent.textContent !== percentText) percent.textContent = percentText

    const zoomIn = toolbar.querySelector('[data-action="zoom-in"]')
    const zoomOut = toolbar.querySelector('[data-action="zoom-out"]')
    if (zoomIn) zoomIn.disabled = state.scale >= this.options.maxScale
    if (zoomOut) zoomOut.disabled = state.scale <= this.options.minScale

    const wheel = toolbar.querySelector('[data-action="wheel-toggle"]')
    if (wheel) {
      wheel.classList.toggle("is-active", state.wheelZoomEnabled)
      wheel.title = this.i18n.t(state.wheelZoomEnabled ? "toolbar.wheelDisable" : "toolbar.wheelEnable")
      wheel.setAttribute("aria-label", wheel.title)
      wheel.setAttribute("aria-pressed", String(state.wheelZoomEnabled))
    }
    this._syncFullscreenButton(state)
  }

  _getFullscreenElement = () => document.fullscreenElement || document.webkitFullscreenElement

  _toggleFullscreen = async state => {
    try {
      const current = this._getFullscreenElement()
      if (current === state.surface) {
        const exit = document.exitFullscreen || document.webkitExitFullscreen
        if (exit) await exit.call(document)
      } else {
        if (current) {
          const exit = document.exitFullscreen || document.webkitExitFullscreen
          if (exit) await exit.call(document)
        }
        const request = state.surface.requestFullscreen || state.surface.webkitRequestFullscreen
        if (request) await request.call(state.surface)
      }
    } catch (error) {
      console.error("[diagram_enhance] Failed to toggle fullscreen", error)
      this.utils.notification?.show(this.i18n.t("notify.fullscreenFailed"), "error", 5000)
    } finally {
      this._syncFullscreenButtons()
    }
  }

  _syncFullscreenButtons = () => {
    this.write?.querySelectorAll(`${PREVIEW_SELECTOR}${SURFACE_SELECTOR}`).forEach(surface => {
      const state = this.states.get(surface)
      if (state) this._syncFullscreenButton(state)
    })
  }

  _syncFullscreenButton = state => {
    const button = state.surface.querySelector(`${TOOLBAR_SELECTOR} [data-action="fullscreen"]`)
    if (!button) return
    const active = this._getFullscreenElement() === state.surface
    button.title = this.i18n.t(active ? "toolbar.fullscreenExit" : "toolbar.fullscreenEnter")
    button.setAttribute("aria-label", button.title)
    button.setAttribute("aria-pressed", String(active))
    const icon = button.querySelector(".fa")
    if (icon) icon.className = `fa ${active ? "fa-compress" : "fa-expand"}`
  }

  _beforeNativeExport = () => {
    this.nativeExportState = []
    this.write?.querySelectorAll(`${PREVIEW_SELECTOR}${SURFACE_SELECTOR}`).forEach(surface => {
      const state = this.states.get(surface)
      if (!state) return
      this.nativeExportState.push({
        state,
        scale: state.scale,
        translateX: state.translateX,
        translateY: state.translateY,
      })
      surface.classList.add("plugin-diagram-exporting")
      this._setTransform(state, { scale: 1, translateX: 0, translateY: 0 })
    })
  }

  _afterNativeExport = () => {
    for (const saved of this.nativeExportState || []) {
      saved.state.surface.classList.remove("plugin-diagram-exporting")
      this._setTransform(saved.state, saved)
    }
    this.nativeExportState = []
  }

  _deferScan = () => setTimeout(() => this._scan(this.write), 0)
}

module.exports = { plugin: DiagramEnhancePlugin }
