class chartPlugin extends BaseCustomPlugin {
    init = () => {
        this.lang = "chart";
        this.ChartPkg = null;
        this.map = {} // {cid: instance}
        this.filepath = "";
    }

    callback = anchorNode => this.utils.insertFence(anchorNode, this.config.TEMPLATE)

    process = () => {
        this.utils.registerDiagramParser(this.lang, false, this.render, this.cancel, null, this.config.INTERACTIVE_MODE);
        this.utils.addEventListener(this.utils.eventType.beforeFileOpen, () => this.filepath = this.utils.getFilePath());
        this.utils.addEventListener(this.utils.eventType.fileOpened, this.destroyAll);
        this.utils.registerExportHelper(this.lang, this.beforeExport, this.afterExport);
    }

    render = async (cid, content, $pre) => {
        this.lazyLoad();
        const $div = this.getDiv($pre);
        try {
            this.setStyle($pre, $div, content);
            if (this.map.hasOwnProperty(cid)) {
                await this.cancel(cid);
            }
            this.create(cid, $div, content);
        } catch (e) {
            this.utils.throwParseError(null, e.toString());
            // console.error(e);
        }
    }

    cancel = async cid => {
        const instance = this.map[cid];
        if (instance) {
            instance.clear();
            instance.destroy();
            delete this.map[cid];
        }
    }

    destroyAll = filepath => {
        if (this.filepath === filepath) return;

        for (const cid of Object.keys(this.map)) {
            this.map[cid].clear();
            this.map[cid].destroy();
            delete this.map[cid];
        }
        this.map = {};
    }

    setStyle = ($pre, $div, content) => {
        const {height, width} = this.utils.getFenceUserSize(content);
        $div.css({
            "width": width || parseInt($pre.find(".md-diagram-panel").css("width").replace("px", "")) - 10 + "px",
            "height": height || this.config.DEFAULT_FENCE_HEIGHT,
            "background-color": this.config.DEFAULT_FENCE_BACKGROUND_COLOR,
        });
    }

    getDiv = $pre => {
        let $div = $pre.find(".plugin-chart-content");
        if ($div.length === 0) {
            $div = $(`<div class="plugin-chart-content"><canvas></canvas></div>`);
        }
        $pre.find(".md-diagram-panel-preview").html($div);
        return $div
    }

    create = (cid, $div, content) => {
        const $canvas = $div.find('canvas');
        if ($canvas.length) {
            const ctx = $canvas[0].getContext('2d');
            this.map[cid] = this.drawChart(ctx, content);
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

    beforeExport = () => {
        for (const cid of Object.keys(this.map)) {
            const instance = this.map[cid];
            const preview = document.querySelector(`#write .md-fences[cid=${cid}] .md-diagram-panel-preview`);
            if (preview) {
                const img = new Image();
                img.src = instance.toBase64Image();
                $(preview).html(img);
            }
        }
    }

    afterExport = () => {
        setTimeout(() => {
            document.querySelectorAll(`#write .md-fences[lang="${this.lang}"]`).forEach(ele => {
                const cid = ele.getAttribute("cid");
                cid && File.editor.diagrams.updateDiagram(cid);
            })
        }, 300)
    }

    lazyLoad = () => this.ChartPkg = this.ChartPkg || this.utils.requireFilePath("./plugin/custom/plugins/chart/chart.min.js");
}

module.exports = {
    plugin: chartPlugin
};