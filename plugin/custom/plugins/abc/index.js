class abcPlugin extends BaseCustomPlugin {
    init = () => this.ABCJS = null;

    callback = anchorNode => this.utils.insertText(anchorNode, this.config.TEMPLATE);

    process = () => {
        this.utils.registerThirdPartyDiagramParser({
            lang: this.config.LANGUAGE,
            mappingLang: this.config.LANGUAGE,
            destroyWhenUpdate: false,
            interactiveMode: this.config.INTERACTIVE_MODE,
            checkSelector: ".plugin-notation-content",
            wrapElement: '<div class="plugin-notation-content"></div>',
            extraCss: {
                defaultHeight: this.config.DEFAULT_FENCE_HEIGHT,
                backgroundColor: this.config.DEFAULT_FENCE_BACKGROUND_COLOR
            },
            lazyLoadFunc: this.lazyLoad,
            createFunc: this.create,
            destroyFunc: null,
            beforeExport: null,
            extraStyleGetter: null,
        })
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