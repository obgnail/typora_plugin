class blurPlugin extends global._basePlugin {
    beforeProcess = () => {
        this.css_id = "plugin-blur-style";
        // todo: 低版本 typora 不支持 css3
        if (this.utils.isBetaVersion) {
            return this.utils.stopLoadPluginError
        }
    }

    style = () => ({textID: this.css_id, text: this.getStyleText()})

    hotkey = () => [{hotkey: this.config.HOTKEY, callback: this.call}]

    process = () => {
        this.inBlur = this.config.BLUR_DEFAULT;
        this.run();
    }

    call = () => {
        this.inBlur = !this.inBlur;
        this.run();
    }

    getStyleText = () => {
        const hide = this.config.BLUR_TYPE === "hide";
        const effect = hide ? "visibility: hidden;" : `filter: blur(${this.config.BLUR_LEVEL}px);`;
        const restore = hide ? `visibility: visible;` : `filter: initial;`;
        const selector = "#write > [cid]:not(.md-focus):not(:has(.md-focus)):not(:has(.md-focus-container))";

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
