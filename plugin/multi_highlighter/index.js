(() => {
    /*
    1. 对比普通网页，给Typora添加多关键字高亮有两个难点：可编辑、延迟加载Fence
    2. 可编辑：
       1. 给关键字添加高亮是通过添加标签实现的。但是为了保证数据安全，Typora是不允许需求#write的标签结构的。所以需要及时地撤销添加的标签，恢复可用。
       2. 同时，Typora监控着#write的结构，以确保发生异常时能进行回滚操作。所以撤销添加的标签还不够，你还需要阅读frame.js研究Typora是怎么监控的，然后找出刷新方法。代码中的refreshFences函数就是用于此。
    3. 延迟加载Fence：
       1. Typora的代码块是延迟加载的。对大文件来说，当你滚动到文档底部时，那里的代码块才会进行加载。
       2. 这就导致了你添加的高亮标签会被刷掉，你需要重新搜索高亮一次。
       3. 每个延迟加载的代码块都要全文搜索高亮一次肯定不太好，所以你需要少量的、针对性的搜索高亮，然后将这些高亮标签全都记录在案。fenceMultiHighlighterList就是用于此。整个过程也会消耗大量内存。
       4. 同时你还需要提供高亮关键字的定位功能，所以你必须协同每个MultiHighlighter对象。
       5. 这种情况还造成了定位功能的时机问题。本来是简单的管理MultiHighlighter对象就行。现在变成了：
            1. 判断下一个关键字是否处于未加载的Fence中
            2. 若是，则需要记录这个关键字的特征，滚动到这个Fence，触发Fence的加载
            3. 使用装饰器劫持Fence的加载函数，并再函数的最后执行搜索高亮操作。然后根据上面的特征找出特定的关键字（Fence中可能有多个关键字），再将滚动条滚动到这个位置，最后在对这个关键字提供位置提示。
            4. 将这个过程产生的高亮对象记录在案，并在合适的时机取消高亮。
    4. 这整套下来，导致逻辑被切的稀碎。同时你还需要注意很多小细节，比如图片和链接上的关键字，你需要显示其markdown源码后才能定位。
    5. 解决方式：我本来想使用类似于Golang的channel。channel非常适合这种逻辑代码各种跳跃的情况，且十分优雅。想来想去，去他妈，直接硬撸算了，全局变量直接上，没有遵循任何设计原则，代码非常难懂。
    6. 下面代码就是本着【又不是不能用】的心态码的，只追求实现速度。若你有心重构，我帮你抽象出了multi_highlighter.js文件，可以方便的搜索并添加高亮标签，接下来你需要的就是和Typora混淆后的frame.js做斗争，和Typora各自特性作斗争。
    */
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
        SHOW_RUN_BUTTON: false,
        // 打开其他文件时自动重新搜索
        RESEARCH_WHILE_OPEN_FILE: true,
        // 点击时显示当前的索引数
        SHOW_CURRENT_INDEX: true,
        // Typora本身的限制: ctrl+F搜索后，点击任意地方原先高亮的地方就会消失
        // 这是由于高亮都是通过添加标签实现的，但是#write标签不允许添加非默认标签，所以需要在编辑的时候remove掉添加的标签
        REMOVE_WHEN_EDIT: true,
        // 定位时高亮关键字出现提示边框
        SHOW_KEYWORD_OUTLINE: true,
        // 定位时高亮关键字提示所在行
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

        // Do not edit this field unless you know what you are doing
        // 性能选项：关键字数量大于X时使用fenceMultiHighlighterList（以空间换时间）。若<0,则总是使用
        // 此选项用在当搜索了很多关键字时，保证有较快的响应速度
        USE_LIST_THRESHOLD: -1,
        // 性能选项：当fenceMultiHighlighterList数量超过X时，clear之（以时间换空间）。若<0,则总不启用
        // 此选项用在当上一个策略使用太多次后，花费时间去回收空间，保证不会占用太大内存
        CLEAR_LIST_THRESHOLD: 12,

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
                width: 420px;
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
        style.id = "plugin-multi-highlighter-style";
        style.type = 'text/css';
        style.innerHTML = css;
        document.getElementsByTagName("head")[0].appendChild(style);

        const div = `
            <div id="plugin-multi-highlighter-input">
                <input type="text" class="input" tabindex="1" autocorrect="off" spellcheck="false"
                    autocapitalize="off" value="" placeholder="多关键字高亮 空格分隔" data-lg="Front">
                <span ty-hint="区分大小写" class="plugin-multi-highlighter-option-btn ${(config.CASE_SENSITIVE) ? "select" : ""}" aria-label="区分大小写">
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

    const collapsePlugin = global._getPlugin("collapse_paragraph");
    const truncatePlugin = global._getPlugin("truncate_text");
    const compatibleOtherPlugin = target => {
        if (!target) return;

        collapsePlugin && collapsePlugin.meta && collapsePlugin.meta.rollback && collapsePlugin.meta.rollback(target);
        truncatePlugin && truncatePlugin.meta && truncatePlugin.meta.rollback && truncatePlugin.meta.rollback(target);
    }

    const multiHighlighterClass = reqnode(reqnode('path').join(global.dirname || global.__dirname,
        "plugin", "multi_highlighter", "multi_highlighter.js")).multiHighlighter;
    const multiHighlighter = new multiHighlighterClass();
    let fenceMultiHighlighterList = []; // 为了解决fence惰性加载的问题

    const clearFenceMultiHighlighterList = () => {
        console.log("clearFenceMultiHighlighterList");
        fenceMultiHighlighterList.forEach(highlighter => highlighter.clear());
        fenceMultiHighlighterList = [];
    }

    const clearHighlight = () => {
        multiHighlighter.clear();
        clearFenceMultiHighlighterList();
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
        console.log("refreshFences");
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

    const handleHiddenElement = marker => {
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
        const totalHeight = window.innerHeight || document.documentElement.clientHeight;
        File.editor.focusAndRestorePos();
        File.editor.selection.scrollAdjust(marker, totalHeight / 2);
        File.isFocusMode && File.editor.updateFocusMode(false);
    }

    // 已废弃
    const scroll2 = marker => {
        requestAnimationFrame(() => marker.scrollIntoView({behavior: "smooth", block: "center", inline: "nearest"}));
    }

    const showIfNeed = marker => {
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

    const whichMarker = (parent, marker) => {
        const markers = parent.getElementsByTagName("marker");
        for (let idx = 0; idx < markers.length; idx++) {
            if (markers[idx] === marker) {
                return idx
            }
        }
        return -1
    }

    const getMarker = (parent, idx) => {
        const markers = parent.querySelectorAll("marker");
        if (markers) {
            return markers[idx];
        }
    }

    const hide = () => {
        clearHighlight();
        entities.modal.style.display = "none";
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
            refreshFences();
            hide();
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

    if (config.REMOVE_WHEN_EDIT) {
        document.querySelector("content").addEventListener("mousedown", ev => {
            if (multiHighlighter.length() !== 0 && !ev.target.closest("#plugin-multi-highlighter")) {
                clearHighlight();
                refreshFences();
            }
        }, true)
    }

    const showMarkerInfo = {
        idxOfFence: -1,
        idxOfWrite: -1,
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

        compatibleOtherPlugin(next);

        showMarkerInfo.idxOfWrite = whichMarker(entities.write, next);

        const fence = next.closest("#write .md-fences");
        if (fence && !fence.classList.contains("modeLoaded")) {
            showMarkerInfo.idxOfFence = whichMarker(fence, next);
            // scroll到Fence，触发File.editor.fences.addCodeBlock函数，接下来的工作就交给他了
            scroll(next);
        } else {
            handleHiddenElement(next);
            scroll(next);
            showIfNeed(next);
        }
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

    const getAndShowMarker = (parent, idx) => {
        setTimeout(() => {
            const nthMarker = getMarker(parent, idx);
            if (nthMarker) {
                scroll(nthMarker);
                showIfNeed(nthMarker);
            }
        }, 120);
    }

    const _timer = setInterval(() => {
        if (!File || !File.editor || !File.editor.fences || !File.editor.fences.addCodeBlock) return;
        clearInterval(_timer);

        let hasMarker;
        const before = (...args) => {
            const cid = args[0];
            if (!cid || multiHighlighter.length() === 0) return;

            const marker = entities.write.querySelector(`.md-fences[cid=${cid}] marker`);
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
            if (!cid || !hasMarker || multiHighlighter.length() === 0) return;

            hasMarker = false;

            const fence = entities.write.querySelector(`.md-fences[cid=${cid}]`);
            if (!fence) return;

            const tokens = multiHighlighter.getTokens();
            if (config.USE_LIST_THRESHOLD > tokens.length
                || config.CLEAR_LIST_THRESHOLD > 0 && fenceMultiHighlighterList.length === config.CLEAR_LIST_THRESHOLD) {
                clearFenceMultiHighlighterList();
                multiHighlighter.removeHighlight();
                multiHighlighter.highlight();
                if (showMarkerInfo.idxOfWrite !== -1) {
                    getAndShowMarker(entities.write, showMarkerInfo.idxOfWrite);
                    showMarkerInfo.idxOfWrite = -1;
                }
            } else {
                const fenceMultiHighlighter = new multiHighlighterClass();
                fenceMultiHighlighter.new(tokens, fence, config.CASE_SENSITIVE, "plugin-search-hit");
                fenceMultiHighlighter.highlight();
                fenceMultiHighlighterList.push(fenceMultiHighlighter);
                if (showMarkerInfo.idxOfFence !== -1) {
                    getAndShowMarker(fence, showMarkerInfo.idxOfFence);
                    showMarkerInfo.idxOfFence = -1;
                }
            }
        }
        File.editor.fences.addCodeBlock = decorator(File.editor.fences.addCodeBlock, before, after);
    }, config.LOOP_DETECT_INTERVAL);

    if (config.RESEARCH_WHILE_OPEN_FILE) {
        const _timer2 = setInterval(() => {
            if (File) {
                clearInterval(_timer2);
                const decorator = (original, after) => {
                    return function () {
                        const result = original.apply(this, arguments);
                        after.call(this, result, ...arguments);
                        return result;
                    };
                }
                const after = (...args) => {
                    if (entities.modal.style.display === "block") {
                        setTimeout(highlight, 300)
                    }
                }
                File.editor.library.openFile = decorator(File.editor.library.openFile, after);
            }
        }, config.LOOP_DETECT_INTERVAL);
    }

    const call = () => {
        if (entities.modal.style.display === "block") {
            hide();
        } else {
            entities.modal.style.display = "block";
            entities.input.select();
        }
    }

    window.addEventListener("keydown", ev => {
        if (config.HOTKEY(ev)) {
            call();
            ev.preventDefault();
            ev.stopPropagation();
        }
    });

    module.exports = {
        config,
        call,
        meta: {
            hide,
            run: highlight,
        }
    };
    console.log("multi_highlighter.js had been injected");
})()