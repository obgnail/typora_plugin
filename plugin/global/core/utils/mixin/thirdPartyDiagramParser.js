/**
 * 动态注册、动态注销第三方代码块图表语法(派生自DiagramParser)
 */
class thirdPartyDiagramParser {
    constructor(utils) {
        this.utils = utils;
        this.parsers = new Map();
        this.defaultHeight = "230px";
        this.defaultBackgroundColor = "#F8F8F8";
        this.regexp = /^\/\/{height:"(?<height>.*?)",width:"(?<width>.*?)"}/;
        this.getPanelWidth = this.utils.cache($pre => parseFloat($pre.find(".md-diagram-panel").css("width")) - 10 + "px");
    }

    /**
     * f**k，js不支持interface，只能将接口函数作为参数传入，整整14个参数，一坨狗屎
     * @param {string} lang: 语言
     * @param {string} mappingLang: 映射到哪个语言
     * @param {boolean} destroyWhenUpdate: 更新前是否清空preview里的html
     * @param {boolean} interactiveMode: 交互模式下，不会自动展开代码块
     * @param {string} checkSelector: 检测当前fence下是否含有目标标签
     * @param {string|function($pre):string} wrapElement: 如果不含目标标签，需要创建
     * @param {object|function($pre, $wrap, content): object} css: fence的样式object
     * @param {function(): Promise<null>} lazyLoadFunc: 加载第三方资源
     * @param {function($wrap, string): instance} createFunc: 传入目标标签和fence的内容，生成图形实例
     * @param {function($wrap, string, instance): instance} updateFunc: 当内容更新时，更新图形实例。此选项为空时会直接调用createFunc
     * @param {function(Object): null} destroyFunc: 传入图形实例，destroy图形实例
     * @param {function(Element, instance): null} beforeExport: 导出前的准备操作（比如在导出前调整图形大小、颜色等等）
     * @param {function(): string} extraStyleGetter 用于导出时，新增css
     * @param {function(): string} versionGetter 第三方资源版本
     */
    register = ({
                    lang, mappingLang = "", destroyWhenUpdate, interactiveMode = true, checkSelector,
                    wrapElement, css = {}, lazyLoadFunc, createFunc, updateFunc, destroyFunc,
                    beforeExport, extraStyleGetter, versionGetter
                }) => {
        lang = lang.toLowerCase();
        lazyLoadFunc = this.utils.once(lazyLoadFunc);
        const settingMsg = null;
        this.parsers.set(lang, {
            lang, mappingLang, destroyWhenUpdate, interactiveMode, settingMsg,
            checkSelector, wrapElement, css, lazyLoadFunc, createFunc, updateFunc, destroyFunc,
            beforeExport, versionGetter, instanceMap: new Map(),
        });
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
            const instance = this.createOrUpdate(parser, cid, content, $wrap, lang);
            instance && parser.instanceMap.set(cid, instance);
        } catch (e) {
            e.stack += this.getSettingMsg(parser);
            this.utils.diagramParser.throwParseError(null, e);
        }
    }

    createOrUpdate = (parser, cid, content, $wrap, lang) => {
        const oldInstance = parser.instanceMap.get(cid);
        if (oldInstance && parser.updateFunc) {
            const newInstance = parser.updateFunc($wrap, content, oldInstance);
            return newInstance || oldInstance
        } else {
            oldInstance && this.cancel(cid, lang);
            return parser.createFunc($wrap, content);
        }
    }

    getSettingMsg = parser => {
        if (!parser.settingMsg) {
            const settings = {
                "diagram version": (parser.versionGetter && parser.versionGetter()) || "unknown",
                "mapping language": parser.mappingLang,
                "interactive mode": parser.interactiveMode,
                "destroy when update": parser.destroyWhenUpdate,
                "render element": parser.wrapElement,
            }
            const list = Object.entries(settings).map(([k, v]) => `    ${k}: ${v}`);
            parser.settingMsg = `\n\ndiagram parser settings:\n${list.join("\n")}`;
        }
        return parser.settingMsg;
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

    getFenceUserSize = content => {
        const lines = content.split("\n").map(line => line.trim()).filter(line => line.startsWith("//"));
        for (let line of lines) {
            line = line.replace(/\s/g, "").replace(/['`]/g, `"`);
            const { groups } = line.match(this.regexp) || {};
            if (groups) {
                return { height: groups.height, width: groups.width };
            }
        }
        return { height: "", width: "" };
    }

    renderAllLangFence = lang => {
        document.querySelectorAll(`#write .md-fences[lang=${lang}]`).forEach(fence => {
            const codeMirror = fence.querySelector(":scope > .CodeMirror");
            if (!codeMirror) {
                const cid = fence.getAttribute("cid");
                cid && File.editor.fences.addCodeBlock(cid);
            }
        })
    }

    refreshAllLangFence = lang => {
        document.querySelectorAll(`#write .md-fences[lang="${lang}"]`).forEach(fence => {
            const cid = fence.getAttribute("cid");
            cid && File.editor.diagrams.updateDiagram(cid);
        })
    }

    setStyle = (parser, $pre, $wrap, content) => {
        const { height, width } = this.getFenceUserSize(content);
        const customCss = parser.css instanceof Function ? parser.css($pre, $wrap, content) : parser.css;
        const { height: h, width: w, "background-color": bgc, ...args } = customCss || {};
        $wrap.css({
            width: width || w || this.getPanelWidth($pre),
            height: height || h || this.defaultHeight,
            "background-color": bgc || this.defaultBackgroundColor,
            ...args,
        });
    }

    cancel = (cid, lang) => {
        const parser = this.parsers.get(lang);
        if (!parser) return;
        const instance = parser.instanceMap.get(cid);
        if (!instance) return;
        parser.destroyFunc && parser.destroyFunc(instance);
        parser.instanceMap.delete(cid);
    }

    destroyAll = () => {
        for (const parser of this.parsers.values()) {
            for (const instance of parser.instanceMap.values()) {
                parser.destroyFunc && parser.destroyFunc(instance);
            }
            parser.instanceMap.clear();
        }
    }

    beforeExport = () => {
        for (const [lang, parser] of this.parsers.entries()) {
            if (!parser.beforeExport) continue;
            this.renderAllLangFence(lang);
            parser.instanceMap.forEach((instance, cid) => {
                const preview = this.utils.entities.querySelectorInWrite(`.md-fences[cid=${cid}] .md-diagram-panel-preview`);
                preview && parser.beforeExport(preview, instance);
            })
        }
    }

    afterExport = () => {
        setTimeout(() => {
            for (const lang of this.parsers.keys()) {
                this.refreshAllLangFence(lang);
            }
        }, 300)
    }

    process = () => this.utils.exportHelper.register("third-party-diagram-parser", this.beforeExport, this.afterExport);
}

module.exports = {
    thirdPartyDiagramParser
}
