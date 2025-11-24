/**
 * Dynamically register and unregister new code block diagram.
 */
class DiagramParser {
    constructor(utils, i18n) {
        this.utils = utils;
        this.i18n = i18n;
        this.diagramModeFlag = "custom_diagram";  // can be any value, just a flag
        this.panel = `<div class="md-diagram-panel md-fences-adv-panel"><div class="md-diagram-panel-header"></div><div class="md-diagram-panel-preview"></div><div class="md-diagram-panel-error"></div></div>`;
        this.exitInteractiveStrategies = ["click_exit_button"];
        this.parsers = new Map();     // {lang: parser}
        this.langMapping = new Map(); // {lang: mappingLang}
        // this.pending = new Set();     // cid
        // this.timeout = 300;
    }

    /**
     * @param {string} lang: language
     * @param {string} mappingLang: language to map to
     * @param {boolean} destroyWhenUpdate: Whether to clear the HTML in the preview before updating
     * @param {function(cid, content, $pre): Promise<null>} renderFunc: Renders based on the content. 1)cid: CID of the current code block. 2)content: content of the code block. 3) $pre: jQuery element of the code block.
     * @param {function(cid): null} cancelFunc: Cancel function, triggered when: 1) modified to another lang 2) the code block content is cleared 3) the code block content does not conform to the syntax
     * @param {function(): null} destroyAllFunc: When switching documents, all charts need to be destroyed (Note: cannot be an AsyncFunction, to prevent the fileOpened event from triggering renderFunc at the same time as destroyAll)
     * @param {function(): string} extraStyleGetter: Used to add CSS when exporting
     * @param {boolean} interactiveMode: In interactive mode, the code block will not automatically expand
     */
    register = ({
                    lang, mappingLang, destroyWhenUpdate = false,
                    renderFunc, cancelFunc = null, destroyAllFunc = null, extraStyleGetter = null, interactiveMode = true
                }) => {
        lang = lang.toLowerCase();
        mappingLang = mappingLang ? mappingLang.toLowerCase() : lang;
        this.langMapping.set(lang, { name: mappingLang, mappingType: this.diagramModeFlag });
        this.parsers.set(lang, {
            lang, mappingLang, destroyWhenUpdate, renderFunc,
            cancelFunc, destroyAllFunc, extraStyleGetter, interactiveMode
        });
    }

    unregister = lang => this.parsers.delete(lang)

    process = async () => {
        if (this.parsers.size === 0) return
        await this.polyfillStyle()
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
        this.log()
    }

    log = () => console.debug(`[ diagram parser ] [ ${this.parsers.size} ]:`, this.parsers)

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

    polyfillStyle = async () => {
        if (this.utils.isBetaVersion) {
            await this.utils.styleTemplater.register("plugin-diagram-parser");
        }
    }

    /** If the fenceEnhance plugin is disabled and EXIT_INTERACTIVE_MODE === click_exit_button, then force all charts to disable interactive mode. */
    fixInteractiveMode = () => {
        const cfg = this.utils.getGlobalSetting("EXIT_INTERACTIVE_MODE");
        if (Array.isArray(cfg)) {
            const arr = cfg.filter(e => e === "ctrl_click_fence" || e === "click_exit_button");
            if (arr.length) {
                this.exitInteractiveStrategies = arr;
            }
        }

        const isClickBtn = this.exitInteractiveStrategies.length === 1 && this.exitInteractiveStrategies[0] === "click_exit_button";
        const hasPlugin = this.utils.getBasePlugin("fence_enhance")
        if (!hasPlugin && isClickBtn) {
            for (const p of this.parsers.values()) {
                p.interactiveMode = false;
            }
        }
    }

    registerLangTooltip = () => File.editor.fences.ALL?.push(...this.parsers.keys())

    registerLangModeMapping = () => {
        const after = mode => {
            if (!mode) return mode

            const isObj = typeof mode === "object"
            const originLang = isObj ? mode.name : mode
            const mappingLang = this.langMapping.get(originLang)
            if (!mappingLang) {
                return mode
            }
            if (!isObj) {
                return mappingLang
            }
            mode.name = mappingLang
            return mode
        }
        this.utils.decorate(() => window, "getCodeMirrorMode", null, after, true)
    }

    isDiagramType = lang => File.editor.diagrams.constructor.isDiagramType(lang)

