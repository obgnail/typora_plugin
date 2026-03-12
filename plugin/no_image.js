class NoImageModePlugin extends BasePlugin {
    init = () => {
        this.isNoImageMode = this.config.NO_IMAGE_DEFAULT
    }

    hotkey = () => [{ hotkey: this.config.HOTKEY, callback: this.call }]

    enableNoImageMode = async () => {
        const renderArg = {
            transition_duration: this.config.TRANSITION_DURATION,
            transition_delay: this.config.TRANSITION_DELAY,
            opacity_on_hover: this.config.SHOW_ON_HOVER ? "100%" : "0",
        }
        await this.utils.styleTemplater.register(this.fixedName, renderArg)
        this.isNoImageMode = true
    }

    disableNoImageMode = () => {
        this.utils.styleTemplater.unregister(this.fixedName)
        this.isNoImageMode = false
    }

    toggleNoImageMode = async () => {
        const func = this.isNoImageMode ? this.disableNoImageMode : this.enableNoImageMode
        await func()
        const msg = this.i18n.t(this.isNoImageMode ? "modeEnabled" : "modeDisabled")
        this.utils.notification.show(msg)
    }

    process = () => this.isNoImageMode && this.enableNoImageMode()

    call = (action, meta) => this.toggleNoImageMode()
}

module.exports = {
    plugin: NoImageModePlugin
}
