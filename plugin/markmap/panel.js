class PanelController {
  isPinTop = false
  isPinRight = false
  originPanelRect = null
  originContentRect = null

  constructor({ entities, config, utils, i18n, hooks }) {
    this.entities = entities
    this.config = config
    this.utils = utils
    this.i18n = i18n
    this.hooks = hooks
  }

  bindMove = () => {
    this.utils.dragElement({
      targetEl: this.entities.header,
      moveEl: this.entities.panel,
      onCheck: () => !this.entities.panel.classList.contains("pinned-window"),
      onMouseDown: null,
      onMouseMove: null,
      onMouseUp: null,
    })
  }

  bindResize = () => {
    const { minHeight, minWidth } = window.getComputedStyle(this.entities.panel)
    const panelMinHeight = parseFloat(minHeight) || 90
    const panelMinWidth = parseFloat(minWidth) || 90
    const onMouseUp = () => this.hooks.fit()

    const whenUnpin = () => {
      let deltaHeight = 0
      let deltaWidth = 0
      const onMouseDown = (startX, startY, startWidth, startHeight) => {
        deltaHeight = panelMinHeight - startHeight
        deltaWidth = panelMinWidth - startWidth
      }
      const onMouseMove = (deltaX, deltaY) => {
        deltaY = Math.max(deltaY, deltaHeight)
        deltaX = Math.max(deltaX, deltaWidth)
        return { deltaX, deltaY }
      }
      this.utils.resizeElement({
        targetEl: this.entities.resize,
        resizeEl: this.entities.panel,
        resizeWidth: true,
        resizeHeight: true,
        onMouseDown,
        onMouseMove,
        onMouseUp,
      })
    }

    const whenPinTop = () => {
      let contentStartTop = 0
      let contentMinTop = 0
      const onMouseDown = () => {
        contentStartTop = this.entities.content.getBoundingClientRect().top
        contentMinTop = panelMinHeight + this.entities.panel.getBoundingClientRect().top
      }
      const onMouseMove = (deltaX, deltaY) => {
        let newContentTop = contentStartTop + deltaY
        if (newContentTop < contentMinTop) {
          newContentTop = contentMinTop
          deltaY = contentMinTop - contentStartTop
        }
        this.entities.content.style.top = newContentTop + "px"
        return { deltaX, deltaY }
      }
      this.utils.resizeElement({
        targetEl: this.entities.gripTop,
        resizeEl: this.entities.panel,
        resizeWidth: false,
        resizeHeight: true,
        onMouseDown,
        onMouseMove,
        onMouseUp,
      })
    }

    const whenPinRight = () => {
      let contentStartRight = 0
      let contentStartWidth = 0
      let panelStartLeft = 0
      let contentMaxRight = 0
      const onMouseDown = () => {
        const contentRect = this.entities.content.getBoundingClientRect()
        contentStartRight = contentRect.right
        contentStartWidth = contentRect.width
        const panelRect = this.entities.panel.getBoundingClientRect()
        panelStartLeft = panelRect.left
        contentMaxRight = panelRect.right - panelMinWidth
      }
      const onMouseMove = (deltaX, deltaY) => {
        deltaX = -deltaX
        deltaY = -deltaY
        let newContentRight = contentStartRight - deltaX
        if (newContentRight > contentMaxRight) {
          deltaX = contentStartRight - contentMaxRight
        }
        this.entities.content.style.width = contentStartWidth - deltaX + "px"
        this.entities.panel.style.left = panelStartLeft - deltaX + "px"
        return { deltaX, deltaY }
      }
      this.utils.resizeElement({
        targetEl: this.entities.gripRight,
        resizeEl: this.entities.panel,
        resizeWidth: true,
        resizeHeight: false,
        onMouseDown,
        onMouseMove,
        onMouseUp,
      })
    }

    whenUnpin()
    whenPinTop()
    whenPinRight()
  }

  // ---- geometry ----

  initRect = () => {
    const { top: t, left: l, width: w, height: h } = this.entities.content.getBoundingClientRect()
    const { WIDTH_PERCENT_WHEN_INIT: wRatio, HEIGHT_PERCENT_WHEN_INIT: hRatio } = this.config
    const top = t + 10
    const height = h * hRatio / 100
    const width = w * wRatio / 100
    const left = l + (w - width) / 2
    this._setPanelRect({ top, height, width, left })
  }

  /** Re-anchors the panel when the sidebar toggles or resizes. */
  reposition = () => {
    if (!this.hooks.isChartActive()) return

    const { panel, content, fullScreen } = this.entities
    const isFullScreen = fullScreen.getAttribute("action") === "shrink"
    if (!this.isPinTop && !this.isPinRight && !isFullScreen) return

    const contentRect = content.getBoundingClientRect()
    const panelRect = panel.getBoundingClientRect()

    let newPanelRect, newContentRect
    if (isFullScreen) {
      newPanelRect = contentRect
      newContentRect = contentRect
    } else if (this.isPinTop) {
      newPanelRect = new DOMRect(contentRect.x, panelRect.y, contentRect.width, panelRect.height)
      newContentRect = new DOMRect(contentRect.x, this.originContentRect.y, contentRect.width, this.originContentRect.height)
    } else if (this.isPinRight) {
      newPanelRect = new DOMRect(contentRect.right, panelRect.y, panelRect.right - contentRect.right, panelRect.height)
      newContentRect = new DOMRect(contentRect.x, this.originContentRect.y, this.originContentRect.right - contentRect.left, this.originContentRect.height)
    }
    this.originContentRect = newContentRect
    this._setPanelRect(newPanelRect)
  }

  // ---- actions (dispatched via doAction on the host) ----

  pinTop = (fit = true) => {
    this.isPinTop = !this.isPinTop
    if (this.isPinTop) {
      if (this.isPinRight) {
        this.pinRight(false)
      } else {
        this._recordRects()
      }
    }

    let panelRect, contentTop
    if (this.isPinTop) {
      const { left, top, height, width } = this.originContentRect
      const newHeight = height * this.config.HEIGHT_PERCENT_WHEN_PIN_TOP / 100
      panelRect = { left, top, width, height: newHeight }
      contentTop = top + newHeight
    } else {
      panelRect = this.originPanelRect
      contentTop = this.originContentRect.top
    }

    this._setPanelRect(panelRect)
    this._setPinStyles(true)
    this.entities.content.style.top = contentTop + "px"
    if (fit) this.hooks.fit()
  }

  pinRight = (fit = true) => {
    this.isPinRight = !this.isPinRight
    if (this.isPinRight) {
      if (this.isPinTop) {
        this.pinTop(false)
      } else {
        this._recordRects()
      }
    }

    let panelRect, contentRight, contentWidth, writeWidth
    if (this.isPinRight) {
      const { top, height, width, right } = this.originContentRect
      const newWidth = width * this.config.WIDTH_PERCENT_WHEN_PIN_RIGHT / 100
      panelRect = { top, height, width: newWidth, left: right - newWidth }
      contentRight = right - newWidth + "px"
      contentWidth = width - newWidth + "px"
      writeWidth = "initial"
    } else {
      panelRect = this.originPanelRect
      contentRight = ""
      contentWidth = ""
      writeWidth = ""
    }

    this._setPanelRect(panelRect)
    this._setPinStyles(false)
    this.entities.content.style.right = contentRight
    this.entities.content.style.width = contentWidth
    this.utils.entities.eWrite.style.width = writeWidth
    if (fit) this.hooks.fit()
  }

  expand = () => this._toggleFullscreen(true)
  shrink = () => this._toggleFullscreen(false)
  showToolbar = () => this._toggleToolbar(true)
  hideToolbar = () => this._toggleToolbar(false)

  /** Restores the panel to its pre-pinned, hidden state. Does not touch the chart. */
  reset = () => {
    if (this.isPinTop) {
      this.pinTop()
    } else if (this.isPinRight) {
      this.pinRight()
    }
    this.entities.panel.style = ""
    this.utils.hide(this.entities.panel)
    this.utils.show(this.entities.resize)
    this.entities.panel.classList.remove("pinned-window")
    this._setFullScreenStyles(false)
  }

  // ---- internals ----

  _recordRects = () => {
    if (!this.entities.panel.classList.contains("pinned-window")) {
      this.originPanelRect = this.entities.panel.getBoundingClientRect()
      this.originContentRect = this.entities.content.getBoundingClientRect()
    }
  }

  _setPanelRect = rect => {
    if (!rect) return
    const { left, top, height, width } = rect
    const s = { left: `${left}px`, top: `${top}px`, height: `${height}px`, width: `${width}px` }
    Object.assign(this.entities.panel.style, s)
  }

  _setPinStyles = (isTop = true) => {
    const [pinned, gripEl, act, hint, icon] = (isTop === true)
      ? [this.isPinTop, this.entities.gripTop, "pinTop", "$option.TITLE_BAR_BUTTONS.pinTop", "fa-chevron-up"]
      : [this.isPinRight, this.entities.gripRight, "pinRight", "$option.TITLE_BAR_BUTTONS.pinRight", "fa-chevron-right"]

    this.entities.panel.classList.toggle("pinned-window", pinned)
    this.utils.toggleInvisible(gripEl, !pinned)
    this.utils.toggleInvisible(this.entities.resize, pinned)
    this._setFullScreenStyles(false)

    const btn = this.entities.header.querySelector(`[action="${act}"]`)
    const iconEl = btn.firstElementChild
    iconEl.classList.toggle(icon, !pinned)
    iconEl.classList.toggle("fa-reply", pinned)
    btn.setAttribute("ty-hint", this.i18n.t(pinned ? "$option.TITLE_BAR_BUTTONS.pinRecover" : hint))
  }

  _setFullScreenStyles = (expand = true) => {
    const btn = this.entities.fullScreen
    if (!btn) return
    btn.setAttribute("action", expand ? "shrink" : "expand")
    btn.setAttribute("ty-hint", this.i18n.t(expand ? "$option.TITLE_BAR_BUTTONS.shrink" : "$option.TITLE_BAR_BUTTONS.expand"))
    const iconEl = btn.firstElementChild
    iconEl.classList.toggle("fa-expand", !expand)
    iconEl.classList.toggle("fa-reply", expand)
  }

  _toggleFullscreen = (expand = true) => {
    if (this.isPinTop) {
      this.pinTop()
    } else if (this.isPinRight) {
      this.pinRight()
    } else {
      this._recordRects()
    }

    this._setPanelRect(expand ? this.originContentRect : this.originPanelRect)
    this._setFullScreenStyles(expand)
    this.entities.panel.classList.toggle("pinned-window", expand)
    this.utils.toggleInvisible(this.entities.resize, expand)
  }

  _toggleToolbar = show => {
    this.utils.toggleInvisible(this.entities.header, !show)
    this.hooks.fit()
  }
}

module.exports = PanelController