    /** Called when a syntax error occurs in the code block content, at which point the page will display an error message. */
    throwParseError = (errorLine, reason) => {
        throw { errorLine, reason }
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

    whenCannotDraw = async (cid, lang, $pre, content, error) => {
        if (!error) {
            $pre.removeClass("md-fences-advanced")
            $pre.children(".md-diagram-panel").remove()
        } else {
            $pre.find(".md-diagram-panel-header").text(lang)
            $pre.find(".md-diagram-panel-preview").text(this.i18n.t("global", "error.drawingFailed"))
            $pre.find(".md-diagram-panel-error").html(`<pre>${this.getErrorMessage(error)}</pre>`)
        }
        await this.noticeRollback(cid)
    }

    whenEmptyContent = async (cid, lang, $pre) => {
        $pre.find(".md-diagram-panel-header").text("")
        $pre.find(".md-diagram-panel-preview").text(this.i18n.t("global", "empty"))
        $pre.find(".md-diagram-panel-error").html("")
        await this.noticeRollback(cid)
    }

    noticeRollback = async cid => {
        for (const [lang, parser] of this.parsers.entries()) {
            if (!parser.cancelFunc) continue;
            try {
                parser.cancelFunc(cid, lang);
            } catch (e) {
                console.error("call cancel func error:", e);
            }
        }
    }

    cleanErrorMsg = $pre => {
        $pre.find(".md-diagram-panel-header").html("");
        $pre.find(".md-diagram-panel-error").html("");
    }

    destroyIfNeed = (parser, cid, lang, $pre) => {
        if (parser.destroyWhenUpdate) {
            parser.cancelFunc?.(cid, lang)
            $pre.find(".md-diagram-panel-preview").html("")
        }
    }

    appendPanelIfNeed = $pre => {
        if ($pre.find(".md-diagram-panel").length === 0) {
            $pre.append(this.panel);
        }
    }

    renderCustomDiagram = async (cid, lang, $pre) => {
        const parser = this.parsers.get(lang);

        this.cleanErrorMsg($pre);
        this.destroyIfNeed(parser, cid, lang, $pre);

        const content = this.utils.getFenceContentByCid(cid);
        $pre.addClass("md-fences-advanced");
        this.appendPanelIfNeed($pre);

        if (!content) {
            await this.whenEmptyContent(cid, lang, $pre);
            return;
        }

        if (!parser.renderFunc) return;
        try {
            await parser.renderFunc(cid, content, $pre, lang);
        } catch (error) {
            await this.whenCannotDraw(cid, lang, $pre, content, error)
        }
    }

    renderDiagram = async cid => {
        const $pre = File.editor.findElemById(cid);
        const lang_ = $pre.attr("lang");
        if (lang_ === undefined) return;

        const lang = lang_.trim().toLowerCase();
        // If it is not Diagram, show the enhancement button.
        if (!this.isDiagramType(lang)) {
            $pre.children(".fence-enhance").show();
            $pre.removeClass("md-fences-advanced md-fences-interactive plugin-custom-diagram");
            await this.noticeRollback(cid);
        } else {
            // If it is Diagram, but not a custom type, do not show the enhancement button and return directly.
            $pre.children(".fence-enhance").hide();
            // If it is Diagram and also a custom type, call its callback function.
            const parser = this.parsers.get(lang);
            if (parser) {
                $pre.addClass("plugin-custom-diagram");
                if (parser.interactiveMode) $pre.addClass("md-fences-interactive")
                await this.renderCustomDiagram(cid, lang, $pre);
            } else {
                $pre.removeClass("md-fences-interactive plugin-custom-diagram");
                await this.noticeRollback(cid);
            }
        }
    }

    // // When the user is continuously typing, how to reduce rendering frequency while ensuring interactive experience?
    // // A: Render immediately when the user types for the first time, then render once every X milliseconds, and finally render again based on the final input string.
    // renderDiagram = async cid => {
    //     if (this.pending.has(cid)) return;
    //
    //     this.pending.add(cid);
    //     await this._renderDiagram(cid);
    //     await this.utils.sleep(this.timeout);
    //     this.pending.delete(cid);
    //     await this._renderDiagram(cid);
    // }

    onAddCodeBlock = () => this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.afterAddCodeBlock, this.renderDiagram)

