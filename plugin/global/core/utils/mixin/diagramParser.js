class diagramParser {
    constructor(utils) {
        this.utils = utils;
        this.diagramModeFlag = "custom_diagram";  // can be any value, just a flag
        this.exitInteractiveStrategies = ["click_exit_button"];
        this.parsers = new Map();     // {lang: parser}
        this.langMapping = new Map(); // {lang: mappingLang}
    }

    /**
     * @param {string} lang: language
     * @param {string} mappingLang: 映射到哪个语言
     * @param {boolean} destroyWhenUpdate: 更新前是否清空preview里的html
     * @param {function(cid, content, $pre): Promise<null>} renderFunc: 渲染函数，根据内容渲染所需的图像. 1)cid: 当前代码块的cid 2)content: 代码块的内容 3) $pre: 代码块的jquery element
     * @param {function(cid): null} cancelFunc: 取消函数，触发时机：1)修改为其他的lang 2)当代码块内容被清空 3)当代码块内容不符合语法
     * @param {function(): null} destroyAllFunc: 当切换文档时，需要将全部的图表destroy掉（注意：不可为AsyncFunction，防止destroyAll的同时，发生fileOpened事件触发renderFunc）
     * @param {function(): string} extraStyleGetter: 用于导出时，新增css
     * @param {boolean} interactiveMode: 交互模式下，不会自动展开代码块
     */
    register = ({ lang, mappingLang, destroyWhenUpdate = false, renderFunc, cancelFunc = null, destroyAllFunc = null, extraStyleGetter = null, interactiveMode = true }) => {
        lang = lang.toLowerCase();
        mappingLang = mappingLang ? mappingLang.toLowerCase() : lang;
        this.langMapping[lang] = { name: mappingLang, mappingType: this.diagramModeFlag };
        const parser = {
            lang, mappingLang, destroyWhenUpdate, renderFunc,
            cancelFunc, destroyAllFunc, extraStyleGetter, interactiveMode
        }
        this.parsers.set(lang, parser);
    }

    unregister = lang => this.parsers.delete(lang)

    process = async () => {
        if (this.parsers.size === 0) return;
        await this.polyfillStyle();
        this.fixInteractiveMode();
        this.registerLangTooltip();      // 语言提示
        this.registerLangModeMapping();  // A语言映射为B语言
        this.onAddCodeBlock();           // 添加代码块时
        this.onTryAddLangUndo();         // 修改语言时
        this.onUpdateDiagram();          // 更新时
        this.onExportToHTML();           // 导出时
        this.onFocus();                  // 聚焦时
        this.onChangeFile();             // 切换文件时
        this.onCheckIsDiagramType();     // 判断是否为Diagram时
        this.report();
    }

    report = () => console.debug(`enable diagram parser:`, this.parsers);

    polyfillStyle = async () => {
        if (this.utils.isBetaVersion) {
            await this.utils.styleTemplater.register("plugin-diagram-parser");
        }
    }

    // 如果没有开启fenceEnhance插件，并且EXIT_INTERACTIVE_MODE为click_exit_button，那么强制所有的图形都关闭交互模式
    fixInteractiveMode = () => {
        const cfg = this.utils.getGlobalSetting("EXIT_INTERACTIVE_MODE");
        if (Array.isArray(cfg)) {
            const arr = cfg.filter(e => e === "ctrl_click_fence" || e === "click_exit_button");
            if (arr.length) {
                this.exitInteractiveStrategies = arr;
            }
        }

        const isClickBtn = this.exitInteractiveStrategies.length === 1 && this.exitInteractiveStrategies[0] === "click_exit_button";
        const hasPlugin = this.utils.getPlugin("fence_enhance");
        if (!hasPlugin && isClickBtn) {
            for (const p of this.parsers.values()) {
                p.interactiveMode = false;
            }
        }
    }

    registerLangTooltip = () => File.editor.fences.ALL && File.editor.fences.ALL.push(...this.parsers.keys())

    registerLangModeMapping = () => {
        const after = mode => {
            if (!mode) return mode;
            const name = typeof mode === "object" ? mode.name : mode;
            return this.langMapping[name] || mode
        }
        this.utils.decorate(() => window, "getCodeMirrorMode", null, after, true)
    }

    isDiagramType = lang => File.editor.diagrams.constructor.isDiagramType(lang)

    // 当代码块内容出现语法错误时调用，此时页面将显示错误信息
    throwParseError = (errorLine, reason) => {
        throw { errorLine, reason }
    }

    getErrorMessage = error => {
        if (error instanceof Error) {
            return this.utils.escape(error.stack);
        }
        const { errorLine, reason } = error;
        let msg = errorLine ? `第 ${errorLine} 行发生错误。` : '';
        if (reason instanceof Error) {
            msg += this.utils.escape(reason.stack);
        } else if (reason) {
            msg += `错误原因：${reason}`;
        }
        return msg || error.toString();
    }

    whenCantDraw = async (cid, lang, $pre, content, error) => {
        if (!error) {
            $pre.removeClass("md-fences-advanced");
            $pre.children(".md-diagram-panel").remove();
        } else {
            $pre.find(".md-diagram-panel-header").text(lang);
            $pre.find(".md-diagram-panel-preview").text("语法解析异常，绘图失败");
            $pre.find(".md-diagram-panel-error").text(this.getErrorMessage(error));
        }
        await this.noticeRollback(cid);
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
        if (!parser.destroyWhenUpdate) return;
        parser.cancelFunc && parser.cancelFunc(cid, lang);
        $pre.find(".md-diagram-panel-preview").html("");
    }

    appendPanelIfNeed = $pre => {
        if ($pre.find(".md-diagram-panel").length === 0) {
            $pre.append(`<div class="md-diagram-panel md-fences-adv-panel"><div class="md-diagram-panel-header"></div><div class="md-diagram-panel-preview"></div><div class="md-diagram-panel-error"></div></div>`);
        }
    }

    renderCustomDiagram = async (cid, lang, $pre) => {
        const parser = this.parsers.get(lang);

        this.cleanErrorMsg($pre);
        this.destroyIfNeed(parser, cid, lang, $pre);

        const content = this.utils.getFenceContent($pre[0], cid);
        if (!content) {
            await this.whenCantDraw(cid, lang, $pre);
            return;
        }

        $pre.addClass("md-fences-advanced");
        this.appendPanelIfNeed($pre);

        if (!parser.renderFunc) return;
        try {
            await parser.renderFunc(cid, content, $pre, lang);
        } catch (error) {
            await this.whenCantDraw(cid, lang, $pre, content, error);
        }
    }

    renderDiagram = async cid => {
        const $pre = File.editor.findElemById(cid);
        const lang = $pre.attr("lang").trim().toLowerCase();

        // 不是Diagram类型，需要展示增强按钮
        if (!this.isDiagramType(lang)) {
            $pre.children(".fence-enhance").show();
            $pre.removeClass("md-fences-advanced md-fences-interactive plugin-custom-diagram");
            await this.noticeRollback(cid);
        } else {
            // 是Diagram类型，但不是自定义类型，不展示增强按钮，直接返回即可
            $pre.children(".fence-enhance").hide();
            // 是Diagram类型，也是自定义类型，调用其回调函数
            const parser = this.parsers.get(lang);
            if (parser) {
                $pre.addClass("plugin-custom-diagram");
                parser.interactiveMode && $pre.addClass("md-fences-interactive");
                await this.renderCustomDiagram(cid, lang, $pre);
            } else {
                $pre.removeClass("md-fences-interactive plugin-custom-diagram");
                await this.noticeRollback(cid);
            }
        }
    }

    onAddCodeBlock = () => this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.afterAddCodeBlock, this.renderDiagram)

    onTryAddLangUndo = () => {
        const objGetter = () => File && File.editor && File.editor.fences;
        const after = (result, ...args) => args && args[0] && this.renderDiagram(args[0].cid);
        this.utils.decorate(objGetter, "tryAddLangUndo", null, after);
    }

    onUpdateDiagram = () => {
        const objGetter = () => File && File.editor && File.editor.diagrams;
        const after = (result, ...args) => this.renderDiagram(args[0]);
        this.utils.decorate(objGetter, "updateDiagram", null, after);
    }

    onExportToHTML = () => {
        this.utils.exportHelper.register("diagramParser", () => {
            const extraCssList = [];
            this.parsers.forEach((parser, lang) => {
                const getter = parser.extraStyleGetter;
                const exist = this.utils.entities.querySelectorInWrite(`.md-fences[lang="${lang}"]`);
                if (getter && exist) {
                    const extraCss = getter();
                    extraCssList.push(extraCss);
                }
            });
            if (extraCssList.length) {
                const base = ` .md-diagram-panel, svg {page-break-inside: avoid;} `;
                return base + extraCssList.join(" ");
            }
        })
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
                const parser = this.parsers.get(lang);
                if (parser && parser.interactiveMode) return this.utils.stopCallError
            }
        }

        this.utils.decorate(() => File && File.editor && File.editor.fences, "focus", stopCall);
        this.utils.decorate(() => File && File.editor, "refocus", stopCall);

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

        const registerFenceEnhanceButton = (className, action, hint, iconClassName, enable, listener, extraFunc,
        ) => this.utils.callPluginFunction("fence_enhance", "registerBuilder", className, action, hint, iconClassName, enable, listener, extraFunc)

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

            const listener = (ev, button) => {
                button.closest(".fence-enhance").querySelectorAll(".enhance-btn").forEach(ele => ele.style.display = "");
                enableFocus();
            }
            const ok = registerFenceEnhanceButton("edit-diagram", "editDiagram", "编辑", "fa fa-pencil", false, listener);
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
                destroyAllFunc && destroyAllFunc();
            }
        });
    }

    onCheckIsDiagramType = () => {
        const objGetter = () => File && File.editor && File.editor.diagrams && File.editor.diagrams.constructor
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
        this.utils.decorate(objGetter, "isDiagramType", null, after, true);
    }
}

module.exports = {
    diagramParser
}
