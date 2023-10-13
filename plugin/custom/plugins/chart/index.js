class chartPlugin extends BaseCustomPlugin {
    init = () => {
        this.ChartPkg = null;
    }

    callback = anchorNode => this.utils.insertText(anchorNode, this.config.TEMPLATE)

    process = () => {
        this.utils.registerThirdPartyDiagramParser(
            this.config.LANGUAGE,
            false,
            this.config.INTERACTIVE_MODE,
            ".plugin-chart-content",
            '<div class="plugin-chart-content"><canvas></canvas></div>',
            {
                defaultHeight: this.config.DEFAULT_FENCE_HEIGHT,
                backgroundColor: this.config.DEFAULT_FENCE_BACKGROUND_COLOR
            },
            this.lazyLoad,
            this.create,
            this.destroy,
            this.beforeExport,
        );
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

    lazyLoad = () => this.ChartPkg = this.ChartPkg || this.utils.requireFilePath("./plugin/custom/plugins/chart/chart.min.js");
}

module.exports = {
    plugin: chartPlugin
};