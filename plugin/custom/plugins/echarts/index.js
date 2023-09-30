class echartsPlugin extends BaseCustomPlugin {
    init = () => {
        this.lang = "echarts";
        this.map = {} // {cid: instance}
    }

    callback = anchorNode => this.utils.insertFence(anchorNode, this.config.TEMPLATE)

    process = () => {
        this.utils.registerDiagramParser(this.lang, false, this.render, this.cancel, this.destroyAll, null, this.config.INTERACTIVE_MODE);
        this.utils.registerExportHelper(this.lang, this.beforeExport, this.afterExport);
    }

    render = async (cid, content, $pre) => {
        await this.lazyLoad();
        const $div = this.getDiv($pre);
        try {
            this.setStyle($pre, $div, content);
            if (this.map.hasOwnProperty(cid)) {
                // 因为可能这个echarts有onClick等事件，不能update，只能destroy掉
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
            instance.dispose();
            delete this.map[cid];
        }
    }
    destroyAll = () => {
        for (const cid of Object.keys(this.map)) {
            this.map[cid].clear();
            this.map[cid].dispose();
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
        let $div = $pre.find(".plugin-echarts-content");
        if ($div.length === 0) {
            $div = $(`<div class="plugin-echarts-content"></div>`);
        }
        $pre.find(".md-diagram-panel-preview").html($div);
        return $div
    }

    create = (cid, $div, content) => {
        const chart = echarts.init($div[0], null, {renderer: this.config.RENDERER});
        this.drawChart(chart, content);
        this.map[cid] = chart;
    }

    drawChart = (myChart, content, resize = false) => {
        // chart.showLoading();
        let echarts = global.echarts;
        let option = "";
        eval(content);
        myChart.clear();
        myChart.setOption(option);
        if (resize) {
            myChart.resize();
        }
        // chart.hideLoading();
    }

    beforeExport = () => {
        const type = this.config.EXPORT_TYPE.toLowerCase();
        for (const cid of Object.keys(this.map)) {
            const instance = this.map[cid];
            instance.setOption({aniamtion: false});

            const preview = document.querySelector(`#write .md-fences[cid=${cid}] .md-diagram-panel-preview`);
            if (!preview) continue
            if (type === "png" || type === "jpg") {
                const img = new Image();
                img.src = instance.getDataURL({type: this.config.EXPORT_TYPE});
                $(preview).html(img);
            } else if (type === "svg") {
                const svg = instance.renderToSVGString();
                $(preview).html(svg);
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

    lazyLoad = async () => (!global.echarts) && await this.utils.insertScript("./plugin/custom/plugins/echarts/echarts.min.js");
}

module.exports = {
    plugin: echartsPlugin
};