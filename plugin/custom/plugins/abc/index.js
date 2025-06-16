class abcPlugin extends BaseCustomPlugin {
    init = () => this.ABCJS = null

    callback = anchorNode => this.utils.insertText(anchorNode, this.config.TEMPLATE)

    process = () => {
        const parser = this.utils.thirdPartyDiagramParser
        parser.register({
            lang: this.config.LANGUAGE,
            mappingLang: this.config.LANGUAGE,
            destroyWhenUpdate: false,
            interactiveMode: this.config.INTERACTIVE_MODE,
            checkSelector: ".plugin-notation-content",
            wrapElement: '<div class="plugin-notation-content"></div>',
            lazyLoadFunc: this.lazyLoad,
            beforeRenderFunc: null,
            setStyleFunc: parser.STYLE_SETTER_SIMPLE({
                height: this.config.DEFAULT_FENCE_HEIGHT,
                "background-color": this.config.DEFAULT_FENCE_BACKGROUND_COLOR
            }),
            createFunc: this.create,
            updateFunc: null,
            destroyFunc: null,
            beforeExportToNative: null,
            beforeExportToHTML: null,
            extraStyleGetter: null,
            versionGetter: this.getVersion,
        })
    }

    create = ($wrap, content) => {
        this.ABCJS.renderAbc($wrap[0], content, this.config.VISUAL_OPTIONS)
    }

    getVersion = () => this.ABCJS && this.ABCJS.signature

    lazyLoad = () => this.ABCJS = require("./abcjs-basic-min.js")
}

module.exports = {
    plugin: abcPlugin
}