/**
 * Dynamically register and unregister third-party code block diagram (derived from DiagramParser).
 */
class ThirdPartyDiagramParser {
    constructor(utils) {
        this.utils = utils
        this.parsers = new Map()
        this.defaultHeight = "230px"
        this.defaultBackgroundColor = "#F8F8F8"
        this.regexp = /^\/\/{height:"(?<height>.*?)",width:"(?<width>.*?)"}/
    }

    /**
     * @param {string} lang: Language.
     * @param {string} mappingLang: Language to map to.
     * @param {boolean} destroyWhenUpdate: Whether to clear the HTML in the preview before updating.
     * @param {boolean} interactiveMode: When in interactive mode, code blocks will not automatically expand.
     * @param {string} checkSelector: Selector to check if the target Element exists under the current fence.
     * @param {string|function($pre):string} wrapElement: If the target Element does not exist, create it.
     * @param {function(): Promise<null>} lazyLoadFunc: Lazy load third-party resources.
     * @param {function(cid, content, $pre)} beforeRenderFunc: Execute before rendering.
     * @param {function(cid, content, $pre, meta)} setStyleFunc: Set styles.
     * @param {function($wrap, string, meta): instance} createFunc: Create a diagram instance, passing in the target Element and the content of the fence.
     * @param {function($wrap, string, instance, meta): instance} updateFunc: Update the diagram instance when the content is updated.
     * @param {function(Object): null} destroyFunc: Destroy the diagram instance, passing in the diagram instance.
     * @param {function(Element, instance): null} beforeExportToNative: Preparation operations before Pandoc export (e.g., adjusting diagram size, color, etc.).
     * @param {function(Element, instance): null} beforeExportToHTML: Preparation operations before HTML export (e.g., adjusting diagram size, color, etc.).
     * @param {function(): string} extraStyleGetter: Get extra CSS for export.
     * @param {function(): string} versionGetter: Get the version.
     */
    register = ({
                    lang, mappingLang = "", destroyWhenUpdate, interactiveMode = true, checkSelector,
                    wrapElement, lazyLoadFunc, beforeRenderFunc, setStyleFunc, createFunc,
                    updateFunc, destroyFunc, beforeExportToNative, beforeExportToHTML, extraStyleGetter,
                    versionGetter,
                }) => {
        lang = lang.toLowerCase()
        lazyLoadFunc = this.utils.once(lazyLoadFunc)
        const settingMsg = null
        this.parsers.set(lang, {
            lang, mappingLang, destroyWhenUpdate, interactiveMode, settingMsg,
            checkSelector, wrapElement, lazyLoadFunc, beforeRenderFunc, setStyleFunc,
            createFunc, updateFunc, destroyFunc, beforeExportToNative, beforeExportToHTML,
            versionGetter, instanceMap: new Map(),
        })
        this.utils.diagramParser.register({
            lang, mappingLang, destroyWhenUpdate, extraStyleGetter, interactiveMode,
            renderFunc: this.render, cancelFunc: this.cancel, destroyAllFunc: this.destroyAll,
        })
    }

    unregister = lang => {
        this.parsers.delete(lang)
        this.utils.diagramParser.unregister(lang)
    }

    render = async (cid, content, $pre, lang) => {
        const parser = this.parsers.get(lang)
        if (!parser) return

        await parser.lazyLoadFunc()
        const $wrap = this.getWrap(parser, $pre)
        try {
            const meta = typeof parser.beforeRenderFunc === "function"
                ? parser.beforeRenderFunc(cid, content, $pre)
                : undefined
            if (typeof parser.setStyleFunc === "function") {
                parser.setStyleFunc($pre, $wrap, content, meta)
            }
            let instance = this.createOrUpdate(parser, cid, content, $wrap, lang, meta)
            // Q: Why not use `await this.createOrUpdate` instead of `isPromise`?
            // A: Some parsers' createFunc might preempt the element, causing a race condition if await is used.
            if (this.utils.isPromise(instance)) {
                instance = await instance
            }
            if (instance) {
                parser.instanceMap.set(cid, instance)
            }
        } catch (e) {
            const reason = `${e.stack}\n\nDiagram Parser Settings:\n${this.getSettingMsg(parser)}`
            this.utils.diagramParser.throwParseError(null, reason)
        }
    }

