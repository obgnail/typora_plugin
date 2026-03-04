class FenceMarkmap {
    constructor(plugin) {
        this.plugin = plugin
        this.utils = plugin.utils
        this.config = plugin.config
        this.Lib = plugin.Lib
    }

    hotkey = () => [{ hotkey: this.config.FENCE_HOTKEY, callback: this.callback }]

    process = () => {
        const parser = this.utils.thirdPartyDiagramParser
        parser.register({
            lang: this.config.FENCE_LANGUAGE,
            mappingLang: "markdown",
            destroyWhenUpdate: false,
            interactiveMode: this.config.INTERACTIVE_MODE,
            metaConfigSchema: null,
            checkSelector: ".plugin-fence-markmap-svg",
            wrapElement: '<svg class="plugin-fence-markmap-svg"></svg>',
            lazyLoadFunc: this.plugin.lazyLoad,
            beforeRenderFunc: this.beforeRender,
            renderStyleGetter: parser.helpers.getRenderStyle({
                height: this.config.DEFAULT_FENCE_HEIGHT,
                backgroundColor: this.config.DEFAULT_FENCE_BACKGROUND_COLOR,
            }),
            createFunc: this.create,
            updateFunc: this.update,
            destroyFunc: this.destroy,
            beforeExportToNative: null,
            beforeExportToHTML: null,
            exportStyleGetter: this.getStyleContent,
            versionGetter: this.getVersion,
        })
    }

    callback = type => {
        const empty = "# empty"
        const frontMatter = `---\nmarkmap:\n  height: 300px\n  backgroundColor: "#f8f8f8"\n---\n`
        const content = type === "draw_fence_template" ? this.config.FENCE_TEMPLATE : `${frontMatter}\n${this.plugin.getToc() || empty}`
        this.utils.insertBlockCode(null, this.config.FENCE_LANGUAGE, content)
    }

    // Get options in fence front-matter
    beforeRender = (cid, content) => {
        const defaultOptions = this.config.DEFAULT_FENCE_OPTIONS || {}
        const { yamlObject } = this.utils.splitFrontMatter(content)
        const fenceOptions = yamlObject?.markmap ?? yamlObject ?? {}
        return { ...defaultOptions, ...fenceOptions }
    }

    create = ($wrap, content, options) => {
        const { root } = this.Lib.transformer.transform(content)
        const _options = this.plugin.assignOptions(options)
        return this.Lib.Markmap.create($wrap[0], _options, root)
    }

    update = async ($wrap, content, instance, options) => {
        const { root } = this.Lib.transformer.transform(content)
        const _options = this.plugin.assignOptions(options, instance.options)
        instance.setData(root, _options)
        await instance.fit()
    }

    destroy = instance => instance.destroy()

    getVersion = () => this.Lib.transformerVersions["markmap-lib"]

    getStyleContent = () => `
        .md-diagram-panel .plugin-fence-markmap-svg { line-height: initial !important; user-select: none; }
        .plugin-fence-markmap-svg table { margin: 0; padding: 0; }
    `
}

module.exports = FenceMarkmap
