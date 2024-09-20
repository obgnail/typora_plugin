class tocPlugin extends BaseCustomPlugin {
    styleTemplate = () => true
    html = () => `<div id="plugin-toc" class="plugin-common-modal plugin-common-hidden"><div class="grip-right"></div><div class="toc-wrap"></div></div>`
    hotkey = () => [this.config.hotkey]
    init = () => {
        this.entities = {
            content: this.utils.entities.eContent,
            modal: document.querySelector("#plugin-toc"),
            grip: document.querySelector("#plugin-toc .grip-right"),
            wrap: document.querySelector("#plugin-toc .toc-wrap"),
        };
    }

    process = () => {
        const onEvent = () => {
            const { eventHub } = this.utils;
            eventHub.addEventListener(eventHub.eventType.outlineUpdated, () => this.isModalShow() && this.renewOutline());
            eventHub.addEventListener(eventHub.eventType.toggleSettingPage, hide => hide && this.isModalShow() && this.toggle());
            this.utils.decorate(() => File && File.editor && File.editor.library && File.editor.library.outline, "highlightVisibleHeader", null, this.highlightVisibleHeader);
            const resetPosition = () => {
                const { right } = this.entities.content.getBoundingClientRect();
                const { right: modalRight } = this.entities.modal.getBoundingClientRect();
                Object.assign(this.entities.modal.style, { left: `${right}px`, width: `${modalRight - right}px` });
            }
            eventHub.addEventListener(eventHub.eventType.afterToggleSidebar, resetPosition);
            eventHub.addEventListener(eventHub.eventType.afterSetSidebarWidth, resetPosition);
            if (this.config.default_show_toc) {
                eventHub.addEventListener(eventHub.eventType.allPluginsHadInjected, this.toggle);
            }
        }
        const onClick = () => {
            this.entities.modal.addEventListener("click", ev => {
                const target = ev.target.closest(".toc-node");
                if (!target) return;
                ev.stopPropagation();
                ev.preventDefault();
                const cid = target.getAttribute("ref");
                this.utils.scrollByCid(cid, -1, true);
            })
            if (this.config.right_click_outline_button_to_toggle) {
                const e = document.querySelector("#info-panel-tab-outline .info-panel-tab-title");
                e && e.addEventListener("mousedown", ev => ev.button === 2 && this.toggle());
            }
        }
        const onResize = () => {
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
                    deltaX = contentStartRight - contentMaxRight;
                }
                this.entities.content.style.width = contentStartWidth - deltaX + "px";
                this.entities.modal.style.left = modalStartLeft - deltaX + "px";
                return { deltaX, deltaY }
            }
            this.utils.resizeFixedModal(this.entities.grip, this.entities.modal, true, false, onMouseDown, onMouseMove);
        }

        onEvent();
        onClick();
        onResize();
    }

    callback = anchorNode => this.toggle()

    isModalShow = () => this.utils.isShow(this.entities.modal)

    hideModal = () => {
        const { modal, content } = this.entities;
        this.utils.entities.eWrite.style.width = "";
        this.utils.hide(modal);
        modal.style.removeProperty("left");
        modal.style.removeProperty("width");
        content.style.removeProperty("width");
    }

    showModal = (renewOutline = true) => {
        this.utils.show(this.entities.modal);
        const { width } = this.entities.content.getBoundingClientRect();
        const modalWidth = width * this.config.width_percent_when_pin_right / 100;
        this.entities.modal.style.width = modalWidth + "px";
        this.entities.content.style.width = `${width - modalWidth}px`;
        this.utils.entities.eWrite.style.width = "initial";
        renewOutline && this.renewOutline();
    }

    toggle = () => {
        if (this.isModalShow()) {
            this.hideModal();
        } else {
            this.showModal();
        }
    }

    renewOutline = () => {
        const ul = this._getTocTemplate();
        const toc = this.utils.htmlTemplater.create(ul);
        this.entities.wrap.firstElementChild && this.entities.wrap.removeChild(this.entities.wrap.firstElementChild);
        this.entities.wrap.appendChild(toc);
        this.highlightVisibleHeader();
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
        this.entities.wrap.querySelectorAll(".toc-node.active").forEach(ele => ele.classList.remove("active"));
        const targetNode = this.entities.wrap.querySelector(`.toc-node[ref=${targetCid}]`);
        if (!targetNode) return;

        targetNode.classList.add("active");
    }

    _getTocTemplate = () => {
        const rootNode = this._getTocRootNode();
        const li = rootNode.children.map(this._tocTemplate);
        return { ele: "ul", class_: "toc-root", children: li }
    }

    _getTocRootNode = () => {
        const root = { depth: 0, cid: "n0", text: "root", children: [] };
        const { headers = [] } = File.editor.nodeMap.toc;
        if (headers.length === 0) return root;

        const { outline } = File.editor.library;
        const toc = this.config.escape_header
            ? outline.getHeaderMatrix(true).map(([depth, text, cid]) => ({ depth, text, cid, children: [] }))
            : headers.map(({ attributes: { depth, text }, cid }) => ({ depth, text, cid, children: [] }))

        toc.forEach((node, idx) => {
            const parent = this._findParent(toc, idx - 1, node.depth) || root;
            parent.children.push(node);
        })
        return root
    }

    _tocTemplate = rootNode => {
        const { text, cid, depth, children = [] } = rootNode;
        const content = [{ class_: "toc-node", ref: cid, children: [{ ele: "span", class_: "toc-text", text }] }];
        const list = children.map(this._tocTemplate);
        if (list.length) {
            content.push({ ele: "ul", children: list });
        }
        return { ele: "li", class_: "plugin-header-depth-" + depth, children: content }
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