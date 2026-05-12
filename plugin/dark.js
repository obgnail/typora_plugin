class DarkModePlugin extends BasePlugin {
  className = "plugin-dark"
  isDarkMode = this.config.DARK_DEFAULT

  style = () => true

  hotkey = () => [{ hotkey: this.config.HOTKEY, callback: this.call }]

  enableDarkMode = () => this._toggleDarkMode(true)

  disableDarkMode = () => this._toggleDarkMode(false)

  toggleDarkMode = () => {
    this._toggleDarkMode(!this.isDarkMode)
    const msg = this.i18n.t(this.isDarkMode ? "modeEnabled" : "modeDisabled")
    this.utils.notification.show(msg)
  }

  _toggleDarkMode = enable => {
    document.documentElement.classList.toggle(this.className, enable)
    this.isDarkMode = enable
  }

  process = () => this.isDarkMode && this.enableDarkMode()

  call = (action, meta) => this.toggleDarkMode()
}

module.exports = {
  plugin: DarkModePlugin,
}
