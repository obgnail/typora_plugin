class echartsPlugin extends BaseCustomPlugin {
    init = () => {
        this.echartsPkg = null;
        this.exportType = this.config.EXPORT_TYPE.toLowerCase();
    }

    callback = anchorNode => this.utils.insertText(anchorNode, this.config.TEMPLATE)

    process = () => {
        this.utils.thirdPartyDiagramParser.register({
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
            updateFunc: null,
            destroyFunc: this.destroy,
            beforeExport: this.beforeExport,
            extraStyleGetter: null,
            versionGetter: this.versionGetter,
        })
    }

    create = ($wrap, content) => {
        const myChart = this.echartsPkg.init($wrap[0], null, { renderer: this.config.RENDERER });
        this.drawChart(myChart, content);
        return myChart;
    }

    drawChart = (myChart, content, resize = false) => {
        // chart.showLoading();
        let echarts = this.echartsPkg;
        let option = {};
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
        instance.setOption({ animation: false });
        if (this.exportType === "png" || this.exportType === "jpg") {
            const img = new Image();
            img.src = instance.getDataURL({ type: this.exportType });
            $(preview).html(img);
        } else if (this.exportType === "svg") {
            const svg = instance.renderToSVGString();
            $(preview).html(svg);
        }
    }

    versionGetter = () => this.echartsPkg && this.echartsPkg.version

    lazyLoad = () => this.echartsPkg = require("./echarts.min");
}

module.exports = {
    plugin: echartsPlugin
};