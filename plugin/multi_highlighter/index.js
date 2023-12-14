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
6. 下面代码就是本着【又不是不能用】的心态码的，只追求实现速度。若你有心重构，我帮你抽象出了multiHighlighter类，可以方便的搜索并添加高亮标签，接下来你需要的就是和Typora混淆后的frame.js做斗争，和Typora各自特性作斗争。
*/

class multiHighlighterPlugin extends BasePlugin {
    styleTemplate = () => ({
        run_style: {
            input_width: (this.config.SHOW_RUN_BUTTON) ? "95%" : "100%",
            case_button_right: (this.config.SHOW_RUN_BUTTON) ? "32px" : "6px",
            run_button_display: (this.config.SHOW_RUN_BUTTON) ? "" : "none",
        },
        colors_style: this.config.STYLE_COLOR.map((color, idx) => `.plugin-search-hit${idx} { background-color: ${color}; }`).join("\n")
    })

    html = () => {
        const modal = document.createElement("div");
        modal.id = 'plugin-multi-highlighter';
        modal.classList.add("plugin-common-modal");
        modal.style.display = "none";
        modal.innerHTML = `
            <div id="plugin-multi-highlighter-input">
                <input type="text" placeholder="多关键字高亮 空格分隔">
                <span ty-hint="区分大小写" class="plugin-multi-highlighter-option-btn ${(this.config.CASE_SENSITIVE) ? "select" : ""}" aria-label="区分大小写">
                    <svg class="icon"><use xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="#find-and-replace-icon-case"></use></svg>
                </span>
                <span class="run-highlight ion-ios7-play" ty-hint="运行"></span>
            </div>
            <div id="plugin-multi-highlighter-result" style="display: none"></div>`;
        return modal
    }

    hotkey = () => [{hotkey: this.config.HOTKEY, callback: this.call}]

    init = () => {
        this.entities = {
            write: document.getElementById("write"),
            modal: document.getElementById('plugin-multi-highlighter'),
            input: document.querySelector("#plugin-multi-highlighter-input input"),
            runButton: document.querySelector("#plugin-multi-highlighter-input .run-highlight"),
            caseOption: document.querySelector(".plugin-multi-highlighter-option-btn"),
            result: document.getElementById("plugin-multi-highlighter-result"),
        }

        this.multiHighlighter = new multiHighlighter(this);
        this.fenceMultiHighlighterList = []; // 为了解决fence惰性加载的问题
        this.lastHighlightFilePath = "";
        this.showMarkerInfo = {idxOfFence: -1, idxOfWrite: -1};
    }

    process = () => {
        this.init();

        this.processAddCodeBlock();

        this.utils.addEventListener(this.utils.eventType.fileOpened, this.utils.debounce(() => {
            this.config.RESEARCH_WHILE_OPEN_FILE && this.entities.modal.style.display === "block" && this.highlight();
        }, 1000));

        this.entities.input.addEventListener("keydown", ev => {
            if (ev.key === "Enter") {
                ev.stopPropagation();
                ev.preventDefault();
                this.highlight();
            } else if (ev.key === "Escape" || ev.key === "Backspace" && this.config.BACKSPACE_TO_HIDE && !this.entities.input.value) {
                ev.stopPropagation();
                ev.preventDefault();
                this.clearHighlight(true);
                this.hide();
            }
        })

        this.entities.caseOption.addEventListener("click", ev => {
            this.entities.caseOption.classList.toggle("select");
            this.config.CASE_SENSITIVE = !this.config.CASE_SENSITIVE;
            ev.preventDefault();
            ev.stopPropagation();
        })

        this.entities.result.addEventListener("mousedown", ev => {
            const target = ev.target.closest(".plugin-multi-highlighter-result-item");
            if (!target) return;

            ev.stopPropagation();
            ev.preventDefault();

            // 当用户切换文档时
            if (this.utils.getFilePath() !== this.lastHighlightFilePath) {
                this.highlight();
                return;
            }

            const idx = target.getAttribute("idx");
            const className = `plugin-search-hit${idx}`;
            let resultList = document.getElementsByClassName(className);

            // 如果被刷新掉了，重新请求一次
            if (resultList.length === 0) {
                const success = this.highlight(false);
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
                this.highlight();
                return;
            }

            this.showMarkerInfo.idxOfWrite = this.whichMarker(this.entities.write, next);

            const fence = next.closest("#write .md-fences");
            if (fence && !fence.classList.contains("modeLoaded")) {
                this.showMarkerInfo.idxOfFence = this.whichMarker(fence, next);
                // scroll到Fence，触发File.editor.fences.addCodeBlock函数，接下来的工作就交给他了
                this.utils.scroll(next);
            } else {
                this.handleHiddenElement(next);
                this.utils.scroll(next);
                this.showIfNeed(next);
            }
            target.setAttribute("cur", nextIdx + "");
            if (this.config.SHOW_CURRENT_INDEX) {
                const searcher = this.multiHighlighter.getHighlighter(idx);
                if (searcher) {
                    target.innerText = `${searcher.token.text} (${nextIdx + 1}/${searcher.matches.length})`;
                }
            }
        })

        if (this.config.SHOW_RUN_BUTTON) {
            this.entities.runButton.addEventListener("click", ev => {
                this.highlight();
                ev.preventDefault();
                ev.stopPropagation();
            })
        }

        if (this.config.REMOVE_WHEN_EDIT) {
            document.querySelector("content").addEventListener("mousedown", ev => {
                if (this.multiHighlighter.length() !== 0 && !ev.target.closest("#plugin-multi-highlighter")) {
                    this.clearHighlight(true);
                }
            }, true)
        }

        if (this.config.ALLOW_DRAG) {
            this.utils.dragFixedModal(this.entities.input, this.entities.modal);
        }
    }

