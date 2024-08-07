class thirdPartyDiagramParser {
    constructor(utils) {
        this.utils = utils;
        this.parsers = new Map();
        this.defaultHeight = "230px";
        this.defaultBackgroundColor = "#F8F8F8";
    }

    /**
     * f**k，js不支持interface，只能将接口函数作为参数传入，整整12个参数，一坨狗屎
     * @param {string} lang: 语言
     * @param {string} mappingLang: 映射到哪个语言
     * @param {boolean} destroyWhenUpdate: 更新前是否清空preview里的html
     * @param {boolean} interactiveMode: 交互模式下，不会自动展开代码块
     * @param {string} checkSelector: 检测当前fence下是否含有目标标签
     * @param {string|function($pre):string} wrapElement: 如果不含目标标签，需要创建
     * @param {{height, "background-color", ...other}} css: 控制fence的样式，要求必须要有高度和背景颜色。这里的obj最终会被执行为$div.css(obj)
     * @param {function(): Promise<null>} lazyLoadFunc: 加载第三方资源
     * @param {function($Element, string): instance} createFunc: 传入目标标签和fence的内容，生成图形实例
     * @param {function(Object): null} destroyFunc: 传入图形实例，destroy图形实例
     * @param {function(Element, instance): null} beforeExport: 导出前的准备操作（比如在导出前调整图形大小、颜色等等）
     * @param {function(): string} extraStyleGetter 用于导出时，新增css
     */
    register = ({ lang, mappingLang, destroyWhenUpdate, interactiveMode, checkSelector, wrapElement, css, lazyLoadFunc, createFunc, destroyFunc, beforeExport, extraStyleGetter }) => {
        const p = { checkSelector, wrapElement, css, lazyLoadFunc, createFunc, destroyFunc, beforeExport, map: {} };
        this.parsers.set(lang.toLowerCase(), p);
        this.utils.diagramParser.register({
            lang, mappingLang, destroyWhenUpdate, extraStyleGetter, interactiveMode,
            renderFunc: this.render, cancelFunc: this.cancel, destroyAllFunc: this.destroyAll,
        });
    }

    unregister = lang => {
        this.parsers.delete(lang);
        this.utils.diagramParser.unregister(lang);
    }

    render = async (cid, content, $pre, lang) => {
        const parser = this.parsers.get(lang);
        if (!parser) return

        await parser.lazyLoadFunc();
        const $wrap = this.getWrap(parser, $pre);
        try {
            this.setStyle(parser, $pre, $wrap, content);
            if (parser.map.hasOwnProperty(cid)) {
                this.cancel(cid, lang);
            }
            const instance = parser.createFunc($wrap, content);
            if (instance) {
                parser.map[cid] = instance;
            }
        } catch (e) {
            this.utils.diagramParser.throwParseError(null, e);
        }
    }

    getWrap = (parser, $pre) => {
        let $wrap = $pre.find(parser.checkSelector);
        if ($wrap.length === 0) {
            const wrap = (parser.wrapElement instanceof Function) ? parser.wrapElement($pre) : parser.wrapElement
            $wrap = $(wrap);
        }
        $pre.find(".md-diagram-panel-preview").html($wrap);
        return $wrap
    }

    setStyle = (parser, $pre, $wrap, content) => {
        const { height, width } = this.utils.getFenceUserSize(content);
        const { height: defaultHeight, "background-color": backgroundColor, ...other } = parser.css || {};
        $wrap.css({
            width: width || parseFloat($pre.find(".md-diagram-panel").css("width")) - 10 + "px",
            height: height || defaultHeight || this.defaultHeight,
            "background-color": backgroundColor || this.defaultBackgroundColor,
            other,
        });
    }

    cancel = (cid, lang) => {
        const parser = this.parsers.get(lang);
        if (!parser) return
        const instance = parser.map[cid];
        if (instance) {
            parser.destroyFunc && parser.destroyFunc(instance);
            delete parser.map[cid];
        }
    }

    destroyAll = () => {
        for (const parser of this.parsers.values()) {
            for (const instance of Object.values(parser.map)) {
                parser.destroyFunc && parser.destroyFunc(instance);
            }
            parser.map = {};
        }
    }

    beforeExport = () => {
        for (const [lang, parser] of this.parsers.entries()) {
            if (!parser.beforeExport) continue;
            this.utils.renderAllLangFence(lang);
            for (const [cid, instance] of Object.entries(parser.map)) {
                const preview = this.utils.entities.querySelectorInWrite(`.md-fences[cid=${cid}] .md-diagram-panel-preview`);
                preview && parser.beforeExport(preview, instance);
            }
        }
    }

    afterExport = () => {
        setTimeout(() => {
            for (const lang of this.parsers.keys()) {
                this.utils.refreshAllLangFence(lang);
            }
        }, 300)
    }

    process = () => this.utils.exportHelper.register("third-party-diagram-parser", this.beforeExport, this.afterExport);
}

module.exports = {
    thirdPartyDiagramParser
}
