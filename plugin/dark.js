class DarkModePlugin extends BasePlugin {
  className = "plugin-dark"
  _isActive = this.config.DARK_DEFAULT

  style = () => `@media (prefers-color-scheme: light) { .${this.className} { filter: invert(.9) hue-rotate(.5turn); } }`

  hotkey = () => [{ hotkey: this.config.HOTKEY, callback: this.call }]

  isActive = () => Boolean(this._isActive)
  enableDark = () => this._toggleDark(true)
  disableDark = () => this._toggleDark(false)
  toggleDark = () => {
    this._toggleDark(!this._isActive)
    const msg = this.i18n.t(this._isActive ? "modeEnabled" : "modeDisabled")
    this.utils.notification.show(msg)
  }

  _toggleDark = enable => {
    document.documentElement.classList.toggle(this.className, enable)
    this._isActive = enable
  }

  process = () => this._isActive && this.enableDark()

  call = (action, meta) => this.toggleDark()
}

module.exports = {
  plugin: DarkModePlugin,
}
