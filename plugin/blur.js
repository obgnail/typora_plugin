class BlurPlugin extends BasePlugin {
  isBlurMode = this.config.BLUR_DEFAULT

  prepare = () => this.utils.supportHasSelector ? undefined : this.utils.PLUGIN_LOAD_ABORT

  hotkey = () => [{ hotkey: this.config.HOTKEY, callback: this.call }]

  style = () => {
    if (!this.isBlurMode) return

    const selector = "#write > [cid]:not(.md-focus):not(:has(.md-focus)):not(:has(.md-focus-container))"
    const [effect, restore] = (this.config.BLUR_TYPE === "hide")
      ? ["visibility: hidden;", "visibility: visible;"]
      : [`filter: blur(${this.config.BLUR_LEVEL}px);`, "filter: initial;"]

    let css = `${selector} { ${effect} }`
    if (this.config.RESTORE_ON_HOVER) {
      css += `${selector}:hover { ${restore} }`
    }
    return css
  }

  call = () => {
    this.isBlurMode = !this.isBlurMode

    if (this.isBlurMode) {
      this.utils.insertStyle(this.fixedName, this.style())
    } else {
      this.utils.removeStyle(this.fixedName)
    }

    const msg = this.i18n.t(this.isBlurMode ? "modeEnabled" : "modeDisabled")
    this.utils.notification.show(msg)
  }
}

module.exports = {
  plugin: BlurPlugin,
}
