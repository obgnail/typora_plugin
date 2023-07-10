(() => {
    /*  1. Typora是延迟加载页面的，文件内容都是通过延迟执行的js写入document的，具体代码在frame.js中$__System.registerDynamic函数中。
        2. 糟糕的是md-fences在frame.js中是很晚生成的，并且有清空innerHTML操作的，你必须等到frame.js执行完毕后才能你的脚本，使用onload，DOMContentLoaded，statechange什么的都不行。
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
        // 启用脚本,若为false,以下配置全部失效
        ENABLE: true,
        LOOP_DETECT_INTERVAL: 20,
        CLICK_CHECK_INTERVAL: 300,

        DEBUG: false
    }

    if (!config.ENABLE) {
        return
    }

    (() => {
        const css = `
            #write .md-fences .typora-copy-code {
                position: absolute;
                top: .1em;
                right: .5em;
                z-index: 99999;
                color: #4183C4;
                opacity: 0.6;
                font-weight: bold;
                border-bottom: 1px solid #4183C4;
                cursor: pointer;
            }
            #write .md-fences .typora-copy-code.copied {
                color: purple;
                border-color: purple;
            }
            `
        const style = document.createElement('style');
        style.type = 'text/css';
        style.innerHTML = css;
        document.getElementsByTagName("head")[0].appendChild(style);
    })()

    const addCopyElement = (target) => {
        let a = target.querySelector(".typora-copy-code");
        if (!a) {
            a = document.createElement("a");
            a.setAttribute("class", "typora-copy-code");
            a.innerText = "Copy";
            target.appendChild(a);
        }
    }

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
            addCopyElement(ele);
        }
    }

    const _timer = setInterval(() => {
        if (File?.editor?.fences?.addCodeBlock) {
            clearInterval(_timer);
            File.editor.fences.addCodeBlock = decorator(File.editor.fences.addCodeBlock, after);
        }
    }, config.LOOP_DETECT_INTERVAL);

    const badChars = [
        "%E2%80%8B", // ZERO WIDTH SPACE \u200b
        "%C2%A0", // NO-BREAK SPACE \u00A0
        "%0A" // NO-BREAK SPACE \u0A
    ];
    const replaceChars = ["", "%20", ""];

    let lastClickTime = 0;
    document.getElementById("write").addEventListener("click", ev => {
        const button = ev.target.closest(".typora-copy-code");
        if (!button) {
            return
        }

        ev.preventDefault();
        ev.stopPropagation();

        if (ev.timeStamp - lastClickTime < config.CLICK_CHECK_INTERVAL) {
            return
        }
        lastClickTime = ev.timeStamp;

        const lines = button.closest(".md-fences").querySelectorAll(".CodeMirror-code .CodeMirror-line")
        if (!lines) {
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

        button.classList.add("copied");
        button.innerText = "Copied";
        setTimeout(() => {
            button.classList.remove("copied");
            button.innerText = "Copy";
        }, 1000)
    })

    if (config.DEBUG) {
        JSBridge.invoke("window.toggleDevTools");
    }
    console.log("copy_code.js had been injected");
})()