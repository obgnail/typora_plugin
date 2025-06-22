class fenceMarkmap {
    constructor(plugin) {
        this.plugin = plugin
        this.utils = plugin.utils
        this.config = plugin.config
        this.Lib = plugin.Lib
    }

    hotkey = () => [{ hotkey: this.config.FENCE_HOTKEY, callback: this.callback }]

    process = () => {
        this.utils.thirdPartyDiagramParser.register({
            lang: this.config.FENCE_LANGUAGE,
            mappingLang: "markdown",
            destroyWhenUpdate: false,
            interactiveMode: this.config.INTERACTIVE_MODE,
            checkSelector: ".plugin-fence-markmap-svg",
            wrapElement: '<svg class="plugin-fence-markmap-svg"></svg>',
            lazyLoadFunc: this.plugin.lazyLoad,
            beforeRenderFunc: this.beforeRender,
            setStyleFunc: this.setStyle,
            createFunc: this.create,
            updateFunc: this.update,
            destroyFunc: this.destroy,
            beforeExportToNative: null,
            beforeExportToHTML: null,
            extraStyleGetter: null,
            versionGetter: this.getVersion,
        })
    }

    callback = type => {
        const empty = "# empty"
        const backQuote = "```"
        const frontMatter = `---\nmarkmap:\n  height: 300px\n  backgroundColor: "#f8f8f8"\n---\n\n`
        const fence = type === "draw_fence_template"
            ? this.config.FENCE_TEMPLATE
            : `${backQuote}${this.config.FENCE_LANGUAGE}\n${frontMatter}${this.plugin.getToc() || empty}\n${backQuote}`
        this.utils.insertText(null, fence)
    }

    // Get options in fence front-matter
    beforeRender = (cid, content) => {
        const defaultOptions = this.config.DEFAULT_FENCE_OPTIONS || {}
        const { yamlObject } = this.utils.splitFrontMatter(content)
        if (!yamlObject) {
            return defaultOptions
        }
        const fenceOptions = yamlObject.markmap ? yamlObject.markmap : yamlObject
        return { ...defaultOptions, ...fenceOptions }
    }

    setStyle = ($pre, $wrap, content, options) => {
        const panelWidth = $pre.find(".md-diagram-panel").css("width")
        $wrap.css({
            width: parseFloat(panelWidth) - 10 + "px",
            height: options.height || this.config.DEFAULT_FENCE_HEIGHT,
            "background-color": options.backgroundColor || this.config.DEFAULT_FENCE_BACKGROUND_COLOR,
        })
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
}

module.exports = {
    fenceMarkmap
}
