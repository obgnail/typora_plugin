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
        // 启用复制代码功能
        ENABLE_COPY: true,
        // 启用折叠代码功能
        ENABLE_FOLD: true,
        // 折叠形式
        FOLD_OVERFLOW: "hidden",

        LOOP_DETECT_INTERVAL: 20,
        CLICK_CHECK_INTERVAL: 300,
    };

    (() => {
        const css = `
            #write .md-fences .fence-enhance {
                display: inline-flex;
                position: absolute;
                top: .1em;
                right: .5em;
                z-index: 8;
            }
            #write .fence-enhance .typora-copy-code, .typora-fold-code {
                opacity: 0.5;
                color: #4183C4;
                font-weight: bold;
                cursor: pointer;
                border-bottom: 1px solid #4183C4;
            }
            #write .fence-enhance .typora-copy-code {
                margin-left: 10px;
            }
            #write .fence-enhance .typora-copy-code.copied, .typora-fold-code.folded {
                color: purple;
                border-color: purple;
            }
            `
        const style = document.createElement('style');
        style.type = 'text/css';
        style.innerHTML = css;
        document.getElementsByTagName("head")[0].appendChild(style);
    })()

    const addEnhanceElement = fence => {
        let enhance = fence.querySelector(".fence-enhance");
        if (!enhance) {
            enhance = document.createElement("div");
            enhance.setAttribute("class", "fence-enhance");

            if (config.ENABLE_FOLD) {
                const foldButton = document.createElement("div");
                foldButton.classList.add("typora-fold-code");
                foldButton.innerText = "Fold";
                enhance.appendChild(foldButton);
            }

            if (config.ENABLE_COPY) {
                const copyButton = document.createElement("div");
                copyButton.classList.add("typora-copy-code");
                copyButton.innerText = "Copy";
                enhance.appendChild(copyButton);
            }

            fence.appendChild(enhance);
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
        const copy = config.ENABLE_COPY && ev.target.closest(".typora-copy-code");
        const fold = config.ENABLE_FOLD && ev.target.closest(".typora-fold-code");
        if (!copy && !fold) {
            return
        }

        ev.preventDefault();
        ev.stopPropagation();

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
        if (ev.timeStamp - lastClickTime < config.CLICK_CHECK_INTERVAL) {
            return
        }
        lastClickTime = ev.timeStamp;

        const lines = copyButton.closest(".md-fences").querySelectorAll(".CodeMirror-code .CodeMirror-line")
        if (lines.length === 0) {
            return
        }

        document.activeElement.blur();

        const contentList = [];
        lines.forEach(line => {
            let encodeText = encodeURI(line.textContent);
            for (let i = 0; i < badChars.length; i++) {
                if (encodeText.indexOf(badChars[i]) !== -1) {
                    encodeText = encodeText.replace(new RegExp(badChars[i], "g"), replaceChars[i]);
                }
            }
            const decodeText = decodeURI(encodeText);
            contentList.push(decodeText)
        })

        const result = contentList.join("\n");
        navigator.clipboard.writeText(result);

        copyButton.classList.add("copied");
        copyButton.innerText = "Copied";
        setTimeout(() => {
            copyButton.classList.remove("copied");
            copyButton.innerText = "Copy";
        }, 1000)
    }

    const foldCode = (ev, foldButton) => {
        const scroll = foldButton.closest(".md-fences").querySelector(".CodeMirror-scroll");
        if (!scroll) {
            return
        }
        document.activeElement.blur();
        if (scroll.style.height && scroll.style.overflowY) {
            scroll.style.height = "";
            scroll.style.overflowY = "";
            foldButton.classList.remove("folded");
            foldButton.innerText = "Fold";
        } else {
            scroll.style.height = window.getComputedStyle(foldButton).lineHeight;
            scroll.style.overflowY = config.FOLD_OVERFLOW;
            foldButton.classList.add("folded");
            foldButton.innerText = "Folded";
        }
    }

    module.exports = {config};

    console.log("fence_enhance.js had been injected");
})()