class SidebarEnhancePlugin extends BasePlugin {
    process = () => {
        const displayNonMarkdownFiles = File.SupportedFiles && this.config.DISPLAY_NON_MARKDOWN_FILES
        if (displayNonMarkdownFiles) {
            this._displayNonMarkdownFiles()
        }
        if (this.config.HIDDEN_NODE_PATTERNS.length || (displayNonMarkdownFiles && this.config.CUSTOMIZE_SIDEBAR_ICONS)) {
            this._rerenderOutlineNode()
        }
        if (this.config.KEEP_OUTLINE_FOLD_STATE && File.option.canCollapseOutlinePanel) {
            this._keepOutlineFoldState()
        }
        if (this.config.SORTABLE_OUTLINE) {
            this._sortableOutline()
        }
        if (this.config.CTRL_WHEEL_TO_SCROLL_SIDEBAR) {
            this._ctrlWheelToScroll()
        }
        if (this.config.ENABLE_FILE_COUNT) {
            this._fileCount()
        }
    }

    init = () => {
        this.entities = {
            outline: document.querySelector("#outline-content"),
            fileTree: document.querySelector("#file-library-tree"),
            get fileTreeRoot() {
                return document.querySelector("#file-library-tree > .file-library-root")  // rootNode may be dynamic
            },
        }
    }

