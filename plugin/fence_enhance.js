/*  1. Typora是延迟加载页面的，文件内容都是通过延迟执行的js写入document的，具体代码在frame.js中$__System.registerDynamic函数中。
    2. 糟糕的是md-fences在frame.js中是很晚生成的，并且有清空innerHTML操作的，你必须等到frame.js执行完毕后才能执行你的脚本，使用onload，DOMContentLoaded，statechange什么的都不行。
        否则你插入的标签都会被清空，一切白费。原因很简单：frame.js执行的时机很晚，你可以认为是一个在网页全部加载完毕后执行的Ajax请求。
    3. 这里给出清空md-fences的函数链条，打个断点就知道了：
        restoreEditStateFromData -> refresh -> refreshUnder -> refreshEditor -> addCodeBlock -> b.addClass("ty-contain-cm").html("");
    4. 解决方法有很多，比如：
        1. 使用::before伪标签。既然标签会被清空，伪标签不就可以了么
        2. 循环检测md-fences的状态，检测到全部加载完成后执行脚本。
    5. 我选择的是装饰器。给上述逻辑链条的addCodeBlock函数注入一段after逻辑。
        这样的好处是:不管是文件本身就存在的，还是用户编辑文件时新增的都可以自动执行脚本，不必整一个MutationObserver。
        坏处是:绿皮
*/
class fenceEnhancePlugin extends global._basePlugin {
    beforeProcess = () => {
        this.enableIndent = this.config.ENABLE_INDENT && !this.utils.isBetaVersion;
    }

    style = () => {
        return `
            #write .md-fences .fence-enhance {
                display: inline-flex;
                flex-direction: row-reverse;
                position: absolute;
                top: .3em;
                right: .5em;
                z-index: 8;
                font-size: 1.2em;
                opacity: .5;
            }
            #write .fence-enhance .enhance-btn {
                cursor: pointer;
                margin-left: .5em;
            }
            #write .fence-enhance .enhance-btn:last-child {
                margin-left: 0;
            }
            `
    }

    hotkey = () => {
        if (this.enableIndent) {
            return [{
                hotkey: this.config.INDENT_HOTKEY,
                callback: this.utils.withAnchorNode("#write .md-fences", this.indentFence),
            }]
        }
    }

    init = () => {
        this.builders = [];
        this.lastClickTime = 0;
        this.dynamicUtil = {target: null};
        this.callArgs = [
            {
                arg_name: "自动隐藏/显示按钮",
                arg_value: "set_auto_hide",
            },
            {
                arg_name: "禁用/启用折叠按钮",
                arg_value: "disable_or_enable_fold",
            },
            {
                arg_name: "禁用/启用复制按钮",
                arg_value: "disable_or_enable_copy",
            },
            {
                arg_name: "总是折叠代码块",
                arg_value: "fold_all",
            },
            {
                arg_name: "总是展开代码块",
                arg_value: "expand_all",
            },
        ];

        if (this.enableIndent) {
            this.callArgs.splice(2, 0, {
                arg_name: "禁用/启用缩进调整按钮",
                arg_value: "disable_or_enable_indent",
            });
        }

        this.callMap = {
            disable_or_enable_fold: () => {
                this.config.ENABLE_FOLD = !this.config.ENABLE_FOLD;
                if (!this.config.ENABLE_FOLD) {
                    document.querySelectorAll(".fold-code.folded").forEach(ele => ele.click());
                }
                const display = (this.config.ENABLE_FOLD) ? "block" : "none";
                document.querySelectorAll(".fence-enhance .fold-code").forEach(ele => ele.style.display = display);
            },
            disable_or_enable_copy: () => {
                this.config.ENABLE_COPY = !this.config.ENABLE_COPY;
                const display = (this.config.ENABLE_COPY) ? "block" : "none";
                document.querySelectorAll(".fence-enhance .copy-code").forEach(ele => ele.style.display = display);
            },
            disable_or_enable_indent: () => {
                this.enableIndent = !this.enableIndent;
                const display = (this.enableIndent) ? "block" : "none";
                document.querySelectorAll(".fence-enhance .indent-code").forEach(ele => ele.style.display = display);
            },
            fold_all: () => {
                document.querySelectorAll(".fold-code:not(.folded)").forEach(ele => ele.click());
                this.config.FOLD_DEFAULT = true;
            },
            expand_all: () => {
                document.querySelectorAll(".fold-code.folded").forEach(ele => ele.click());
                this.config.FOLD_DEFAULT = false;
            },
            fold_current: () => this.foldFence(this.dynamicUtil.target),
            copy_current: () => this.copyFence(this.dynamicUtil.target),
            indent_current: () => this.indentFence(this.dynamicUtil.target),
            set_auto_hide: () => {
                this.config.AUTO_HIDE = !this.config.AUTO_HIDE;
                const visibility = (this.config.AUTO_HIDE) ? "hidden" : "";
                document.querySelectorAll(".fence-enhance").forEach(ele => ele.style.visibility = visibility);
            }
        }
    }

