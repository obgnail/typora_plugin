class chartPlugin extends BaseCustomPlugin {
    init = () => this.ChartPkg = null;

    callback = anchorNode => this.utils.insertText(anchorNode, this.config.TEMPLATE)

    process = () => {
        this.utils.thirdPartyDiagramParser.register({
            lang: this.config.LANGUAGE,
            mappingLang: "javascript",
            destroyWhenUpdate: false,
            interactiveMode: this.config.INTERACTIVE_MODE,
            checkSelector: ".plugin-chart-content",
            wrapElement: '<div class="plugin-chart-content"><canvas></canvas></div>',
            css: {
                height: this.config.DEFAULT_FENCE_HEIGHT,
                "background-color": this.config.DEFAULT_FENCE_BACKGROUND_COLOR
            },
            lazyLoadFunc: this.lazyLoad,
            createFunc: this.create,
            destroyFunc: this.destroy,
            beforeExport: this.beforeExport,
            extraStyleGetter: null,
            versionGetter: this.versionGetter,
        })
    }

    create = ($wrap, content) => {
        const $canvas = $wrap.find('canvas');
        if ($canvas.length) {
            const ctx = $canvas[0].getContext('2d');
            return this.drawChart(ctx, content);
        }
    }

    drawChart = (ctx, content) => {
        let Chart = this.ChartPkg.Chart;
        let myChart = null;
        let config = "";
        eval(content);
        myChart = new this.ChartPkg.Chart(ctx, config);
        return myChart;
    }

    destroy = instance => {
        instance.clear();
        instance.destroy();
    }

    beforeExport = (preview, instance) => {
        const img = new Image();
        img.src = instance.toBase64Image();
        $(preview).html(img);
    }

    versionGetter = () => this.ChartPkg && this.ChartPkg.version

    lazyLoad = () => this.ChartPkg = require("./chart.min");
}

module.exports = {
    plugin: chartPlugin
};