    processAddCodeBlock = () => {
        let hasMarker = false;

        const before = cid => {
            if (this.multiHighlighter.length() !== 0) {
                hasMarker = !!this.entities.write.querySelector(`.md-fences[cid=${cid}] marker`);
            }
        }

        const after = cid => {
            if (!hasMarker || this.multiHighlighter.length() === 0) return;

            hasMarker = false;

            const fence = this.entities.write.querySelector(`.md-fences[cid=${cid}]`);
            if (!fence) return;

            const tokens = this.multiHighlighter.getTokens();
            if (this.config.USE_LIST_THRESHOLD > tokens.length
                || this.config.CLEAR_LIST_THRESHOLD > 0 && this.fenceMultiHighlighterList.length === this.config.CLEAR_LIST_THRESHOLD
            ) {
                this.clearFenceMultiHighlighterList();
                this.multiHighlighter.removeHighlight();
                this.multiHighlighter.highlight();
                if (this.showMarkerInfo.idxOfWrite !== -1) {
                    this.getAndShowMarker(this.entities.write, this.showMarkerInfo.idxOfWrite);
                    this.showMarkerInfo.idxOfWrite = -1;
                }
            } else {
                const fenceMultiHighlighter = new multiHighlighter(this);
                fenceMultiHighlighter.new(tokens, fence, this.config.CASE_SENSITIVE, "plugin-search-hit");
                fenceMultiHighlighter.highlight();
                this.fenceMultiHighlighterList.push(fenceMultiHighlighter);
                if (this.showMarkerInfo.idxOfFence !== -1) {
                    this.getAndShowMarker(fence, this.showMarkerInfo.idxOfFence);
                    this.showMarkerInfo.idxOfFence = -1;
                }
            }
        }

        this.utils.addEventListener(this.utils.eventType.beforeAddCodeBlock, before);
        this.utils.addEventListener(this.utils.eventType.afterAddCodeBlock, after);
    }

    compatibleFenceEnhancePlugin = fence => {
        if (!fence) return;
        const fenceEnhancePlugin = this.utils.getPlugin("fence_enhance");
        fenceEnhancePlugin && fenceEnhancePlugin.expandFence(fence);
    }

    clearFenceMultiHighlighterList = () => {
        console.debug("clearFenceMultiHighlighterList");
        this.fenceMultiHighlighterList.forEach(highlighter => highlighter.clear());
        this.fenceMultiHighlighterList = [];
    }

    clearHighlight = (refreshFences = false) => {
        const fences = refreshFences ? this.getNeedRefreshFences() : [];
        this.multiHighlighter.clear();
        this.clearFenceMultiHighlighterList();
        this.entities.write.querySelectorAll(".plugin-multi-highlighter-bar").forEach(this.utils.removeElement);
        fences.forEach(cid => {
            const fence = File.editor.fences.queue[cid];
            fence && fence.refresh();
        });
    }

    getNeedRefreshFences = () => {
        const set = new Set();
        this.entities.write.getElementsByTagName("marker").forEach(el => {
            const target = el.closest(".md-fences[cid]");
            target && set.add(target.getAttribute("cid"));
        })
        return set
    }

