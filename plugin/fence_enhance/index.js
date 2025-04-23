class fenceEnhancePlugin extends BasePlugin {
    beforeProcess = () => {
        const hasFunc = File && File.editor && File.editor.fences && File.editor.fences.formatContent;
        this.supportIndent = this.config.ENABLE_INDENT && hasFunc;
        this.enableIndent = this.supportIndent;
        this.builders = [];
    }

    styleTemplate = () => ({ bgColorWhenHover: this.config.HIGHLIGHT_WHEN_HOVER ? this.config.HIGHLIGHT_LINE_COLOR : "initial" })

    process = async () => {
        this.utils.settings.autoSaveSettings(this)

        if (this.config.ENABLE_HOTKEY) {
            new editorHotkeyHelper(this).process();
        }
        if (this.config.INDENTED_WRAPPED_LINE) {
            new indentedWrappedLineHelper(this).process();
        }
        if (this.config.ENABLE_BUTTON) {
            this.processButton();
        }
        if (this.config.HIGHLIGHT_BY_LANGUAGE) {
            new highlightHelper(this).process();
        }
        if (this.config.ENABLE_LANGUAGE_FOLD) {
            await new languageFoldHelper(this).process();
        }
    }

    processButton = () => {
        const registerCustomButtons = () => {
            const evalFunc = arg => {
                const func = eval(arg);
                if (!(func instanceof Function)) {
                    throw Error(`custom button arg is not function: ${arg}`)
                }
                return func
            }
            this.config.CUSTOM_BUTTONS.forEach(btn => {
                const { DISABLE, ICON, HINT, ON_INIT, ON_CLICK, ON_RENDER } = btn;
                if (DISABLE) return;
                if (ON_INIT) {
                    const initFunc = evalFunc(ON_INIT);
                    initFunc(this);
                }
                const renderFunc = ON_RENDER ? evalFunc(ON_RENDER) : undefined;
                if (!ON_CLICK) return;
                const callbackFunc = evalFunc(ON_CLICK);
                const callback = (ev, button) => {
                    const fence = button.closest(".md-fences");
                    const cid = fence.getAttribute("cid");
                    const cont = this.utils.getFenceContentByCid(cid);
                    return callbackFunc({ ev, button, cont, fence, cid, plu: this });
                }
                const action = this.utils.randomString();
                this.registerBuilder(action, action, HINT, ICON, !DISABLE, callback, renderFunc);
            })
        }
        const addEnhanceElement = (fence, cid) => {
            if (!fence || this.builders.length === 0) return
            let enhance = fence.querySelector(".fence-enhance")
            if (enhance) return

            enhance = document.createElement("div")
            enhance.setAttribute("class", "fence-enhance")
            if (this.config.AUTO_HIDE) {
                enhance.style.visibility = "hidden"
            }
            const buttons = this.builders.map(b => b.createButton(this.config.REMOVE_BUTTON_HINT))
            enhance.append(...buttons)
            fence.appendChild(enhance)
            this.builders.forEach((builder, idx) => {
                const button = buttons[idx]
                if (builder.extraFunc) {
                    builder.extraFunc(button, cid)
                }
            })
        }

        const defaultButtons = [
            ["copy-code", "copyCode", this.i18n.t("btn.hint.copy"), "fa fa-clipboard", this.config.ENABLE_COPY, this.copyCode],
            ["indent-code", "indentCode", this.i18n.t("btn.hint.indent"), "fa fa-indent", this.enableIndent, this.indentCode],
            ["fold-code", "foldCode", this.i18n.t("btn.hint.fold"), "fa fa-minus", this.config.ENABLE_FOLD, this.foldCode, this.defaultFold],
        ]
        defaultButtons.forEach(button => this.registerBuilder(...button))

        registerCustomButtons()

        this.utils.exportHelper.register("fence_enhance", this.beforeExport)

        this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.afterAddCodeBlock, cid => {
            const fence = this.utils.entities.querySelectorInWrite(`.md-fences[cid=${cid}]`)
            addEnhanceElement(fence, cid)
        })

        this.utils.entities.eWrite.addEventListener("click", ev => {
            const target = ev.target.closest(".fence-enhance .enhance-btn");
            if (!target) return;
            ev.preventDefault();
            ev.stopPropagation();
            document.activeElement.blur();
            const action = target.getAttribute("action");
            const builder = this.builders.find(builder => builder.action === action);
            if (builder) {
                builder.listener(ev, target)
            }
        })

        const config = this.config;
        this.utils.entities.$eWrite.on("mouseenter", ".md-fences", function () {
            if (config.AUTO_HIDE) {
                this.querySelector(".fence-enhance").style.visibility = "";
            }
        }).on("mouseleave", ".md-fences", function () {
            if (config.AUTO_HIDE && !this.querySelector(".fold-code.folded")) {
                this.querySelector(".fence-enhance").style.visibility = "hidden";
            }
        })
    }

    registerBuilder = (className, action, hint, iconClassName, enable, listener, extraFunc) => {
        const b = new builder(className, action, hint, iconClassName, enable, listener, extraFunc)
        this.builders.push(b)
    }
    removeBuilder = action => this.builders = this.builders.filter(builder => builder.action !== action);

    beforeExport = () => this.utils.entities.querySelectorAllInWrite(".fold-code.folded").forEach(ele => ele.click())

    defaultFold = (foldButton, cid) => {
        const { DEFAULT_FOLD, DEFAULT_FOLD_THRESHOLD: t } = this.config
        const shouldFold = DEFAULT_FOLD && (t <= 0 || t < File.editor.fences.queue[cid].lineCount())
        if (shouldFold) {
            foldButton.click()
        }
    }
    copyCode = (ev, copyButton) => {
        const result = this.utils.getFenceContentByPre(copyButton.closest(".md-fences"));
        navigator.clipboard.writeText(result).then(() => this._changeIcon(copyButton, "fa fa-check", "fa fa-clipboard"));
    }
    foldCode = (ev, foldButton) => {
        const fence = foldButton.closest(".md-fences");
        if (!fence) return;
        const isDiagram = fence.classList.contains("md-fences-advanced");
        if (isDiagram) return;  // diagram cannot be folded
        const scroll = fence.querySelector(".CodeMirror-scroll");
        if (!scroll) return;
        const enhance = foldButton.closest(".fence-enhance");
        if (!enhance) return;

        const folded = scroll.style.height && scroll.style.overflowY;
        const [height, overflowY, force, className, visibility] = folded
            ? ["", "", false, "fa fa-minus", "hidden"]
            : [window.getComputedStyle(scroll).lineHeight, "hidden", true, "fa fa-plus", ""]
        scroll.style.height = height;
        scroll.style.overflowY = overflowY;
        foldButton.classList.toggle("folded", force);
        foldButton.firstElementChild.className = className;
        if (this.config.AUTO_HIDE) {
            enhance.style.visibility = visibility
        }
    }
    indentCode = (ev, indentButton) => {
        const fence = indentButton.closest(".md-fences");
        if (!fence || !File.editor.fences.formatContent) return;

        const cid = fence.getAttribute("cid");
        File.editor.refocus(cid);
        File.editor.fences.formatContent();

        this._changeIcon(indentButton, "fa fa-check", "fa fa-indent");
    }

    copyFence = target => target.querySelector(".copy-code").click();
    indentFence = target => target.querySelector(".indent-code").click();
    foldFence = target => target.querySelector(".fold-code").click();
    expandFence = fence => {
        const button = fence.querySelector(".fence-enhance .fold-code.folded")
        if (button) {
            button.click()
        }
    }

    _changeIcon = (btn, newClass, originClass) => {
        const icon = btn.firstElementChild;
        originClass = originClass || icon.className;
        icon.className = newClass;
        setTimeout(() => icon.className = originClass, this.config.WAIT_RECOVER_INTERVAL);
    }
    _rangeAllFences = rangeFunc => {
        this.utils.entities.querySelectorAllInWrite(".md-fences[cid]").forEach(fence => {
            const codeMirror = fence.querySelector(":scope > .CodeMirror");
            if (!codeMirror) {
                const cid = fence.getAttribute("cid");
                File.editor.fences.addCodeBlock(cid);
            }
            rangeFunc(fence);
        })
    }

    getDynamicActions = (anchorNode, meta) => {
        const HINT = {
            DANGEROUS: this.i18n.t("actHint.dangerous"),
        }
        return this.i18n.fillActions([
            { act_value: "toggle_state_fold", act_state: this.config.ENABLE_FOLD },
            { act_value: "toggle_state_copy", act_state: this.config.ENABLE_COPY },
            { act_value: "toggle_state_indent", act_state: this.enableIndent, act_hidden: !this.supportIndent },
            { act_value: "toggle_state_auto_hide", act_state: this.config.AUTO_HIDE },
            { act_value: "toggle_state_default_fold", act_state: this.config.DEFAULT_FOLD },
            { act_value: "toggle_state_button_hint", act_state: !this.config.REMOVE_BUTTON_HINT },
            { act_value: "add_fences_lang", act_hint: HINT.DANGEROUS },
            { act_value: "replace_fences_lang", act_hint: HINT.DANGEROUS },
            { act_value: "indent_all_fences", act_hint: HINT.DANGEROUS, act_hidden: !this.supportIndent }
        ])
    }

    call = (action, meta) => {
        const callMap = {
            toggle_state_fold: () => {
                this.config.ENABLE_FOLD = !this.config.ENABLE_FOLD
                if (!this.config.ENABLE_FOLD) {
                    document.querySelectorAll(".fold-code.folded").forEach(ele => ele.click())
                }
                const display = this.config.ENABLE_FOLD ? "block" : "none"
                document.querySelectorAll(".fence-enhance .fold-code").forEach(ele => ele.style.display = display)
            },
            toggle_state_copy: () => {
                this.config.ENABLE_COPY = !this.config.ENABLE_COPY
                const display = this.config.ENABLE_COPY ? "block" : "none"
                document.querySelectorAll(".fence-enhance .copy-code").forEach(ele => ele.style.display = display)
            },
            toggle_state_indent: () => {
                this.enableIndent = !this.enableIndent
                const display = this.enableIndent ? "block" : "none"
                document.querySelectorAll(".fence-enhance .indent-code").forEach(ele => ele.style.display = display)
            },
            toggle_state_default_fold: () => {
                this.config.DEFAULT_FOLD = !this.config.DEFAULT_FOLD
                const selector = this.config.DEFAULT_FOLD ? ".fold-code:not(.folded)" : ".fold-code.folded"
                let buttons = [...document.querySelectorAll(selector)]
                if (this.config.DEFAULT_FOLD && this.config.DEFAULT_FOLD_THRESHOLD > 0) {
                    buttons = buttons.filter(btn => {
                        const cid = btn.closest(".md-fences").getAttribute("cid")
                        const lineCount = File.editor.fences.queue[cid].lineCount()
                        return lineCount > this.config.DEFAULT_FOLD_THRESHOLD
                    })
                }
                buttons.forEach(ele => ele.click())
            },
            toggle_state_auto_hide: () => {
                this.config.AUTO_HIDE = !this.config.AUTO_HIDE
                const visibility = this.config.AUTO_HIDE ? "hidden" : ""
                document.querySelectorAll(".fence-enhance").forEach(ele => {
                    // Code blocks in collapsed state cannot be hidden.
                    ele.style.visibility = ele.querySelector(".fold-code.folded") ? "" : visibility
                })
            },
            indent_all_fences: async () => {
                const title = this.i18n.t("modal.indent_all_fences.title")
                const label = this.i18n.t("modal.indent_all_fences.limitedFunctionality")
                const op = { title, components: [{ label, type: "p" }] }
                const { response } = await this.utils.dialog.modalAsync(op)
                if (response === 1) {
                    this._rangeAllFences(this.indentFence)
                }
            },
            add_fences_lang: async () => {
                const title = this.i18n.t("modal.add_fences_lang.title")
                const label = this.i18n.t("modal.add_fences_lang.targetLang")
                const op = { title, components: [{ label, type: "input", value: "javascript" }] }
                const { response, submit: [targetLang] } = await this.utils.dialog.modalAsync(op)
                if (response === 0 || !targetLang) return
                this._rangeAllFences(fence => {
                    const lang = fence.getAttribute("lang")
                    if (lang) return
                    const cid = fence.getAttribute("cid")
                    File.editor.fences.focus(cid)
                    const input = fence.querySelector(".ty-cm-lang-input")
                    if (!input) return
                    input.textContent = targetLang
                    File.editor.fences.tryAddLangUndo(File.editor.getNode(cid), input)
                })
            },
            replace_fences_lang: async () => {
                const title = this.i18n.t("modal.replace_fences_lang.title")
                const labelSource = this.i18n.t("modal.replace_fences_lang.sourceLang")
                const labelTarget = this.i18n.t("modal.replace_fences_lang.targetLang")
                const components = [
                    { label: labelSource, type: "input", value: "js" },
                    { label: labelTarget, type: "input", value: "javascript" }
                ]
                const op = { title, components }
                const { response, submit: [waitToReplaceLang, replaceLang] } = await this.utils.dialog.modalAsync(op)
                if (response === 0 || !waitToReplaceLang || !replaceLang) return
                this._rangeAllFences(fence => {
                    const lang = fence.getAttribute("lang")
                    if (lang && lang !== waitToReplaceLang) return
                    const cid = fence.getAttribute("cid")
                    File.editor.fences.focus(cid)
                    const input = fence.querySelector(".ty-cm-lang-input")
                    if (!input) return
                    input.textContent = replaceLang
                    File.editor.fences.tryAddLangUndo(File.editor.getNode(cid), input)
                })
            },
            toggle_state_button_hint: async () => {
                this.config.REMOVE_BUTTON_HINT = !this.config.REMOVE_BUTTON_HINT
                await this.utils.reload()
            },
        }
        const func = callMap[action]
        func && func()
    }
}

