class tocPlugin extends BaseCustomPlugin {
    styleTemplate = () => true

    html = () => `
        <div id="plugin-toc" class="plugin-common-modal plugin-common-hidden">
            <div class="grip-right"></div>
            <div class="plugin-toc-wrap">
                <div class="plugin-toc-header">
                    <div class="plugin-toc-icon" data-type="header" ty-hint="${this.i18n.t("header")}"><div class="fa fa-header"></div></div>
                    <div class="plugin-toc-icon" data-type="image" ty-hint="${this.i18n.t("image")}"><div class="fa fa-image"></div></div>
                    <div class="plugin-toc-icon" data-type="table" ty-hint="${this.i18n.t("table")}"><div class="fa fa-table"></div></div>
                    <div class="plugin-toc-icon" data-type="fence" ty-hint="${this.i18n.t("fence")}"><div class="fa fa-code"></div></div>
                    <div class="plugin-toc-icon" data-type="link" ty-hint="${this.i18n.t("link")}"><div class="fa fa-link"></div></div>
                    <div class="plugin-toc-icon" data-type="math" ty-hint="${this.i18n.t("math")}"><div class="fa fa-dollar"></div></div>
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
            this.utils.decorate(
                () => File && File.editor && File.editor.library && File.editor.library.outline,
                "highlightVisibleHeader",
                null,
                this.highlightVisibleHeader,
            )
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
                const node = ev.target.closest(".toc-node")
                if (node) {
                    if (File.editor.sourceView.inSourceMode) {
                        File.toggleSourceMode()
                    }
                    this.utils.scrollByCid(node.dataset.ref, -1, true)
                    return
                }
                const icon = ev.target.closest(".plugin-toc-icon")
                if (icon) {
                    this.refresh(icon.dataset.type)
                }
            })

            if (this.config.right_click_outline_button_to_toggle) {
                const panelTitle = document.querySelector("#info-panel-tab-outline .info-panel-tab-title")
                if (panelTitle) {
                    panelTitle.addEventListener("mousedown", ev => ev.button === 2 && this.toggle())
                }
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
            this.utils.resizeElement({
                targetEle: this.entities.grip,
                resizeEle: this.entities.modal,
                resizeWidth: true,
                resizeHeight: false,
                onMouseDown,
                onMouseMove,
                onMouseUp: null,
            })
        }
        const onDrag = () => {
            if (!this.config.sortable) return

            let dragItem
            const that = this
            const classAbove = "plugin-toc-drag-above"
            const classBelow = "plugin-toc-drag-below"
            const classSource = "plugin-toc-drag-source"
            const isAncestorOf = (ancestor, descendant) => ancestor.parentElement.contains(descendant)
            const isPreceding = (el, otherEl) => el.compareDocumentPosition(otherEl) === document.DOCUMENT_POSITION_PRECEDING
            const setStyle = function (ev) {
                if (isAncestorOf(dragItem, this)) {
                    ev.originalEvent.dataTransfer.effectAllowed = "none"
                    ev.originalEvent.dataTransfer.dropEffect = "none"
                } else {
                    const cls = isPreceding(dragItem, this) ? classAbove : classBelow
                    this.parentElement.classList.add(cls)
                }
                return false
            }
            const getHeader = (cid, headers, blocks) => {
                const start = headers.findIndex(h => h.node.cid === cid)
                if (start === -1) return

                const header = headers[start].node
                if (!header.attributes) return

                let end = start + 1
                const depth = header.attributes.depth
                while (end < headers.length) {
                    const { attributes } = headers[end].node
                    const _depth = attributes && attributes.depth
                    if (_depth && _depth <= depth) {
                        break
                    }
                    end++
                }

                const startIdx = headers[start].idx
                const endIdx = headers.length === end ? blocks.length : headers[end].idx
                return { startIdx, endIdx }
            }
            $(this.entities.list)
                .on("dragstart", ".toc-node", function (ev) {
                    dragItem = this
                    ev.originalEvent.dataTransfer.effectAllowed = "move"
                    ev.originalEvent.dataTransfer.dropEffect = "move"
                    this.parentElement.classList.add(classSource)
                })
                .on("dragenter", ".toc-node", setStyle)
                .on("dragover", ".toc-node", setStyle)
                .on("dragleave", ".toc-node", function () {
                    this.parentElement.classList.remove(classAbove, classBelow)
                })
                .on("drop", ".toc-node", function () {
                    if (isAncestorOf(dragItem, this)) return

                    const headers = []
                    const blocks = File.editor.nodeMap.blocks.toArray()
                    blocks.forEach((node, idx) => node.attributes.type === Node.TYPE.heading && headers.push({ idx: idx, node: node }))

                    const drag = getHeader(dragItem.dataset.ref, headers, blocks)
                    const drop = getHeader(this.dataset.ref, headers, blocks)

                    const dragLength = drag.endIdx - drag.startIdx
                    const removed = blocks.splice(drag.startIdx, dragLength)
                    const isDragDown = drag.startIdx < drop.startIdx
                    const insertIdx = isDragDown ? drop.endIdx - dragLength : drop.startIdx
                    blocks.splice(insertIdx, 0, ...removed)

                    const joiner = File.option.preferCRLF ? "\r\n" : "\n"
                    const content = blocks.map(node => node.toMark()).join(joiner)
                    const op = File.option.enableAutoSave ? { delayRefresh: true, skipChangeCount: true, skipStore: true } : undefined
                    File.reloadContent(content, op)
                })
                .on("dragend", function () {
                    const selector = `.${classAbove}, .${classBelow}, .${classSource}`
                    that.entities.list.querySelectorAll(selector).forEach(e => {
                        e.classList.remove(classAbove, classBelow, classSource)
                    })
                })
        }

        onEvent();
        onClick();
        onResize();
        onDrag()
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
        if (this.isModalShow()) {
            type = type || this.getCurrentType()
            this._setIconActive(type)
            const root = this._getRoot(type)
            const sortable = this.config.sortable && type === "header"
            this.entities.list.innerHTML = this._getRootHTML(root, sortable)
            this.highlightVisibleHeader()
        }
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
        const targetNode = this.entities.list.querySelector(`.toc-node[data-ref=${targetCid}]`);
        if (!targetNode) return;

        targetNode.classList.add("active");
    }

    _getRoot = type => (type === "header") ? this.utils.getTocTree(this.config.remove_header_styles) : this._getKindRoot([type]);

    _getKindRoot = types => {
        const includeHeadings = types.some(type => this.config.include_headings[type])
        if (includeHeadings) {
            types.push("h1", "h2")
        }

        const idxMap = { table: 0, fence: 0, image: 0, link: 0, math: 0 };
        const typeMap = {
            h1: ":scope > h1",
            h2: ":scope > h2",
            table: ".md-table",
            fence: ".md-fences",
            image: ".md-image",
            link: ".md-link",
            math: ".md-math-block, .md-inline-math-container",
        }
        const root = { depth: 0, cid: "n0", text: "root", children: [] };
        const current = { C: root, H1: root };
        const selector = types.map(t => typeMap[t]).join(" , ")
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
                const prefix = this.config.show_name[type]
                const idx = idxMap[type] + ""
                const extra = (imageHasAlt && type === "image") ? ele.dataset.alt : ""
                const text = [prefix, idx, extra].filter(Boolean).join(" ")
                current.C.children.push({ cid, children, text })
            }
        });
        return root
    }

    _getRootHTML = (rootNode, sortable) => {
        const drag = sortable ? 'draggable="true"' : ""
        const genLi = node => {
            const { text, cid, depth, class_ = "", children = [] } = node
            const t = this.utils.escape(text)
            let content = `<div class="toc-node ${class_}" data-ref="${cid}" ${drag}><span class="toc-text">${t}</span></div>`
            if (children.length !== 0) {
                const li = children.map(genLi).join("")
                content += `<ul>${li}</ul>`
            }
            return `<li data-depth="${depth}">${content}</li>`
        }
        const li = rootNode.children.map(genLi).join("")
        return `<ul class="toc-root">${li}</ul>`
    }
}

module.exports = {
    plugin: tocPlugin
}
