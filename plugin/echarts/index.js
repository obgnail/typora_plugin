class EchartsPlugin extends BasePlugin {
    init = () => this.echartsPkg = null

    hotkey = () => [{ hotkey: this.config.HOTKEY, callback: this.call }]

    call = () => this.utils.insertBlockCode(null, this.config.LANGUAGE, this.config.TEMPLATE)

    process = () => {
        const parser = this.utils.thirdPartyDiagramParser
        parser.register({
            lang: this.config.LANGUAGE,
            mappingLang: "javascript",
            destroyWhenUpdate: false,
            interactiveMode: this.config.INTERACTIVE_MODE,
            metaConfigSchema: {
                ...parser.helpers.styleMetaConfigSchema.wrapDefaultStyle({
                    height: this.config.DEFAULT_FENCE_HEIGHT,
                    backgroundColor: this.config.DEFAULT_FENCE_BACKGROUND_COLOR,
                }),
                locale: { type: "string", enum: ["en", "zh"], default: this.config.LOCALE },
                theme: { type: "string", enum: ["light", "dark"], default: this.config.THEME },
                renderer: { type: "string", enum: ["svg", "canvas"], default: this.config.RENDERER },
            },
            checkSelector: ".plugin-echarts-content",
            wrapElement: '<div class="plugin-echarts-content"></div>',
            lazyLoadFunc: this.lazyLoad,
            beforeRenderFunc: null,
            renderStyleGetter: parser.helpers.renderStyle.base,
            createFunc: this.create,
            updateFunc: null,
            destroyFunc: this.destroy,
            beforeExportToNative: null,
            beforeExportToHTML: this.beforeExportToHTML,
            exportStyleGetter: null,
            versionGetter: this.getVersion,
        })
    }

    create = ($wrap, content, meta) => {
        const { theme, locale, renderer } = meta
        const myChart = this.echartsPkg.init($wrap[0], theme, { locale, renderer })
        this.drawChart(myChart, content)
        return myChart
    }

    drawChart = (myChart, content, resize = false) => {
        // chart.showLoading()
        let echarts = this.echartsPkg
        let option = {}
        eval(content)
        myChart.clear()
        myChart.setOption(option)
        if (resize) {
            myChart.resize()
        }
        // chart.hideLoading()
    }

    destroy = instance => {
        instance.clear()
        instance.dispose()
    }

    beforeExportToHTML = (preview, instance) => {
        instance.setOption({ animation: false })
        if (this.config.RENDERER.toLowerCase() === "canvas") {
            const t = this.config.EXPORT_TYPE.toLowerCase()
            const type = ["png", "jpg"].includes(t) ? t : "jpg"
            const img = new Image()
            img.src = instance.getDataURL({ type })
            $(preview).html(img)
        } else {
            const svg = instance.renderToSVGString()
            $(preview).html(svg)
        }
    }

    getVersion = () => this.echartsPkg?.version

    lazyLoad = () => this.echartsPkg = require("./echarts.min.js")
}

module.exports = {
    plugin: EchartsPlugin
}