class builder {
    constructor(className, action, hint, iconClassName, enable, listener, extraFunc) {
        this.className = className;
        this.action = action;
        this.hint = hint;
        this.iconClassName = iconClassName;
        this.enable = enable;
        this.listener = listener;
        this.extraFunc = extraFunc;
    }

    createButton(removeHint = false) {
        const button = document.createElement("div")
        button.classList.add("enhance-btn", this.className)
        button.setAttribute("action", this.action)
        if (!removeHint && this.hint) {
            button.setAttribute("ty-hint", this.hint)
        }
        if (!this.enable) {
            button.style.display = "none"
        }

        const span = document.createElement("span")
        span.className = this.iconClassName
        button.appendChild(span)

        return button
    }
}

// doc: https://codemirror.net/5/doc/manual.html
class editorHotkeyHelper {
    constructor(controller) {
        this.controller = controller;
        this.utils = controller.utils;
        this.config = controller.config;
    }

    process = () => {
        const hotkeyDict = {};
        const keyMap = {
            SWAP_PREVIOUS_LINE: () => this.swapLine(true),
            SWAP_NEXT_LINE: () => this.swapLine(false),
            COPY_PREVIOUS_LINE: () => this.copyLine(true),
            COPY_NEXT_LINE: () => this.copyLine(false),
            INSERT_LINE_NEXT: () => this.newlineAndIndent(false),
            INSERT_LINE_PREVIOUS: () => this.newlineAndIndent(true),
        }
        for (const [hotkey, callback] of Object.entries(keyMap)) {
            const hk = this.config[hotkey];
            if (hk) {
                hotkeyDict[hk] = callback;
            }
        }
        this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.afterAddCodeBlock, (cid, fence) => {
            if (fence) {
                fence.addKeyMap(hotkeyDict)
            }
        })
    }

    getFence = () => {
        const anchor = this.utils.getAnchorNode();
        if (anchor.length === 0) return;
        const pre = anchor.closest(".md-fences[cid]")[0];
        if (!pre) return;
        const activeLine = pre.querySelector(".CodeMirror-activeline");
        if (!activeLine) return;
        const cid = pre.getAttribute("cid");
        const fence = File.editor.fences.queue[cid];
        if (!fence) return;

        const separator = fence.lineSeparator() || "\\n";
        const cursor = fence.getCursor();
        const lineNum = cursor.line + 1;
        const lastNum = fence.lastLine() + 1;
        return { pre, cid, fence, cursor, lineNum, lastNum, separator }
    }

    keydown = keyObj => {
        const dict = { shiftKey: false, ctrlKey: false, altKey: false, ...keyObj };
        document.activeElement.dispatchEvent(new KeyboardEvent('keydown', dict));
    }
    // Do not use fence.execCommand("goLineUp"): it checks if the Shift key is pressed.
    goLineUp = () => this.keydown({ key: 'ArrowUp', keyCode: 38, code: 'ArrowUp', which: 38 });
    goLineDown = () => this.keydown({ key: 'ArrowDown', keyCode: 40, code: 'ArrowDown', which: 40 });

    swapLine = (previous = true) => {
        const { fence, separator, lineNum, lastNum } = this.getFence();
        if (!fence || (previous && lineNum === 1) || (!previous && lineNum === lastNum)) return

        const lines = previous
            ? [{ line: lineNum - 2, ch: 0 }, { line: lineNum - 1, ch: null }]
            : [{ line: lineNum - 1, ch: 0 }, { line: lineNum, ch: null }];
        const lineCount = fence.getRange(...lines);
        const lineList = lineCount.split(separator);
        if (lines.length !== 2) return

        const newContent = [lineList[1], separator, lineList[0]].join("");
        fence.replaceRange(newContent, ...lines);
        if (previous) {
            this.goLineUp()
        }
    }

    copyLine = (previous = true) => {
        const { fence, separator, lineNum } = this.getFence();
        if (!fence) return
        const lineContent = fence.getLine(lineNum - 1);
        const newContent = separator + lineContent;
        fence.replaceRange(newContent, { line: lineNum - 1, ch: null });
    }

    newlineAndIndent = (previous = true) => {
        const { fence } = this.getFence();
        if (!fence) return
        if (previous) {
            this.goLineUp()
        }
        fence.execCommand("goLineEnd");
        fence.execCommand("newlineAndIndent");
    }
}

