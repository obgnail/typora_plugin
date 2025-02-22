class blurPlugin extends BasePlugin {
    beforeProcess = () => {
        if (!this.utils.supportHasSelector) {
            return this.utils.stopLoadPluginError
        }
    }

    hotkey = () => [{ hotkey: this.config.HOTKEY, callback: this.call }]

    init = () => {
        this.blurType = { BLUR: "blur", HIDE: "hide" };
        this.css_id = "plugin-blur-style";
        this.inBlur = this.config.BLUR_DEFAULT;
    }

    process = () => this.run(false);

    call = () => {
        this.inBlur = !this.inBlur;
        this.run();
    }

    getStyleText = () => {
        const selector = "#write > [cid]:not(.md-focus):not(:has(.md-focus)):not(:has(.md-focus-container))";
        const [effect, restore] = (this.config.BLUR_TYPE === this.blurType.HIDE)
            ? ["visibility: hidden;", "visibility: visible;"]
            : [`filter: blur(${this.config.BLUR_LEVEL}px);`, "filter: initial;"]

        let css = `${selector} { ${effect} }`;
        if (this.config.RESRTORE_WHEN_HOVER) {
            css += `${selector}:hover { ${restore} }`;
        }
        return css
    }

    run = (showNotification = true) => {
        if (this.inBlur) {
            this.utils.insertStyle(this.css_id, this.getStyleText())
        } else {
            this.utils.removeStyle(this.css_id)
        }
        if (showNotification) {
            const msg = this.i18n.t(this.inBlur ? "modeEnabled" : "modeDisabled")
            this.utils.notification.show(msg)
        }
    }
}

module.exports = {
    plugin: blurPlugin,
}
