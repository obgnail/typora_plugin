class ABCPlugin extends BasePlugin {
    init = () => this.ABCJS = null

    call = () => this.utils.insertBlockCode(null, this.config.LANGUAGE, this.config.TEMPLATE)

    process = () => {
        const parser = this.utils.thirdPartyDiagramParser
        parser.register({
            lang: this.config.LANGUAGE,
            mappingLang: this.config.LANGUAGE,
            destroyWhenUpdate: false,
            interactiveMode: this.config.INTERACTIVE_MODE,
            metaConfigSchema: null,
            checkSelector: ".plugin-notation-content",
            wrapElement: '<div class="plugin-notation-content"></div>',
            lazyLoadFunc: this.lazyLoad,
            beforeRenderFunc: null,
            renderStyleGetter: parser.helpers.getRenderStyle({
                height: this.config.DEFAULT_FENCE_HEIGHT,
                backgroundColor: this.config.DEFAULT_FENCE_BACKGROUND_COLOR,
            }),
            createFunc: this.create,
            updateFunc: null,
            destroyFunc: null,
            beforeExportToNative: null,
            beforeExportToHTML: null,
            exportStyleGetter: null,
            versionGetter: this.getVersion,
        })
    }

    create = ($wrap, content) => {
        this.ABCJS.renderAbc($wrap[0], content, this.config.VISUAL_OPTIONS)
    }

    getVersion = () => this.ABCJS?.signature

    lazyLoad = () => this.ABCJS = require("./abcjs-basic-min.js")
}

module.exports = {
    plugin: ABCPlugin
}
