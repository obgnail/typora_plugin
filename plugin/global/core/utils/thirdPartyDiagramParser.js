/**
 * Dynamically register and unregister third-party code block diagram (derived from DiagramParser).
 */
class ThirdPartyDiagramParser {
    constructor(utils) {
        this.utils = utils
        this.parsers = new Map()
        this.DEFAYLT_CSS = { width: "100%", height: "230px", backgroundColor: "#F8F8F8" }
        this.createConfigParser = metaConfigParserFactory()
        this.helpers = {
            META_SCHEMA_JAVASCRIPT: {
                width: { type: "string" },
                height: { type: "string" },
                backgroundColor: { type: "string" },
            },
            META_PROPS_STYLE: ["width", "height", "backgroundColor"],
            getFenceWidth: ($pre) => parseFloat($pre.find(".md-diagram-panel").css("width")) - 10 + "px",
            getRenderStyle: (defaultCss) => {
                return ($pre, $wrap, content, meta) => {
                    const metaStyle = this.utils.pick(meta, this.helpers.META_PROPS_STYLE)
                    const extraStyle = metaStyle.width === "auto" ? { width: this.helpers.getFenceWidth($pre) } : {}
                    return { ...defaultCss, ...metaStyle, ...extraStyle }
                }
            },
            getSvgExportStyle: (lang) => {
                const selector = this.parsers.get(lang)?.checkSelector
                return selector
                    ? `@media print {
                        .md-diagram-panel[lang="${lang}"] ${selector} { max-width: 100% !important; width: 100% !important; overflow: visible !important; }
                        .md-diagram-panel[lang="${lang}"] svg { width: 100% !important; max-width: 100% !important; height: auto !important; }
                    }`
                    : ""
            }
        }
    }

    /**
     * @param {string} lang: Language.
     * @param {string} mappingLang: Language to map to.
     * @param {boolean} destroyWhenUpdate: Whether to clear the HTML in the preview before updating.
     * @param {boolean} interactiveMode: When in interactive mode, code blocks will not automatically expand.
     * @param {Object} metaConfigSchema: meta config schema.
     * @param {string} checkSelector: Selector to check if the target Element exists under the current fence.
     * @param {string|function($pre):string} wrapElement: If the target Element does not exist, create it.
     * @param {function(): Promise<null>} lazyLoadFunc: Lazy load third-party resources.
     * @param {function(cid, content, $pre)} beforeRenderFunc: Execute before rendering.
     * @param {function(cid, content, $pre, meta)} renderStyleGetter: Get styles for render.
     * @param {function($wrap, string, meta): instance} createFunc: Create a diagram instance, passing in the target Element and the content of the fence.
     * @param {function($wrap, string, instance, meta): instance} updateFunc: Update the diagram instance when the content is updated.
     * @param {function(Object): null} destroyFunc: Destroy the diagram instance, passing in the diagram instance.
     * @param {function(Element, instance): null} beforeExportToNative: Preparation operations before Pandoc export (e.g., adjusting diagram size, color, etc.).
     * @param {function(Element, instance): null} beforeExportToHTML: Preparation operations before HTML export (e.g., adjusting diagram size, color, etc.).
     * @param {function(lang): string} exportStyleGetter: Get styles for export.
     * @param {function(): string} versionGetter: Get the version.
     */
    register = ({
                    lang, mappingLang = "", destroyWhenUpdate, interactiveMode = true, metaConfigSchema,
                    checkSelector, wrapElement, lazyLoadFunc, beforeRenderFunc, renderStyleGetter, createFunc,
                    updateFunc, destroyFunc, beforeExportToNative, beforeExportToHTML, exportStyleGetter, versionGetter,
                }) => {
        lang = lang.toLowerCase()
        lazyLoadFunc = this.utils.once(lazyLoadFunc)
        const settingMsg = null
        const metaConfigParser = this.createConfigParser(metaConfigSchema)
        this.parsers.set(lang, {
            lang, mappingLang, destroyWhenUpdate, interactiveMode, settingMsg, metaConfigParser,
            checkSelector, wrapElement, lazyLoadFunc, beforeRenderFunc, renderStyleGetter,
            createFunc, updateFunc, destroyFunc, beforeExportToNative, beforeExportToHTML,
            versionGetter, instanceMap: new Map(),
        })
        this.utils.diagramParser.register({
            lang, mappingLang, destroyWhenUpdate, exportStyleGetter, interactiveMode,
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
            const rawMeta = typeof parser.beforeRenderFunc === "function" ? parser.beforeRenderFunc(cid, content, $pre) : {}
            const extractedMeta = typeof parser.metaConfigParser === "function" ? parser.metaConfigParser(content) : {}
            const meta = { ...rawMeta, ...extractedMeta }
            if (typeof parser.renderStyleGetter === "function") {
                const css = parser.renderStyleGetter($pre, $wrap, content, meta)
                this.applyFenceStyles($pre, $wrap, css)
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

    applyFenceStyles = ($pre, $wrap, css) => {
        const { width, height, "background-color": bgc1, backgroundColor: bgc2, ...rest } = css
        $wrap.css({
            width: width || this.DEFAYLT_CSS.width,
            height: height || this.DEFAYLT_CSS.height,
            "background-color": bgc1 || bgc2 || this.DEFAYLT_CSS.backgroundColor,
            ...rest,
        })
    }

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

function metaConfigParserFactory() {
    const BLOCK_REGEX = /^(?:\u00EF\u00BB\u00BF)?\s*\/\/ ==BlockCodeConfig==([\s\S]*?)^\/\/ ==\/BlockCodeConfig==/im
    const KV_REGEX = /^\s*\/\/\s+@([a-zA-Z0-9_\-$]+)(?:\s+(.*))?$/gm
    const TYPE_REGEX = /^([a-z]+)(?:<([a-z]+)>)?$/i

    const fallbackType = { main: "string", item: "string" }

    function castValue(val, type) {
        if (type === "number") {
            const num = Number(val)
            return (val === "" || Number.isNaN(num)) ? val : num
        }
        if (type === "boolean") {
            return val.toLowerCase() !== "false" && val !== "0"
        }
        return val
    }

    function resolveType(schemaDef = {}) {
        const rawType = schemaDef.type || "string"
        const match = String(rawType).trim().match(TYPE_REGEX)
        return match
            ? {
                main: match[1].toLowerCase(),
                item: match[2] ? match[2].toLowerCase() : (schemaDef.items || "string")
            }
            : { main: "string", item: "string" }
    }

    return function createConfigParser(schema = {}) {
        const compiledSchema = Object.create(null)
        for (const [key, def] of Object.entries(schema)) {
            compiledSchema[key] = resolveType(def)
        }
        return function parse(code) {
            const blockText = code?.match(BLOCK_REGEX)?.[1]
            if (!blockText) return null
            const meta = {}
            for (const [, key, rawVal] of blockText.matchAll(KV_REGEX)) {
                const val = (rawVal || "").trim()
                const { main, item } = compiledSchema[key] || fallbackType
                if (main === "array") {
                    if (!Array.isArray(meta[key])) {
                        meta[key] = []
                    }
                    if (val !== "") {
                        meta[key].push(castValue(val, item))
                    }
                } else {
                    meta[key] = castValue(val, main)
                }
            }
            return meta
        }
    }
}

module.exports = ThirdPartyDiagramParser
