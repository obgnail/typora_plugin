class fenceEnhancePlugin extends BasePlugin {
    styleTemplate = () => ({ bgColorWhenHover: this.config.HIGHLIGHT_WHEN_HOVER ? this.config.HIGHLIGHT_LINE_COLOR : "initial" })

    init = () => {
        const supportIndent = File && File.editor && File.editor.fences && File.editor.fences.formatContent
        this.supportIndent = this.config.ENABLE_INDENT && supportIndent
        this.enableIndent = this.supportIndent
        this.buttons = []
    }

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
            const evalFn = fnString => {
                const fn = this.utils.safeEval(fnString)
                if (!(fn instanceof Function)) {
                    throw Error(`custom button param is not function: ${fnString}`)
                }
                return fn
            }
            const getParams = (ev, btn) => {
                const fence = btn.closest(".md-fences")
                const cid = fence.getAttribute("cid")
                const cm = File.editor.fences.queue[cid]
                const cont = cm && cm.getValue()
                return { ev, btn, cont, fence, cm, cid, plu: this }
            }
            const normalize = ({ DISABLE, ICON, HINT, ON_INIT, ON_CLICK, ON_RENDER }) => {
                if (DISABLE || !ON_CLICK) return
                try {
                    if (ON_INIT) {
                        const initFn = evalFn(ON_INIT)
                        initFn(this)
                    }
                    const renderFn = ON_RENDER ? evalFn(ON_RENDER) : null
                    const callbackFn = evalFn(ON_CLICK)
                    return {
                        className: "custom-btn",
                        action: this.utils.randomString(),
                        hint: HINT,
                        iconClassName: ICON,
                        enable: !DISABLE,
                        listener: (ev, btn) => callbackFn(getParams(ev, btn)),
                        extraFunc: renderFn,
                    }
                } catch (e) {
                    console.error("Register custom button error:", e)
                }
            }
            this.config.CUSTOM_BUTTONS.map(normalize).filter(Boolean).forEach(this.registerButton)
        }

        const registerBuiltinButtons = () => {
            const _changeIcon = (btn, newClass, originClass) => {
                const icon = btn.firstElementChild
                originClass = originClass || icon.className
                icon.className = newClass
                setTimeout(() => icon.className = originClass, this.config.WAIT_RECOVER_INTERVAL)
            }
            const copyCode = async (ev, btn) => {
                const result = this.utils.getFenceContentByPre(btn.closest(".md-fences"))
                await navigator.clipboard.writeText(result)
                _changeIcon(btn, "fa fa-check", "fa fa-clipboard")
            }
            const indentCode = (ev, btn) => {
                const fence = btn.closest(".md-fences")
                if (!fence || !File.editor.fences.formatContent) return

                const cid = fence.getAttribute("cid")
                File.editor.refocus(cid)
                File.editor.fences.formatContent()
                _changeIcon(btn, "fa fa-check", "fa fa-indent")
            }
            const foldCode = (ev, btn) => {
                const fence = btn.closest(".md-fences")
                if (!fence) return
                const isDiagram = fence.classList.contains("md-fences-advanced")
                if (isDiagram) return  // diagram cannot be folded
                const scroll = fence.querySelector(".CodeMirror-scroll")
                if (!scroll) return
                const enhance = btn.closest(".fence-enhance")
                if (!enhance) return

                const getHeight = () => {
                    const { lineHeight, height } = window.getComputedStyle(scroll)
                    const maxHeight = Math.min(parseFloat(height), parseFloat(lineHeight) * this.config.FOLD_LINES)
                    return maxHeight + "px"
                }
                const folded = scroll.style.height && scroll.style.overflowY
                scroll.style.height = folded ? "" : getHeight()
                scroll.style.overflowY = folded ? "" : this.config.FOLD_OVERFLOW
                btn.classList.toggle("folded", !folded)
                btn.firstElementChild.className = folded ? "fa fa-minus" : "fa fa-plus"
                if (this.config.AUTO_HIDE) {
                    enhance.style.visibility = folded ? "hidden" : ""
                }
            }
            const defaultFold = (foldButton, cid) => {
                const { DEFAULT_FOLD, DEFAULT_FOLD_THRESHOLD: t } = this.config
                const shouldFold = DEFAULT_FOLD && (t <= 0 || t < File.editor.fences.queue[cid].lineCount())
                if (shouldFold) {
                    foldButton.click()
                }
            }
            const builtinButtons = [
                {
                    className: "copy-code",
                    action: "copyCode",
                    hint: this.i18n.t("btn.hint.copy"),
                    iconClassName: "fa fa-clipboard",
                    enable: this.config.ENABLE_COPY,
                    listener: copyCode,
                    extraFunc: null,
                },
                {
                    className: "indent-code",
                    action: "indentCode",
                    hint: this.i18n.t("btn.hint.indent"),
                    iconClassName: "fa fa-indent",
                    enable: this.enableIndent,
                    listener: indentCode,
                    extraFunc: null,
                },
                {
                    className: "fold-code",
                    action: "foldCode",
                    hint: this.i18n.t("btn.hint.fold"),
                    iconClassName: "fa fa-minus",
                    enable: this.config.ENABLE_FOLD,
                    listener: foldCode,
                    extraFunc: defaultFold,
                },
            ]
            builtinButtons.forEach(btn => this.registerButton(btn))
        }

        const handleLifecycleEvents = () => {
            this.utils.exportHelper.register(this.fixedName, () => {
                this.utils.entities.querySelectorAllInWrite(".fold-code.folded").forEach(ele => ele.click())
            })

            this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.afterAddCodeBlock, cid => {
                if (this.buttons.length === 0) return
                const fence = this.utils.entities.querySelectorInWrite(`.md-fences[cid=${cid}]`)
                if (!fence) return
                let enhance = fence.querySelector(".fence-enhance")
                if (enhance) return

                enhance = document.createElement("div")
                enhance.setAttribute("class", "fence-enhance")
                if (this.config.AUTO_HIDE) {
                    enhance.style.visibility = "hidden"
                }
                const buttons = this.buttons.map(btn => {
                    const button = document.createElement("div")
                    button.classList.add("enhance-btn", btn.className)
                    button.setAttribute("action", btn.action)
                    if (!this.config.REMOVE_BUTTON_HINT && btn.hint) {
                        button.setAttribute("ty-hint", btn.hint)
                    }
                    if (!btn.enable) {
                        button.style.display = "none"
                    }
                    const span = document.createElement("span")
                    span.className = btn.iconClassName
                    button.appendChild(span)
                    return button
                })
                enhance.append(...buttons)
                fence.appendChild(enhance)
                this.buttons.forEach((b, idx) => {
                    if (b.extraFunc) {
                        b.extraFunc(buttons[idx], cid)
                    }
                })
            })
        }

        const handleDomEvents = () => {
            this.utils.entities.eWrite.addEventListener("click", ev => {
                const target = ev.target.closest(".fence-enhance .enhance-btn")
                if (!target) return
                ev.preventDefault()
                ev.stopPropagation()
                document.activeElement.blur()
                const action = target.getAttribute("action")
                const btn = this.buttons.find(b => b.action === action)
                if (btn) {
                    btn.listener(ev, target)
                }
            })
            const config = this.config
            this.utils.entities.$eWrite.on("mouseenter", ".md-fences", function () {
                if (config.AUTO_HIDE) {
                    this.querySelector(".fence-enhance").style.visibility = ""
                }
            }).on("mouseleave", ".md-fences", function () {
                if (config.AUTO_HIDE && !this.querySelector(".fold-code.folded")) {
                    this.querySelector(".fence-enhance").style.visibility = "hidden"
                }
            })
        }

        registerBuiltinButtons()
        registerCustomButtons()
        handleLifecycleEvents()
        handleDomEvents()
    }

    registerButton = ({ className, action, hint, iconClassName, enable, listener, extraFunc }) => {
        this.buttons.push({ className, action, hint, iconClassName, enable, listener, extraFunc })
    }
    unregisterButton = action => this.buttons = this.buttons.filter(btn => btn.action !== action)

    copyFence = fence => fence.querySelector(".copy-code").click()
    indentFence = fence => fence.querySelector(".indent-code").click()
    foldFence = fence => fence.querySelector(".fold-code").click()
    expandFence = fence => {
        const button = fence.querySelector(".fence-enhance .fold-code.folded")
        if (button) {
            button.click()
        }
    }

    indentAllFences = () => {
        this.utils.entities.querySelectorAllInWrite(".md-fences[cid]").forEach(fence => {
            const codeMirror = fence.querySelector(":scope > .CodeMirror")
            if (!codeMirror) {
                const cid = fence.getAttribute("cid")
                File.editor.fences.addCodeBlock(cid)
            }
            this.indentFence(fence)
        })
    }

    addFenceLang = async lang => {
        const filterFn = token => token.info === ""
        const handleFn = line => line.endsWith("```") ? line + lang : line
        await this._handleFence(filterFn, handleFn)
    }

    replaceFenceLang = async (sourceLang, targetLang) => {
        const regex = new RegExp(`(?<=\`\`\`)${sourceLang}$`)
        const filterFn = token => token.info === sourceLang
        const handleFn = line => line.replace(regex, targetLang)
        await this._handleFence(filterFn, handleFn)
    }

    _handleFence = async (filterFn, handleFn) => {
        await this.utils.editCurrentFile(content => {
            const lines = content.split(/\r?\n/g)
            this.utils.parseMarkdownBlock(content)
                .filter(token => token.type === "fence")
                .filter(filterFn)
                .map(token => token.map[0])
                .forEach(idx => lines[idx] = handleFn(lines[idx].trimEnd()))
            const joiner = content.includes("\r\n") ? "\r\n" : "\n"
            return lines.join(joiner)
        })
        this.utils.notification.show(this.i18n._t("global", "success"))
    }

    getDynamicActions = (anchorNode, meta) => this.i18n.fillActions([
        { act_value: "toggle_state_fold", act_state: this.config.ENABLE_FOLD },
        { act_value: "toggle_state_copy", act_state: this.config.ENABLE_COPY },
        { act_value: "toggle_state_indent", act_state: this.enableIndent, act_hidden: !this.supportIndent },
        { act_value: "toggle_state_auto_hide", act_state: this.config.AUTO_HIDE },
        { act_value: "toggle_state_default_fold", act_state: this.config.DEFAULT_FOLD },
        { act_value: "add_fences_lang" },
        { act_value: "replace_fences_lang" },
        { act_value: "indent_all_fences", act_hint: this.i18n.t("actHint.dangerous"), act_hidden: !this.supportIndent }
    ])

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
                const title = this.i18n.t("btn.hint.indent")
                const message = this.i18n.t("modal.indent_all_fences.limitedFunctionality")
                const op = { type: "warning", title, message }
                const { response } = await this.utils.showMessageBox(op)
                if (response === 0) {
                    this.indentAllFences()
                }
            },
            add_fences_lang: async () => {
                const op = {
                    title: this.i18n.t("modal.add_fences_lang.title"),
                    schema: [{ fields: [{ key: "targetLang", type: "text", label: this.i18n.t("modal.add_fences_lang.targetLang") }] }],
                    data: { targetLang: "javascript" },
                }
                const { response, data: { targetLang } } = await this.utils.formDialog.modal(op)
                if (response === 1 && targetLang) {
                    await this.addFenceLang(targetLang)
                }
            },
            replace_fences_lang: async () => {
                const fields = [
                    { key: "sourceLang", type: "text", label: this.i18n.t("modal.replace_fences_lang.sourceLang") },
                    { key: "targetLang", type: "text", label: this.i18n.t("modal.replace_fences_lang.targetLang") },
                ]
                const op = {
                    title: this.i18n.t("modal.replace_fences_lang.title"),
                    schema: [{ fields }],
                    data: { sourceLang: "js", targetLang: "javascript" },
                }
                const { response, data: { sourceLang, targetLang } } = await this.utils.formDialog.modal(op)
                if (response === 1 && sourceLang && targetLang) {
                    await this.replaceFenceLang(sourceLang, targetLang)
                }
            },
        }
        const func = callMap[action]
        if (func) func()
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
        const hotkeys = this.getHotkeys()
        this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.afterAddCodeBlock, (cid, fence) => {
            if (fence) fence.addKeyMap(hotkeys)
        })
    }

    getHotkeys = () => {
        const hotkeys = {}
        const keyMap = {
            SWAP_PREVIOUS_LINE: () => this.swapLine(true),
            SWAP_NEXT_LINE: () => this.swapLine(false),
            COPY_PREVIOUS_LINE: () => this.copyLine(true),
            COPY_NEXT_LINE: () => this.copyLine(false),
            INSERT_LINE_NEXT: () => this.newlineAndIndent(false),
            INSERT_LINE_PREVIOUS: () => this.newlineAndIndent(true),
        }
        for (const [hotkey, callback] of Object.entries(keyMap)) {
            const hk = this.config[hotkey]
            if (hk) {
                hotkeys[hk] = callback
            }
        }
        this.config.CUSTOM_HOTKEYS.forEach(({ DISABLE, HOTKEY, CALLBACK }) => {
            if (DISABLE || !HOTKEY || !CALLBACK) return
            const fn = this.utils.safeEval(CALLBACK)
            if (!(fn instanceof Function)) {
                throw Error(`CALLBACK param is not function: ${CALLBACK}`)
            }
            hotkeys[HOTKEY] = () => fn(this.getFence())
        })
        return hotkeys
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
        this.pattern = new RegExp(plugin.config.HIGHLIGHT_PATTERN)
        this.numberingBase = (plugin.config.NUMBERING_BASE === "0-based") ? 0 : 1
        this.className = "plugin-fence-enhance-highlight"
    }

    extract = langStr => {
        const match = langStr.match(this.pattern)
        return match ? { origin: langStr, ...match.groups } : { origin: langStr }
    }

    parse = line => {
        return line
            .split(",")
            .filter(Boolean)
            .flatMap(part => {
                if (!part.includes("-")) {
                    return [Number(part)]
                }
                const [start, end] = part.split("-").map(Number)
                return Array.from({ length: end - start + 1 }, (_, i) => start + i)
            })
            .map(i => Math.max(i - this.numberingBase, 0))
    }

    _setHighlightLines = (fence) => {
        const info = fence.options && fence.options.mode && fence.options.mode._highlightInfo
        if (info && info.line) {
            const needHighlightLines = this.parse(info.line)
            needHighlightLines.forEach(i => fence.addLineClass(i, "background", this.className))
        }
    }

    _clearHighlightLines = fence => {
        const last = fence.lastLine()
        for (let i = 0; i <= last; i++) {
            fence.removeLineClass(i, "background", this.className)
        }
    }

    process = () => {
        let _highlightInfo
        const before = (mode, ...rest) => {
            _highlightInfo = this.extract(mode)
            const newMode = _highlightInfo.lang || mode
            return [newMode, ...rest]
        }
        const after = (mode) => {
            if (typeof mode !== "object") {
                mode = { name: mode }
            }
            mode._highlightInfo = _highlightInfo
            return mode
        }
        this.utils.decorate(() => window, "getCodeMirrorMode", before, after, true, true)

        this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.afterAddCodeBlock, (_, fence) => fence.operation(() => this._setHighlightLines(fence)))

        this.utils.decorate(() => File && File.editor && File.editor.fences, "tryAddLangUndo", null, (result, cm) => {
            const cid = cm && cm.cid
            if (cid) {
                const fence = File.editor.fences.queue[cid]
                fence.operation(() => {
                    this._clearHighlightLines(fence)
                    this._setHighlightLines(fence)
                })
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
