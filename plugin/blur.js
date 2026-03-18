class BlurPlugin extends BasePlugin {
    beforeProcess = () => this.utils.supportHasSelector ? undefined : this.utils.PLUGIN_LOAD_ABORT

    hotkey = () => [{ hotkey: this.config.HOTKEY, callback: this.call }]

    init = () => {
        this.BLUR_TYPE = { BLUR: "blur", HIDE: "hide" }
        this.isBlurMode = this.config.BLUR_DEFAULT
    }

    process = () => this.run(false)

    call = () => {
        this.isBlurMode = !this.isBlurMode
        this.run()
    }

    getStyleText = () => {
        const selector = "#write > [cid]:not(.md-focus):not(:has(.md-focus)):not(:has(.md-focus-container))"
        const [effect, restore] = (this.config.BLUR_TYPE === this.BLUR_TYPE.HIDE)
            ? ["visibility: hidden;", "visibility: visible;"]
            : [`filter: blur(${this.config.BLUR_LEVEL}px);`, "filter: initial;"]

        let css = `${selector} { ${effect} }`
        if (this.config.RESTORE_ON_HOVER) {
            css += `${selector}:hover { ${restore} }`
        }
        return css
    }

    run = (showNotification = true) => {
        const id = this.utils.styleTemplater.getID(this.fixedName)
        if (this.isBlurMode) {
            this.utils.insertStyle(id, this.getStyleText())
        } else {
            this.utils.removeStyle(id)
        }
        if (showNotification) {
            const msg = this.i18n.t(this.isBlurMode ? "modeEnabled" : "modeDisabled")
            this.utils.notification.show(msg)
        }
    }
}

module.exports = {
    plugin: BlurPlugin
}