    createOrUpdate = (parser, cid, content, $wrap, lang, meta) => {
        const oldInstance = parser.instanceMap.get(cid)
        if (oldInstance && parser.updateFunc) {
            const newInstance = parser.updateFunc($wrap, content, oldInstance, meta)
            return newInstance || oldInstance
        } else {
            if (oldInstance) {
                this.cancel(cid, lang)
            }
            return parser.createFunc($wrap, content, meta)
        }
    }

    getSettingMsg = parser => {
        if (!parser.settingMsg) {
            const settings = {
                language: parser.lang,
                mappingLanguage: parser.mappingLang,
                diagramVersion: parser.versionGetter?.() || "Unknown",
                interactiveMode: parser.interactiveMode,
                destroyWhenUpdate: parser.destroyWhenUpdate,
                containerElement: parser.wrapElement,
            }
            parser.settingMsg = Object.entries(settings).map(([k, v]) => `    ${k}: ${v}`).join("\n")
        }
        return parser.settingMsg
    }

    getWrap = (parser, $pre) => {
        let $wrap = $pre.find(parser.checkSelector)
        if ($wrap.length === 0) {
            const wrap = typeof parser.wrapElement === "function"
                ? parser.wrapElement($pre)
                : parser.wrapElement
            $wrap = $(wrap)
            $pre.find(".md-diagram-panel-preview").html($wrap)
        }
        return $wrap
    }

    cancel = (cid, lang) => {
        const parser = this.parsers.get(lang)
        if (!parser) return
        const instance = parser.instanceMap.get(cid)
        if (!instance) return
        parser.destroyFunc?.(instance)
        parser.instanceMap.delete(cid)
    }

    destroyAll = () => {
        for (const parser of this.parsers.values()) {
            for (const instance of parser.instanceMap.values()) {
                parser.destroyFunc?.(instance)
            }
            parser.instanceMap.clear()
        }
    }

    getFenceUserSize = content => {
        const lines = content.split("\n").map(line => line.trim()).filter(line => line.startsWith("//"))
        for (let line of lines) {
            line = line.replace(/\s/g, "").replace(/['`]/g, `"`)
            const { groups } = line.match(this.regexp) || {}
            if (groups) {
                return { height: groups.height, width: groups.width }
            }
        }
        return { height: "", width: "" }
    }

    applyFenceStyles = ($pre, $wrap, userSize = {}, defaultCss = {}) => {
        const { height: customH, width: customW, "background-color": customBackgroundColor, ...rest } = defaultCss
        $wrap.css({
            width: userSize.width || customW || parseFloat($pre.find(".md-diagram-panel").css("width")) - 10 + "px",
            height: userSize.height || customH || this.defaultHeight,
            "background-color": customBackgroundColor || this.defaultBackgroundColor,
            ...rest,
        })
    }

    STYLE_SETTER = css => {
        return ($pre, $wrap, content) => {
            const userSize = this.getFenceUserSize(content)
            const defaultCss = (typeof css === "function") ? css($pre, $wrap, content) : css
            this.applyFenceStyles($pre, $wrap, userSize, defaultCss)
        }
    }
    STYLE_SETTER_SIMPLE = css => {
        return ($pre, $wrap, content) => this.applyFenceStyles($pre, $wrap, {}, css)
    }

    SVG_PRINT_STYLE_FIXER = (lang, selector) => () => `
        @media print {
            .md-diagram-panel[lang="${lang}"] ${selector} {
                max-width: 100% !important;
                width: 100% !important;
                overflow: visible !important; 
            }
            .md-diagram-panel[lang="${lang}"] svg {
                width: 100% !important;
                max-width: 100% !important;
                height: auto !important;
            }
        }`

    process = () => {
        const getLifeCycleFn = (fnName) => () => {
            for (const parser of this.parsers.values()) {
                if (!parser[fnName]) continue
                parser.instanceMap.forEach((instance, cid) => {
                    const preview = this.utils.entities.querySelectorInWrite(`.md-fences[cid=${cid}] .md-diagram-panel-preview`)
                    if (preview) {
                        parser[fnName](preview, instance)
                    }
                })
            }
        }
        this.utils.exportHelper.register("third-party-diagram-parser", getLifeCycleFn("beforeExportToHTML"))
        this.utils.exportHelper.registerNative("third-party-diagram-parser", getLifeCycleFn("beforeExportToNative"))
    }
}

module.exports = ThirdPartyDiagramParser
