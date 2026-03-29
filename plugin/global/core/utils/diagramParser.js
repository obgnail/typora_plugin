/**
 * Dynamically register and unregister new code block diagram.
 */
class DiagramParser {
    constructor(utils, i18n) {
        this.utils = utils
        this.i18n = i18n
        this.enableMappingSym = Symbol("enable_mapping")
        this.panel = `<div class="md-diagram-panel md-fences-adv-panel"><div class="md-diagram-panel-header"></div><div class="md-diagram-panel-preview"></div><div class="md-diagram-panel-error"></div></div>`
        this.exitInteractiveStrategies = ["click_exit_button"]
        this.parsers = new Map()     // map[lang]parser
        this.langMapping = new Map() // map[lang]mappingLang

        this.scheduled = new Set()     // cid
        this.timeout = 300
    }

    /**
     * @param {string} lang: language
     * @param {string} mappingLang: language to map to
     * @param {boolean} destroyWhenUpdate: Whether to clear the HTML in the preview before updating
     * @param {function(cid, content, $pre): Promise<null>} renderFunc: Renders based on the content. 1)cid: CID of the current code block. 2)content: content of the code block. 3) $pre: jQuery element of the code block.
     * @param {function(cid): null} cancelFunc: Cancel function, triggered when: 1) modified to another lang 2) the code block content is cleared 3) the code block content does not conform to the syntax
     * @param {function(): null} destroyAllFunc: When switching documents, all charts need to be destroyed (Note: cannot be an AsyncFunction, to prevent the fileOpened event from triggering renderFunc at the same time as destroyAll)
     * @param {function(lang): string} exportStyleGetter: Used to add CSS when exporting
     * @param {boolean} interactiveMode: In interactive mode, the code block will not automatically expand
     */
    register = ({
                    lang, mappingLang, destroyWhenUpdate = false,
                    renderFunc, cancelFunc = null, destroyAllFunc = null, exportStyleGetter = null, interactiveMode = true
                }) => {
        lang = lang.toLowerCase()
        mappingLang = mappingLang ? mappingLang.toLowerCase() : lang
        this.langMapping.set(lang, { name: mappingLang, [this.enableMappingSym]: true })
        this.parsers.set(lang, { lang, mappingLang, destroyWhenUpdate, renderFunc, cancelFunc, destroyAllFunc, exportStyleGetter, interactiveMode })
    }

    unregister = lang => this.parsers.delete(lang)

    process = () => {
        if (this.parsers.size === 0) return
        this.polyfill()
        this.setRenderTiming()
        this.fixInteractiveMode()
        this.registerLangTooltip()
        this.registerLangModeMapping()
        this.onAddCodeBlock()           // When adding code blocks
        this.onTryAddLangUndo()         // When modifying the language
        this.onUpdateDiagram()          // When updating
        this.onExport()                 // When exporting
        this.onFocus()                  // When focusing
        this.onChangeFile()             // When switching files
        this.onCheckIsDiagramType()     // When determining whether it is a Diagram
        console.debug(`[ Diagram Parser ] [ ${this.parsers.size} ]:`, this.parsers)
    }

    renderAllLangFence = lang => {
        document.querySelectorAll(`#write .md-fences[lang=${lang}]`).forEach(fence => {
            const cid = fence.getAttribute("cid")
            const cm = File.editor.fences.queue[cid]
            if (!cm) File.editor.fences.addCodeBlock(cid)
        })
    }

    refreshAllLangFence = lang => {
        document.querySelectorAll(`#write .md-fences[lang="${lang}"]`).forEach(fence => {
            const cid = fence.getAttribute("cid")
            if (cid) File.editor.diagrams.updateDiagram(cid)
        })
    }

    polyfill = () => {
        if (this.utils.isBetaVersion) {
            this.utils.insertStyle("plugin-diagram-parser-style", ".md-fences-advanced:not(.md-focus) .CodeMirror { display: none }")
        }
    }

