class ChartPlugin extends BasePlugin {
    init = () => this.ChartPkg = null

    call = () => this.utils.insertBlockCode(null, this.config.LANGUAGE, this.config.TEMPLATE)

    process = () => {
        const parser = this.utils.thirdPartyDiagramParser
        parser.register({
            lang: this.config.LANGUAGE,
            mappingLang: "javascript",
            destroyWhenUpdate: false,
            interactiveMode: this.config.INTERACTIVE_MODE,
            metaConfigSchema: parser.helpers.META_SCHEMA_JAVASCRIPT,
            checkSelector: ".plugin-chart-content",
            wrapElement: '<div class="plugin-chart-content"><canvas></canvas></div>',
            lazyLoadFunc: this.lazyLoad,
            beforeRenderFunc: null,
            renderStyleGetter: parser.helpers.getRenderStyle({
                height: this.config.DEFAULT_FENCE_HEIGHT,
                backgroundColor: this.config.DEFAULT_FENCE_BACKGROUND_COLOR,
            }),
            createFunc: this.create,
            updateFunc: null,
            destroyFunc: this.destroy,
            beforeExportToNative: null,
            beforeExportToHTML: this.beforeExportToHTML,
            exportStyleGetter: null,
            versionGetter: this.getVersion,
        })
    }

    create = ($wrap, content) => {
        const $canvas = $wrap.find("canvas")
        if ($canvas.length) {
            const ctx = $canvas[0].getContext("2d")
            return this.drawChart(ctx, content)
        }
    }

    destroy = instance => {
        instance.clear()
        instance.destroy()
    }

    drawChart = (ctx, content) => {
        let config = {}
        const Chart = this.ChartPkg.Chart
        eval(content)
        return new Chart(ctx, config)
    }

    beforeExportToHTML = (preview, instance) => {
        const img = new Image()
        img.src = instance.toBase64Image()
        $(preview).html(img)
    }

    getVersion = () => this.ChartPkg?.version

    lazyLoad = () => this.ChartPkg = require("./chart.min.js")
}

module.exports = {
    plugin: ChartPlugin
}
