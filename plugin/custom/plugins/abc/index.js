class abcPlugin extends BaseCustomPlugin {
    init = () => this.ABCJS = null;

    callback = anchorNode => this.utils.insertText(anchorNode, this.config.TEMPLATE);

    process = () => {
        this.utils.registerThirdPartyDiagramParser(
            this.config.LANGUAGE,
            false,
            this.config.INTERACTIVE_MODE,
            ".plugin-notation-content",
            '<div class="plugin-notation-content"></div>',
            {
                defaultHeight: this.config.DEFAULT_FENCE_HEIGHT,
                backgroundColor: this.config.DEFAULT_FENCE_BACKGROUND_COLOR
            },
            this.lazyLoad,
            this.create,
        );
    }

    create = ($wrap, content) => {
        const visualOptions = Object.assign({}, this.config.VISUAL_OPTIONS); // set prototype
        this.ABCJS.renderAbc($wrap[0], content, visualOptions);
    }

    lazyLoad = () => this.ABCJS = this.ABCJS || this.utils.requireFilePath("./plugin/custom/plugins/abc/abcjs-basic-min.js");
}

module.exports = {
    plugin: abcPlugin
};