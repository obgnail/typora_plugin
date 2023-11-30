class blurPlugin extends BasePlugin {
    beforeProcess = () => {
        this.css_id = "plugin-blur-style";
        this.inBlur = this.config.BLUR_DEFAULT;
        // todo: 低版本typora不支持:has
        if (this.utils.isBetaVersion) {
            return this.utils.stopLoadPluginError
        }
    }

    style = () => ({textID: this.css_id, text: this.getStyleText()})

    hotkey = () => [{hotkey: this.config.HOTKEY, callback: this.call}]

    process = () => this.run();

    call = () => {
        this.inBlur = !this.inBlur;
        this.run();
    }

    getStyleText = () => {
        const selector = "#write > [cid]:not(.md-focus):not(:has(.md-focus)):not(:has(.md-focus-container))";
        const [effect, restore] = (this.config.BLUR_TYPE === "hide")
            ? ["visibility: hidden;", "visibility: visible;"]
            : [`filter: blur(${this.config.BLUR_LEVEL}px);`, "filter: initial;"]

        let css = `${selector} { ${effect} }`;
        if (this.config.RESRTORE_WHEN_HOVER) {
            css += `${selector}:hover { ${restore} }`;
        }
        return css
    }

    run = () => {
        if (this.inBlur) {
            this.utils.insertStyle(this.css_id, this.getStyleText());
        } else {
            this.utils.removeStyle(this.css_id)
        }
    }
}

module.exports = {
    plugin: blurPlugin,
};