    process = () => {
        this.init();

        [
            ["copy-code", "copyCode", "复制", "fa fa-clipboard", this.config.ENABLE_COPY, this.copyCode],
            ["indent-code", "indentCode", "调整缩进", "fa fa-indent", this.enableIndent, this.indentCode],
            ["fold-code", "foldCode", "折叠", "fa fa-minus", this.config.ENABLE_FOLD, this.foldCode, this.defaultFold],
        ].forEach(button => this.registerBuilder(...button));

        this.utils.addEventListener(this.utils.eventType.afterAddCodeBlock, cid => {
            const ele = document.querySelector(`#write .md-fences[cid=${cid}]`);
            this.addEnhanceElement(ele);
        })

        document.getElementById("write").addEventListener("click", ev => {
            const target = ev.target.closest(".fence-enhance .enhance-btn");
            if (target) {
                ev.preventDefault();
                ev.stopPropagation();
                document.activeElement.blur();
                const action = target.getAttribute("action");
                for (const builder of this.builders) {
                    if (builder.action === action) {
                        builder.listener(ev, target);
                        return
                    }
                }
            }
        })

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

            const buttons = this.builders.map(builder => builder.createButton());
            this.builders.forEach((builder, idx) => {
                const button = buttons[idx];
                enhance.appendChild(button);
                builder["extraFunc"] && builder.extraFunc(button);
            })
        }
    }

    defaultFold = foldButton => this.config.FOLD_DEFAULT && foldButton.click();

    copyCode = (ev, copyButton) => {
        if (ev.timeStamp - this.lastClickTime < this.config.CLICK_CHECK_INTERVAL) return;
        this.lastClickTime = ev.timeStamp;

        const result = this.utils.getFenceContent(copyButton.closest(".md-fences"))
        // File.editor.UserOp.setClipboard(null, null, result);
        navigator.clipboard.writeText(result).then(() => {
            copyButton.firstElementChild.className = "fa fa-check";
            setTimeout(() => copyButton.firstElementChild.className = "fa fa-clipboard", this.config.WAIT_RECOVER_INTERVAL);
        })
    }

    foldCode = (ev, foldButton) => {
        const scroll = foldButton.closest(".md-fences").querySelector(".CodeMirror-scroll");
        if (!scroll) return;

        if (scroll.style.height && scroll.style.overflowY) {
            scroll.style.height = "";
            scroll.style.overflowY = "";
            foldButton.classList.remove("folded");
            foldButton.firstElementChild.className = "fa fa-minus";
        } else {
            scroll.style.height = window.getComputedStyle(scroll).lineHeight;
            scroll.style.overflowY = this.config.FOLD_OVERFLOW;
            foldButton.classList.add("folded");
            foldButton.firstElementChild.className = "fa fa-plus";
        }
    }

    indentCode = (ev, indentButton) => {
        const fence = indentButton.closest(".md-fences");
        if (!fence || !File.editor.fences.formatContent) return;

        const cid = fence.getAttribute("cid");
        File.editor.refocus(cid);
        File.editor.fences.formatContent();

        indentButton.firstElementChild.className = "fa fa-check";
        setTimeout(() => indentButton.firstElementChild.className = "fa fa-indent", this.config.WAIT_RECOVER_INTERVAL);
    }

    dynamicCallArgsGenerator = anchorNode => {
        const target = anchorNode.closest("#write .md-fences");
        this.dynamicUtil.target = target;

        const arr = [];
        if (this.enableIndent) {
            arr.push({arg_name: "调整缩进", arg_value: "indent_current"});
        }
        arr.push({arg_name: "折叠/展开代码块", arg_value: "fold_current", arg_disabled: !target});
        arr.push({arg_name: "复制代码", arg_value: "copy_current", arg_disabled: !target});
        return arr
    }

    copyFence = target => target.querySelector(".copy-code").click();
    indentFence = target => target.querySelector(".indent-code").click();
    foldFence = target => target.querySelector(".fold-code").click();
    expandFence = fence => {
        const button = fence.querySelector(".fence-enhance .fold-code.folded");
        button && button.click();
    }

    call = type => {
        const func = this.callMap[type];
        func && func();
    }
}

// 模拟抽象类
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

    createButton = () => {
        const button = document.createElement("div");
        button.classList.add("enhance-btn");
        button.classList.add(this.className);
        button.setAttribute("action", this.action);
        this.hint && button.setAttribute("ty-hint", this.hint);
        const span = document.createElement("span");
        span.className = this.iconClassName;
        button.appendChild(span);

        if (!this.enable) {
            button.style.display = "none";
        }
        return button
    }
}

module.exports = {
    plugin: fenceEnhancePlugin,
};