    onTryAddLangUndo = () => this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.afterUpdateCodeBlockLang, args => args?.[0] && this.renderDiagram(args[0].cid))

    onUpdateDiagram = () => this.utils.decorate(() => File?.editor?.diagrams, "updateDiagram", null, (_, ...args) => this.renderDiagram(args[0]))

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
                const extraCssList = []
                this.parsers.forEach((parser, lang) => {
                    this.renderAllLangFence(lang)
                    const getter = parser.extraStyleGetter
                    const exist = this.utils.entities.querySelectorInWrite(`.md-fences[lang="${lang}"]`)
                    if (getter && exist) {
                        const extraCss = getter()
                        extraCssList.push(extraCss)
                    }
                })
                if (extraCssList.length) {
                    const base = ` .md-diagram-panel, svg {page-break-inside: avoid;} `
                    return base + extraCssList.join(" ")
                }
            }
            // Make `frame.js` happy. Avoid null pointer exceptions
            // There is a line of code in the export source code: document.querySelector("[cid='" + t.cid + "'] svg").getBoundingClientRect()
            const beforeToNative = () => {
                this.parsers.forEach((parser, lang) => {
                    this.renderAllLangFence(lang)
                    const previews = this.utils.entities.querySelectorAllInWrite(`.md-fences[lang="${lang}"] .md-diagram-panel-preview`)
                    previews.forEach(preview => {
                        const svg = preview.querySelector("svg")
                        if (!svg) {
                            preview.innerHTML = "<svg></svg>"
                        }
                    })
                })
            }
            this.utils.exportHelper.register("diagram-parser", beforeToHTML, afterExport)
            this.utils.exportHelper.registerNative("diagram-parser", beforeToNative, afterExport)
        }

        this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.allPluginsHadInjected, callback)
    }

    onFocus = () => {
        let dontFocus = true;

        const enableFocus = () => {
            dontFocus = false;
            setTimeout(() => dontFocus = true, 200);
        }

        const stopCall = (...args) => {
            if (!dontFocus || !args || !args[0]) return;

            const cid = ("string" == typeof args[0]) ? args[0] : args[0]["id"];
            if (cid) {
                const lang = (File.editor.findElemById(cid).attr("lang") || "").trim().toLowerCase();
                if (!cid || !lang) return;
                if (this.parsers.get(lang)?.interactiveMode) return this.utils.stopCallError
            }
        }

        this.utils.decorate(() => File?.editor?.fences, "focus", stopCall)
        this.utils.decorate(() => File?.editor, "refocus", stopCall)

        const showAllTButton = fence => {
            const enhance = fence.querySelector(".fence-enhance");
            if (!enhance) return;
            enhance.querySelectorAll(".enhance-btn").forEach(ele => ele.style.display = "");
            return enhance
        }

        const showEditButtonOnly = fence => {
            const enhance = fence.querySelector(".fence-enhance");
            if (!enhance) return;
            enhance.style.display = "";
            enhance.querySelectorAll(".enhance-btn").forEach(ele => ele.style.display = "none");
            enhance.querySelector(".edit-diagram").style.display = "";
        }

        const hideAllButton = fence => {
            const enhance = showAllTButton(fence);
            if (!enhance) return;
            const editButton = enhance.querySelector(".edit-diagram");
            if (editButton) {
                editButton.style.display = "none";
            }
            enhance.style.display = "none";
        }

        const registerButton = (className, action, hint, iconClassName, enable, listener, extraFunc) => {
            const fn = this.utils.getPluginFunction("fence_enhance", "registerButton")
            fn?.({ className, action, hint, iconClassName, enable, listener, extraFunc })
            return !!fn
        }

        const handleCtrlClick = () => {
            const ctrlClick = this.exitInteractiveStrategies.includes("ctrl_click_fence");
            if (!ctrlClick) return;
            this.utils.entities.eWrite.addEventListener("mouseup", ev => {
                if (this.utils.metaKeyPressed(ev) && ev.target.closest(".md-fences-interactive .md-diagram-panel-preview")) {
                    showAllTButton(ev.target.closest(".md-fences-interactive"));
                    enableFocus();
                }
            }, true)
        }

        const handleEditButton = () => {
            const editBtn = this.exitInteractiveStrategies.includes("click_exit_button");
            const hasInteractive = Array.from(this.parsers.values()).some(parser => parser.interactiveMode);
            if (!editBtn || !hasInteractive) return;

            const editText = this.i18n.t("global", "edit")
            const listener = ({ btn }) => {
                btn.closest(".fence-enhance").querySelectorAll(".enhance-btn").forEach(ele => ele.style.display = "")
                enableFocus()
            }
            const ok = registerButton("edit-diagram", "editDiagram", editText, "fa fa-pencil", false, listener)
            if (!ok) return;

            this.utils.entities.$eWrite.on("mouseenter", ".md-fences-interactive:not(.md-focus)", function () {
                showEditButtonOnly(this);
            }).on("mouseleave", ".md-fences-interactive.md-focus", function () {
                showEditButtonOnly(this);
            }).on("mouseleave", ".md-fences-interactive:not(.md-focus)", function () {
                hideAllButton(this);
            }).on("mouseenter", ".md-fences-interactive.md-focus", function () {
                showAllTButton(this);
            })
        }

        handleCtrlClick();
        handleEditButton();
    }

    onChangeFile = () => {
        this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.otherFileOpened, () => {
            for (const { destroyAllFunc } of this.parsers.values()) {
                destroyAllFunc?.()
            }
        });
    }

    onCheckIsDiagramType = () => {
        const after = (result, ...args) => {
            if (result === true) return true;

            let lang = args[0];
            if (!lang) return false;

            const type = typeof lang;
            if (type === "object" && lang.mappingType === this.diagramModeFlag) return true;
            if (type === "object" && lang.name) {
                lang = lang.name;
            }
            if (type === "string") {
                return this.parsers.get(lang.toLowerCase());
            }
            return result
        }
        this.utils.decorate(() => File?.editor?.diagrams?.constructor, "isDiagramType", null, after, true)
    }
}

module.exports = DiagramParser
