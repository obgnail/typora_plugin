class tocPlugin extends BaseCustomPlugin {
    styleTemplate = () => true

    html = () => `
        <div id="plugin-toc" class="plugin-common-modal plugin-common-hidden">
            <div class="grip-right"></div>
            <div class="plugin-toc-wrap">
                <div class="plugin-toc-header">
                    <div class="plugin-toc-icon" data-type="header" ty-hint="标题"><i class="fa fa-header"></i></div>
                    <div class="plugin-toc-icon" data-type="image" ty-hint="图片"><i class="fa fa-image"></i></div>
                    <div class="plugin-toc-icon" data-type="table" ty-hint="表格"><i class="fa fa-table"></i></div>
                    <div class="plugin-toc-icon" data-type="fence" ty-hint="代码块"><i class="fa fa-code"></i></div>
                    <div class="plugin-toc-icon" data-type="link" ty-hint="链接"><i class="fa fa-link"></i></div>
                    <div class="plugin-toc-icon" data-type="math" ty-hint="公式"><i class="fa fa-dollar"></i></div>
                </div>
                <div class="plugin-toc-list"></div>
            </div>
        </div>
    `

    hotkey = () => [this.config.hotkey]

    init = () => {
        this.entities = {
            content: this.utils.entities.eContent,
            modal: document.querySelector("#plugin-toc"),
            grip: document.querySelector("#plugin-toc .grip-right"),
            list: document.querySelector("#plugin-toc .plugin-toc-list"),
            header: document.querySelector("#plugin-toc .plugin-toc-header"),
        };
    }

    process = () => {
        const onEvent = () => {
            const { eventHub } = this.utils;
            eventHub.addEventListener(eventHub.eventType.outlineUpdated, () => this.refresh());
            eventHub.addEventListener(eventHub.eventType.toggleSettingPage, hide => hide && this.isModalShow() && this.toggle());
            eventHub.addEventListener(eventHub.eventType.fileEdited, this.utils.debounce(this.refresh, 300));
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
                const node = ev.target.closest(".toc-node");
                const icon = ev.target.closest(".plugin-toc-icon");

                if (!node && !icon) return;
                if (node) {
                    const cid = node.getAttribute("ref");
                    this.utils.scrollByCid(cid, -1, true);
                } else if (icon) {
                    this.refresh(icon.dataset.type);
                }
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

    showModal = (refresh = true) => {
        this.utils.show(this.entities.modal);
        const { width } = this.entities.content.getBoundingClientRect();
        const modalWidth = width * this.config.width_percent_when_pin_right / 100;
        this.entities.modal.style.width = modalWidth + "px";
        this.entities.content.style.width = `${width - modalWidth}px`;
        this.utils.entities.eWrite.style.width = "initial";
        refresh && this.refresh();
    }

    toggle = () => {
        if (this.isModalShow()) {
            this.hideModal();
        } else {
            this.showModal();
        }
    }

    getCurrentType = () => {
        const select = this.entities.header.querySelector(".select");
        return select ? select.dataset.type : "header";
    }

    refresh = type => {
        if (!this.isModalShow()) return;
        type = type || this.getCurrentType();
        this._setIconActive(type);
        const root = this._getRoot(type);
        const headers = this._getRootTemplate(root);
        const list = this.utils.htmlTemplater.create(headers);
        this.entities.list.firstElementChild && this.entities.list.removeChild(this.entities.list.firstElementChild);
        this.entities.list.appendChild(list);
        this.highlightVisibleHeader();
    }

    _setIconActive = type => this.entities.header.children.forEach(ele => ele.classList.toggle("select", ele.dataset.type === type))

    highlightVisibleHeader = (_, $header, targetIdx) => {
        if (!this.isModalShow() || this.getCurrentType() !== "header") return;

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
        this.entities.list.querySelectorAll(".toc-node.active").forEach(ele => ele.classList.remove("active"));
        const targetNode = this.entities.list.querySelector(`.toc-node[ref=${targetCid}]`);
        if (!targetNode) return;

        targetNode.classList.add("active");
    }

    _getRoot = type => (type === "header") ? this.utils.getTocTree(this.config.escape_header) : this._getKindRoot([type]);

    _getKindRoot = types => {
        const idxMap = { table: 0, fence: 0, image: 0, link: 0, math: 0 };
        const typeMap = {
            table: ".md-table",
            fence: ".md-fences",
            image: ".md-image",
            link: ".md-link",
            math: ".md-math-block, .md-inline-math-container",
        }
        const root = { depth: 0, cid: "n0", text: "root", children: [] };
        const current = { C: root, H1: root };
        const selector = ":scope>h1, :scope>h2, " + types.map(t => typeMap[t]).join(" , ");
        const imageHasAlt = document.querySelector(".md-image[data-alt]");
        this.utils.entities.eWrite.querySelectorAll(selector).forEach(ele => {
            if (ele.style.display === "none") return;

            const children = [];
            const tagName = ele.tagName;
            if (tagName === "H1" || tagName === "H2") {
                const header = { cid: ele.getAttribute("cid"), text: ele.textContent, class_: "toc-header-node", children };
                if (tagName === "H1") {
                    root.children.push(header);
                    current.H1 = header;
                } else {
                    current.H1.children.push(header);
                }
                current.C = header;
                return;
            }

            const classList = ele.classList;
            const type = classList.contains("md-table") ? "table"
                : classList.contains("md-fences") ? "fence"
                    : classList.contains("md-image") ? "image"
                        : classList.contains("md-link") ? "link"
                            : (classList.contains("md-math-block") || classList.contains("md-inline-math-container")) ? "math"
                                : null;

            if (type) {
                idxMap[type]++;
                const cid = ele.closest("[cid]").getAttribute("cid");
                let text = `${this.config.show_name[type]} ${idxMap[type]}`;
                if (imageHasAlt && type === "image") {
                    text += ` ${ele.dataset.alt}`;
                }
                current.C.children.push({ cid, children, text });
            }
        });
        return root
    }

    _getRootTemplate = rootNode => {
        const getTemplate = rootNode => {
            const { text, cid, depth, class_ = "", children = [] } = rootNode;
            const content = [{ class_: `toc-node ${class_}`, ref: cid, children: [{ ele: "span", class_: "toc-text", text }] }];
            const list = children.map(getTemplate);
            if (list.length) {
                content.push({ ele: "ul", children: list });
            }
            return { ele: "li", depth, children: content }
        }
        return { ele: "ul", class_: "toc-root", children: rootNode.children.map(getTemplate) }
    }
}

module.exports = {
    plugin: tocPlugin
};