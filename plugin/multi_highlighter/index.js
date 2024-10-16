/**
 * 1. 对比普通网页，给Typora添加多关键字高亮有两个难点：可编辑、延迟加载Fence
 * 2. 可编辑：
 *    1. 给关键字添加高亮是通过添加标签实现的。但是为了保证数据安全，最好不要修改#write的标签结构。所以需要及时地撤销添加的标签。
 *    2. 同时，Typora监控着#write的结构，以确保发生异常时能进行回滚操作。所以撤销添加的标签还不够，你还需要阅读frame.js研究Typora是怎么监控的，然后找出刷新方法。代码中的refreshFences函数就是用于此。
 * 3. 延迟加载Fence：
 *    1. Typora的代码块是使用intersectionObserver延迟加载的（具体可以看File.editor.fences.intersectionObserve）。
 *    2. 这就导致了添加的高亮标签会被刷掉，需要重新搜索高亮一次。
 *    3. 每个延迟加载的代码块都要全文搜索高亮一次肯定不太好，所以你需要少量的、针对性的搜索高亮，然后将这些高亮标签全都记录在案。fenceMultiHighlighterList就是用于此。整个过程也会消耗大量内存。
 *    4. 同时你还需要提供高亮关键字的定位功能，所以你必须协同每个MultiHighlighter对象。
 *    5. 这种情况还造成了定位功能的时机问题。本来是简单的管理MultiHighlighter对象就行。现在变成了：
 *        1. 判断下一个关键字是否处于未加载的Fence中
 *        2. 若是，则需要记录这个关键字的特征，滚动到这个Fence，触发Fence的加载
 *        3. 使用装饰器劫持Fence的加载函数，并在函数的最后执行搜索高亮操作。然后根据上面的特征找出特定的关键字（Fence中可能有多个关键字），再将滚动条滚动到这个位置，最后在对这个关键字提供位置提示。
 *        4. 将这个过程产生的高亮对象记录在案，并在合适的时机取消高亮。
 * 4. 这整套下来，导致逻辑被切的稀碎。同时你还需要注意很多小细节，比如图片和链接上的关键字，你需要显示其markdown源码后才能定位。
 * 5. 解决方式：我本来想使用类似于Golang的channel。channel非常适合这种逻辑代码各种跳跃的情况，且十分优雅。想来想去，去他妈，直接硬撸算了，没有遵循任何设计原则，代码非常难懂。
 * 6. 下面代码就是本着【又不是不能用】的心态码的，只追求实现速度。若你有心重构，我帮你抽象出了multiHighlighter类，可以方便的搜索并添加高亮标签。
 */
const { InstantSearch } = require("./highlighter");

class multiHighlighterPlugin extends BasePlugin {
    styleTemplate = () => ({
        colors_style: this.config.STYLE_COLOR.map((color, idx) => `.plugin-search-hit${idx} { background-color: ${color}; }`).join("\n")
    })

    html = () => `
        <div id="plugin-multi-highlighter" class="plugin-common-modal plugin-common-hidden">
            <div id="plugin-multi-highlighter-input">
                <input type="text" placeholder="多关键字高亮 空格分隔" title="空格分隔 引号包裹视为词组">
                <span ty-hint="区分大小写" class="plugin-multi-highlighter-option-btn ${(this.config.CASE_SENSITIVE) ? "select" : ""}">
                    <svg class="icon"><use xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="#find-and-replace-icon-case"></use></svg>
                </span>
            </div>
            <div id="plugin-multi-highlighter-result" class="plugin-common-hidden"></div>
        </div>
    `

    hotkey = () => [{ hotkey: this.config.HOTKEY, callback: this.call }]

