class FenceEnhancePlugin extends BasePlugin {
    styleTemplate = () => ({ bgColorWhenHover: this.config.HIGHLIGHT_WHEN_HOVER ? this.config.HIGHLIGHT_LINE_COLOR : "initial" })

    init = () => {
        this.supportIndent = this.config.ENABLE_INDENT && File.editor.fences?.formatContent
        this.enableIndent = this.supportIndent
        this.buttons = []
    }

    process = async () => {
        this.utils.settings.autoSaveSettings(this)

        if (this.config.ENABLE_HOTKEY) {
            new EditorHotkeyHelper(this).process()
        }
        if (this.config.INDENTED_WRAPPED_LINE) {
            indentWrappedLine(this)
        }
        if (this.config.ENABLE_BUTTON) {
            this.processButton()
        }
        if (this.config.PRELOAD_ALL_FENCES) {
            this.preloadAllFences()
        }
        if (this.config.HIGHLIGHT_BY_LANGUAGE) {
            new HighlightHelper(this).process()
        }
        if (this.config.ENABLE_LANGUAGE_FOLD) {
            await foldLanguage(this)
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
            const getParams = ({ cm, ...reset }) => ({ cont: cm.getValue(), plu: this, cm, ...reset })
            const normalize = ({ DISABLE, ICON, HINT, ON_INIT, ON_CLICK, ON_RENDER }) => {
                if (DISABLE || !ON_CLICK) return
                try {
                    const callbackFn = evalFn(ON_CLICK)
                    return {
                        action: this.utils.randomString(),
                        hint: HINT,
                        iconClassName: ICON,
                        enable: !DISABLE,
                        listener: (args) => callbackFn(getParams(args)),
                        extraFunc: ON_RENDER ? evalFn(ON_RENDER) : null,
                        initFunc: ON_INIT ? evalFn(ON_INIT) : null,
                    }
                } catch (e) {
                    console.error("Register custom button error:", e)
                }
            }
            this.config.CUSTOM_BUTTONS.map(normalize).filter(Boolean).forEach(this.registerButton)
        }

        const registerBuiltinButtons = () => {
            const _showIconFeedback = (btnEl, feedbackClass, originalClass) => {
                const icon = btnEl.firstElementChild
                icon.className = feedbackClass
                setTimeout(() => icon.className = originalClass, this.config.WAIT_RECOVER_INTERVAL)
            }
            const _getFenceHeight = (cm, retainedLines) => {
                const textHeight = cm.display.cachedTextHeight || cm.defaultTextHeight()
                const height = Math.min(cm.lineCount(), retainedLines) * textHeight
                return height + "px"
            }
            const copyCode = async ({ btn, fence, cid }) => {
                let content = this.utils.getFenceContentByCid(cid)
                if (this.config.TRIM_WHITESPACE_ON_COPY) {
                    content = content.trim()
                }
                if (this.config.COPY_AS_MARKDOWN) {
                    const lang = fence.getAttribute("lang")
                    content = `\`\`\`${lang}\n${content}\n\`\`\``
                }
                if (this.config.LINE_BREAKS_ON_COPY !== "preserve") {
                    const [regex, replacer] = this.config.LINE_BREAKS_ON_COPY === "lf" ? [/\r\n/g, "\n"] : [/\r?\n/g, "\r\n"]
                    content = content.replace(regex, replacer)
                }
                await navigator.clipboard.writeText(content)
                _showIconFeedback(btn, "fa fa-check", "fa fa-clipboard")
            }
            const indentCode = ({ btn, fence, cid }) => {
                const lang = fence.getAttribute("lang")
                if (this.config.EXCLUDE_LANGUAGE_ON_INDENT.includes(lang)) return
                File.editor.refocus(cid)
                File.editor.fences.formatContent()
                _showIconFeedback(btn, "fa fa-check", "fa fa-indent")
            }
            const foldCode = ({ ev, btn, fence, cm }) => {
                const scroller = cm.display.scroller
                if (!scroller) return
                const isDiagram = fence.classList.contains("md-fences-advanced")
                if (isDiagram) return  // diagram cannot be folded
                const folded = btn.classList.contains("folded")
                const retainedLines = ev.isTrusted ? this.config.MANUAL_FOLD_LINES : this.config.AUTO_FOLD_LINES
                cm.setSize(null, folded ? "100%" : _getFenceHeight(cm, retainedLines))
                scroller.style.overflowY = folded ? "" : this.config.FOLD_OVERFLOW
                btn.classList.toggle("folded", !folded)
                btn.firstElementChild.className = folded ? "fa fa-minus" : "fa fa-plus"
                if (this.config.AUTO_HIDE) {
                    btn.closest(".fence-enhance").style.visibility = folded ? "hidden" : ""
                }
            }
            const defaultFold = ({ btn, cid }) => {
                const { DEFAULT_FOLD, DEFAULT_FOLD_THRESHOLD: threshold } = this.config
                if (!DEFAULT_FOLD) return
                const cm = File.editor.fences.queue[cid]
                if (!cm) return
                const shouldFold = threshold <= 0 || threshold < cm.lineCount()
                if (shouldFold) btn.click()
            }
            const autoFold = () => {
                const { EXPAND_ON_FOCUS, FOLD_ON_BLUR, DEFAULT_FOLD } = this.config
                if (!DEFAULT_FOLD) return
                if (!EXPAND_ON_FOCUS && !FOLD_ON_BLUR) return

                let lastFocusFenceCid = ""
                const fold = (cid) => {
                    if (FOLD_ON_BLUR && cid) {
                        const btn = this.utils.entities.querySelectorInWrite(`.md-fences[cid="${cid}"] .enhance-btn:not(.folded)[action="fold"]`)
                        if (btn) defaultFold({ btn, cid })
                    }
                    lastFocusFenceCid = ""
                }
                const expand = (fence) => {
                    const cid = fence.getAttribute("cid")
                    if (EXPAND_ON_FOCUS && lastFocusFenceCid !== cid) {
                        const btn = fence.querySelector('.enhance-btn.folded[action="fold"]')
                        if (btn) defaultFold({ btn, cid })
                        if (lastFocusFenceCid) fold(lastFocusFenceCid)
                    }
                    lastFocusFenceCid = cid
                }
                $("#write").on("cursorChange", (ev, cursorContext) => {
                    if (!cursorContext) return
                    const focusing = cursorContext.style.block.includes("fences")
                    if (focusing) {
                        expand(cursorContext.cursor.commonAncestorContainer.closest(".md-fences"))
                    } else {
                        fold(lastFocusFenceCid)
                    }
                })
            }
            const builtinButtons = [
                {
                    action: "copy",
                    hint: this.i18n.t("btn.hint.copy"),
                    iconClassName: "fa fa-clipboard",
                    enable: this.config.ENABLE_COPY,
                    listener: copyCode,
                    extraFunc: null,
                    initFunc: null,
                },
                {
                    action: "indent",
                    hint: this.i18n.t("btn.hint.indent"),
                    iconClassName: "fa fa-indent",
                    enable: this.enableIndent,
                    listener: indentCode,
                    extraFunc: null,
                    initFunc: null,
                },
                {
                    action: "fold",
                    hint: this.i18n.t("btn.hint.fold"),
                    iconClassName: "fa fa-minus",
                    enable: this.config.ENABLE_FOLD,
                    listener: foldCode,
                    extraFunc: defaultFold,
                    initFunc: autoFold,
                },
            ]
            builtinButtons.forEach(btn => this.registerButton(btn))
        }

        const handleLifecycleEvents = () => {
            this.utils.exportHelper.register(this.fixedName, () => {
                this.utils.entities.querySelectorAllInWrite('.enhance-btn.folded[action="fold"]').forEach(el => el.click())
            })
            const eventHub = this.utils.eventHub
            eventHub.addEventListener(eventHub.eventType.allPluginsHadInjected, () => {
                this.buttons.filter(btn => btn.enable && typeof btn.initFunc === "function").forEach(btn => btn.initFunc(this))
            })
            eventHub.addEventListener(eventHub.eventType.afterAddCodeBlock, (cid, cm) => {
                if (this.buttons.length === 0) return
                const fence = cm?.display.wrapper.parentElement ?? this.utils.entities.querySelectorInWrite(`.md-fences[cid=${cid}]`)
                if (!fence) return
                let enhance = fence.querySelector(".fence-enhance")
                if (enhance) return

                enhance = document.createElement("div")
                enhance.setAttribute("class", "fence-enhance")
                if (this.config.AUTO_HIDE) {
                    enhance.style.visibility = "hidden"
                }
                const buttons = this.buttons.map(btn => {
                    const btnEl = document.createElement("div")
                    btnEl.classList.add("enhance-btn")
                    btnEl.setAttribute("action", btn.action)
                    if (!this.config.REMOVE_BUTTON_HINT && btn.hint) {
                        btnEl.setAttribute("ty-hint", btn.hint)
                    }
                    if (!btn.enable) {
                        btnEl.style.display = "none"
                    }
                    const i = document.createElement("i")
                    i.className = btn.iconClassName
                    btnEl.appendChild(i)
                    return btnEl
                })
                enhance.append(...buttons)
                fence.appendChild(enhance)
                this.buttons.forEach((b, idx) => b.extraFunc?.({ btn: buttons[idx], cid, fence, enhance }))
            })
        }

        const handleDomEvents = () => {
            this.utils.entities.eWrite.addEventListener("click", ev => {
                const btn = ev.target.closest(".fence-enhance .enhance-btn")
                if (!btn) return
                const action = btn.getAttribute("action")
                if (!action) return
                const fence = btn.closest(".md-fences")
                if (!fence) return
                const cid = fence.getAttribute("cid")
                if (!cid) return
                const cm = File.editor.fences.queue[cid]
                if (!cm) return

                ev.preventDefault()
                ev.stopPropagation()
                document.activeElement.blur()
                const button = this.buttons.find(b => b.action === action)
                button?.listener({ ev, btn, fence, cid, cm })
            })
            const config = this.config
            this.utils.entities.$eWrite.on("mouseenter", ".md-fences", function () {
                if (config.AUTO_HIDE) {
                    this.querySelector(".fence-enhance").style.visibility = ""
                }
            }).on("mouseleave", ".md-fences", function () {
                if (config.AUTO_HIDE && !this.querySelector('.enhance-btn.folded[action="fold"]')) {
                    this.querySelector(".fence-enhance").style.visibility = "hidden"
                }
            })
        }

        registerBuiltinButtons()
        registerCustomButtons()
        handleLifecycleEvents()
        handleDomEvents()
    }