    _displayNonMarkdownFiles = () => {
        const displayExt = new Set([...this.config.OPEN_BY_SYSTEM_EXT, ...this.config.OPEN_BY_TYPORA_EXT])
        const openBySystemExt = new Set(this.config.OPEN_BY_SYSTEM_EXT.filter(ext => !this.config.OPEN_BY_TYPORA_EXT.includes(ext)).map(ext => `.${ext}`))

        File.SupportedFiles.push(...displayExt)

        // Delay decoration to ensure this beforeFn runs first, this beforeFn may return a stopCallError
        this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.allPluginsHadInjected, () => {
            this.utils.decorate(() => File?.editor?.library, "openFile", (toOpenFile) => {
                const ext = this.utils.Package.Path.extname(toOpenFile)
                if (openBySystemExt.has(ext)) {
                    this.utils.openPath(toOpenFile)
                    return this.utils.stopCallError
                }
            })
        })
    }

    _rerenderOutlineNode = () => {
        const getCustomFileIcons = () => {
            const ICONS = new Map(
                this.config.SIDEBAR_ICONS
                    .filter(item => item.enable && item.extensions.length && item.extensions.every(ext => !!ext))
                    .flatMap(item => item.extensions.map(ext => [`.${ext.trim()}`, item.icon.trim()]))
            )
            const fn = ($node, info) => {
                if (!info.isFile) return
                const ext = this.utils.Package.Path.extname(info.name)
                const icon = ICONS.get(ext)
                if (icon) $node.find(".file-node-icon").removeClass("fa fa-file-text-o").addClass(icon)
            }
            return this.config.CUSTOMIZE_SIDEBAR_ICONS && ICONS.size ? fn : this.utils.identity
        }

        const getHideFolders = () => {
            const compile = p => {
                try {
                    return new RegExp(p)
                } catch (e) {
                }
            }
            const REGEXPS = this.config.HIDDEN_NODE_PATTERNS.map(compile).filter(Boolean)
            const fn = ($node, info) => {
                if (REGEXPS.some(reg => reg.test(info.name)) && !$node.hasClass("file-node-root")) {
                    $node.addClass("plugin-common-hidden")
                }
            }
            return REGEXPS.length ? fn : this.utils.identity
        }

        const customizeFileIcons = getCustomFileIcons()
        const hideFolders = getHideFolders()
        this.utils.decorate(() => File?.editor?.library?.fileTree, "renderNode", null, ($node, info) => {
            customizeFileIcons($node, info)
            hideFolders($node, info)
        })

        this.utils.eventHub.once(this.utils.eventHub.eventType.fileOpened, () => File.editor.library.refreshPanelCommand())
    }

    _keepOutlineFoldState = () => {
        const [arm, fire] = this.utils.oneShot()
        const hasOpenClass = "outline-item-open"
        const singleItemClass = this.utils.isBetaVersion ? "outline-item-signle" : "outline-item-single"  // `signle` is Typora's typo
        this.utils.stateRecorder.register({
            name: this.fixedName,
            selector: `#outline-content .outline-item-wrapper:not(.${singleItemClass})`,
            stateGetter: el => el.classList.contains(hasOpenClass),
            stateRestorer: (el, isOpen) => isOpen && el.classList.add(hasOpenClass),
            delayFn: (task) => arm(task),
        })
        this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.outlineUpdated, fire)
    }

    _sortableOutline = () => {
        const classSource = "plugin-sortable-outline-source"
        const classAbove = "plugin-sortable-outline-above"
        const classBelow = "plugin-sortable-outline-below"

        this.utils.insertStyle("plugin-sortable-outline-style", `
            .${classSource} { opacity: 0.4 }
            .${classAbove} { outline: 1px dashed #000; box-shadow: 0 -3px 0 #8d8df0; }
            .${classBelow} { outline: 1px dashed #000; box-shadow: 0 3px 0 #8d8df0; }`
        )

        const fresh = this.utils.debounce(() => this.entities.outline.querySelectorAll(".outline-item").forEach(e => e.draggable = true), 200)
        this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.outlineUpdated, fresh)
        this.utils.decorate(() => File, "freshMenu", null, fresh)
        this.utils.decorate(() => File?.editor?.library?.outline, "renderOutline", null, fresh)

        let dragItem
        const isAncestorOf = (ancestor, descendant) => ancestor.parentElement.contains(descendant)
        const isPreceding = (el, otherEl) => el.compareDocumentPosition(otherEl) === document.DOCUMENT_POSITION_PRECEDING
        const getCid = item => item.querySelector(":scope > .outline-label").dataset.ref
        const clearStyle = () => this.entities.outline.querySelectorAll(`.${classAbove}, .${classBelow}, .${classSource}`).forEach(e => {
            e.classList.remove(classAbove, classBelow, classSource)
        })
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

        $(this.entities.outline)
            .on("dragstart", ".outline-item", function (ev) {
                dragItem = this
                ev.originalEvent.dataTransfer.effectAllowed = "move"
                ev.originalEvent.dataTransfer.dropEffect = "move"
                this.parentElement.classList.add(classSource)
            })
            .on("dragenter", ".outline-item", setStyle)
            .on("dragover", ".outline-item", setStyle)
            .on("dragleave", ".outline-item", function () {
                this.parentElement.classList.remove(classAbove, classBelow)
            })
            .on("drop", ".outline-item", function () {
                if (isAncestorOf(dragItem, this)) return
                const dragCid = getCid(dragItem)
                const dropCid = getCid(this)
                if (!dragCid || !dropCid) return

                const headers = []
                const blocks = File.editor.nodeMap.blocks.toArray()
                blocks.forEach((node, idx) => node.attributes.type === Node.TYPE.heading && headers.push({ idx: idx, node: node }))

                const drag = getHeader(dragCid, headers, blocks)
                const drop = getHeader(dropCid, headers, blocks)

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
            .on("dragend", clearStyle)
    }

    _ctrlWheelToScroll = () => {
        document.querySelector("#file-library").addEventListener("wheel", ev => {
            if (!this.utils.metaKeyPressed(ev)) return
            ev.currentTarget.scrollLeft += ev.deltaY * 0.2
            ev.stopPropagation()
            ev.preventDefault()
        }, { passive: false, capture: true })
    }

    _fileCount = () => {
        const getObserver = () => {
            return new MutationObserver(mutations => {
                if (mutations.length === 1) {
                    const added = mutations[0].addedNodes[0]
                    if (added?.classList?.contains("file-library-node")) {
                        countDir(added)
                        return
                    }
                }
                countAllDirs()
            })
        }
        const getWalkOptions = () => {
            const abortController = new AbortController()
            const allowedExt = new Set(this.config.COUNT_EXT.map(ext => {
                const prefix = (ext !== "" && !ext.startsWith(".")) ? "." : ""
                return prefix + ext.toLowerCase()
            }))
            const verifyExt = name => allowedExt.has(this.utils.Package.Path.extname(name).toLowerCase())
            const verifySize = stat => 0 > this.config.MAX_SIZE || stat.size < this.config.MAX_SIZE
            return {
                fileFilter: (name, filepath, stat) => verifySize(stat) && verifyExt(name),
                dirFilter: name => !this.config.IGNORE_FOLDERS.includes(name),
                fileParamsGetter: this.utils.identity,
                maxStats: this.config.MAX_STATS,
                semaphore: this.config.CONCURRENCY_LIMIT,
                followSymlinks: this.config.FOLLOW_SYMBOLIC_LINKS,
                signal: abortController.signal,
                onFinished: (err) => {
                    if (!err) return
                    if (err.name === "AbortError") {
                        console.warn("File-Counter Aborted")
                    } else if (err.name === "QuotaExceededError") {
                        observer.disconnect()
                        abortController.abort(new DOMException("Stop File-Counter", "AbortError"))
                        document.querySelectorAll(".file-node-content[data-count]").forEach(el => el.removeAttribute("data-count"))
                        this.utils.notification.show(this.i18n.t("error.tooManyFiles"), "warning", 7000)
                    }
                },
            }
        }

        const observer = getObserver()
        const walkOptions = getWalkOptions()
        const setCount = async (node) => {
            let fileCount = 0
            await this.utils.walkDir({ ...walkOptions, dir: node.dataset.path, onFile: () => fileCount++ })
            const displayEl = node.querySelector(":scope > .file-node-content")
            if (fileCount <= this.config.IGNORE_MIN_NUM) {
                displayEl.removeAttribute("data-count")
            } else {
                displayEl.setAttribute("data-count", fileCount)
            }
        }
        const countDir = (node) => {
            if (!node) return
            setCount(node)
            node.querySelectorAll(':scope > .file-node-children > .file-library-node[data-has-sub="true"]').forEach(countDir)
        }
        const countAllDirs = () => countDir(this.entities.fileTreeRoot)

        this.utils.insertStyle("plugin-count-file-style", `
            .file-node-content:after {
                content: attr(data-count);
                position: absolute;
                right: 10px;
                padding: 0 3px;
                border-radius: 3px;
                color: ${this.config.TEXT_COLOR || "var(--active-file-text-color)"};
                background: ${this.config.BACKGROUND_COLOR || "var(--active-file-bg-color)"};
                font-weight: ${this.config.FONT_WEIGHT};
            }`
        )
        this.utils.eventHub.once(this.utils.eventHub.eventType.fileOpened, () => {
            File.editor.library.refreshPanelCommand()
            countAllDirs()
        })
        observer.observe(this.entities.fileTree, { subtree: true, childList: true })
    }
}

module.exports = {
    plugin: SidebarEnhancePlugin
}
