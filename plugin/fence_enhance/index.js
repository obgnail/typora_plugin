class fenceEnhancePlugin extends BasePlugin {
    beforeProcess = () => {
        const hasFunc = File && File.editor && File.editor.fences && File.editor.fences.formatContent;
        this.supportIndent = this.config.ENABLE_INDENT && hasFunc;
        this.enableIndent = this.supportIndent;
        this.builders = [];
    }

    styleTemplate = () => ({ bgColorWhenHover: this.config.HIGHLIGHT_WHEN_HOVER ? this.config.HIGHLIGHT_LINE_COLOR : "initial" })

    process = async () => {
        this.utils.runtime.autoSaveConfig(this);

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
                    const cont = this.utils.getFenceContent({ cid });
                    return callbackFunc({ ev, button, cont, fence, cid, plu: this });
                }
                const action = this.utils.randomString();
                this.registerBuilder(action, action, HINT, ICON, !DISABLE, callback, renderFunc);
            })
        }
        const addEnhanceElement = fence => {
            if (!fence) return;
            let enhance = fence.querySelector(".fence-enhance");
            if (!enhance && this.builders.length) {
                enhance = document.createElement("div");
                enhance.setAttribute("class", "fence-enhance");
                if (this.config.AUTO_HIDE) {
                    enhance.style.visibility = "hidden";
                }
                fence.appendChild(enhance);

                const buttons = this.builders.map(builder => builder.createButton(this.config.REMOVE_BUTTON_HINT));
                this.builders.forEach((builder, idx) => {
                    const button = buttons[idx];
                    enhance.appendChild(button);
                    builder.extraFunc && builder.extraFunc(button);
                })
            }
        }

        [
            ["copy-code", "copyCode", "复制", "fa fa-clipboard", this.config.ENABLE_COPY, this.copyCode],
            ["indent-code", "indentCode", "调整缩进", "fa fa-indent", this.enableIndent, this.indentCode],
            ["fold-code", "foldCode", "折叠", "fa fa-minus", this.config.ENABLE_FOLD, this.foldCode, this.defaultFold],
        ].forEach(button => this.registerBuilder(...button));
        registerCustomButtons();

        this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.afterAddCodeBlock, cid => {
            const ele = this.utils.entities.querySelectorInWrite(`.md-fences[cid=${cid}]`);
            addEnhanceElement(ele);
        })

        this.utils.entities.eWrite.addEventListener("click", ev => {
            const target = ev.target.closest(".fence-enhance .enhance-btn");
            if (!target) return;
            ev.preventDefault();
            ev.stopPropagation();
            document.activeElement.blur();
            const action = target.getAttribute("action");
            const builder = this.builders.find(builder => builder.action === action);
            builder && builder.listener(ev, target);
        })

        this.utils.exportHelper.register("fence_enhance", this.beforeExport);

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

    registerBuilder = (className, action, hint, iconClassName, enable, listener, extraFunc) => this.builders.push(new builder(className, action, hint, iconClassName, enable, listener, extraFunc));
    removeBuilder = action => this.builders = this.builders.filter(builder => builder.action !== action);

    beforeExport = () => this.utils.entities.querySelectorAllInWrite(".fold-code.folded").forEach(ele => ele.click())

    defaultFold = foldButton => this.config.FOLD_DEFAULT && foldButton.click();
    copyCode = (ev, copyButton) => {
        const result = this.utils.getFenceContent({ pre: copyButton.closest(".md-fences") });
        navigator.clipboard.writeText(result).then(() => this._changeIcon(copyButton, "fa fa-check", "fa fa-clipboard"));
    }
    foldCode = (ev, foldButton) => {
        const fence = foldButton.closest(".md-fences");
        if (!fence) return;
        const isDiagram = fence.classList.contains("md-fences-advanced");  // 图形不可折叠
        if (isDiagram) return;
        const scroll = fence.querySelector(".CodeMirror-scroll");
        if (!scroll) return;
        const enhance = foldButton.closest(".fence-enhance");
        if (!enhance) return;

        const folded = scroll.style.height && scroll.style.overflowY;
        const [height, overflowY, force, className, visibility] = folded
            ? ["", "", false, "fa fa-minus", "hidden"]
            : [window.getComputedStyle(scroll).lineHeight, this.config.FOLD_OVERFLOW, true, "fa fa-plus", ""];
        scroll.style.height = height;
        scroll.style.overflowY = overflowY;
        foldButton.classList.toggle("folded", force);
        foldButton.firstElementChild.className = className;
        this.config.AUTO_HIDE && (enhance.style.visibility = visibility);
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
        const button = fence.querySelector(".fence-enhance .fold-code.folded");
        button && button.click();
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

    dynamicCallArgsGenerator = (anchorNode, meta) => {
        const HINT = {
            dangerous: "警告：消耗巨量资源并可能导致Typora长时间失去响应",
            fold: "根据语言语法在每行的左侧显示折叠按钮",
            alignment: "不建议开启，需要大量时间去计算缩进，造成性能损失",
            highlight_by_lang: "例 ```js(2, 5-8)``` 表示：高亮第2，5-8行",
        }
        const arr = [
            { arg_name: "启用按钮：折叠", arg_value: "disable_or_enable_fold", arg_state: this.config.ENABLE_FOLD },
            { arg_name: "启用按钮：复制", arg_value: "disable_or_enable_copy", arg_state: this.config.ENABLE_COPY },
            { arg_name: "启用功能：自动隐藏按钮", arg_value: "set_auto_hide", arg_state: this.config.AUTO_HIDE },
            { arg_name: "启用功能：默认折叠代码块", arg_value: "disable_or_enable_fold_default", arg_state: this.config.FOLD_DEFAULT },
            { arg_name: "启用功能：快捷键", arg_value: "disable_or_enable_hotkey", arg_state: this.config.ENABLE_HOTKEY },
            { arg_name: "启用功能：代码折叠", arg_value: "disable_or_enable_fold_lang", arg_state: this.config.ENABLE_LANGUAGE_FOLD, arg_hint: HINT.fold },
            { arg_name: "启用功能：缩进对齐", arg_value: "disable_or_enable_indent_alignment", arg_state: this.config.INDENTED_WRAPPED_LINE, arg_hint: HINT.alignment },
            { arg_name: "启用功能：高亮鼠标悬停的代码行", arg_value: "disable_or_enable_highlight", arg_state: this.config.HIGHLIGHT_WHEN_HOVER },
            { arg_name: "启用功能：通过语言设置高亮行", arg_value: "disable_or_enable_highlight_by_lang", arg_state: this.config.HIGHLIGHT_BY_LANGUAGE, arg_hint: HINT.highlight_by_lang },
            { arg_name: "(危) 为所有无语言代码块添加语言", arg_value: "add_fences_lang", arg_hint: HINT.dangerous },
            { arg_name: "(危) 批量替换代码块语言", arg_value: "replace_fences_lang", arg_hint: HINT.dangerous },
        ];
        if (this.supportIndent) {
            arr.splice(2, 0, { arg_name: "启用按钮：缩进", arg_value: "disable_or_enable_indent", arg_state: this.enableIndent });
            arr.push({ arg_name: "(极危) 调整所有代码块的缩进", arg_value: "indent_all_fences", arg_hint: HINT.dangerous });
        }
        return arr
    }

    call = (type, meta) => {
        const restartTypora = async args => {
            const { response } = await this.utils.showMessageBox({ type: "info", buttons: ["确定", "取消"], message: "重启后生效，确认重启？", ...args })
            if (response === 0) {
                this.utils.restartTypora()
            }
        }

        const callMap = {
            disable_or_enable_fold: () => {
                this.config.ENABLE_FOLD = !this.config.ENABLE_FOLD;
                if (!this.config.ENABLE_FOLD) {
                    document.querySelectorAll(".fold-code.folded").forEach(ele => ele.click());
                }
                const display = this.config.ENABLE_FOLD ? "block" : "none";
                document.querySelectorAll(".fence-enhance .fold-code").forEach(ele => ele.style.display = display);
            },
            disable_or_enable_copy: () => {
                this.config.ENABLE_COPY = !this.config.ENABLE_COPY;
                const display = this.config.ENABLE_COPY ? "block" : "none";
                document.querySelectorAll(".fence-enhance .copy-code").forEach(ele => ele.style.display = display);
            },
            disable_or_enable_indent: () => {
                this.enableIndent = !this.enableIndent;
                const display = this.enableIndent ? "block" : "none";
                document.querySelectorAll(".fence-enhance .indent-code").forEach(ele => ele.style.display = display);
            },
            disable_or_enable_fold_default: () => {
                this.config.FOLD_DEFAULT = !this.config.FOLD_DEFAULT;
                const selector = this.config.FOLD_DEFAULT ? ".fold-code:not(.folded)" : ".fold-code.folded";
                document.querySelectorAll(selector).forEach(ele => ele.click());
            },
            disable_or_enable_fold_lang: async () => {
                this.config.ENABLE_LANGUAGE_FOLD = !this.config.ENABLE_LANGUAGE_FOLD;
                const option = { type: "info", buttons: ["确定", "取消"], title: "preferences", detail: "配置将于重启 Typora 后生效，确认重启？", message: "设置成功" }
                const { response } = await this.utils.showMessageBox(option);
                if (response === 0) {
                    this.utils.restartTypora();
                }
            },
            set_auto_hide: () => {
                this.config.AUTO_HIDE = !this.config.AUTO_HIDE;
                const visibility = (this.config.AUTO_HIDE) ? "hidden" : "";
                document.querySelectorAll(".fence-enhance").forEach(ele => {
                    // 处于折叠状态的代码块不可隐藏
                    ele.style.visibility = ele.querySelector(".fold-code.folded") ? "" : visibility;
                });
            },
            indent_all_fences: async () => {
                const label = "调整缩进功能的能力有限，对于 Python 这种游标卡尺语言甚至会出现误判，你确定吗？";
                const { response } = await this.utils.dialog.modalAsync({ title: "为所有代码块调整缩进", components: [{ label, type: "p" }] });
                if (response === 1) {
                    this._rangeAllFences(this.indentFence);
                }
            },
            add_fences_lang: async () => {
                const components = [{ label: "语言", type: "input", value: "javascript" }];
                const { response, submit: [targetLang] } = await this.utils.dialog.modalAsync({ title: "添加语言", components });
                if (response === 0 || !targetLang) return;
                this._rangeAllFences(fence => {
                    const lang = fence.getAttribute("lang");
                    if (lang) return;
                    const cid = fence.getAttribute("cid");
                    File.editor.fences.focus(cid);
                    const input = fence.querySelector(".ty-cm-lang-input");
                    if (!input) return;
                    input.textContent = targetLang;
                    File.editor.fences.tryAddLangUndo(File.editor.getNode(cid), input);
                })
            },
            replace_fences_lang: async () => {
                const components = [{ label: "被替换语言", type: "input", value: "js" }, { label: "替换语言", type: "input", value: "javascript" }];
                const { response, submit: [waitToReplaceLang, replaceLang] } = await this.utils.dialog.modalAsync({ title: "替换语言", components });
                if (response === 0 || !waitToReplaceLang || !replaceLang) return;
                this._rangeAllFences(fence => {
                    const lang = fence.getAttribute("lang");
                    if (lang && lang !== waitToReplaceLang) return;
                    const cid = fence.getAttribute("cid");
                    File.editor.fences.focus(cid);
                    const input = fence.querySelector(".ty-cm-lang-input");
                    if (!input) return;
                    input.textContent = replaceLang;
                    File.editor.fences.tryAddLangUndo(File.editor.getNode(cid), input);
                })
            },
            disable_or_enable_hotkey: async () => {
                this.config.ENABLE_HOTKEY = !this.config.ENABLE_HOTKEY
                const hotkeys = {
                    "SWAP_PREVIOUS_LINE": "将当前行和上一行互换",
                    "SWAP_NEXT_LINE": "将当前行和下一行互换",
                    "COPY_PREVIOUS_LINE": "复制当前行到上一行",
                    "COPY_NEXT_LINE": "复制当前行到下一行",
                    "INSERT_LINE_PREVIOUS": "直接在上面新建一行",
                    "INSERT_LINE_NEXT": "直接在下面新建一行",
                }
                const detail = Object.entries(hotkeys)
                    .map(([key, name], idx) => `${idx + 1}. ${name}: ${this.config[key]}`)
                    .join("\n")
                const title = this.config.ENABLE_HOTKEY ? "新增快捷键" : "取消快捷键"
                await restartTypora({ title, detail })
            },
            disable_or_enable_indent_alignment: async () => {
                this.config.INDENTED_WRAPPED_LINE = !this.config.INDENTED_WRAPPED_LINE
                const title = this.config.INDENTED_WRAPPED_LINE ? "启动缩进对齐" : "取消缩进对齐"
                await restartTypora({ title })
            },
            disable_or_enable_highlight: async () => {
                this.config.HIGHLIGHT_WHEN_HOVER = !this.config.HIGHLIGHT_WHEN_HOVER
                const title = this.config.HIGHLIGHT_WHEN_HOVER ? "启动高亮代码行" : "取消高亮代码行"
                await restartTypora({ title })
            },
            disable_or_enable_highlight_by_lang: async () => {
                this.config.HIGHLIGHT_BY_LANGUAGE = !this.config.HIGHLIGHT_BY_LANGUAGE
                const title = this.config.HIGHLIGHT_WHEN_HOVER ? "启动高亮代码行" : "取消高亮代码行"
                await restartTypora({ title })
            }
        }
        const func = callMap[type];
        func && func();
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
        const button = document.createElement("div");
        button.classList.add("enhance-btn", this.className);
        button.setAttribute("action", this.action);
        !removeHint && this.hint && button.setAttribute("ty-hint", this.hint);
        const span = document.createElement("span");
        span.className = this.iconClassName;
        button.appendChild(span);
        if (!this.enable) {
            button.style.display = "none";
        }
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
        this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.afterAddCodeBlock, cid => {
            const fence = File.editor.fences.queue[cid];
            fence && fence.addKeyMap(hotkeyDict);
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
    // 不可使用fence.execCommand("goLineUp")：因为它会检测shift键是否被pressed
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
        previous && this.goLineUp();
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
        previous && this.goLineUp();
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
        this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.afterAddCodeBlock, cid => {
            const fence = File.editor.fences.queue[cid];
            if (fence) {
                charWidth = charWidth || fence.defaultCharWidth();
                fence.on("renderLine", callback);
                setTimeout(() => fence && fence.refresh(), 100);
            }
        })
    }
}

