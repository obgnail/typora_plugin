class NoImageModePlugin extends BasePlugin {
  isNoImageMode = this.config.NO_IMAGE_DEFAULT

  hotkey = () => [{ hotkey: this.config.HOTKEY, callback: this.call }]

  enableNoImageMode = async () => {
    await this.utils.styleManager.register(this.fixedName, {
      transition_duration: this.config.TRANSITION_DURATION,
      transition_delay: this.config.TRANSITION_DELAY,
      opacity_on_hover: this.config.SHOW_ON_HOVER ? "100%" : "0",
    })
    this.isNoImageMode = true
  }

  disableNoImageMode = () => {
    this.utils.removeStyle(this.fixedName)
    this.isNoImageMode = false
  }

  toggleNoImageMode = async () => {
    const fn = this.isNoImageMode ? this.disableNoImageMode : this.enableNoImageMode
    await fn()
    const msg = this.i18n.t(this.isNoImageMode ? "modeEnabled" : "modeDisabled")
    this.utils.notification.show(msg)
  }

  process = () => this.isNoImageMode && this.enableNoImageMode()

  call = (action, meta) => this.toggleNoImageMode()
}

module.exports = {
  plugin: NoImageModePlugin,
}
