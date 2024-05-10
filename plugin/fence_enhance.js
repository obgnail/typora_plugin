class fenceEnhancePlugin extends BasePlugin {
    beforeProcess = () => {
        this.enableIndent = this.config.ENABLE_INDENT && !this.utils.isBetaVersion;
    }

    styleTemplate = () => ({bgColorWhenHover: this.config.HIGHLIGHT_WHEN_HOVER ? this.config.HIGHLIGHT_LINE_COLOR : "initial"})

    process = () => {
        if (this.config.ENABLE_HOTKEY) {
            new editorHotkey(this).process();
        }
        if (this.config.INDENTED_WRAPPED_LINE) {
            this.processIndentedWrappedLine();
        }
        if (this.config.ENABLE_BUTTON) {
            this.processButton();
        }
    }

    processIndentedWrappedLine = () => {
        let charWidth = 0;
        const codeIndentSize = File.option.codeIndentSize;
        const callback = (cm, line, elt) => {
            const off = CodeMirror.countColumn(line.text, null, cm.getOption("tabSize")) * charWidth;
            elt.style.textIndent = "-" + off + "px";
            elt.style.paddingLeft = (codeIndentSize + off) + "px";
        }
        this.utils.addEventListener(this.utils.eventType.afterAddCodeBlock, cid => {
            const fence = File.editor.fences.queue[cid];
            if (fence) {
                charWidth = charWidth || fence.defaultCharWidth();
                fence.on("renderLine", callback);
                setTimeout(() => fence && fence.refresh(), 100);
            }
        })
    }

    initVar = () => {
        this.builders = [];
        this.lastClickTime = 0;
        this.dangerousHint = "警告：消耗巨量资源并导致Typora长时间失去响应";
        this.callArgs = [
            {arg_name: "自动隐藏/显示按钮", arg_value: "set_auto_hide"},
            {arg_name: "禁用/启用按钮：折叠", arg_value: "disable_or_enable_fold"},
            {arg_name: "禁用/启用按钮：复制", arg_value: "disable_or_enable_copy"},
            {arg_name: "总是折叠代码块", arg_value: "fold_all"},
            {arg_name: "总是展开代码块", arg_value: "expand_all"},
        ];

        if (this.enableIndent) {
            this.callArgs.splice(2, 0, {arg_name: "禁用/启用按钮：缩进调整", arg_value: "disable_or_enable_indent"});
        }
    }

    processButton = () => {
        this.initVar();

        [
            ["copy-code", "copyCode", "复制", "fa fa-clipboard", this.config.ENABLE_COPY, this.copyCode],
            ["indent-code", "indentCode", "调整缩进", "fa fa-indent", this.enableIndent, this.indentCode],
            ["fold-code", "foldCode", "折叠", "fa fa-minus", this.config.ENABLE_FOLD, this.foldCode, this.defaultFold],
        ].forEach(button => this.registerBuilder(...button));

        this.registerCustomButtons();

        this.utils.addEventListener(this.utils.eventType.afterAddCodeBlock, cid => {
            const ele = document.querySelector(`#write .md-fences[cid=${cid}]`);
            this.addEnhanceElement(ele);
        })

        document.getElementById("write").addEventListener("click", ev => {
            const target = ev.target.closest(".fence-enhance .enhance-btn");
            if (!target) return;
            ev.preventDefault();
            ev.stopPropagation();
            document.activeElement.blur();
            const action = target.getAttribute("action");
            const builder = this.builders.find(builder => builder.action === action);
            builder && builder.listener(ev, target);
        })

        this.utils.registerExportHelper("fence_enhance", this.beforeExport);

        const config = this.config;
        $("#write").on("mouseenter", ".md-fences", function () {
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
        this.builders.push(new builder(className, action, hint, iconClassName, enable, listener, extraFunc));
    }

    registerCustomButtons = () => {
        const evalFunc = arg => {
            const func = eval(arg);
            if (!(func instanceof Function)) {
                throw Error(`custom button arg is not function: ${arg}`)
            }
            return func
        }
        this.config.CUSTOM_BUTTONS.forEach(btn => {
            const {DISABLE, ICON, HINT, ON_INIT, ON_CLICK, ON_RENDER} = btn;
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
                const cont = this.utils.getFenceContent(fence);
                return callbackFunc({ev, button, cont, fence, cid, plu: this});
            }
            const action = this.utils.randomString();
            this.registerBuilder(action, action, HINT, ICON, !DISABLE, callback, renderFunc);
        })
    }

    removeBuilder = action => this.builders = this.builders.filter(builder => builder.action !== action);

    addEnhanceElement = fence => {
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

    beforeExport = () => document.querySelectorAll("#write .fold-code.folded").forEach(ele => ele.click())

    defaultFold = foldButton => this.config.FOLD_DEFAULT && foldButton.click();

    changeIcon = (btn, newClass, originClass) => {
        const icon = btn.firstElementChild;
        originClass = originClass || icon.className;
        icon.className = newClass;
        setTimeout(() => icon.className = originClass, this.config.WAIT_RECOVER_INTERVAL);
    }

    copyCode = (ev, copyButton) => {
        if (ev.timeStamp - this.lastClickTime < this.config.CLICK_CHECK_INTERVAL) return;
        this.lastClickTime = ev.timeStamp;

        const result = this.utils.getFenceContent(copyButton.closest(".md-fences"));
        navigator.clipboard.writeText(result).then(() => this.changeIcon(copyButton, "fa fa-check", "fa fa-clipboard"));
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

        this.changeIcon(indentButton, "fa fa-check", "fa fa-indent");
    }

    dynamicCallArgsGenerator = (anchorNode, meta) => {
        const target = anchorNode.closest("#write .md-fences");
        meta.target = target;

        const arr = [];
        if (this.enableIndent) {
            arr.push({arg_name: "调整缩进", arg_value: "indent_current"});
            if (this.config.ENABLE_DANGEROUS_FEATURES) {
                arr.push(
                    {arg_name: "(危)调整所有代码块的缩进", arg_value: "indent_all_fences", arg_hint: this.dangerousHint},
                    {arg_name: "(危)为所有无语言代码块添加语言", arg_value: "add_fences_lang", arg_hint: this.dangerousHint},
                    {arg_name: "(危)批量替换代码块语言", arg_value: "replace_fences_lang", arg_hint: this.dangerousHint},
                );
            }
        }
        arr.push(
            {arg_name: "折叠/展开代码块", arg_value: "fold_current", arg_disabled: !target},
            {arg_name: "复制代码", arg_value: "copy_current", arg_disabled: !target}
        );
        return arr
    }

    rangeAllFences = rangeFunc => {
        document.querySelectorAll("#write .md-fences[cid]").forEach(fence => {
            const codeMirror = fence.querySelector(":scope > .CodeMirror");
            if (!codeMirror) {
                const cid = fence.getAttribute("cid");
                File.editor.fences.addCodeBlock(cid);
            }
            rangeFunc(fence);
        })
    }

    copyFence = target => target.querySelector(".copy-code").click();
    indentFence = target => target.querySelector(".indent-code").click();
    foldFence = target => target.querySelector(".fold-code").click();
    expandFence = fence => {
        const button = fence.querySelector(".fence-enhance .fold-code.folded");
        button && button.click();
    }
    indentAllFences = () => this.rangeAllFences(this.indentFence)
    replaceFencesLang = () => {
        const components = [
            {label: "被替换语言", type: "input", value: "js"},
            {label: "替换语言", type: "input", value: "javascript"}
        ];
        this.utils.modal({title: "替换语言", components}, ([{submit: waitToReplaceLang}, {submit: replaceLang}]) => {
            if (!waitToReplaceLang || !replaceLang) return;

            this.rangeAllFences(fence => {
                const lang = fence.getAttribute("lang");
                if (lang && lang !== waitToReplaceLang) return;
                const cid = fence.getAttribute("cid");
                File.editor.fences.focus(cid);
                const input = fence.querySelector(".ty-cm-lang-input");
                if (!input) return;
                input.textContent = replaceLang;
                File.editor.fences.tryAddLangUndo(File.editor.getNode(cid), input);
            })
        })
    }
    addFencesLang = () => {
        const components = [{label: "语言", type: "input", value: "javascript"}];
        this.utils.modal({title: "添加语言", components}, ([{submit: targetLang}]) => {
            if (!targetLang) return;

            this.rangeAllFences(fence => {
                const lang = fence.getAttribute("lang");
                if (lang) return;
                const cid = fence.getAttribute("cid");
                File.editor.fences.focus(cid);
                const input = fence.querySelector(".ty-cm-lang-input");
                if (!input) return;
                input.textContent = targetLang;
                File.editor.fences.tryAddLangUndo(File.editor.getNode(cid), input);
            })
        })
    }
    disableOrEnableFold = () => {
        this.config.ENABLE_FOLD = !this.config.ENABLE_FOLD;
        if (!this.config.ENABLE_FOLD) {
            document.querySelectorAll(".fold-code.folded").forEach(ele => ele.click());
        }
        const display = (this.config.ENABLE_FOLD) ? "block" : "none";
        document.querySelectorAll(".fence-enhance .fold-code").forEach(ele => ele.style.display = display);
    }
    disableOrEnableCopy = () => {
        this.config.ENABLE_COPY = !this.config.ENABLE_COPY;
        const display = (this.config.ENABLE_COPY) ? "block" : "none";
        document.querySelectorAll(".fence-enhance .copy-code").forEach(ele => ele.style.display = display);
    }
    disableOrEnableIndent = () => {
        this.enableIndent = !this.enableIndent;
        const display = (this.enableIndent) ? "block" : "none";
        document.querySelectorAll(".fence-enhance .indent-code").forEach(ele => ele.style.display = display);
    }
    foldAll = () => {
        document.querySelectorAll(".fold-code:not(.folded)").forEach(ele => ele.click());
        this.config.FOLD_DEFAULT = true;
    }
    expandAll = () => {
        document.querySelectorAll(".fold-code.folded").forEach(ele => ele.click());
        this.config.FOLD_DEFAULT = false;
    }
    setAutoHide = () => {
        this.config.AUTO_HIDE = !this.config.AUTO_HIDE;
        const visibility = (this.config.AUTO_HIDE) ? "hidden" : "";
        document.querySelectorAll(".fence-enhance").forEach(ele => {
            // 处于折叠状态的代码块不可隐藏
            ele.style.visibility = ele.querySelector(".fold-code.folded") ? "" : visibility;
        });
    }
    showIndentAllFencesModal = () => {
        const label = "调整缩进功能的能力有限，对于 Python 这种游标卡尺语言甚至会出现误判，你确定吗？";
        this.utils.modal({title: "为所有代码块调整缩进", components: [{label, type: "p"}]}, this.indentAllFences)
    }

    call = (type, meta) => {
        const callMap = {
            disable_or_enable_fold: this.disableOrEnableFold,
            disable_or_enable_copy: this.disableOrEnableCopy,
            disable_or_enable_indent: this.disableOrEnableIndent,
            fold_all: this.foldAll,
            expand_all: this.expandAll,
            set_auto_hide: this.setAutoHide,
            fold_current: meta => this.foldFence(meta.target),
            copy_current: meta => this.copyFence(meta.target),
            indent_current: meta => this.indentFence(meta.target),
            indent_all_fences: this.showIndentAllFencesModal,
            add_fences_lang: this.addFencesLang,
            replace_fences_lang: this.replaceFencesLang,
        }
        const func = callMap[type];
        func && func(meta);
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

    createButton = (removeHint = false) => {
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
class editorHotkey {
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
        this.utils.addEventListener(this.utils.eventType.afterAddCodeBlock, cid => {
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
        return {pre, cid, fence, cursor, lineNum, lastNum, separator}
    }

    keydown = keyObj => {
        const dict = {shiftKey: false, ctrlKey: false, altKey: false, ...keyObj};
        document.activeElement.dispatchEvent(new KeyboardEvent('keydown', dict));
    }
    // 不可使用fence.execCommand("goLineUp")：因为它会检测shift键是否被pressed
    goLineUp = () => this.keydown({key: 'ArrowUp', keyCode: 38, code: 'ArrowUp', which: 38});
    goLineDown = () => this.keydown({key: 'ArrowDown', keyCode: 40, code: 'ArrowDown', which: 40});

    swapLine = (previous = true) => {
        const {fence, separator, lineNum, lastNum} = this.getFence();
        if (!fence || (previous && lineNum === 1) || (!previous && lineNum === lastNum)) return

        const lines = previous
            ? [{line: lineNum - 2, ch: 0}, {line: lineNum - 1, ch: null}]
            : [{line: lineNum - 1, ch: 0}, {line: lineNum, ch: null}];
        const lineCount = fence.getRange(...lines);
        const lineList = lineCount.split(separator);
        if (lines.length !== 2) return

        const newContent = [lineList[1], separator, lineList[0]].join("");
        fence.replaceRange(newContent, ...lines);
        previous && this.goLineUp();
    }

    copyLine = (previous = true) => {
        const {fence, separator, lineNum} = this.getFence();
        if (!fence) return
        const lineContent = fence.getLine(lineNum - 1);
        const newContent = separator + lineContent;
        fence.replaceRange(newContent, {line: lineNum - 1, ch: null});
    }

    newlineAndIndent = (previous = true) => {
        const {fence} = this.getFence();
        if (!fence) return
        previous && this.goLineUp();
        fence.execCommand("goLineEnd");
        fence.execCommand("newlineAndIndent");
    }
}

module.exports = {
    plugin: fenceEnhancePlugin,
};