// doc: https://codemirror.net/5/demo/indentwrap.html
class indentedWrappedLineHelper {
    constructor(controller) {
        this.utils = controller.utils;
    }

    process = () => {
        let charWidth = 0;
        const codeIndentSize = File.option.codeIndentSize;
        const callback = (cm, line, elt) => {
            const off = CodeMirror.countColumn(line.text, null, cm.getOption("tabSize")) * charWidth;
            elt.style.textIndent = "-" + off + "px";
            elt.style.paddingLeft = (codeIndentSize + off) + "px";
        }
        this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.afterAddCodeBlock, (cid, fence) => {
            if (fence) {
                charWidth = charWidth || fence.defaultCharWidth();
                fence.on("renderLine", callback);
                setTimeout(() => fence && fence.refresh(), 100);
            }
        })
    }
}

class highlightHelper {
    constructor(plugin) {
        this.utils = plugin.utils
        this.regex = /^([^\(\)]+)\(([^}]+)\)$/
        this.cls = "plugin-fence-enhance-highlight"
    }

    extract = Lang => {
        const match = Lang.match(this.regex)
        if (!match) {
            return { origin: Lang }
        }
        const [origin, lang, line] = match
        return { origin, lang, line }
    }

    parseRange = line => {
        return line
            .split(",")
            .flatMap(part => {
                if (!part.includes("-")) {
                    return [Number(part)]
                }
                const [start, end] = part.split("-").map(Number)
                return Array.from({ length: end - start + 1 }, (_, i) => start + i)
            })
            .map(i => Math.max(i - 1, 0))
    }

    getHighlightObj = fence => fence.options && fence.options.mode && fence.options.mode._highlightObj

    highlightLines = (fence, obj) => {
        obj = obj || this.getHighlightObj(fence)
        if (!obj) return

        const { line } = obj
        if (line) {
            const needHighlightLines = this.parseRange(line)
            needHighlightLines.forEach(i => fence.addLineClass(i, "background", this.cls))
        }
    }

    clearHighlightLines = fence => {
        const last = fence.lastLine()
        for (let i = 0; i <= last; i++) {
            fence.removeLineClass(i, "background", this.cls)
        }
    }

    process = () => {
        this.utils.decorate(() => window, "getCodeMirrorMode", null, mode => {
            if (!mode) {
                return mode
            }
            const isObj = typeof mode === "object"
            const lang = isObj ? mode.name : mode
            const obj = this.extract(lang)
            if (!obj || !obj.lang) {
                return mode
            }
            mode = !isObj ? {} : mode
            mode.name = obj.lang
            mode._highlightObj = obj
            return mode
        }, true)

        this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.afterAddCodeBlock, (_, fence) => this.highlightLines(fence))
        this.utils.decorate(() => File && File.editor && File.editor.fences, "tryAddLangUndo", null, (result, ...args) => {
            const cid = args[0].cid
            const fence = File.editor.fences.queue[cid]

            this.clearHighlightLines(fence)
            const obj = this.getHighlightObj(fence)
            if (obj) {
                this.highlightLines(fence, obj)
            }
        })
    }
}