    // Q: When the user is continuously typing, how to reduce rendering frequency while ensuring interactive experience?
    // A: Render immediately when the user types for the first time, then render once every X milliseconds, and finally render again based on the final input string.
    setRenderTiming = () => {
        const batch = this.utils.getGlobalSetting()?.BATCH_RENDER_CHARTS
        this.renderDiagram = batch ? this._batchRenderDiagram : this._doRenderDiagram
    }

    /** If the fenceEnhance plugin is disabled and EXIT_CHART_INTERACTION === click_exit_button, then force all charts to disable interactive mode. */
    fixInteractiveMode = () => {
        const cfg = this.utils.getGlobalSetting()?.EXIT_CHART_INTERACTION
        if (Array.isArray(cfg)) {
            const arr = cfg.filter(e => e === "ctrl_click_fence" || e === "click_exit_button")
            if (arr.length) {
                this.exitInteractiveStrategies = arr
            }
        }

        const isClickBtn = this.exitInteractiveStrategies.length === 1 && this.exitInteractiveStrategies[0] === "click_exit_button"
        const hasPlugin = this.utils.getBasePlugin("fence_enhance")
        if (!hasPlugin && isClickBtn) {
            for (const p of this.parsers.values()) {
                p.interactiveMode = false
            }
        }
    }

    registerLangTooltip = () => File.editor.fences.ALL?.push(...this.parsers.keys())

    registerLangModeMapping = () => {
        this.utils.decorator.modifyReturn(() => window, "getCodeMirrorMode", mode => {
            if (!mode) return mode

            const isObj = typeof mode === "object"
            const originLang = isObj ? mode.name : mode
            const mappingLang = this.langMapping.get(originLang)
            if (!mappingLang) return mode
            if (!isObj) return mappingLang
            return { ...mode, ...mappingLang }
        })
    }

    isDiagramType = lang => File.editor.diagrams.constructor.isDiagramType(lang)

    /** Called when a syntax error occurs in the code block content, at which point the page will display an error message. */
    throwParseError = (errorLine, reason) => {
        throw { errorLine, reason }
    }

    assertOK = (must, errorLine, reason) => {
        if (!must) this.throwParseError(errorLine, reason)
    }

    getErrorMessage = error => {
        if (error instanceof Error) {
            return this.utils.escape(error.stack)
        }
        const { errorLine, reason } = error || {}
        let msg = errorLine ? this.i18n.t("global", "error.atLine", { errorLine }) : ''
        if (reason instanceof Error) {
            msg += "\n" + this.utils.escape(reason.stack)
        } else if (reason) {
            msg += "\n" + this.utils.escape(reason.toString())
        }
        return msg || this.utils.escape(error.toString())
    }

    onRenderFailed = async (cid, lang, $pre, content, error) => {
        if (!error) {
            $pre.removeClass("md-fences-advanced")
            $pre.children(".md-diagram-panel").remove()
        } else {
            $pre.find(".md-diagram-panel-header").text(lang)
            $pre.find(".md-diagram-panel-preview").text(this.i18n.t("global", "error.drawingFailed"))
            $pre.find(".md-diagram-panel-error").html(`<pre>${this.getErrorMessage(error)}</pre>`)
        }
        await this.onCancel(cid)
    }

    onEmptyContent = async (cid, lang, $pre) => {
        $pre.find(".md-diagram-panel-header").text("")
        $pre.find(".md-diagram-panel-preview").text(this.i18n.t("global", "empty"))
        $pre.find(".md-diagram-panel-error").html("")
        await this.onCancel(cid)
    }

    onCancel = async cid => {
        for (const [lang, parser] of this.parsers.entries()) {
            if (!parser.cancelFunc) continue
            try {
                parser.cancelFunc(cid, lang)
            } catch (e) {
                console.error("Func cancel error:", e)
            }
        }
    }

    cleanErrorMsg = $pre => {
        $pre.find(".md-diagram-panel-header").html("")
        $pre.find(".md-diagram-panel-error").html("")
    }

    destroyIfNeed = (parser, cid, lang, $pre) => {
        if (parser.destroyWhenUpdate) {
            parser.cancelFunc?.(cid, lang)
            $pre.find(".md-diagram-panel-preview").html("")
        }
    }