    doSearch = (keyArr, refreshResult = true) => {
        this.clearHighlight();

        this.multiHighlighter.new(keyArr, this.entities.write, this.config.CASE_SENSITIVE, "plugin-search-hit");
        this.multiHighlighter.highlight();

        if (refreshResult) {
            const itemList = this.multiHighlighter.getList().map((searcher, idx) => {
                const color = (idx < this.config.STYLE_COLOR.length) ? this.config.STYLE_COLOR[idx] : this.config.DEFAULT_COLOR;
                return `<div class="plugin-multi-highlighter-result-item" style="background-color: ${color}" ty-hint="左键下一个；右键上一个"
                         idx="${idx}" cur="-1">${searcher.token.text} (${searcher.matches.length})</div>`;
            })
            this.entities.result.innerHTML = itemList.join("");
        }
        this.entities.result.style.display = "";
    }

    getKeyArr = () => {
        const value = this.entities.input.value;
        if (value) {
            return value.split(this.config.SEPARATOR).filter(Boolean)
        }
    }

    setInputValue = value => this.entities.input.value = value;

    highlight = (refreshResult = true) => {
        this.lastHighlightFilePath = this.utils.getFilePath();
        const keyArr = this.getKeyArr();
        if (!keyArr) return false;
        this.doSearch(keyArr, refreshResult);
        return true;
    }

    handleHiddenElement = marker => {
        const image = marker.closest(`#write span[md-inline="image"]`);
        if (image) {
            image.classList.add("md-expand");
        }
        const link = marker.closest(`#write span[md-inline="link"]`);
        if (link) {
            link.classList.add("md-expand");
        }
        const fence = marker.closest("#write .md-fences");
        if (fence) {
            this.compatibleFenceEnhancePlugin(fence);
        }
    }

    showIfNeed = marker => {
        if (this.config.SHOW_KEYWORD_OUTLINE) {
            document.querySelectorAll(".plugin-multi-highlighter-move").forEach(ele => ele.classList.remove("plugin-multi-highlighter-move"));
            marker.classList.add("plugin-multi-highlighter-move");
        }

        if (this.config.SHOW_KEYWORD_BAR) {
            const writeRect = this.entities.write.getBoundingClientRect();
            const markerRect = marker.getBoundingClientRect();

            const bar = document.createElement("div");
            bar.classList.add("plugin-multi-highlighter-bar");
            bar.style.height = markerRect.height + "px";
            bar.style.width = writeRect.width + "px";
            bar.style.top = "0";
            marker.appendChild(bar);

            setTimeout(() => this.utils.removeElement(bar), 3000);
        }
    }

    whichMarker = (parent, marker) => {
        const markers = parent.getElementsByTagName("marker");
        for (let idx = 0; idx < markers.length; idx++) {
            if (markers[idx] === marker) {
                return idx
            }
        }
        return -1
    }

    getMarker = (parent, idx) => {
        const markers = parent.querySelectorAll("marker");
        if (markers) {
            return markers[idx];
        }
    }

    hide = () => {
        this.clearHighlight();
        this.entities.modal.style.display = "none";
    }
    show = () => {
        this.entities.modal.style.display = "block";
        this.entities.input.select();
    }
    toggleModal = () => {
        if (this.entities.modal.style.display === "block") {
            this.hide();
        } else {
            this.show();
        }
    }

    getAndShowMarker = (parent, idx) => {
        setTimeout(() => {
            const nthMarker = this.getMarker(parent, idx);
            if (nthMarker) {
                this.utils.scroll(nthMarker);
                this.showIfNeed(nthMarker);
            }
        }, 120);
    }

    call = () => this.toggleModal();
}

class multiHighlighter {
    constructor(controller) {
        this.highlighterList = [];
        this.InstantSearch = controller.utils.requireFilePath("./plugin/multi_highlighter/highlighter.js").InstantSearch;
    }

    _newHighlighter(root, key, caseSensitive, className) {
        return new this.InstantSearch(
            root, // root
            {text: key, caseSensitive: caseSensitive, className: className}, //token
            true, // scrollToResult
            className, // defaultClassName
            caseSensitive, // defaultCaseSensitive
        )
    }

    new(keyArr, root, caseSensitive, className) {
        this.highlighterList = keyArr.map((key, idx) => this._newHighlighter(root, key, caseSensitive, className + idx));
    }

    highlight() {
        this.highlighterList.forEach(highlighter => highlighter.highlight());
    }

    removeHighlight() {
        this.highlighterList.forEach(highlighter => highlighter.removeHighlight());
    }

    clear() {
        this.removeHighlight();
        this.highlighterList = [];
    }

    length() {
        return this.highlighterList.length
    }

    getList() {
        return this.highlighterList
    }

    getHighlighter(idx) {
        return this.highlighterList[idx]
    }

    getTokens() {
        return this.highlighterList.map(highlighter => highlighter.token.text)
    }
}


module.exports = {
    plugin: multiHighlighterPlugin
};