// doc: https://codemirror.net/5/demo/folding.html
class languageFoldHelper {
    constructor(controller) {
        this.utils = controller.utils;
        this.gutter = "CodeMirror-foldgutter";
    }

    requireModules = async () => {
        const resourcePath = "./plugin/fence_enhance/resource/";
        this.utils.insertStyleFile("plugin-fence-enhance-fold-style", resourcePath + "foldgutter.css");
        require("./resource/foldcode");
        require("./resource/foldgutter");
        const files = await this.utils.Package.FsExtra.readdir(this.utils.joinPath(resourcePath));
        const modules = files.filter(f => f.endsWith("-fold.js"));
        modules.forEach(f => require(this.utils.joinPath(resourcePath, f)));
        console.debug(`[ CodeMirror folding module ] [ ${modules.length} ]:`, modules);
    }

    addFold = (cid, fence) => {
        if (!fence) return;
        if (!fence.options.gutters.includes(this.gutter)) {
            fence.setOption("gutters", [...fence.options.gutters, this.gutter]);
        }
        if (!fence.options.foldGutter) {
            fence.setOption("foldGutter", true);
        }
    }

    process = async () => {
        await this.requireModules();
        this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.afterAddCodeBlock, this.addFold);
    }
}

module.exports = {
    plugin: fenceEnhancePlugin,
}
