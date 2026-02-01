class TOCPlugin extends BaseCustomPlugin {
    styleTemplate = () => true

    html = () => {
        const ICONS = { header: "fa-header", image: "fa-image", table: "fa-table", fence: "fa-code", link: "fa-link", math: "fa-dollar" }
        const buttons = this.config.title_bar_buttons.map(btn => {
            const icon = `<div class="fa ${ICONS[btn]}"></div>`
            const hint = this.i18n.t(`$option.title_bar_buttons.${btn}`)
            return `<div class="plugin-toc-icon" data-type="${btn}" ty-hint="${hint}">${icon}</div>`
        })
        const cls = buttons.length > 1 ? "plugin-toc-header" : "plugin-toc-header plugin-common-hidden"
        return `
            <div id="plugin-toc" class="plugin-common-modal plugin-common-hidden">
                <div class="grip-right"></div>
                <div class="plugin-toc-wrap">
                    <div class="${cls}">${buttons.join("")}</div>
                    <div class="plugin-toc-list"></div>
                </div>
            </div>`
    }

    hotkey = () => [this.config.hotkey]

    init = () => {
        this.diaplayNameFn = this._getDisplayNameFn()
        this.entities = {
            content: this.utils.entities.eContent,
            modal: document.querySelector("#plugin-toc"),
            grip: document.querySelector("#plugin-toc .grip-right"),
            list: document.querySelector("#plugin-toc .plugin-toc-list"),
            header: document.querySelector("#plugin-toc .plugin-toc-header"),
        }
    }

    process = () => {
        const onEvent = () => {
            const { eventHub } = this.utils
            eventHub.addEventListener(eventHub.eventType.outlineUpdated, () => this.refreshModal())
            eventHub.addEventListener(eventHub.eventType.toggleSettingPage, hide => hide && this.isModalShown() && this.hideModal())
            eventHub.addEventListener(eventHub.eventType.fileEdited, this.utils.debounce(this.refreshModal, 300))
            this.utils.decorate(() => File?.editor?.library?.outline, "highlightVisibleHeader", null, this._highlightVisibleHeader)
            const resetPosition = () => {
                const { right: contentRight } = this.entities.content.getBoundingClientRect()
                const { right: modalRight } = this.entities.modal.getBoundingClientRect()
                Object.assign(this.entities.modal.style, { left: `${contentRight}px`, width: `${modalRight - contentRight}px` })
            }
            eventHub.addEventListener(eventHub.eventType.afterToggleSidebar, resetPosition);
            eventHub.addEventListener(eventHub.eventType.afterSetSidebarWidth, resetPosition);
            if (this.config.default_show_toc) {
                eventHub.addEventListener(eventHub.eventType.allPluginsHadInjected, this.toggleModal)
            }
        }
        const onClick = () => {
            this.entities.modal.addEventListener("click", ev => {
                const toggleLi = ev.target.closest(".toc-toggle")?.closest("li")
                if (toggleLi) {
                    toggleLi.classList.toggle("collapsed")
                    return
                }

                const ref = ev.target.closest(".toc-node")?.dataset.ref
                if (ref) {
                    if (File.editor.sourceView.inSourceMode) File.toggleSourceMode()
                    this.utils.scrollByCid(ref, -1, true)
                    return
                }

                const type = ev.target.closest(".plugin-toc-icon")?.dataset.type
                if (type) this.refreshModal(type)
            })

            if (this.config.right_click_outline_button_to_toggle) {
                const panelTitle = document.querySelector("#info-panel-tab-outline .info-panel-tab-title")
                panelTitle?.addEventListener("mousedown", ev => ev.button === 2 && this.toggleModal())
            }
        }
        const onResize = () => {
            let contentStartRight = 0;
            let contentStartWidth = 0;
            let modalStartLeft = 0;
            let contentMaxRight = 0;
            const onMouseDown = () => {
                const contentRect = this.entities.content.getBoundingClientRect();
                const modalRect = this.entities.modal.getBoundingClientRect()
                contentStartRight = contentRect.right;
                contentStartWidth = contentRect.width;
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

                const targetDepth = headers[start].node.attributes?.depth
                if (targetDepth == null) return

                let end = start + 1
                while (end < headers.length) {
                    const nextDepth = headers[end].node.attributes?.depth
                    if (nextDepth != null && nextDepth <= targetDepth) break
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
                    const blocks = []
                    File.editor.nodeMap.blocks.sortedForEach(node => blocks.push(node))
                    blocks.forEach((node, idx) => {
                        if (node.attributes.type === Node.TYPE.heading) headers.push({ idx: idx, node: node })
                    })

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

    callback = anchorNode => this.toggleModal()

    isModalShown = () => this.utils.isShown(this.entities.modal)

    hideModal = () => {
        const { modal, content } = this.entities;
        this.utils.entities.eWrite.style.width = "";
        this.utils.hide(modal);
        modal.style.removeProperty("left");
        modal.style.removeProperty("width");
        content.style.removeProperty("width");
    }

    showModal = (forceRefresh = true) => {
        this.utils.show(this.entities.modal);
        const { width } = this.entities.content.getBoundingClientRect();
        const modalWidth = width * this.config.width_percent_when_pin_right / 100;
        this.entities.modal.style.width = modalWidth + "px";
        this.entities.content.style.width = `${width - modalWidth}px`;
        this.utils.entities.eWrite.style.width = "initial";
        if (forceRefresh) this.refreshModal()
    }

    toggleModal = () => this.isModalShown() ? this.hideModal() : this.showModal()

    refreshModal = type => this.isModalShown() && this._refreshModal(type)

    _refreshModal = (type = this._getCurrentType()) => {
        this._activeIcon(type)
        const root = this._getRoot(type)
        const sortable = this.config.sortable && type === "header"
        this.entities.list.innerHTML = this._getRootHTML(root, sortable)
        this._highlightVisibleHeader()
    }

    _getCurrentType = () => {
        const btn = this.entities.header.querySelector(".select") || this.entities.header.firstElementChild
        return btn?.dataset.type ?? "header"
    }

    _activeIcon = type => this.entities.header.children.forEach(el => el.classList.toggle("select", el.dataset.type === type))

    _highlightVisibleHeader = (_, $header, targetIdx) => {
        if (!this.isModalShown() || this._getCurrentType() !== "header") return

        const headers = $header || this.utils.entities.$eWrite.children(File.editor.library.outline.headerStr)
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
        this.entities.list.querySelectorAll(".toc-node.active").forEach(el => el.classList.remove("active"))
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

        const TYPE_COUNTERS = { table: 0, fence: 0, image: 0, link: 0, math: 0 }
        const TYPE_SELECTORS = {
            h1: ":scope > h1",
            h2: ":scope > h2",
            table: ".md-table",
            fence: ".md-fences",
            image: ".md-image",
            link: ".md-link",
            math: ".md-math-block, .md-inline-math-container",
        }
        const TYPE_MAPPINGS = {
            "md-table": "table",
            "md-fences": "fence",
            "md-image": "image",
            "md-link": "link",
            "md-math-block": "math",
            "md-inline-math-container": "math",
        }
        const root = { depth: 0, cid: "n0", text: "root", children: [], parent: null }
        const helper = { current: root, H1: root }

        const selector = types.map(t => TYPE_SELECTORS[t]).join(", ")
        this.utils.entities.eWrite.querySelectorAll(selector).forEach(el => {
            if (el.style.display === "none") return

            const { tagName, classList } = el
            if (tagName === "H1" || tagName === "H2") {
                const header = { cid: el.getAttribute("cid"), text: el.textContent, class_: "toc-header-node", children: [] }
                if (tagName === "H1") {
                    root.children.push({ ...header, parent: root })
                    helper.H1 = header
                } else {
                    helper.H1.children.push({ ...header, parent: helper.H1 })
                }
                helper.current = header
                return
            }

            const matchedClass = Object.keys(TYPE_MAPPINGS).find(cls => classList.contains(cls))
            const type = matchedClass ? TYPE_MAPPINGS[matchedClass] : null
            if (type) {
                const idx = ++TYPE_COUNTERS[type]
                const parent = helper.current
                const cid = el.closest("[cid]").getAttribute("cid")
                const text = this.diaplayNameFn[type]({ idx, cid, el, parent })
                helper.current.children.push({ cid, text, parent, children: [] })
            }
        })
        return root
    }

    _getRootHTML = (rootNode, sortable) => {
        const drag = sortable ? 'draggable="true"' : ""
        const genLi = node => {
            const { text, cid, depth, class_ = "", children = [] } = node
            const toggleEl = children.length === 0 ? "" : '<span class="toc-toggle fa fa-caret-down"></span>'
            const textEl = `<span class="toc-text">${this.utils.escape(text)}</span>`
            let nodeEl = `<div class="toc-node ${class_}" data-ref="${cid}" ${drag}>${toggleEl}${textEl}</div>`
            if (children.length !== 0) {
                const li = children.map(genLi).join("")
                nodeEl += `<ul>${li}</ul>`
            }
            const depthAttr = depth ? `data-depth="${depth}"` : ""
            return `<li ${depthAttr}>${nodeEl}</li>`
        }
        const li = rootNode.children.map(genLi).join("")
        return `<ul class="toc-root">${li}</ul>`
    }

    _getDisplayNameFn = () => ({
        fence: ({ idx, cid }) => this.utils.getFenceContentByCid(cid)?.slice(0, 20) || `Code ${idx}`,
        table: ({ idx, el }) => el.querySelector(".td-span")?.textContent || `Table ${idx}`,
        link: ({ idx, el }) => el.querySelector("a")?.textContent || `Link ${idx}`,
        image: ({ idx, el }) => el.querySelector("img")?.getAttribute("alt") || `Image ${idx}`,
        math: ({ idx, el }) => el.querySelector("mjx-assistive-mml")?.textContent?.slice(0, 30) || `Math ${idx}`,
    })
}

module.exports = {
    plugin: TOCPlugin
}