    init = () => {
        this.entities = {
            write: this.utils.entities.eWrite,
            modal: document.querySelector("#plugin-multi-highlighter"),
            input: document.querySelector("#plugin-multi-highlighter-input input"),
            result: document.querySelector("#plugin-multi-highlighter-result"),
            caseOption: document.querySelector(".plugin-multi-highlighter-option-btn"),
        }
        // 当搜索关键字数量超出STYLE_COLOR范围时面板显示的颜色
        this.defaultColor = "#dd6699";
        // 关键字数量大于X时使用fenceMultiHighlighterList（以空间换时间）。若<0，则总是不使用。此选项用在当搜索了很多关键字时，保证有较快的响应速度
        this.useListThreshold = -1;
        // 当fenceMultiHighlighterList数量超过X时，clear之（以时间换空间）。若<0，则总不启用。此选项用在当上一个策略使用太多次后，花费时间去回收空间，保证不会占用太大内存
        this.clearListThresold = 12;
        // 为了解决fence惰性加载的问题
        this.fenceMultiHighlighterList = [];
        this.multiHighlighter = new multiHighlighter();
        this.lastHighlightFilePath = "";
        this.markerHelper = {
            idxOfFence: -1,
            idxOfWrite: -1,
            getMarkerIdx: (parent, marker) => Array.prototype.indexOf.call(parent.getElementsByTagName("marker"), marker),
            scrollToMarker: (parent, idx) => {
                setTimeout(() => {
                    const markers = parent.getElementsByTagName("marker");
                    const marker = markers && markers[idx];
                    if (marker) {
                        this.utils.scroll(marker);
                        this.markerHelper.highlightMarker(marker);
                    }
                }, 120);
            },
            highlightMarker: marker => {
                document.querySelectorAll(".plugin-multi-highlighter-move").forEach(ele => ele.classList.remove("plugin-multi-highlighter-move"));
                marker.classList.add("plugin-multi-highlighter-move");

                const writeRect = this.entities.write.getBoundingClientRect();
                const markerRect = marker.getBoundingClientRect();
                const bar = document.createElement("div");
                bar.classList.add("plugin-multi-highlighter-bar");
                bar.style.height = markerRect.height + "px";
                bar.style.width = writeRect.width + "px";
                marker.appendChild(bar);
                setTimeout(() => this.utils.removeElement(bar), 3000);
            },
        }
    }

    process = () => {
        this.onAddCodeBlock();

        this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.otherFileOpened, this.utils.debounce(() => {
            this.config.RESEARCH_WHILE_OPEN_FILE && this.utils.isShow(this.entities.modal) && this.highlight();
        }, 1000));

        this.entities.input.addEventListener("keydown", ev => {
            if (ev.key === "Enter") {
                this.highlight();
            } else if (ev.key === "Escape" || ev.key === "Backspace" && this.config.BACKSPACE_TO_HIDE && !this.entities.input.value) {
                this.clearHighlight(true);
                this.hide();
            }
        })
        this.entities.caseOption.addEventListener("click", ev => {
            this.entities.caseOption.classList.toggle("select");
            this.config.CASE_SENSITIVE = !this.config.CASE_SENSITIVE;
        })
        this.utils.entities.eContent.addEventListener("mousedown", ev => {
            const shouldClear = this.multiHighlighter.length() !== 0 && !ev.target.closest("#plugin-multi-highlighter");
            shouldClear && this.clearHighlight(true);
        }, true)

