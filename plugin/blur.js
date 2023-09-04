class blurPlugin extends global._basePlugin {
    beforeProcess = () => {
        // todo: 低版本 typora 不支持 css3
        if (this.utils.isBetaVersion) {
            return this.utils.stopLoadPluginError
        }
    }

    style = () => {
        const textID = this.config.BLUR_STYLE_ID;
        const text = this.getStyleText();
        return {textID, text}
    }

    process = () => {
        this.inBlur = this.config.BLUR_DEFAULT;
        this.run();
    }

    call = () => {
        this.inBlur = !this.inBlur;
        this.run();
    }


    getStyleText = () => {
        const content = (this.config.BLUR_TYPE === "hide") ? "visibility: hidden;" : `filter: blur(${this.config.BLUR_LEVEL}px);`;
        return `#write > [cid]:not(.md-focus):not(:has(.md-focus)):not(:has(.md-focus-container)) { ${content} }`
    }

    run = () => {
        if (this.inBlur) {
            const css = this.getStyleText();
            this.utils.insertStyle(this.config.BLUR_STYLE_ID, css);
        } else {
            this.utils.removeStyle(this.config.BLUR_STYLE_ID)
        }
    }
}

module.exports = {
    plugin: blurPlugin,
};
