(() => {
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
    const config = {
        // 自动隐藏,鼠标移动到fence才显示
        AUTO_HIDE: false,
        // 启用复制代码功能
        ENABLE_COPY: true,
        // 启用折叠代码功能
        ENABLE_FOLD: true,
        // 折叠形式
        FOLD_OVERFLOW: "hidden",
        // 默认折叠
        FOLD_DEFAULT: false,

        LOOP_DETECT_INTERVAL: 20,
        CLICK_CHECK_INTERVAL: 300,
        WAIT_RECOVER_INTERVAL: 1000,
    };

    (() => {
        const css = `
            #write .md-fences .fence-enhance {
                display: inline-flex;
                position: absolute;
                top: .3em;
                right: .5em;
                z-index: 8;
                font-size: 1.2em;
            }
            #write .fence-enhance .typora-copy-code, .typora-fold-code {
                opacity: 0.5;
                cursor: pointer;
            }
            #write .fence-enhance .typora-copy-code {
                margin-left: .5em;
            }
            `
        const style = document.createElement('style');
        style.id = "plugin-fence-enhance-style";
        style.type = 'text/css';
        style.innerHTML = css;
        document.getElementsByTagName("head")[0].appendChild(style);
    })()

    const addEnhanceElement = fence => {
        let enhance = fence.querySelector(".fence-enhance");
        if (!enhance) {
            enhance = document.createElement("div");
            enhance.setAttribute("class", "fence-enhance");

            if (config.AUTO_HIDE) {
                enhance.style.visibility = "hidden";
            }

            let foldButton;
            if (config.ENABLE_FOLD) {
                foldButton = document.createElement("div");
                foldButton.classList.add("typora-fold-code");
                const span = document.createElement("span");
                span.className = "fa fa-minus";
                foldButton.appendChild(span);
                enhance.appendChild(foldButton);
            }

            if (config.ENABLE_COPY) {
                const copyButton = document.createElement("div");
                copyButton.classList.add("typora-copy-code");
                const span = document.createElement("span");
                span.className = "fa fa-clipboard";
                copyButton.appendChild(span);
                enhance.appendChild(copyButton);
            }

            fence.appendChild(enhance);

            if (config.FOLD_DEFAULT && foldButton) {
                foldButton.click();
            }
        }
    }

    const _timer = setInterval(() => {
        if (File && File.editor && File.editor.fences && File.editor.fences.addCodeBlock) {
            clearInterval(_timer);

            const decorator = (original, after) => {
                return function () {
                    const result = original.apply(this, arguments);
                    after.call(this, result, ...arguments);
                    return result;
                };
            }

            const after = (result, ...args) => {
                const cid = args[0];
                if (cid) {
                    const ele = document.querySelector(`#write .md-fences[cid=${cid}]`);
                    addEnhanceElement(ele);
                }
            }
            File.editor.fences.addCodeBlock = decorator(File.editor.fences.addCodeBlock, after);
        }
    }, config.LOOP_DETECT_INTERVAL);

    document.getElementById("write").addEventListener("click", ev => {
        const copy = ev.target.closest(".typora-copy-code");
        const fold = ev.target.closest(".typora-fold-code");
        if (!copy && !fold) return;

        ev.preventDefault();
        ev.stopPropagation();
        document.activeElement.blur();

        if (copy) {
            copyCode(ev, copy);
        } else {
            foldCode(ev, fold);
        }
    })

    let lastClickTime = 0;
    const badChars = [
        "%E2%80%8B", // ZERO WIDTH SPACE \u200b
        "%C2%A0", // NO-BREAK SPACE \u00A0
        "%0A" // NO-BREAK SPACE \u0A
    ];
    const replaceChars = ["", "%20", ""];

    const copyCode = (ev, copyButton) => {
        if (ev.timeStamp - lastClickTime < config.CLICK_CHECK_INTERVAL) return;
        lastClickTime = ev.timeStamp;

        const lines = copyButton.closest(".md-fences").querySelectorAll(".CodeMirror-code .CodeMirror-line")
        if (lines.length === 0) return;

        const contentList = [];
        lines.forEach(line => {
            let encodeText = encodeURI(line.textContent);
            for (let i = 0; i < badChars.length; i++) {
                if (encodeText.indexOf(badChars[i]) !== -1) {
                    encodeText = encodeText.replace(new RegExp(badChars[i], "g"), replaceChars[i]);
                }
            }
            const decodeText = decodeURI(encodeText);
            contentList.push(decodeText);
        })

        const result = contentList.join("\n");
        // navigator.clipboard.writeText(result);
        File.editor.UserOp.setClipboard(null, null, result);

        copyButton.firstElementChild.className = "fa fa-check";
        setTimeout(() => copyButton.firstElementChild.className = "fa fa-clipboard", config.WAIT_RECOVER_INTERVAL);
    }

    const foldCode = (ev, foldButton) => {
        const scroll = foldButton.closest(".md-fences").querySelector(".CodeMirror-scroll");
        if (!scroll) return;

        if (scroll.style.height && scroll.style.overflowY) {
            scroll.style.height = "";
            scroll.style.overflowY = "";
            foldButton.classList.remove("folded");
            foldButton.firstElementChild.className = "fa fa-minus";
        } else {
            scroll.style.height = window.getComputedStyle(scroll).lineHeight;
            scroll.style.overflowY = config.FOLD_OVERFLOW;
            foldButton.classList.add("folded");
            foldButton.firstElementChild.className = "fa fa-plus";
        }
    }

    $("#write").on("mouseenter", ".md-fences", function () {
        if (config.AUTO_HIDE) {
            this.querySelector(".fence-enhance").style.visibility = "";
        }
    }).on("mouseleave", ".md-fences", function () {
        if (config.AUTO_HIDE && !this.querySelector(".typora-fold-code.folded")) {
            this.querySelector(".fence-enhance").style.visibility = "hidden";
        }
    })

    //////////////////////// 以下是声明式插件系统代码 ////////////////////////
    const dynamicUtil = {target: null}
    const dynamicCallArgsGenerator = anchorNode => {
        const target = anchorNode.closest("#write .md-fences");
        if (!target) return;

        dynamicUtil.target = target;

        return [
            {
                arg_name: "折叠/展开代码块",
                arg_value: "fold_current",
            },
            {
                arg_name: "复制代码",
                arg_value: "copy_current",
            },
        ]
    }

    const callArgs = [
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

    const callMap = {
        disable_or_enable_fold: () => {
            config.ENABLE_FOLD = !config.ENABLE_FOLD;
            if (!config.ENABLE_FOLD) {
                document.querySelectorAll(".typora-fold-code.folded").forEach(ele => ele.click());
            }
            const display = (config.ENABLE_FOLD) ? "block" : "none";
            document.querySelectorAll(".fence-enhance .typora-fold-code").forEach(ele => ele.style.display = display);
        },
        disable_or_enable_copy: () => {
            config.ENABLE_COPY = !config.ENABLE_COPY;
            const display = (config.ENABLE_COPY) ? "block" : "none";
            document.querySelectorAll(".fence-enhance .typora-copy-code").forEach(ele => ele.style.display = display);
        },
        fold_all: () => {
            document.querySelectorAll(".typora-fold-code:not(.folded)").forEach(ele => ele.click());
            config.FOLD_DEFAULT = true;
        },
        expand_all: () => {
            document.querySelectorAll(".typora-fold-code.folded").forEach(ele => ele.click());
            config.FOLD_DEFAULT = false;
        },
        fold_current: () => {
            dynamicUtil.target.querySelector(".typora-fold-code").click();
        },
        copy_current: () => {
            dynamicUtil.target.querySelector(".typora-copy-code").click();
        },
        set_auto_hide: () => {
            config.AUTO_HIDE = !config.AUTO_HIDE;
            const visibility = (config.AUTO_HIDE) ? "hidden" : "";
            document.querySelectorAll(".fence-enhance").forEach(ele => ele.style.visibility = visibility);
        }
    }

    const call = type => {
        const func = callMap[type];
        func && func();
    }

    module.exports = {
        config,
        call,
        callArgs,
        dynamicCallArgsGenerator,
    };

    console.log("fence_enhance.js had been injected");
})()