        this.entities.result.addEventListener("mousedown", ev => {
            const target = ev.target.closest(".plugin-multi-highlighter-result-item");
            if (!target) return;

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
            } else if (ev.button === 2) { // 鼠标右键
                nextIdx = (targetIdx === 0 || targetIdx === -1) ? resultList.length - 1 : targetIdx - 1;
            }

            const next = resultList[nextIdx];
            if (!next) {
                this.highlight();
                return;
            }

            this.markerHelper.idxOfWrite = this.markerHelper.getMarkerIdx(this.entities.write, next);

            const fence = next.closest("#write .md-fences");
            if (fence && !fence.classList.contains("modeLoaded")) {
                this.markerHelper.idxOfFence = this.markerHelper.getMarkerIdx(fence, next);
                // scroll到Fence，触发intersectionObserver，进而触发File.editor.fences.addCodeBlock函数
                this.utils.scroll(next);
            } else {
                this._handleHiddenElement(next);
                this.utils.scroll(next);
                this.markerHelper.highlightMarker(next);
            }
            target.setAttribute("cur", nextIdx + "");
            const searcher = this.multiHighlighter.getHighlighter(idx);
            if (searcher) {
                target.innerText = `${searcher.token.text} (${nextIdx + 1}/${searcher.matches.length})`;
            }
        })
        if (this.config.ALLOW_DRAG) {
            this.utils.dragFixedModal(this.entities.input, this.entities.modal);
        }
    }

    onAddCodeBlock = () => {
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
            const shouldRefresh = this.useListThreshold > tokens.length || this.clearListThresold > 0 && this.fenceMultiHighlighterList.length === this.clearListThresold
            if (shouldRefresh) {
                this.clearFenceMultiHighlighterList();
                this.multiHighlighter.removeHighlight();
                this.multiHighlighter.highlight();
                if (this.markerHelper.idxOfWrite !== -1) {
                    this.markerHelper.scrollToMarker(this.entities.write, this.markerHelper.idxOfWrite);
                    this.markerHelper.idxOfWrite = -1;
                }
            } else {
                const fenceMultiHighlighter = new multiHighlighter(this);
                fenceMultiHighlighter.new(tokens, fence, this.config.CASE_SENSITIVE, "plugin-search-hit");
                fenceMultiHighlighter.highlight();
                this.fenceMultiHighlighterList.push(fenceMultiHighlighter);
                if (this.markerHelper.idxOfFence !== -1) {
                    this.markerHelper.scrollToMarker(fence, this.markerHelper.idxOfFence);
                    this.markerHelper.idxOfFence = -1;
                }
            }
        }
        this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.beforeAddCodeBlock, before);
        this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.afterAddCodeBlock, after, 999);
    }

    clearFenceMultiHighlighterList = () => {
        console.debug("clearFenceMultiHighlighterList");
        this.fenceMultiHighlighterList.forEach(highlighter => highlighter.clear());
        this.fenceMultiHighlighterList = [];
    }

    clearHighlight = (refreshFences = false) => {
        const getNeedRefreshFences = () => {
            const set = new Set();
            this.entities.write.getElementsByTagName("marker").forEach(el => {
                const target = el.closest(".md-fences[cid]");
                target && set.add(target.getAttribute("cid"));
            })
            return set
        }
        const fences = refreshFences ? getNeedRefreshFences() : [];
        this.multiHighlighter.clear();
        this.clearFenceMultiHighlighterList();
        this.entities.write.querySelectorAll(".plugin-multi-highlighter-bar").forEach(this.utils.removeElement);
        fences.forEach(cid => {
            const fence = File.editor.fences.queue[cid];
            fence && fence.refresh();
        });
    }

    highlight = (refreshResult = true) => {
        const keyArr = this._splitKeyword(this.entities.input.value);
        this.lastHighlightFilePath = this.utils.getFilePath();
        this._doSearch(keyArr, refreshResult);
        return true;
    }

    _doSearch = (keyArr, refreshResult = true) => {
        this.clearHighlight();

        if (!keyArr || keyArr.length === 0) {
            this.utils.hide(this.entities.result);
            return;
        }

        this.multiHighlighter.new(keyArr, this.entities.write, this.config.CASE_SENSITIVE, "plugin-search-hit");
        this.multiHighlighter.highlight();

        if (refreshResult) {
            const itemList = this.multiHighlighter.getList().map((searcher, idx) => {
                const color = (idx < this.config.STYLE_COLOR.length) ? this.config.STYLE_COLOR[idx] : this.defaultColor;
                return `<div class="plugin-multi-highlighter-result-item" style="background-color: ${color}" ty-hint="左键下一个；右键上一个"
                         idx="${idx}" cur="-1">${searcher.token.text} (${searcher.matches.length})</div>`;
            })
            this.entities.result.innerHTML = itemList.join("");
        }
        this.utils.show(this.entities.result);
    }

    _handleHiddenElement = marker => {
        const inline = marker.closest('#write span[md-inline="image"], #write span[md-inline="link"], #write span[md-inline="inline_math"]');
        if (inline) {
            inline.classList.add("md-expand");
            return;
        }
        const fence = marker.closest("#write .md-fences");
        if (fence) {
            this.utils.callPluginFunction("fence_enhance", "expandFence", fence);
        }
    }

    _splitKeyword = str => {
        const regex = /[^\s"']+|"([^"]*)"|'([^']*)'/g;
        let result = [];
        let match;
        while ((match = regex.exec(str))) {
            result.push(match[1] || match[2] || match[0]);
        }
        return result;
    }

    hide = () => {
        this.clearHighlight();
        this.utils.hide(this.entities.modal);
    }
    show = () => {
        this.utils.show(this.entities.modal);
        this.entities.input.select();
    }
    toggleModal = () => {
        if (this.utils.isShow(this.entities.modal)) {
            this.hide();
        } else {
            this.show();
        }
    }

    call = () => this.toggleModal();
}

class multiHighlighter {
    constructor() {
        this.highlighterList = [];
        this.InstantSearch = InstantSearch;
    }

    _newHighlighter(root, key, caseSensitive, className) {
        return new this.InstantSearch(
            root, // root
            { text: key, caseSensitive: caseSensitive, className: className }, //token
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
