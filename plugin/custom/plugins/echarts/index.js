class echartsPlugin extends BaseCustomPlugin {
    init = () => {
        this.echartsPkg = null;
        this.exportType = this.config.EXPORT_TYPE.toLowerCase();
    }

    callback = anchorNode => this.utils.insertText(anchorNode, this.config.TEMPLATE)

    process = () => {
        this.utils.registerThirdPartyDiagramParser({
            lang: this.config.LANGUAGE,
            mappingLang: "javascript",
            destroyWhenUpdate: false,
            interactiveMode: this.config.INTERACTIVE_MODE,
            checkSelector: ".plugin-echarts-content",
            wrapElement: '<div class="plugin-echarts-content"></div>',
            css: {
                height: this.config.DEFAULT_FENCE_HEIGHT,
                "background-color": this.config.DEFAULT_FENCE_BACKGROUND_COLOR
            },
            lazyLoadFunc: this.lazyLoad,
            createFunc: this.create,
            destroyFunc: this.destroy,
            beforeExport: this.beforeExport,
            extraStyleGetter: null,
        })
    }

    create = ($wrap, content) => {
        const chart = this.echartsPkg.init($wrap[0], null, {renderer: this.config.RENDERER});
        this.drawChart(chart, content);
        return chart;
    }

    drawChart = (myChart, content, resize = false) => {
        // chart.showLoading();
        let echarts = this.echartsPkg;
        let option = "";
        eval(content);
        myChart.clear();
        myChart.setOption(option);
        if (resize) {
            myChart.resize();
        }
        // chart.hideLoading();
    }

    destroy = instance => {
        instance.clear();
        instance.dispose();
    }

    beforeExport = (preview, instance) => {
        instance.setOption({animation: false});
        if (this.exportType === "png" || this.exportType === "jpg") {
            const img = new Image();
            img.src = instance.getDataURL({type: this.exportType});
            $(preview).html(img);
        } else if (this.exportType === "svg") {
            const svg = instance.renderToSVGString();
            $(preview).html(svg);
        }
    }

    lazyLoad = () => this.echartsPkg = this.echartsPkg || this.utils.requireFilePath("./plugin/custom/plugins/echarts/echarts.min.js");
}

module.exports = {
    plugin: echartsPlugin
};