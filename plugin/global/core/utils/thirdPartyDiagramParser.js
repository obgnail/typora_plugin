/**
 * Dynamically register and unregister third-party code block diagram (derived from DiagramParser).
 */
class ThirdPartyDiagramParser {
    constructor(utils) {
        this.utils = utils
        this.parsers = new Map()
        this.DEFAULT_CSS = { width: "calc(100% - 4px)", height: "300px", backgroundColor: "transparent" }
        this.createConfigParser = metaConfigParserFactory()
        this.helpers = this.getHelpers()
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
        const metaConfigParser = metaConfigSchema ? this.createConfigParser(metaConfigSchema) : null
        this.parsers.set(lang, {
            lang, mappingLang, destroyWhenUpdate, interactiveMode, settingMsg, metaConfigSchema, metaConfigParser,
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
                const userCss = parser.renderStyleGetter($pre, $wrap, content, meta)
                $wrap.css({ ...this.DEFAULT_CSS, ...userCss })
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

    getHelpers = () => {
        const DEFAULT_CSS = this.DEFAULT_CSS
        const getFenceWidth = ($pre) => parseFloat($pre.find(".md-diagram-panel").css("width"))
        const styleMetaConfigSchema = {
            wrapDefaultStyle: (defaultStyleVal = {}) => ({
                width: { type: "string", default: defaultStyleVal.width || DEFAULT_CSS.width, valueAliases: { auto: DEFAULT_CSS.width } },
                height: { type: "string", default: defaultStyleVal.height || DEFAULT_CSS.height },
                backgroundColor: { type: "string", default: defaultStyleVal.backgroundColor || DEFAULT_CSS.backgroundColor, aliases: ["gbc", "background-color"] },
            }),
        }
        const renderStyle = {
            base: ($pre, $wrap, content, meta) => meta ? this.utils.pick(meta, Object.keys(DEFAULT_CSS)) : {},
            wrapDefault: (defaultStyle = {}) => {
                return ($pre, $wrap, content, meta) => ({ ...defaultStyle, ...renderStyle.base($pre, $wrap, content, meta) })
            },
            wrapMeta: (metaToStyle) => {
                return ($pre, $wrap, content, meta) => ({ ...metaToStyle(meta), ...renderStyle.base($pre, $wrap, content, meta) })
            },
        }
        const exportStyle = {
            svg: (lang) => {
                const selector = this.parsers.get(lang)?.checkSelector
                return selector
                    ? `@media print {
                        .md-diagram-panel[lang="${lang}"] ${selector} { max-width: 100% !important; width: 100% !important; overflow: visible !important; }
                        .md-diagram-panel[lang="${lang}"] svg { width: 100% !important; max-width: 100% !important; height: auto !important; }
                    }`
                    : ""
            },
        }
        return { DEFAULT_CSS, styleMetaConfigSchema, renderStyle, exportStyle, getFenceWidth }
    }
}

function metaConfigParserFactory(customCasters = {}) {
    const BLOCK_REGEX = /^(?:\u00EF\u00BB\u00BF)?\s*\/\/ ==BlockCodeConfig==([\s\S]*?)^\/\/ ==\/BlockCodeConfig==/im
    const KV_REGEX = /^\s*\/\/\s+@([a-zA-Z0-9_\-$]+)(?:\s+(.*))?$/gm

    const CASTERS = {
        string: String,
        number: (v) => isNaN(v) ? v : Number(v),
        boolean: (v) => v.toLowerCase() !== "false" && v !== "0",
        ...customCasters
    }

    function getLiteralFallback(type) {
        if (type === "array") return []
        if (type === "number") return 0
        if (type === "boolean") return false
        return ""
    }

    function normalizeRule(def) {
        const rule = typeof def === "string" ? { type: def } : { ...def }
        return {
            type: rule.type || "string",
            items: rule.items || "string",
            default: rule.default,
            required: Object.hasOwn(rule, "default") ? false : (rule.required ?? false),
            enum: Array.isArray(rule.enum) ? rule.enum : null,
            aliases: Array.isArray(rule.aliases) ? rule.aliases : null,
            valueAliases: (rule.valueAliases && typeof rule.valueAliases === "object") ? rule.valueAliases : null,
            pattern: rule.pattern instanceof RegExp ? rule.pattern : null,
            minItems: typeof rule.minItems === "number" ? Math.max(0, Math.floor(rule.minItems)) : null,
            maxItems: typeof rule.maxItems === "number" ? Math.max(0, Math.floor(rule.maxItems)) : null,
            transform: typeof rule.transform === "function" ? rule.transform : null,
            validator: typeof rule.validator === "function" ? rule.validator : null,
        }
    }

    return function createConfigParser(schema = {}) {
        const compiledSchema = Object.create(null)
        const keyAliases = Object.create(null)
        for (const [key, def] of Object.entries(schema)) {
            const rule = normalizeRule(def)
            compiledSchema[key] = rule
            if (rule.aliases) {
                for (const alias of rule.aliases) {
                    keyAliases[alias] = key
                }
            }
        }

        return function parse(code) {
            const rawData = Object.create(null)
            const blockText = code?.match(BLOCK_REGEX)?.[1] || ""
            if (blockText) {
                for (const [, rawKey, rawVal] of blockText.matchAll(KV_REGEX)) {
                    const val = (rawVal || "").trim()
                    if (val === "") continue
                    const key = keyAliases[rawKey] || rawKey
                    if (!rawData[key]) rawData[key] = []
                    rawData[key].push(val)
                }
            }

            const meta = {}
            const errors = []
            for (const [key, rule] of Object.entries(compiledSchema)) {
                const rawValues = rawData[key] || []
                const isArray = rule.type === "array"
                const itemType = isArray ? rule.items : rule.type
                const castFn = CASTERS[itemType] || CASTERS.string

                let processedValues = rawValues.map(v => (rule.valueAliases && Object.hasOwn(rule.valueAliases, v)) ? rule.valueAliases[v] : v).map(castFn)
                if (rule.transform) {
                    processedValues = processedValues.flatMap(v => rule.transform(v))
                }

                const validValues = []
                for (const v of processedValues) {
                    let isValid = true
                    if (rule.pattern && !rule.pattern.test(String(v))) {
                        errors.push(`[Pattern Error] @${key}: "${v}" does not match pattern ${rule.pattern}`)
                        isValid = false
                    }
                    else if (rule.enum && !rule.enum.includes(v)) {
                        errors.push(`[Enum Error] @${key}: "${v}" is not in allowed list [${rule.enum.join(", ")}]`)
                        isValid = false
                    }
                    else if (rule.validator && !rule.validator(v)) {
                        errors.push(`[Validation Error] @${key}: "${v}" failed custom validator`)
                        isValid = false
                    }
                    if (isValid) {
                        validValues.push(v)
                    }
                }

                if (isArray && rawValues.length > 0) {
                    const count = validValues.length
                    if (rule.maxItems !== null && count > rule.maxItems) {
                        errors.push(`[Collection Error] @${key}: Exceeds maximum of ${rule.maxItems} valid items (found ${count})`)
                        validValues.length = 0
                    }
                    else if (rule.minItems !== null && count < rule.minItems) {
                        errors.push(`[Collection Error] @${key}: Requires at least ${rule.minItems} valid items (found ${count})`)
                        validValues.length = 0
                    }
                }

                if (validValues.length > 0) {
                    meta[key] = isArray ? validValues : validValues.at(-1)
                } else {
                    if (Object.hasOwn(rule, "default")) {
                        meta[key] = Array.isArray(rule.default) ? [...rule.default] : rule.default
                    } else {
                        meta[key] = getLiteralFallback(rule.type)
                        if (rule.required && rawValues.length === 0) {
                            errors.push(`[Missing Required] @${key}: Field is required`)
                        }
                    }
                }
            }

            // Handle undefined header keys
            for (const [key, rawValues] of Object.entries(rawData)) {
                if (Object.hasOwn(compiledSchema, key)) continue
                meta[key] = rawValues.length === 1 ? rawValues[0] : rawValues
            }

            if (errors.length > 0) {
                throw new Error("Meta Config Validation Failed:\n- " + [...new Set(errors)].join("\n- "))
            }
            return meta
        }
    }
}

module.exports = ThirdPartyDiagramParser
