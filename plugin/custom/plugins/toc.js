class tocPlugin extends BaseCustomPlugin {
    styleTemplate = () => true
    html = () => `<div id="plugin-toc" class="plugin-common-modal plugin-common-hidden plugin-toc"><div class="grip-right"></div><div class="toc-ul"></div></div>`
    hotkey = () => [this.config.hotkey]
    init = () => {
        this.entities = {
            content: this.utils.entities.eContent,
            modal: document.querySelector("#plugin-toc"),
            grip: document.querySelector("#plugin-toc .grip-right"),
            ul: document.querySelector("#plugin-toc .toc-ul"),
        };
    }

    process = () => {
        this.onResize();
        this.onToggleSidebar();
        this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.outlineUpdated, () => this.isModalShow() && this.renewModal());
        this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.toggleSettingPage, hide => hide && this.isModalShow() && this.toggle());
        this.utils.decorate(() => File && File.editor && File.editor.library && File.editor.library.outline, "highlightVisibleHeader", null, this.highlightVisibleHeader);
        this.entities.modal.addEventListener("click", ev => {
            const target = ev.target.closest(".toc-node");
            if (!target) return;
            ev.stopPropagation();
            ev.preventDefault();
            const cid = target.getAttribute("ref");
            this.utils.scrollByCid(cid);
        })
        if (this.config.right_click_outline_button_to_toggle) {
            document.querySelector("#info-panel-tab-outline .info-panel-tab-title").addEventListener("mousedown", ev => ev.button === 2 && this.toggle());
        }
        if (this.config.default_show_toc) {
            this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.allPluginsHadInjected, this.toggle);
        }
    }

    callback = () => this.toggle()

    onToggleSidebar = () => {
        const resetPosition = () => {
            const {right} = this.entities.content.getBoundingClientRect();
            const {right: modalRight} = this.entities.modal.getBoundingClientRect();
            Object.assign(this.entities.modal.style, {left: `${right}px`, width: `${modalRight - right}px`});
        }
        this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.afterToggleSidebar, resetPosition);
        this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.afterSetSidebarWidth, resetPosition);
    }

    isModalShow = () => this.utils.isShow(this.entities.modal)

    toggle = () => {
        if (this.isModalShow()) {
            this.utils.entities.eWrite.style.width = "";
            this.utils.hide(this.entities.modal);
            this.entities.modal.style.removeProperty("left");
            this.entities.modal.style.removeProperty("width");
            this.entities.content.style.removeProperty("right");
            this.entities.content.style.removeProperty("width");
            return
        }

        this.utils.show(this.entities.modal);
        const {width, right} = this.entities.content.getBoundingClientRect();
        const modalWidth = width * this.config.width_percent_when_pin_right / 100;
        this.entities.modal.style.width = modalWidth + "px";
        Object.assign(this.entities.content.style, {
            right: `${right - modalWidth}px`,
            width: `${width - modalWidth}px`,
        });
        this.utils.entities.eWrite.style.width = "initial";
        this.renewModal();
    }

    renewModal = () => {
        const ul = this._getTocTemplate();
        const toc = this.utils.htmlTemplater.create(ul);
        this.entities.ul.firstElementChild && this.entities.ul.removeChild(this.entities.ul.firstElementChild);
        this.entities.ul.appendChild(toc);
        this.highlightVisibleHeader();
    }

    onResize = () => {
        let contentStartRight = 0;
        let contentStartWidth = 0;
        let modalStartLeft = 0;
        let contentMaxRight = 0;
        const onMouseDown = () => {
            const contentRect = this.entities.content.getBoundingClientRect();
            contentStartRight = contentRect.right;
            contentStartWidth = contentRect.width;

            const modalRect = this.entities.modal.getBoundingClientRect();
            modalStartLeft = modalRect.left;
            contentMaxRight = modalRect.right - 100;
        }
        const onMouseMove = (deltaX, deltaY) => {
            deltaX = -deltaX;
            deltaY = -deltaY;
            let newContentRight = contentStartRight - deltaX;
            if (newContentRight > contentMaxRight) {
                newContentRight = contentMaxRight;
                deltaX = contentStartRight - contentMaxRight;
            }
            this.entities.content.style.right = newContentRight + "px";
            this.entities.content.style.width = contentStartWidth - deltaX + "px";
            this.entities.modal.style.left = modalStartLeft - deltaX + "px";
            return {deltaX, deltaY}
        }
        this.utils.resizeFixedModal(this.entities.grip, this.entities.modal, true, false, onMouseDown, onMouseMove);
    }

    highlightVisibleHeader = (_, $header, targetIdx) => {
        if (!this.isModalShow()) return;

        const headers = $header || $(File.editor.writingArea).children(File.editor.library.outline.headerStr);
        if (!headers.length) return;

        const contentScrollTop = this.utils.entities.$eContent.scrollTop();
        const isBelowViewBox = 1 === this.utils.compareScrollPosition(headers[headers.length - 1], contentScrollTop);
        const findActiveIndex = index => {
            for (index--; headers[index] && this.utils.compareScrollPosition(headers[index], contentScrollTop) === 0;) {
                index--;
            }
            return index + 1;
        }

        let start = isBelowViewBox ? 0 : headers.length - 1;
        let end = headers.length - 1;
        let activeIndex = targetIdx === undefined ? undefined : targetIdx;

        while (1 < end - start && activeIndex === undefined) {
            let middleIndex = Math.floor((start + end) / 2);
            let scrollPosition = this.utils.compareScrollPosition(headers[middleIndex], contentScrollTop);
            if (scrollPosition === 1) {
                end = middleIndex;
            } else if (scrollPosition === -1) {
                start = middleIndex;
            } else {
                activeIndex = findActiveIndex(middleIndex);
            }
        }
        if (activeIndex === undefined) {
            activeIndex = start;
        }

        if (activeIndex >= headers.length) return;

        const targetCid = headers[activeIndex].getAttribute("cid");
        this.entities.ul.querySelectorAll(".toc-node.active").forEach(ele => ele.classList.remove("active"));
        const targetNode = this.entities.ul.querySelector(`.toc-node[ref=${targetCid}]`);
        if (!targetNode) return;

        targetNode.classList.add("active");
    }

    _getTocTemplate = () => {
        const rootNode = this._getTocRootNode();
        const li = rootNode.children.map(this._tocTemplate);
        return {ele: "ul", class_: "toc-root", children: li}
    }

    _getTocRootNode = () => {
        const root = {depth: 0, cid: "n0", text: "root", children: []};
        const {headers = []} = File.editor.nodeMap.toc;
        if (headers.length === 0) return root;

        const {outline} = File.editor.library;
        const toc = this.config.escape_header
            ? outline.getHeaderMatrix(true).map(([depth, text, cid]) => ({depth, text, cid, children: []}))
            : headers.map(({attributes: {depth, text}, cid}) => ({depth, text, cid, children: []}))

        toc.forEach((node, idx) => {
            const parent = this._findParent(toc, idx - 1, node.depth) || root;
            parent.children.push(node);
        })
        return root
    }

    _tocTemplate = rootNode => {
        const {text, cid, depth, children = []} = rootNode;
        const content = [{class_: "toc-node", ref: cid, children: [{ele: "span", class_: "toc-text", text}]}];
        const list = children.map(this._tocTemplate);
        if (list.length) {
            content.push({ele: "ul", children: list});
        }
        return {ele: "li", class_: "plugin-toc-depth-" + depth, children: content}
    }

    _findParent = (toc, idx, depth) => {
        while (idx >= 0 && toc[idx].depth >= depth) {
            idx--;
        }
        return toc[idx]
    }
}

module.exports = {
    plugin: tocPlugin
};