    preloadAllFences = () => {
        const preload = () => this.traverseAllFences(this.utils.noop)
        this.utils.eventHub.once(this.utils.eventHub.eventType.fileOpened, () => setTimeout(preload, 3000))
        this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.fileContentLoaded, preload)
    }

    registerButton = ({ action, hint, iconClassName, enable, listener, extraFunc, initFunc }) => {
        this.buttons.push({ action, hint, iconClassName, enable, listener, extraFunc, initFunc })
    }
    unregisterButton = action => this.buttons = this.buttons.filter(btn => btn.action !== action)

    copyFence = fence => fence.querySelector('.enhance-btn[action="copy"]').click()
    indentFence = fence => fence.querySelector('.enhance-btn[action="indent"]').click()
    foldFence = fence => fence.querySelector('.enhance-btn[action="fold"]').click()
    expandFence = fence => fence.querySelector('.enhance-btn.folded[action="fold"]')?.click()
    indentAllFences = () => this.traverseAllFences(({ fence }) => this.indentFence(fence))

    traverseAllFences = (visitor) => {
        this.utils.entities.querySelectorAllInWrite(".md-fences[cid]").forEach(fence => {
            const cid = fence.getAttribute("cid")
            const cm = File.editor.fences.queue[cid] || File.editor.fences.addCodeBlock(cid)
            visitor({ fence, cm, cid })
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
        this.utils.notification.show(this.i18n.t("success"))
    }

    getDynamicActions = (anchorNode, meta) => this.i18n.fillActions([
        { act_value: "toggle_state_fold", act_state: this.config.ENABLE_FOLD },
        { act_value: "toggle_state_copy", act_state: this.config.ENABLE_COPY },
        { act_value: "toggle_state_indent", act_state: this.enableIndent, act_hidden: !this.supportIndent },
        { act_value: "toggle_state_auto_hide", act_state: this.config.AUTO_HIDE },
        { act_value: "toggle_state_default_fold", act_state: this.config.DEFAULT_FOLD },
        { act_value: "add_fences_lang" },
        { act_value: "replace_fences_lang" },
        { act_value: "indent_all_fences", act_hint: this.i18n.t("$tooltip.dangerous"), act_hidden: !this.supportIndent }
    ])

    call = (action, meta) => {
        const callMap = {
            toggle_state_fold: () => {
                this.config.ENABLE_FOLD = !this.config.ENABLE_FOLD
                if (!this.config.ENABLE_FOLD) {
                    document.querySelectorAll('.fence-enhance > .enhance-btn.folded[action="fold"]').forEach(el => el.click())
                }
                const display = this.config.ENABLE_FOLD ? "block" : "none"
                document.querySelectorAll('.fence-enhance > .enhance-btn[action="fold"]').forEach(el => el.style.display = display)
            },
            toggle_state_copy: () => {
                this.config.ENABLE_COPY = !this.config.ENABLE_COPY
                const display = this.config.ENABLE_COPY ? "block" : "none"
                document.querySelectorAll('.fence-enhance > [action="copy"]').forEach(el => el.style.display = display)
            },
            toggle_state_indent: () => {
                this.enableIndent = !this.enableIndent
                const display = this.enableIndent ? "block" : "none"
                document.querySelectorAll('.fence-enhance > [action="indent"]').forEach(el => el.style.display = display)
            },
            toggle_state_default_fold: () => {
                this.config.DEFAULT_FOLD = !this.config.DEFAULT_FOLD
                const selector = this.config.DEFAULT_FOLD ? '.enhance-btn:not(.folded)[action="fold"]' : '.enhance-btn.folded[action="fold"]'
                let buttons = [...document.querySelectorAll(selector)]
                if (this.config.DEFAULT_FOLD && this.config.DEFAULT_FOLD_THRESHOLD > 0) {
                    buttons = buttons.filter(btn => {
                        const cid = btn.closest(".md-fences").getAttribute("cid")
                        const lineCount = File.editor.fences.queue[cid].lineCount()
                        return lineCount > this.config.DEFAULT_FOLD_THRESHOLD
                    })
                }
                buttons.forEach(el => el.click())
            },
            toggle_state_auto_hide: () => {
                this.config.AUTO_HIDE = !this.config.AUTO_HIDE
                const visibility = this.config.AUTO_HIDE ? "hidden" : ""
                document.querySelectorAll(".fence-enhance").forEach(el => {
                    // Code blocks in collapsed state cannot be hidden.
                    el.style.visibility = el.querySelector('.enhance-btn.folded[action="fold"]') ? "" : visibility
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
        callMap[action]?.()
    }
}

// doc: https://codemirror.net/5/doc/manual.html
class EditorHotkeyHelper {
    constructor(plugin) {
        this.utils = plugin.utils
        this.config = plugin.config
    }

    process = () => {
        const hotkeys = this.getHotkeys()
        this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.afterAddCodeBlock, (cid, cm) => cm?.addKeyMap(hotkeys))
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
            hotkeys[HOTKEY] = () => fn(this.getFocusedFence())
        })
        return hotkeys
    }

    getFocusedFence = () => {
        const pre = this.utils.getAnchorNode(".md-fences[cid]")?.[0]
        if (!pre) return
        const activeLine = pre.querySelector(".CodeMirror-activeline")
        if (!activeLine) return
        const cid = pre.getAttribute("cid")
        const cm = File.editor.fences.queue[cid]
        if (!cm) return

        const separator = cm.lineSeparator() || "\\n"
        const cursor = cm.getCursor()
        const lineNum = cursor.line + 1
        const lastNum = cm.lastLine() + 1
        return { pre, cid, cm, cursor, lineNum, lastNum, separator }
    }

    keydown = keyObj => {
        const dict = { shiftKey: false, ctrlKey: false, altKey: false, ...keyObj }
        document.activeElement.dispatchEvent(new KeyboardEvent("keydown", dict))
    }
    // Do not use `cm.execCommand("goLineUp")`: it checks if the Shift key is pressed.
    goLineUp = () => this.keydown({ key: "ArrowUp", keyCode: 38, code: "ArrowUp", which: 38 })
    goLineDown = () => this.keydown({ key: "ArrowDown", keyCode: 40, code: "ArrowDown", which: 40 })

    swapLine = (previous = true) => {
        const { cm, separator, lineNum, lastNum } = this.getFocusedFence()
        if (!cm || (previous && lineNum === 1) || (!previous && lineNum === lastNum)) return

        const lines = previous
            ? [{ line: lineNum - 2, ch: 0 }, { line: lineNum - 1, ch: null }]
            : [{ line: lineNum - 1, ch: 0 }, { line: lineNum, ch: null }]
        const lineCount = cm.getRange(...lines)
        const lineList = lineCount.split(separator)
        if (lines.length !== 2) return

        const newContent = [lineList[1], separator, lineList[0]].join("")
        cm.replaceRange(newContent, ...lines)
        if (previous) this.goLineUp()
    }

    copyLine = (previous = true) => {
        const { cm, separator, lineNum } = this.getFocusedFence()
        if (!cm) return
        const lineContent = cm.getLine(lineNum - 1)
        const newContent = separator + lineContent
        cm.replaceRange(newContent, { line: lineNum - 1, ch: null })
    }

    newlineAndIndent = (previous = true) => {
        const { cm } = this.getFocusedFence()
        if (!cm) return
        if (previous) this.goLineUp()
        cm.execCommand("goLineEnd")
        cm.execCommand("newlineAndIndent")
    }
}

// doc: https://codemirror.net/5/demo/indentwrap.html
const indentWrappedLine = ({ utils }) => {
    let charWidth = 0
    const codeIndentSize = File.option.codeIndentSize
    const callback = (cm, line, elt) => {
        const off = CodeMirror.countColumn(line.text, null, cm.getOption("tabSize")) * charWidth
        elt.style.textIndent = "-" + off + "px"
        elt.style.paddingLeft = (codeIndentSize + off) + "px"
    }
    utils.eventHub.addEventListener(utils.eventHub.eventType.afterAddCodeBlock, (cid, cm) => {
        if (cm) {
            charWidth = charWidth || cm.defaultCharWidth()
            cm.on("renderLine", callback)
            setTimeout(() => cm?.refresh(), 100)
        }
    })
}

class HighlightHelper {
    constructor(plugin) {
        this.utils = plugin.utils
        this.pattern = new RegExp(plugin.config.HIGHLIGHT_PATTERN)
        this.numberingBase = (plugin.config.NUMBERING_BASE === "0-based") ? 0 : 1
        this.className = "plugin-fence-enhance-highlight"
    }

    _setHighlight = (cm) => {
        const line = cm?.options?.mode?.__highlight?.line
        if (!line) return

        const lastLine = cm.lastLine()
        const lineNumbers = line
            .split(",")
            .filter(Boolean)
            .flatMap(part => {
                if (!part.includes("-")) return [Number(part)]
                const [start, end] = part.split("-").map(Number)
                return Array.from({ length: end - start + 1 }, (_, i) => start + i)
            })
            .map(n => n - this.numberingBase)
            .filter(n => n >= 0 && n <= lastLine)

        cm.__highlight_handles = [...new Set(lineNumbers)].map(lineNo => {
            const handle = cm.getLineHandle(lineNo)
            cm.addLineClass(handle, "background", this.className)
            return handle
        })
    }

    _clearHighlight = cm => {
        const handles = cm.__highlight_handles
        if (Array.isArray(handles) && handles.length > 0) {
            handles.filter(handle => handle?.parent).forEach(handle => cm.removeLineClass(handle, "background", this.className))
        }
        cm.__highlight_handles = null
    }

    _rerender = (cm) => {
        cm?.operation(() => {
            this._clearHighlight(cm)
            this._setHighlight(cm)
        })
    }

    process = () => {
        let context
        const handleLineChange = (cm, changeObj) => {
            const isLineCountChanged = changeObj.text.length !== changeObj.removed.length
            if (isLineCountChanged) this._rerender(cm)
        }
        const extract = mode => {
            const match = mode.match(this.pattern)
            return match ? { origin: mode, ...match.groups } : { origin: mode }
        }
        const before = (mode, ...rest) => {
            if (mode == null) return [mode, ...rest]
            context = extract(mode)
            const newMode = context.lang || mode
            return [newMode, ...rest]
        }
        const after = (mode) => {
            if (mode == null) return mode
            if (typeof mode !== "object") {
                mode = { name: mode }
            }
            mode.__highlight = context
            context = null
            return mode
        }
        this.utils.decorate(() => window, "getCodeMirrorMode", before, after, true, true)
        this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.afterAddCodeBlock, (cid, cm) => {
            this._rerender(cm)
            cm.off("change", handleLineChange)
            cm.on("change", handleLineChange)
        })
        this.utils.decorate(() => File?.editor?.fences, "tryAddLangUndo", null, (_, node) => {
            const cid = node?.cid
            if (cid) this._rerender(File.editor.fences.queue[cid])
        })
    }
}

// doc: https://codemirror.net/5/demo/folding.html
const foldLanguage = async ({ utils }) => {
    const requireModules = async () => {
        const resourcePath = "./plugin/fence_enhance/resource/"
        utils.insertStyleFile("plugin-fence-enhance-fold-style", resourcePath + "foldgutter.css")
        require("./resource/foldcode")
        require("./resource/foldgutter")
        const files = await utils.Package.FsExtra.readdir(utils.joinPath(resourcePath))
        const modules = files.filter(f => f.endsWith("-fold.js"))
        modules.forEach(f => require(utils.joinPath(resourcePath, f)))
        console.debug(`[ CodeMirror folding module ] [ ${modules.length} ]:`, modules)
    }

    const handle = () => {
        const gutter = "CodeMirror-foldgutter"
        utils.eventHub.addEventListener(utils.eventHub.eventType.afterAddCodeBlock, (cid, cm) => {
            if (!cm) return
            if (!cm.options.gutters.includes(gutter)) {
                cm.setOption("gutters", [...cm.options.gutters, gutter])
            }
            if (!cm.options.foldGutter) {
                cm.setOption("foldGutter", true)
            }
        })
    }

    await requireModules()
    handle()
}

module.exports = {
    plugin: FenceEnhancePlugin
}
