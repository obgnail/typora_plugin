(() => {
    const config = {
        // 快捷键
        HOTKEY_HIDE_FRONT: ev => metaKeyPressed(ev) && ev.shiftKey && ev.key === "B",
        HOTKEY_SHOW_ALL: ev => metaKeyPressed(ev) && ev.shiftKey && ev.key === "U",
        HOTKEY_HIDE_BASE_VIEW: ev => metaKeyPressed(ev) && ev.shiftKey && ev.key === "Y",

        // 剩余文本段
        REMAIN_LENGTH: 80,
        // make users feel happy while waiting
        SHOW_MASK: true,
    }

    if (config.SHOW_MASK) {
        const css = `
            .truncate-text-mask-wrapper {
                z-index: 9999;
                position: fixed;
                width: 100px;
                height: 100px;
                border-radius: 2px;
                top: calc(50% - 50px);
                left: calc(50% - 50px);
                background-color: rgba(51,51,51,.62);
            }
            
            .truncate-text-mask {
                width: 100px;
                height: 100px;
                text-align: center;
                background-color: transparent;
                display: block;
                border-radius: 4px;
            }
            
            .truncate-text-mask .truncate-text-label {
                display: block;
                color: #ddd;
                font-size: 14px;
                margin-top: 16px;
                margin-bottom: 12px;
            }
            
            .truncate-text-mask .truncate-line {
                display: inline-block;
                width: 8px;
                height: 8px;
                margin-left: 2px;
                margin-right: 2px;
                background-color: #ccc;
            }
            
            .truncate-text-mask .truncate-line:nth-last-child(1) {
                animation: loadingC .6s .1s linear infinite
            }
            
            .truncate-text-mask .truncate-line:nth-last-child(2) {
                animation: loadingC .6s .2s linear infinite
            }
            
            .truncate-text-mask .truncate-line:nth-last-child(3) {
                animation: loadingC .6s .3s linear infinite
            }
            `
        const style = document.createElement('style');
        style.type = 'text/css';
        style.innerHTML = css;
        document.getElementsByTagName("head")[0].appendChild(style);

        const span = `
              <span class="truncate-text-mask">
                    <span class="truncate-text-label">Truncating</span>
                    <span class="truncate-line"></span>
                    <span class="truncate-line"></span>
                    <span class="truncate-line"></span>
              </span>
            `
        const waiting_span = document.createElement("span");
        waiting_span.classList.add("truncate-text-mask-wrapper");
        waiting_span.style.display = "none";
        waiting_span.innerHTML = span;
        const content = document.querySelector("content");
        content.insertBefore(waiting_span, content.firstElementChild);
    }

    const withMask = func => {
        if (!config.SHOW_MASK) {
            func();
        } else {
            const mask = document.querySelector(".truncate-text-mask-wrapper");
            mask.style.display = "block";
            func();
            mask.style.display = "none";
        }
    }

    const metaKeyPressed = ev => File.isMac ? ev.metaKey : ev.ctrlKey;

    const isInViewBox = el => {
        if (el.style.display) {
            return false
        }
        const totalHeight = window.innerHeight || document.documentElement.clientHeight;
        const totalWidth = window.innerWidth || document.documentElement.clientWidth;
        const {top, right, bottom, left} = el.getBoundingClientRect();
        return (top >= 0 && left >= 0 && right <= totalWidth && bottom <= totalHeight);
    }

    const CallArgs = [
        {
            "arg_name": "隐藏最前面",
            "arg_value": "hide_front"
        },
        {
            "arg_name": "重新显示",
            "arg_value": "show_all"
        },
        {
            "arg_name": "根据当前可视范围显示",
            "arg_value": "hide_base_view"
        }
    ];
    const Call = type => {
        const write = document.getElementById("write");
        withMask(() => {
            switch (type) {
                case "hide_front":
                    const length = write.children.length;
                    if (length > config.REMAIN_LENGTH) {
                        for (let i = 0; i <= length - config.REMAIN_LENGTH; i++) {
                            write.children[i].style.display = "none";
                        }
                    }
                    return
                case "show_all":
                    write.children.forEach(el => el.style = "")
                    return
                case "hide_base_view":
                    let start = 0, end = 0;
                    write.children.forEach((el, idx) => {
                        if (isInViewBox(el)) {
                            if (!start) {
                                start = idx
                            }
                            start = Math.min(start, idx);
                            end = Math.max(end, idx);
                        }
                    });

                    const halfLength = config.REMAIN_LENGTH / 2;
                    start = Math.max(start - halfLength, 0);
                    end = Math.min(end + halfLength, write.children.length);

                    write.children.forEach((el, idx) => {
                        if (idx < start || idx > end) {
                            el.style.display = "none";
                        } else {
                            el.style = "";
                        }
                    });
                    return;
            }
        })
    }

    window.addEventListener("keydown", ev => {
        let type;
        if (config.HOTKEY_HIDE_FRONT(ev)) {
            type = "hide_front"; // 隐藏最前面的文本段
        } else if (config.HOTKEY_SHOW_ALL(ev)) {
            type = "show_all"; // 重新显示所有文本段
        } else if (config.HOTKEY_HIDE_BASE_VIEW(ev)) {
            type = "hide_base_view"; // 显示当前可视范围上下文本段
        }

        if (type) {
            Call(type);
            ev.preventDefault();
            ev.stopPropagation();
        }
    }, true)

    module.exports = {Call, CallArgs};
    console.log("truncate_text.js had been injected");
})()
