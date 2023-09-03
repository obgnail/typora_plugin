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
        const textID = "plugin-fence-enhance-style";
        const text = `
            #write .md-fences .fence-enhance {
                display: inline-flex;
                position: absolute;
                top: .3em;
                right: .5em;
                z-index: 8;
                font-size: 1.2em;
                opacity: 0.5;
            }
            #write .fence-enhance .enhance-button {
                cursor: pointer;
            }
            #write .fence-enhance .copy-code, .indent-code {
                margin-left: .5em;
            }`;
        return {textID, text}
    }

    hotkey = () => {
        if (this.enableIndent) {
            return [{
                hotkey: this.config.INDENT_HOTKEY,
                callback: () => {
                    const anchorNode = File.editor.getJQueryElem(window.getSelection().anchorNode);
                    const target = anchorNode.closest("#write .md-fences");
                    if (target && target[0]) {
                        this.indentFence(target[0]);
                    }
                },
            }]
        }
    }

    init = () => {
        this.lastClickTime = 0;
        this.badChars = [
            "%E2%80%8B", // ZERO WIDTH SPACE \u200b
            "%C2%A0", // NO-BREAK SPACE \u00A0
            "%0A" // NO-BREAK SPACE \u0A
        ];
        this.replaceChars = ["", "%20", ""];
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

        this.utils.decorateAddCodeBlock(null, (result, ...args) => {
            const cid = args[0];
            if (cid) {
                const ele = document.querySelector(`#write .md-fences[cid=${cid}]`);
                this.addEnhanceElement(ele);
            }
        })

        document.getElementById("write").addEventListener("click", ev => {
            const target = ev.target.closest(".fence-enhance .enhance-button");
            if (target) {
                ev.preventDefault();
                ev.stopPropagation();
                document.activeElement.blur();
                const action = target.getAttribute("action");
                this[action](ev, target);
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

    createButton = (className, action, hint, iconClassName) => {
        const button = document.createElement("div");
        button.classList.add("enhance-button");
        button.classList.add(className);
        button.setAttribute("action", action);
        hint && button.setAttribute("ty-hint", hint);
        const span = document.createElement("span");
        span.className = iconClassName;
        button.appendChild(span);
        return button
    }

    addEnhanceElement = fence => {
        let enhance = fence.querySelector(".fence-enhance");
        if (!enhance) {
            enhance = document.createElement("div");
            enhance.setAttribute("class", "fence-enhance");

            if (this.config.AUTO_HIDE) {
                enhance.style.visibility = "hidden";
            }

            const foldButton = this.createButton("fold-code", "foldCode", "折叠", "fa fa-minus");
            if (!this.config.ENABLE_FOLD) {
                foldButton.style.display = "none";
            }

            const indentButton = this.createButton("indent-code", "indentCode", "调整缩进", "fa fa-indent");
            if (!this.enableIndent) {
                indentButton.style.display = "none";
            }

            const copyButton = this.createButton("copy-code", "copyCode", "复制", "fa fa-clipboard");
            if (!this.config.ENABLE_COPY) {
                copyButton.style.display = "none";
            }

            enhance.appendChild(foldButton);
            enhance.appendChild(indentButton);
            enhance.appendChild(copyButton);
            fence.appendChild(enhance);

            if (this.config.FOLD_DEFAULT) {
                foldButton.click();
            }
        }
    }

    copyCode = (ev, copyButton) => {
        if (ev.timeStamp - this.lastClickTime < this.config.CLICK_CHECK_INTERVAL) return;
        this.lastClickTime = ev.timeStamp;

        const lines = copyButton.closest(".md-fences").querySelectorAll(".CodeMirror-code .CodeMirror-line");
        if (lines.length === 0) return;

        const contentList = [];
        lines.forEach(line => {
            let encodeText = encodeURI(line.textContent);
            for (let i = 0; i < this.badChars.length; i++) {
                if (encodeText.indexOf(this.badChars[i]) !== -1) {
                    encodeText = encodeText.replace(new RegExp(this.badChars[i], "g"), this.replaceChars[i]);
                }
            }
            const decodeText = decodeURI(encodeText);
            contentList.push(decodeText);
        })

        const result = contentList.join("\n");
        navigator.clipboard.writeText(result);
        // File.editor.UserOp.setClipboard(null, null, result);

        copyButton.firstElementChild.className = "fa fa-check";
        setTimeout(() => copyButton.firstElementChild.className = "fa fa-clipboard", this.config.WAIT_RECOVER_INTERVAL);
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

module.exports = {
    plugin: fenceEnhancePlugin,
};