class echartsPlugin extends BaseCustomPlugin {
    init = () => {
        this.map = {} // {cid: instance}
        this.FenceContent = "";
    }

    callback = anchorNode => this.utils.insertFence(anchorNode, this.config.TEMPLATE)

    process = () => {
        this.utils.registerDiagramParser("echarts", this.render, this.cancel, false);
        this.utils.decorateOpenFile(null, this.destroyAll);
    }

    render = async (cid, lang, content, $pre) => await this.draw(cid, $pre, content);
    cancel = cid => {
        const instance = this.map[cid];
        if (instance) {
            instance.dispose();
            delete this.map[cid];
        }
    }
    destroyAll = () => {
        for (let cid of Object.keys(this.map)) {
            this.map[cid].dispose();
        }
        this.map = {};
    }

    draw = async (cid, $pre, content) => {
        await this.lazyLoad();
        const $div = this.getDiv($pre);
        try {
            this.setStyle($pre, $div, content);
            if (this.map.hasOwnProperty(cid)) {
                this.update(cid, content);
            } else {
                this.create(cid, $div, content);
            }
        } catch (e) {
            this.utils.throwParseError(null, e.toString());
            // console.error(e);
        }
    }

    getUserSize = content => {
        let height = "";
        let width = "";
        const lines = content.split("\n").map(line => line.trim()).filter(line => line.startsWith("//"));
        for (let line of lines) {
            line = line.replace(/\s/g, "").replace(`'`, `"`).replace("`", '"');
            const result = line.match(/^\/\/{height:"(?<height>.*?)",width:"(?<width>.*?)"}/);
            if (result && result.groups) {
                height = height || result.groups["height"];
                width = width || result.groups["width"];
            }
            if (height && width) break
        }
        return {height, width}
    }

    setStyle = ($pre, $div, content) => {
        const {height, width} = this.getUserSize(content);
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

    update = (cid, content) => {
        const chart = this.map[cid];
        this.drawChart(chart, content, true);
    }

    create = (cid, $div, content) => {
        const chart = echarts.init($div[0]);
        this.drawChart(chart, content);
        this.map[cid] = chart;
    }

    drawChart = (chart, content, resize = false) => {
        // chart.showLoading();
        eval(`this.FenceContent = ${content}`);
        chart.clear();
        chart.setOption(this.FenceContent);
        if (resize) {
            chart.resize();
        }
        // chart.hideLoading();
    }

    lazyLoad = async () => (!global.echarts) && await this.utils.insertScript("./plugin/custom/plugins/echarts/echarts.min.js");
}

module.exports = {
    plugin: echartsPlugin
};