    appendPanelIfNeed = $pre => {
        if ($pre.find(".md-diagram-panel").length === 0) {
            $pre.append(this.panel)
        }
    }

    renderCustomDiagram = async (cid, lang, $pre) => {
        const parser = this.parsers.get(lang)

        this.cleanErrorMsg($pre)
        this.destroyIfNeed(parser, cid, lang, $pre)

        const content = this.utils.getFenceContentByCid(cid)
        $pre.addClass("md-fences-advanced")
        this.appendPanelIfNeed($pre)

        if (!content) {
            await this.onEmptyContent(cid, lang, $pre)
            return
        }

        if (!parser.renderFunc) return
        try {
            await parser.renderFunc(cid, content, $pre, lang)
        } catch (error) {
            await this.onRenderFailed(cid, lang, $pre, content, error)
        }
    }

    _doRenderDiagram = async cid => {
        const $pre = File.editor.findElemById(cid)
        const lang = $pre.attr("lang")?.trim().toLowerCase()
        if (lang === undefined) return

        // If it is not Diagram, show the enhancement button.
        if (!this.isDiagramType(lang)) {
            $pre.children(".fence-enhance").show()
            $pre.removeClass("md-fences-advanced md-fences-interactive plugin-custom-diagram")
            await this.onCancel(cid)
        } else {
            // If it is Diagram, but not a custom type, do not show the enhancement button and return directly.
            $pre.children(".fence-enhance").hide()
            // If it is Diagram and also a custom type, call its callback function.
            const parser = this.parsers.get(lang)
            if (parser) {
                $pre.addClass("plugin-custom-diagram")
                if (parser.interactiveMode) $pre.addClass("md-fences-interactive")
                await this.renderCustomDiagram(cid, lang, $pre)
            } else {
                $pre.removeClass("md-fences-interactive plugin-custom-diagram")
                await this.onCancel(cid)
            }
        }
    }

    _batchRenderDiagram = async cid => {
        if (this.scheduled.has(cid)) return
        try {
            this.scheduled.add(cid)
            await this._doRenderDiagram(cid)
            await this.utils.sleep(this.timeout)
        } finally {
            this.scheduled.delete(cid)
            await this._doRenderDiagram(cid)
        }
    }

