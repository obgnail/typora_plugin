(() => {
    const config = {
        // 允许拖拽
        ALLOW_DRAG: true,
        // 大小写敏感(此选项不必手动调整，可以在UI设置)
        CASE_SENSITIVE: false,
        // 关键词按空格分割
        SEPARATOR: " ",
        // 快捷键
        HOTKEY: ev => metaKeyPressed(ev) && ev.shiftKey && ev.key === "H",
        // 展示执行按钮
        SHOW_RUN_BUTTON: true,
        // 点击时显示当前的索引数
        SHOW_CURRENT_INDEX: true,
        // Typora本身的限制: ctrl+F搜索后，点击任意地方原先高亮的地方就会消失
        // 这是由于高亮都是通过添加标签实现的，但是#write标签不允许添加非默认标签，所以需要在编辑的时候remove掉添加的标签
        UNDO_WHEN_EDIT: true,
        // 定位时高亮关键字边框
        SHOW_KEYWORD_OUTLINE: true,
        // 定位时高亮关键字所在行
        SHOW_KEYWORD_BAR: true,
        // 高亮的样式
        STYLE_COLOR: [
            // 浅一些的颜色
            '#bbeeff',
            '#ffbbcc',
            '#88ee88',
            '#ccbbff',
            '#ffee88',
            '#FFFFa0',
            '#88cccc',
            '#ffbb88',
            '#cccccc',
            '#ffaabb',
            // 深一些的颜色
            '#99ccff',
            '#ff99cc',
            '#66cc66',
            '#cc99ff',
            '#ffcc66',
            '#FFFF80',
            '#dd9966',
            '#aaaaaa',
            '#66aaaa',
            '#dd6699',
        ],
        // 当搜索关键字数量超出STYLE_COLOR范围时面板显示的颜色（页面中无颜色）
        // 20个关键字肯定够用了,此选项没太大意义
        DEFAULT_COLOR: "aquamarine",

        LOOP_DETECT_INTERVAL: 20,
    };

    (() => {
        const run_style = {
            input_width: (config.SHOW_RUN_BUTTON) ? "95%" : "100%",
            case_button_right: (config.SHOW_RUN_BUTTON) ? "32px" : "6px",
            run_button_display: (config.SHOW_RUN_BUTTON) ? "" : "none",
        }

        const colors = config.STYLE_COLOR.map((color, idx) => `.plugin-search-hit${idx} { background-color: ${color}; }`)
        const colorsStyle = colors.join("\n");
        const css = `
            #plugin-multi-highlighter {
                position: fixed;
                top: 15%;
                left: 55%;
                width: 500px;
                z-index: 9999;
                padding: 4px;
                background-color: #f8f8f8;
                box-shadow: 0 4px 10px rgba(0, 0, 0, .5);
                border: 1px solid #ddd;
                border-top: none;
                color: var(--text-color);
                transform: translate3d(0, 0, 0)
            }
            
            .mac-seamless-mode #plugin-multi-highlighter {
                top: 30px
            }
            
            #plugin-multi-highlighter-input {
                position: relative;
            }
            
            #plugin-multi-highlighter-input input {
                width: ${run_style.input_width};
                font-size: 14px;
                line-height: 25px;
                max-height: 27px;
                overflow: auto;
                border: 1px solid #ddd;
                box-shadow: inset 0 1px 1px rgba(0, 0, 0, .075);
                border-radius: 2px;
                padding-left: 5px;
                padding-right: 30px;
            }
            
            #plugin-multi-highlighter-input svg {
                width: 20px;
                height: 14px;
                stroke: none;
                fill: currentColor
            }
            
            #plugin-multi-highlighter-input .plugin-multi-highlighter-option-btn {
                position: absolute;
                padding: 1px;
                right: ${run_style.case_button_right};
                top: 8px;
                opacity: .5;
                line-height: 10px;
                border-radius: 3px;
                cursor: pointer;
            }
            
            #plugin-multi-highlighter-input .plugin-multi-highlighter-option-btn.select, .plugin-multi-highlighter-option-btn:hover {
                background: var(--active-file-bg-color);
                color: var(--active-file-text-color);
                opacity: 1
            }
            
            #plugin-multi-highlighter-input .run-highlight {
                margin-left: 4px; 
                opacity: .5; 
                cursor: pointer;
                display: ${run_style.run_button_display};
            }
    
            #plugin-multi-highlighter-input .run-highlight:hover {
                opacity: 1 !important;
            }
            
            #plugin-multi-highlighter-result {
                display: inline-flex;
                flex-wrap: wrap;
                align-content: flex-start;
            }
            
            .plugin-multi-highlighter-result-item {
                font-family: Arial;
                cursor: pointer;
                font-size: 13px;
                line-height: 20px;
                margin: 3px 3px;
                padding: 0 5px;
                border-radius: 5px;
            }
            
            .plugin-multi-highlighter-move {
                outline: 4px solid #FF7B00;
                text-decoration: blink;
            }
            
            .plugin-multi-highlighter-bar {
                background: rgba(29,163,63,.3);
                position: absolute;
                z-index: 99999;
                animation-name: fadeit; 
                animation-duration: 3s;
            }
            
            @keyframes fadeit {
                from {opacity:1;} 
                to {opacity:0;}
            }
            
            ${colorsStyle}
            `
        const style = document.createElement('style');
        style.type = 'text/css';
        style.innerHTML = css;
        document.getElementsByTagName("head")[0].appendChild(style);

        const div = `
        <div id="plugin-multi-highlighter-input">
            <input type="text" class="input" tabindex="1" autocorrect="off" spellcheck="false"
                autocapitalize="off" value="" placeholder="多关键字高亮 空格分隔" data-lg="Front">
            <span ty-hint="区分大小写" class="plugin-multi-highlighter-option-btn" aria-label="区分大小写">
                <svg class="icon"><use xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="#find-and-replace-icon-case"></use></svg>
            </span>
            <span class="run-highlight ion-ios7-play" ty-hint="运行"></span>
        </div>
        <div id="plugin-multi-highlighter-result" style="display: none"></div>`
        const searchModal = document.createElement("div");
        searchModal.id = 'plugin-multi-highlighter';
        searchModal.style.display = "none";
        searchModal.innerHTML = div;
        const quickOpenNode = document.getElementById("typora-quick-open");
        quickOpenNode.parentNode.insertBefore(searchModal, quickOpenNode.nextSibling);
    })()

    const entities = {
        write: document.getElementById("write"),
        modal: document.getElementById('plugin-multi-highlighter'),
        input: document.querySelector("#plugin-multi-highlighter-input input"),
        runButton: document.querySelector("#plugin-multi-highlighter-input .run-highlight"),
        caseOption: document.querySelector(".plugin-multi-highlighter-option-btn"),
        result: document.getElementById("plugin-multi-highlighter-result"),
    }

    const metaKeyPressed = ev => File.isMac ? ev.metaKey : ev.ctrlKey;
    const getFilePath = () => File.filePath || File.bundle && File.bundle.filePath;

    const multiHighlighterClass = reqnode(reqnode('path').join(global.dirname || global.__dirname,
        "plugin", "multi_highlighter", "multi_highlighter.js")).multiHighlighter;
    const multiHighlighter = new multiHighlighterClass();
    let fenceMultiHighlighterList = []; // 为了解决fence惰性加载的问题

    global.multiHighlighter = multiHighlighter; // todo to delete

    const clearHighlight = () => {
        multiHighlighter.clear();
        fenceMultiHighlighterList.forEach(highlighter => highlighter.clear());
        fenceMultiHighlighterList = [];
        entities.write.querySelectorAll(".plugin-multi-highlighter-bar").forEach(
            ele => ele && ele.parentElement && ele.parentElement.removeChild(ele));
    }

    const doSearch = (keyArr, refreshResult = true) => {
        clearHighlight();

        multiHighlighter.new(keyArr, entities.write, config.CASE_SENSITIVE, "plugin-search-hit");
        multiHighlighter.highlight();

        if (refreshResult) {
            const itemList = multiHighlighter.getList().map((searcher, idx) => {
                const color = (idx < config.STYLE_COLOR.length) ? config.STYLE_COLOR[idx] : config.DEFAULT_COLOR;
                return `<div class="plugin-multi-highlighter-result-item" style="background-color: ${color}" ty-hint="左键下一个；右键上一个"
                         idx="${idx}" cur="-1">${searcher.token.text} (${searcher.matches.length})</div>`;
            })
            entities.result.innerHTML = itemList.join("");
        }
        entities.result.style.display = "";
    }

    const refreshFences = () => {
        for (let id in File.editor.fences.queue) {
            File.editor.fences.queue[id].refresh();
        }
    }

    const getKeyArr = () => {
        const value = entities.input.value;
        if (!value) return;
        return value.split(config.SEPARATOR).filter(Boolean)
    }

    let lastHighlightFilePath;
    const highlight = (refreshResult = true) => {
        lastHighlightFilePath = getFilePath();
        const keyArr = getKeyArr();
        if (!keyArr) return false;
        doSearch(keyArr, refreshResult);
        return true;
    }

    const handleHideElement = marker => {
        const image = marker.closest(`span[md-inline="image"]`);
        if (image) {
            image.classList.add("md-expand");
        }
        const link = marker.closest(`span[md-inline="link"]`);
        if (link) {
            link.classList.add("md-expand");
        }
    }

    const scroll = marker => {
        if (!marker) return;

        handleHideElement(marker);
        requestAnimationFrame(() => marker.scrollIntoView({behavior: "smooth", block: "center", inline: "nearest"}));

        if (config.SHOW_KEYWORD_OUTLINE) {
            document.querySelectorAll(".plugin-multi-highlighter-move").forEach(ele => ele.classList.remove("plugin-multi-highlighter-move"));
            marker.classList.add("plugin-multi-highlighter-move");
        }

        if (config.SHOW_KEYWORD_BAR) {
            const writeRect = entities.write.getBoundingClientRect();
            const markerRect = marker.getBoundingClientRect();

            const bar = document.createElement("div");
            bar.classList.add("plugin-multi-highlighter-bar");
            bar.style.height = markerRect.height + "px";
            bar.style.width = writeRect.width + "px";
            bar.style.top = "0";
            marker.appendChild(bar);

            setTimeout(() => bar && bar.parentElement && bar.parentElement.removeChild(bar), 3000);
        }
    }

    entities.input.addEventListener("keydown", ev => {
        if (ev.key === "Enter") {
            ev.stopPropagation();
            ev.preventDefault();
            highlight();
        } else if (ev.key === "Escape") {
            ev.stopPropagation();
            ev.preventDefault();
            clearHighlight();
            entities.modal.style.display = "none";
        }
    })

    entities.caseOption.addEventListener("click", ev => {
        entities.caseOption.classList.toggle("select");
        config.CASE_SENSITIVE = !config.CASE_SENSITIVE;
        ev.preventDefault();
        ev.stopPropagation();
    })

    if (config.SHOW_RUN_BUTTON) {
        entities.runButton.addEventListener("click", ev => {
            highlight();
            ev.preventDefault();
            ev.stopPropagation();
        })
    }

    if (config.UNDO_WHEN_EDIT) {
        document.querySelector("content").addEventListener("mousedown", ev => {
            if (multiHighlighter.length() !== 0 && !ev.target.closest("#plugin-multi-highlighter")) {
                clearHighlight();
                refreshFences();
            }
        }, true)
    }

    entities.result.addEventListener("mousedown", ev => {
        const target = ev.target.closest(".plugin-multi-highlighter-result-item");
        if (!target) return;

        ev.stopPropagation();
        ev.preventDefault();

        // 当用户切换文档时
        if (getFilePath() !== lastHighlightFilePath) {
            highlight();
            return;
        }

        const idx = target.getAttribute("idx");
        const className = `plugin-search-hit${idx}`
        let resultList = document.getElementsByClassName(className);

        // 如果被刷新掉了，重新请求一次
        if (resultList.length === 0) {
            const success = highlight(false);
            if (!success) return;
            resultList = document.getElementsByClassName(className);
        }

        let targetIdx = parseInt(target.getAttribute("cur"));

        let nextIdx;
        if (ev.button === 0) { // 鼠标左键
            nextIdx = (targetIdx === resultList.length - 1) ? 0 : targetIdx + 1;
        } else if (ev.button === 2) { //鼠标右键
            nextIdx = (targetIdx === 0 || targetIdx === -1) ? resultList.length - 1 : targetIdx - 1;
        }

        const next = resultList[nextIdx];
        if (!next) {
            highlight();
            return;
        }

        scroll(next);
        target.setAttribute("cur", nextIdx + "");
        if (config.SHOW_CURRENT_INDEX) {
            const searcher = multiHighlighter.getHighlighter(idx);
            if (searcher) {
                target.innerText = `${searcher.token.text} (${nextIdx + 1}/${searcher.matches.length})`
            }
        }
    })

    if (config.ALLOW_DRAG) {
        entities.input.addEventListener("mousedown", ev => {
            if (!metaKeyPressed(ev) || ev.button !== 0) return;
            ev.stopPropagation();
            const rect = entities.modal.getBoundingClientRect();
            const shiftX = ev.clientX - rect.left;
            const shiftY = ev.clientY - rect.top;

            const onMouseMove = ev => {
                if (!metaKeyPressed(ev) || ev.button !== 0) return;
                ev.stopPropagation();
                ev.preventDefault();
                requestAnimationFrame(() => {
                    entities.modal.style.left = ev.clientX - shiftX + 'px';
                    entities.modal.style.top = ev.clientY - shiftY + 'px';
                });
            }

            document.addEventListener("mouseup", ev => {
                    if (!metaKeyPressed(ev) || ev.button !== 0) return;
                    ev.stopPropagation();
                    ev.preventDefault();
                    document.removeEventListener('mousemove', onMouseMove);
                    entities.modal.onmouseup = null;
                }
            )

            document.addEventListener('mousemove', onMouseMove);
        })
        entities.input.ondragstart = () => false
    }


    const _timer = setInterval(() => {
        if (!File || !File.editor || !File.editor.fences || !File.editor.fences.addCodeBlock) return;
        clearInterval(_timer);

        let hasMarker;
        const before = (...args) => {
            const cid = args[0];
            const marker = entities.write.querySelector(`.md-fences[cid=${cid}] marker`)
            hasMarker = !!marker;
        }

        const decorator = (original, before, after) => {
            return function () {
                before.call(this, ...arguments);
                const result = original.apply(this, arguments);
                after.call(this, result, ...arguments);
                return result;
            };
        }

        const after = (result, ...args) => {
            const cid = args[0];
            if (cid && hasMarker && multiHighlighter.length()) {
                hasMarker = false;
                const fence = entities.write.querySelector(`.md-fences[cid=${cid}]`);
                if (fence) {
                    const tokens = multiHighlighter.getTokens();
                    const fenceMultiHighlighter = new multiHighlighterClass();
                    fenceMultiHighlighter.new(tokens, fence, config.CASE_SENSITIVE, "plugin-search-hit");
                    fenceMultiHighlighter.highlight();
                    fenceMultiHighlighterList.push(fenceMultiHighlighter);
                }
            }
        }
        File.editor.fences.addCodeBlock = decorator(File.editor.fences.addCodeBlock, before, after);
    }, config.LOOP_DETECT_INTERVAL);

    const Call = () => {
        entities.modal.style.display = "block";
        entities.input.select();
    }

    window.addEventListener("keydown", ev => {
        if (config.HOTKEY(ev)) {
            Call();
            ev.preventDefault();
            ev.stopPropagation();
        }
    });

    module.exports = {config, Call};
    console.log("multi_highlighter.js had been injected");
})()