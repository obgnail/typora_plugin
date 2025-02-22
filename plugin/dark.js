class darkModePlugin extends BasePlugin {
    styleTemplate = () => true

    init = () => {
        this.class = "plugin-dark"
        this.isDarkMode = this.config.DARK_DEFAULT
    }

    hotkey = () => [this.config.HOTKEY]

    enableDarkMode = () => this._toggleDarkMode(true)

    disableDarkMode = () => this._toggleDarkMode(false)

    toggleDarkMode = () => {
        this._toggleDarkMode(!this.isDarkMode)
        const msg = this.i18n.t(this.isDarkMode ? "modeEnabled" : "modeDisabled")
        this.utils.notification.show(msg)
    }

    _toggleDarkMode = enable => {
        document.documentElement.classList.toggle(this.class, enable)
        this.isDarkMode = enable
    }

    process = () => this.isDarkMode && this.enableDarkMode()

    call = (action, meta) => this.toggleDarkMode()
}

module.exports = {
    plugin: darkModePlugin,
}
