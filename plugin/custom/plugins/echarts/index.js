class EchartsPlugin extends BaseCustomPlugin {
    init = () => this.echartsPkg = null

    callback = anchorNode => this.utils.insertText(anchorNode, this.config.TEMPLATE)

    process = () => {
        const parser = this.utils.thirdPartyDiagramParser
        parser.register({
            lang: this.config.LANGUAGE,
            mappingLang: "javascript",
            destroyWhenUpdate: false,
            interactiveMode: this.config.INTERACTIVE_MODE,
            checkSelector: ".plugin-echarts-content",
            wrapElement: '<div class="plugin-echarts-content"></div>',
            lazyLoadFunc: this.lazyLoad,
            beforeRenderFunc: null,
            setStyleFunc: parser.STYLE_SETTER({
                height: this.config.DEFAULT_FENCE_HEIGHT,
                "background-color": this.config.DEFAULT_FENCE_BACKGROUND_COLOR
            }),
            createFunc: this.create,
            updateFunc: null,
            destroyFunc: this.destroy,
            beforeExportToNative: null,
            beforeExportToHTML: this.beforeExportToHTML,
            extraStyleGetter: null,
            versionGetter: this.getVersion,
        })
    }

    create = ($wrap, content) => {
        const myChart = this.echartsPkg.init($wrap[0], null, { renderer: this.config.RENDERER })
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