class highlightHelper {
    constructor(controller) {
        this.utils = controller.utils;
        this.regexp = /^([^\(\)]+)\(([^}]+)\)$/;
    }

    extract = lang => {
        const match = lang.match(this.regexp);
        if (!match) return { origin: lang }

        const [origin, prefix, line] = match;
        return { origin, prefix, line };
    }

    parseRange = line => {
        return line
            .split(',')
            .flatMap(part => {
                if (!part.includes('-')) return [Number(part)];
                const [start, end] = part.split('-').map(Number);
                return Array.from({ length: end - start + 1 }, (_, i) => start + i)
            })
            .map(e => Math.max(e - 1, 0))
    };

    getEntities = cid => {
        const fence = File.editor.fences.queue[cid];
        const obj = (fence.options && fence.options.mode && fence.options.mode._highlightObj) || undefined;
        return { fence, obj }
    }

    highlightLines = cid => {
        const { fence, obj } = this.getEntities(cid);
        if (!obj) return;
        const { line } = obj;
        if (!line) return;

        const last = fence.lastLine();
        for (let i = 0; i <= last; i++) {
            fence.removeLineClass(i, "background", "plugin-fence-enhance-highlight");
        }

        const needHighlight = this.parseRange(line);
        needHighlight.forEach(e => fence.addLineClass(e, "background", "plugin-fence-enhance-highlight"));
    }

    process = () => {
        this.utils.decorate(() => window, "getCodeMirrorMode", null, mode => {
            if (!mode) return mode;

            const lang = typeof mode === "object" ? mode.name : mode;
            const obj = this.extract(lang);
            if (!obj) return mode;

            mode = typeof mode === "string" ? {} : mode;
            mode.name = obj.prefix;
            mode._highlightObj = obj;
            return mode;
        }, true)

        this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.afterAddCodeBlock, this.highlightLines);
        this.utils.decorate(() => File && File.editor && File.editor.fences, "tryAddLangUndo", null, (result, ...args) => {
            const cid = args[0].cid;
            const { obj } = this.getEntities(cid);
            obj && this.highlightLines(cid);
        });
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

    addFold = cid => {
        const fence = File.editor.fences.queue[cid];
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
};