    onAddCodeBlock = () => this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.afterAddCodeBlock, this.renderDiagram)

    onTryAddLangUndo = () => this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.afterUpdateCodeBlockLang, ([node] = []) => node && this.renderDiagram(node.cid))

    onUpdateDiagram = () => this.utils.decorator.afterCall(() => File?.editor?.diagrams, "updateDiagram", (_, cid) => this.renderDiagram(cid))

    onExport = () => {
        const afterExport = () => {
            setTimeout(() => {
                for (const lang of this.parsers.keys()) {
                    this.refreshAllLangFence(lang)
                }
            }, 300)
        }

        const callback = () => {
            const beforeToHTML = () => {
                const extraCSSs = []
                this.parsers.forEach((parser, lang) => {
                    this.renderAllLangFence(lang)
                    if (typeof parser.exportStyleGetter === "function" && !!this.utils.entities.querySelectorInWrite(`.md-fences[lang="${lang}"]`)) {
                        extraCSSs.push(parser.exportStyleGetter(lang))
                    }
                })
                if (extraCSSs.length) {
                    const base = ` .md-diagram-panel, svg { page-break-inside: avoid } `
                    return base + extraCSSs.join(" ")
                }
            }
            // Make `frame.js` happy. To avoid null pointer exceptions
            // There is a line of code in `frame.js` in exporting logic:
            //    document.querySelector("[cid='" + t.cid + "'] svg").getBoundingClientRect()
            const beforeToNative = () => {
                this.parsers.forEach((parser, lang) => {
                    this.renderAllLangFence(lang)
                    this.utils.entities.querySelectorAllInWrite(`.md-fences[lang="${lang}"] .md-diagram-panel-preview`).forEach(preview => {
                        const svg = preview.querySelector("svg")
                        if (!svg) preview.innerHTML = "<svg></svg>"
                    })
                })
            }
            this.utils.exportHelper.register("diagram-parser", beforeToHTML, afterExport)
            this.utils.exportHelper.registerNative("diagram-parser", beforeToNative, afterExport)
        }

        this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.allPluginsHadInjected, callback)
    }

    onFocus = () => {
        let dontFocus = true

        const focusFence = (enhance) => {
            enhance?.querySelectorAll(".enhance-btn").forEach(el => el.style.display = "")
            dontFocus = false
            setTimeout(() => dontFocus = true, 200)
        }

        const shouldPreventFocus = (node) => {
            if (!dontFocus || !node) return false
            const cid = typeof node === "string" ? node : node.id
            if (!cid) return false
            const lang = File.editor.findElemById(cid)?.attr("lang")?.trim().toLowerCase()
            return !!(lang && this.parsers.get(lang)?.interactiveMode)
        }

        this.utils.decorator.preventCallIf(() => File?.editor?.fences, "focus", shouldPreventFocus)
        this.utils.decorator.preventCallIf(() => File?.editor, "refocus", shouldPreventFocus)

        const useCtrlClick = this.exitInteractiveStrategies.includes("ctrl_click_fence")
        const useClickExit = this.exitInteractiveStrategies.includes("click_exit_button") && [...this.parsers.values()].some(p => p.interactiveMode)
        if (useCtrlClick) {
            this.utils.entities.eWrite.addEventListener("mouseup", ev => {
                if (this.utils.metaKeyPressed(ev)) {
                    const fence = ev.target.closest(".md-fences-interactive")
                    if (fence && ev.target.closest(".md-diagram-panel-preview")) {
                        focusFence(fence.querySelector(".fence-enhance"))
                    }
                }
            }, true)
        }
        if (useClickExit) {
            const register = this.utils.getPluginFunction("fence_enhance", "registerButton")
            register?.({
                action: "edit",
                hint: this.i18n.t("global", "edit"),
                iconClassName: "fa fa-pencil",
                enable: false,
                listener: ctx => focusFence(ctx.btn.closest(".fence-enhance")),
            })
            if (!!register) {
                const toggleButtons = (fence, mode) => {
                    const enhance = fence.querySelector(".fence-enhance")
                    if (!enhance) return
                    if (mode === "hide") {
                        enhance.style.display = "none"
                        return
                    }
                    enhance.style.display = ""
                    const fn = mode === "editOnly"
                        ? el => el.style.display = el.getAttribute("action") === "edit" ? "" : "none"
                        : el => el.style.display = ""
                    enhance.querySelectorAll(".enhance-btn").forEach(fn)
                }
                this.utils.entities.$eWrite
                    .on("mouseenter", ".md-fences-interactive:not(.md-focus)", ev => toggleButtons(ev.currentTarget, "editOnly"))
                    .on("mouseleave", ".md-fences-interactive.md-focus", ev => toggleButtons(ev.currentTarget, "editOnly"))
                    .on("mouseleave", ".md-fences-interactive:not(.md-focus)", ev => toggleButtons(ev.currentTarget, "hide"))
                    .on("mouseenter", ".md-fences-interactive.md-focus", ev => toggleButtons(ev.currentTarget, "all"))
            }
        }
    }

    onChangeFile = () => {
        this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.otherFileOpened, () => {
            for (const p of this.parsers.values()) {
                p.destroyAllFunc?.()
            }
        })
    }

    onCheckIsDiagramType = () => {
        this.utils.decorator.modifyReturn(() => File?.editor?.diagrams?.constructor, "isDiagramType", (origin, mode) => {
            if (origin === true) return true
            if (!mode) return false
            if (Object.hasOwn(mode, this.enableMappingSym)) return true

            const t = typeof mode
            if (t === "object" && mode.name) {
                mode = mode.name
            }
            if (t === "string") {
                return this.parsers.get(mode.toLowerCase())
            }
            return origin
        })
    }
}

module.exports = DiagramParser
