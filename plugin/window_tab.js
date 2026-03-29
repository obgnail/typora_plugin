class TabManager {
    constructor(context) {
        this.utils = context.utils
        this.i18n = context.i18n
        this.config = context.config
        this.hooks = {
            onRender: context.onRender,
            onEmpty: context.onEmpty,
            onExit: context.onExit,
        }
        this._tabs = []
        this._activeIdx = 0
        this._localOpen = false
    }

    get tabs() {
        return this._tabs
    }

    get activeIdx() {
        return this._activeIdx
    }

    get current() {
        return this._tabs[this._activeIdx] || null
    }

    get count() {
        return this._tabs.length
    }

    get maxIdx() {
        return Math.max(0, this._tabs.length - 1)
    }

    get isLocalOpen() {
        return this._localOpen
    }

    toggleLocalOpen() {
        this._localOpen = !this._localOpen
    }

    setLocalOpen(isOpen) {
        this._localOpen = isOpen
    }

    getByIdx(idx) {
        return this._tabs[idx]
    }

    getTabPathByIdx(idx) {
        return this._tabs[idx]?.path
    }

    _findIndexByPath(path) {
        return this._tabs.findIndex(tab => tab.path === path)
    }

    reset(tabList = []) {
        this._tabs = [...tabList]
        this._activeIdx = 0
        this._formatShowNames()
    }

    open(wantOpenPath) {
        const { NEW_TAB_POSITION, MAX_TAB_NUM } = this.config
        const isNewTab = this._findIndexByPath(wantOpenPath) === -1
        if (isNewTab) {
            if (this._localOpen && this.current) {
                this.current.path = wantOpenPath
            } else {
                const newTab = { path: wantOpenPath, scrollTop: 0 }
                if (NEW_TAB_POSITION === "end") this._tabs.push(newTab)
                else if (NEW_TAB_POSITION === "start") this._tabs.unshift(newTab)
                else if (NEW_TAB_POSITION === "right") this._tabs.splice(this._activeIdx + 1, 0, newTab)
                else if (NEW_TAB_POSITION === "left") this._tabs.splice(this._activeIdx, 0, newTab)
            }

            if (MAX_TAB_NUM > 0 && this.count > MAX_TAB_NUM) {
                const overflowCount = this.count - MAX_TAB_NUM
                const isInsertLeft = NEW_TAB_POSITION === "start" || NEW_TAB_POSITION === "left"
                const trimStartIndex = isInsertLeft ? this.count - overflowCount : 0
                this._tabs.splice(trimStartIndex, overflowCount)
            }
        }

        this._activeIdx = this._findIndexByPath(wantOpenPath)
        if (this.current) {
            this.current.timestamp = Date.now()
        }
        this._formatShowNames()
        this.hooks.onRender(wantOpenPath)
    }

    switch(idx) {
        this._activeIdx = Math.min(Math.max(0, idx), this.maxIdx)
        if (this.current) this.utils.openFile(this.current.path)
    }

    switchByPath(path) {
        const idx = this._findIndexByPath(path)
        if (idx !== -1) this.switch(idx)
    }

    switchToLastActive() {
        if (this.count <= 1) return
        const lastActiveTab = this._tabs
            .filter((_, idx) => idx !== this._activeIdx)
            .reduce((prev, cur) => (cur.timestamp || 0) > (prev.timestamp || 0) ? cur : prev, { timestamp: 0 })
        if (lastActiveTab?.path) this.switchByPath(lastActiveTab.path)
    }

    previous() {
        const idx = (this._activeIdx === 0) ? this.maxIdx : this._activeIdx - 1
        this.switch(idx)
    }

    next() {
        const idx = (this._activeIdx === this.maxIdx) ? 0 : this._activeIdx + 1
        this.switch(idx)
    }

    close(idx) {
        if (this.count <= 1) {
            return this._handleCloseLastTab(idx)
        }

        this._tabs.splice(idx, 1)
        const { TAB_SWITCH_ON_CLOSE } = this.config
        if (TAB_SWITCH_ON_CLOSE === "latest") {
            this._activeIdx = this._tabs.reduce((max, tab, i, arr) => (tab.timestamp || 0) > (arr[max].timestamp || 0) ? i : max, 0)
        } else if (this._activeIdx !== 0) {
            const isClosingLeftOrActive = idx < this._activeIdx || (idx === this._activeIdx && TAB_SWITCH_ON_CLOSE === "left")
            if (isClosingLeftOrActive) {
                this._activeIdx--
            }
            this._activeIdx = Math.min(this._activeIdx, this.maxIdx)
        }

        this.switch(this._activeIdx)
    }

    _handleCloseLastTab(idx) {
        const exitApp = () => {
            this._tabs.splice(idx, 1)
            this.hooks.onExit()
        }
        switch (this.config.LAST_TAB_CLOSE_ACTION) {
            case "exit":
                return exitApp()
            case "blankPage":
                this._tabs.splice(idx, 1)
                return this.hooks.onEmpty()
            case "reconfirm":
            default:
                const op = { type: "info", title: this.i18n.t("modal.exit"), message: this.i18n.t("modal.reconfirmExit") }
                this.utils.showMessageBox(op).then(ret => ret.response === 0 && exitApp())
        }
    }

    closeActive() {
        if (this.count !== 0) this.close(this._activeIdx)
    }

    closeOthers(idx) {
        const targetTab = this._tabs[idx]
        if (targetTab) {
            this._tabs = [targetTab]
            this.switch(0)
        }
    }

    closeLeft(idx) {
        const originPath = this.current?.path
        this._tabs.splice(0, idx)
        if (!originPath || this._findIndexByPath(originPath) === -1) {
            this.switch(0)
        } else {
            this.switchByPath(originPath)
        }
    }

    closeRight(idx) {
        const originPath = this.current?.path
        this._tabs.splice(idx + 1)
        if (!originPath || this._findIndexByPath(originPath) === -1) {
            this.switch(this.maxIdx)
        } else {
            this.switchByPath(originPath)
        }
    }

    sort() {
        if (this.count <= 1) return
        this._formatShowNames()
        const current = this.current
        this._tabs.sort(({ showName: n1 }, { showName: n2 }) => (n1 || "").localeCompare(n2 || ""))
        if (current) {
            this._activeIdx = this._tabs.indexOf(current)
            this.utils.openFile(this.current.path)
        }
    }

    move(fromIdx, toIdx) {
        if (fromIdx === toIdx || fromIdx < 0 || toIdx < 0 || fromIdx > this.maxIdx || toIdx > this.maxIdx) return
        const tab = this._tabs.splice(fromIdx, 1)[0]
        this._tabs.splice(toIdx, 0, tab)
        if (this._activeIdx === fromIdx) {
            this._activeIdx = toIdx
        } else if (this._activeIdx > fromIdx && this._activeIdx <= toIdx) {
            this._activeIdx--
        } else if (this._activeIdx < fromIdx && this._activeIdx >= toIdx) {
            this._activeIdx++
        }
    }

    async checkExist() {
        if (this.count === 0) {
            await this.hooks.onEmpty()
            return
        }
        const checkResults = await Promise.all(this._tabs.map(async (tab, idx) => {
            const exist = await this.utils.existPath(tab.path)
            return exist ? undefined : idx
        }))
        const waitToCloseIndices = checkResults.filter(idx => idx !== undefined)
        if (waitToCloseIndices.length === 0) return

        const isClosingActive = waitToCloseIndices.includes(this._activeIdx)
        waitToCloseIndices.reverse().forEach(idx => this._tabs.splice(idx, 1))

        const removedLeftCount = waitToCloseIndices.filter(idx => idx <= this._activeIdx).length
        this._activeIdx -= removedLeftCount

        if (isClosingActive && this.config.TAB_SWITCH_ON_CLOSE !== "left") {
            this._activeIdx++
        }
        this._activeIdx = Math.min(Math.max(0, this._activeIdx), this.maxIdx)

        if (this.count === 0) {
            await this.hooks.onEmpty()
        } else {
            this.switch(this._activeIdx)
        }
    }

    restoreSession(saveTabs, mountFolder, currentMountFolder, matchMountFolder = false) {
        if (!saveTabs || saveTabs.length === 0) return
        if (matchMountFolder && mountFolder !== currentMountFolder) return

        let activePath
        const existTabsMap = new Map(this._tabs.map(tab => [tab.path, tab]))
        saveTabs.forEach(tab => {
            const existTab = existTabsMap.get(tab.path)
            if (!existTab) {
                this._tabs.push({ path: tab.path, scrollTop: tab.scrollTop })
            } else {
                existTab.scrollTop = tab.scrollTop
            }
            if (tab.active) activePath = tab.path
        })

        this._formatShowNames()

        if (activePath) {
            this.switchByPath(activePath)
        } else if (this.count) {
            this.switch(this._activeIdx)
        }
    }

    _formatShowNames() {
        for (const tab of this._tabs) {
            tab.showName = this.utils.getFileName(tab.path, this.config.TRIM_FILE_EXT)
        }
        if (!this.config.SHOW_DIR_ON_DUPLICATE) return

        const groupedTabs = new Map()
        for (const tab of this._tabs) {
            const group = groupedTabs.get(tab.showName) || []
            group.push(tab)
            groupedTabs.set(tab.showName, group)
        }
        if (groupedTabs.size === this._tabs.length) return

        const hasDuplicateNames = group => new Set(group.map(t => t.showName)).size !== group.length
        for (const group of groupedTabs.values()) {
            if (group.length === 1) continue
            const dirStacks = group.map(tab => tab.path.split(this.utils.separator).slice(0, -1))
            while (hasDuplicateNames(group)) {
                let expandedAny = false
                for (let i = 0; i < group.length; i++) {
                    const parentDir = dirStacks[i].pop()
                    if (parentDir) {
                        group[i].showName = parentDir + this.utils.separator + group[i].showName
                        expandedAny = true
                    }
                }
                if (!expandedAny) break
            }
        }
    }
}

class WindowTabPlugin extends BasePlugin {
    beforeProcess = () => {
        if (window._options.framelessWindow && this.config.HIDE_WINDOW_TITLE_BAR) {
            document.querySelector("header").style.zIndex = "897"
            document.getElementById("top-titlebar").style.display = "none"
        }
        if (this.config.LAST_TAB_CLOSE_ACTION === "blankPage" && this.utils.isBetaVersion) {
            this.config.LAST_TAB_CLOSE_ACTION = "reconfirm"
        }
    }

    styleTemplate = () => true

    html = () => `<div id="plugin-window-tab"><div class="tab-bar"></div></div>`

    hotkey = () => [
        { hotkey: this.config.SWITCH_NEXT_TAB_HOTKEY, callback: () => this.tab.next() },
        { hotkey: this.config.SWITCH_PREVIOUS_TAB_HOTKEY, callback: () => this.tab.previous() },
        { hotkey: this.config.SWITCH_LAST_ACTIVE_TAB_HOTKEY, callback: () => this.tab.switchToLastActive() },
        { hotkey: this.config.SORT_TABS_HOTKEY, callback: () => this.tab.sort() },
        { hotkey: this.config.CLOSE_HOTKEY, callback: () => this.tab.closeActive() },
        { hotkey: this.config.COPY_PATH_HOTKEY, callback: () => this.copyPath(this.tab.activeIdx) },
        { hotkey: this.config.TOGGLE_TAB_BAR_HOTKEY, callback: this.forceToggleTabBar },
    ]

    init = () => {
        this.checkTabsInterval = null
        this.renderRafManager = this.utils.getRafManager()
        this.manualSaveStorage = this.utils.getStorage(`${this.fixedName}.manual`)
        this.autoSaveStorage = this.utils.getStorage(`${this.fixedName}.auto`)
        this.staticActions = this.i18n.fillActions([
            { act_value: "sort_tabs", act_hotkey: this.config.SORT_TABS_HOTKEY },
            { act_value: "save_tabs" },
        ])
        this.entities = {
            content: this.utils.entities.eContent,
            header: document.querySelector("header"),
            source: document.querySelector("#typora-source"),
            tabBar: document.querySelector("#plugin-window-tab .tab-bar"),
            windowTab: document.querySelector("#plugin-window-tab"),
        }
        this.tab = new TabManager({
            utils: this.utils,
            i18n: this.i18n,
            config: this.config,
            onRender: (wantOpenPath) => {
                this.renderRafManager.schedule(() => {
                    this._showTabBar()
                    this._startCheckTabsInterval()
                    this._renderTabs(wantOpenPath)
                })
            },
            onEmpty: async () => {
                this._hideTabBar()
                this._stopCheckTabsInterval()
                this.tab.reset()
                File.bundle = {
                    filePath: "", originalPath: null, untitledId: +new Date,
                    fileName: null, fileEncode: null, removed: false,
                    useCRLF: File.useCRLF || false, unsupported: "",
                    hasModified: false, modifiedDate: null, lastSnapDate: null,
                    savedContent: null, isLocked: false, oversize: false,
                    fileMissingWhenOpen: false, bundleFile: null, zip: null
                }
                await this.utils.reload()
                document.getElementById("title-text").innerHTML = "Typora"
                document.querySelector(".file-library-node.active")?.classList.remove("active")
            },
            onExit: () => this.utils.exitTypora()
        })
    }

    process = () => {
        const handleLifeCycle = () => {
            this._hideTabBar()
            this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.fileOpened, path => this.tab.open(path))
            this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.fileContentLoaded, this._scrollContent)
            this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.toggleSettingPage, hide => this.entities.windowTab.style.visibility = hide ? "hidden" : "initial")

            const isHeaderReady = () => this.utils.isBetaVersion ? this.entities.header.getBoundingClientRect().height : true
            const adjustTop = () => setTimeout(() => {
                if (!this.config.HIDE_WINDOW_TITLE_BAR) {
                    const { height, top } = this.entities.header.getBoundingClientRect()
                    this.entities.windowTab.style.top = `${height + top}px`
                }
                // Adjust the top position of the content Tag to prevent it from being obscured by the tab.
                this._adjustContentTop()
            }, 200)
            this.utils.waitUntil(isHeaderReady, 50, 1000).catch(this.utils.noop).finally(adjustTop)
        }
        const handleClick = () => {
            this.entities.tabBar.addEventListener("click", ev => {
                const closeButton = ev.target.closest(".close-button")
                const tabContainer = ev.target.closest(".tab-container")
                if (!closeButton && !tabContainer) return
                const el = closeButton ? closeButton.closest(".tab-container") : tabContainer
                const idx = parseInt(el.dataset.idx)
                if (this.config.CTRL_CLICK_TO_NEW_WINDOW && this.utils.metaKeyPressed(ev)) {
                    this.openFileNewWindow(this.tab.getTabPathByIdx(idx), false)
                } else if (closeButton) {
                    this.tab.close(idx)
                } else {
                    this.tab.switch(idx)
                }
            })
        }
        const handleScroll = () => {
            this.entities.content.addEventListener("scroll", this.utils.debounce(() => {
                if (this.tab.current) {
                    this.tab.current.scrollTop = this.entities.content.scrollTop
                }
            }), 100)
        }
        const handleDrag = () => {
            const newWindowIfNeed = (offsetY, el) => {
                if (this.config.TAB_DETACHMENT === "lockVertical" || this.config.DRAG_NEW_WINDOW_THRESHOLD <= 0) return
                offsetY = Math.abs(offsetY)
                const { height } = this.entities.tabBar.getBoundingClientRect()
                if (offsetY > height * this.config.DRAG_NEW_WINDOW_THRESHOLD) {
                    const idx = parseInt(el.dataset.idx)
                    this.openFileNewWindow(this.tab.getTabPathByIdx(idx), false)
                }
            }

            const sortJetBrains = () => {
                const self = this
                const preview = new Image()
                const rafManager = self.utils.getRafManager()
                const resetTabBar = () => {
                    const all = self.entities.windowTab.querySelectorAll(".tab-container")
                    const activePath = self.tab.current?.path
                    self.tab.reset(Array.from(all, el => self.tab.getByIdx(parseInt(el.dataset.idx))))
                    if (activePath) self.tab.open(activePath)
                }
                let dragged, cloned, offsetX, offsetY, startX, startY, axis, _axis, threshold, _offsetX

                $("#plugin-window-tab .tab-bar").on("dragstart", ".tab-container", function (ev) {
                    dragged = this
                    _offsetX = ev.offsetX

                    axis = dragged.getAttribute("axis")
                    _axis = axis
                    ev.originalEvent.dataTransfer.setDragImage(preview, 0, 0)
                    ev.originalEvent.dataTransfer.effectAllowed = "move"
                    ev.originalEvent.dataTransfer.dropEffect = "move"
                    let { left, top, height } = dragged.getBoundingClientRect()
                    startX = ev.clientX
                    startY = ev.clientY
                    offsetX = startX - left
                    offsetY = startY - top
                    threshold = height * self.config.DETACHMENT_THRESHOLD

                    const faker = dragged.cloneNode(true)
                    faker.style.height = dragged.offsetHeight + "px" // dragBox uses height: 100%, needs to be reset.
                    faker.style.transform = "translate3d(0, 0, 0)"
                    faker.setAttribute("dragging", "")
                    cloned = document.createElement("div")
                    cloned.append(faker)
                    cloned.className = "drag-obj"
                    cloned.style.transform = `translate3d(${left}px, ${top}px, 0)`
                    self.entities.tabBar.append(cloned)
                }).on("dragend", ".tab-container", function (ev) {
                    rafManager.cancel()
                    newWindowIfNeed(ev.offsetY, this)
                    if (!cloned) {
                        dragged = null
                        return
                    }
                    const { left, top } = this.getBoundingClientRect()
                    const resetAnimation = cloned.animate(
                        [{ transform: cloned.style.transform }, { transform: `translate3d(${left}px, ${top}px, 0)` }],
                        { duration: 70, easing: "ease-in-out" }
                    )
                    resetAnimation.onfinish = function () {
                        cloned?.remove()
                        cloned = null
                        dragged.style.visibility = "visible"
                        dragged = null
                        resetTabBar()
                    }
                }).on("dragover", ".tab-container", function (ev) {
                    ev.preventDefault()
                    if (dragged) {
                        const fn = ev.offsetX > _offsetX ? "after" : "before"
                        this[fn](dragged)
                    }
                }).on("dragenter", () => false)

                document.addEventListener("dragover", function (ev) {
                    if (!cloned) return

                    ev.preventDefault()
                    ev.stopPropagation()
                    ev.dataTransfer.dropEffect = "move"
                    dragged.style.visibility = "hidden"
                    const currentX = ev.clientX
                    const currentY = ev.clientY
                    rafManager.schedule(() => {
                        let left = currentX - offsetX
                        let top = currentY - offsetY
                        if (axis) {
                            if (_axis === "X") {
                                top = startY - offsetY
                            } else if (_axis === "Y") {
                                left = startX - offsetX
                            } else {
                                const x = Math.abs(currentX - startX)
                                const y = Math.abs(currentY - startY)
                                _axis = (x > y && "X") || (x < y && "Y") || ""
                            }
                        } else {
                            _axis = ""
                        }
                        startX = left + offsetX
                        startY = top + offsetY

                        const detachment = self.config.TAB_DETACHMENT
                        if (detachment === "lockVertical" || (detachment === "resistant" && top < threshold)) {
                            top = 0
                        }
                        cloned.style.transform = `translate3d(${left}px, ${top}px, 0)`
                    })
                })
            }

            const sortVscode = () => {
                const self = this
                let lastOver = null
                const toggleOver = (target, isAdd) => {
                    if (isAdd) {
                        target.classList.add("over")
                        lastOver = target
                    } else {
                        target.classList.remove("over")
                    }
                }

                $("#plugin-window-tab .tab-bar").on("dragstart", ".tab-container", function (ev) {
                    ev.originalEvent.dataTransfer.effectAllowed = "move"
                    ev.originalEvent.dataTransfer.dropEffect = "move"
                    this.style.opacity = 0.5
                    lastOver = null
                }).on("dragend", ".tab-container", function (ev) {
                    this.style.opacity = ""
                    newWindowIfNeed(ev.offsetY, this)
                    if (lastOver) {
                        lastOver.classList.remove("over")
                        const toIdx = parseInt(lastOver.dataset.idx)
                        const fromIdx = parseInt(this.dataset.idx)
                        self.tab.move(fromIdx, toIdx)
                        self.tab.hooks.onRender(self.tab.current.path)
                    }
                }).on("dragover", ".tab-container", function () {
                    toggleOver(this, true)
                    return false
                }).on("dragenter", ".tab-container", function () {
                    toggleOver(this, true)
                    return false
                }).on("dragleave", ".tab-container", function () {
                    toggleOver(this, false)
                })
            }

            if (this.config.DRAG_STYLE === "JetBrains") {
                sortJetBrains()
            } else {
                sortVscode()
            }
        }
        const handleRename = () => {
            reqnode("electron").ipcRenderer.on("didRename", (sender, { oldPath, newPath }) => {
                const isDir = this.utils.Package.FsExtra.statSync(newPath).isDirectory()
                if (isDir) {
                    this.tab.tabs
                        .filter(t => t.path.startsWith(oldPath))
                        .forEach(t => t.path = newPath + t.path.slice(oldPath.length))
                } else {
                    const toRenameTab = this.tab.tabs.find(t => t.path === oldPath)
                    if (toRenameTab) toRenameTab.path = newPath
                }
                if (this.tab.current) {
                    this.tab.open(this.tab.current.path)
                    // queueMicrotask(() => File.editor.library.refreshPanelCommand())
                }
            })
        }
        const handleFocusChange = () => {
            window.addEventListener("focus", async () => {
                if (this.tab.count > 0) {
                    await this.tab.checkExist()
                    this._startCheckTabsInterval()
                }
            })
            window.addEventListener("blur", this._stopCheckTabsInterval)
        }
        const handleWheel = () => {
            this.entities.tabBar.addEventListener("wheel", ev => {
                const target = ev.target.closest("#plugin-window-tab .tab-bar")
                if (!target) return
                if (this.config.CTRL_WHEEL_TO_SWITCH && this.utils.metaKeyPressed(ev)) {
                    if (ev.deltaY < 0) this.tab.previous()
                    else this.tab.next()
                } else if (this.config.WHEEL_TO_SCROLL_TAB_BAR) {
                    target.scrollLeft += ev.deltaY * 0.5
                }
            }, { passive: true })
        }
        const handleMiddleClick = () => {
            this.entities.tabBar.addEventListener("mousedown", ev => {
                if (ev.button === 1) {
                    const idx = parseInt(ev.target.closest(".tab-container")?.dataset.idx)
                    if (!isNaN(idx)) this.tab.close(idx)
                }
            })
        }
        const handleContextMenu = () => {
            let tabIdx = -1
            const getMenuItems = (ev) => {
                const tabEl = ev.target.closest(".tab-container")
                if (tabEl) {
                    tabIdx = parseInt(tabEl.dataset.idx)
                    const all = ["closeTab", "closeOtherTabs", "closeLeftTabs", "closeRightTabs", "copyPath", "showInFinder", "openInNewWindow", "sortTabs"]
                    return this.utils.pick(this.i18n.entries(all, "$option.CONTEXT_MENU."), this.config.CONTEXT_MENU)
                }
            }
            const onClickMenuItem = (ev, key) => {
                const commands = {
                    closeTab: () => this.tab.close(tabIdx),
                    closeOtherTabs: () => this.tab.closeOthers(tabIdx),
                    closeLeftTabs: () => this.tab.closeLeft(tabIdx),
                    closeRightTabs: () => this.tab.closeRight(tabIdx),
                    sortTabs: () => this.tab.sort(),
                    copyPath: () => this.copyPath(tabIdx),
                    showInFinder: () => this.showInFinder(tabIdx),
                    openInNewWindow: () => this.openInNewWindow(tabIdx),
                }
                commands[key]?.()
            }
            this.utils.contextMenu.register(this.entities.tabBar, getMenuItems, onClickMenuItem)
        }
        const adjustQuickOpen = () => {
            const openQuickTab = (item, ev) => {
                ev.preventDefault()
                ev.stopPropagation()
                const path = item.dataset.path
                if (item.dataset.isDir === "true") this.utils.openFolder(path)
                else this.utils.openFile(path)
                if (File.isMac && $("#typora-quick-open:visible").hide().length) {
                    bridge.callHandler("quickOpen.stopQuery")
                }
            }
            document.querySelector(".typora-quick-open-list").addEventListener("mousedown", ev => {
                const target = ev.target.closest(".typora-quick-open-item")
                // Changed the original click behavior to ctrl+click.
                if (target && !this.utils.metaKeyPressed(ev)) openQuickTab(target, ev)
            }, true)
            document.querySelector("#typora-quick-open-input > input").addEventListener("keydown", ev => {
                if (ev.key === "Enter") {
                    const el = document.querySelector(".typora-quick-open-item.active")
                    if (el) openQuickTab(el, ev)
                }
            }, true)
        }
        const reopenTabsWhenInit = () => {
            this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.allPluginsHadInjected, () => {
                // Redirection is disabled when opening specific files (isDiscardableUntitled === false).
                this.utils.waitUntil(this.utils.isDiscardableUntitled, 50, 2000)
                    .then(() => this.openSaveTabs(this.autoSaveStorage, true))
                    .catch(this.utils.noop)
                const autoSave = () => this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.fileContentLoaded, () => this.saveTabs(this.autoSaveStorage))
                setTimeout(autoSave, 2000)
            })
        }

        // Typora version 1.1 and later supports using anchor links to jump to local files
        // Intercept internal and local file links, and change the jump behavior to open in a new tab
        const interceptLink = () => {
            const cache = { file: "", anchor: "" }
            const setCache = (file, anchor) => Object.assign(cache, { file, anchor })
            this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.fileContentLoaded, () => {
                if (cache.file && cache.anchor.startsWith("#")) {
                    const $target = File.editor.EditHelper.findAnchorElem(cache.anchor)
                    this.utils.scroll($target, 10)
                    setCache("", "")
                }
            })
            this.utils.decorator.preventCallIf(() => JSBridge, "invoke", (cmd, file, options) => {
                if (cmd !== "app.openFileOrFolder") return false
                if (file && typeof options?.anchor === "string") {
                    setCache(file, options.anchor)
                    this.utils.openFile(file)
                    return true
                }
                return false
            })
        }

        handleLifeCycle()
        handleClick()
        handleScroll()
        handleDrag()
        handleRename()
        handleFocusChange()
        adjustQuickOpen()
        interceptLink()
        if (this.config.WHEEL_TO_SCROLL_TAB_BAR || this.config.CTRL_WHEEL_TO_SWITCH) handleWheel()
        if (this.config.MIDDLE_CLICK_TO_CLOSE) handleMiddleClick()
        if (this.config.REOPEN_TABS_ON_STARTUP) reopenTabsWhenInit()
        if (this.config.CONTEXT_MENU.length) handleContextMenu()
    }

    getDynamicActions = () => this.i18n.fillActions([
        { act_value: "open_save_tabs", act_hidden: !this.manualSaveStorage.exist() },
        { act_value: "toggle_file_ext", act_state: this.config.TRIM_FILE_EXT },
        { act_value: "toggle_show_dir", act_state: this.config.SHOW_DIR_ON_DUPLICATE },
        { act_value: "toggle_show_close_button", act_state: this.config.SHOW_TAB_CLOSE_BUTTON },
        { act_value: "toggle_tab_bar", act_state: this.entities.windowTab.style.display === "none", act_hotkey: this.config.TOGGLE_TAB_BAR_HOTKEY },
        { act_value: "toggle_local", act_state: !this.tab.isLocalOpen },
    ])

    call = action => {
        const toggleConfig = async (cfg) => {
            this.config[cfg] = !this.config[cfg]
            await this.utils.settings.save(this.fixedName, { [cfg]: this.config[cfg] })
            this.rerenderTabBar()
        }
        const callMap = {
            toggle_local: () => this.tab.toggleLocalOpen(),
            toggle_show_dir: () => toggleConfig("SHOW_DIR_ON_DUPLICATE"),
            toggle_file_ext: () => toggleConfig("TRIM_FILE_EXT"),
            toggle_show_close_button: () => toggleConfig("SHOW_TAB_CLOSE_BUTTON"),
            save_tabs: () => this.saveTabs(this.manualSaveStorage),
            open_save_tabs: () => this.openSaveTabs(this.manualSaveStorage),
            sort_tabs: () => this.tab.sort(),
            toggle_tab_bar: this.forceToggleTabBar,
        }
        callMap[action]?.()
    }

    _hideTabBar = () => {
        if (this.utils.isShown(this.entities.windowTab) && this.tab.count === 0) {
            this.utils.hide(this.entities.windowTab)
            this._resetContentTop()
        }
    }

    _showTabBar = () => {
        if (this.utils.isHidden(this.entities.windowTab)) {
            this.utils.show(this.entities.windowTab)
            this._adjustContentTop()
        }
    }

    _adjustContentTop = () => {
        const { height, top } = this.entities.windowTab.getBoundingClientRect()
        if (height + top === 0) {  // Equal to 0, indicating that there are no tabs.
            this._resetContentTop()
        } else {
            const { height: headerHeight, top: headerTop } = document.querySelector("header").getBoundingClientRect()
            const t = Math.max(top + height, headerHeight + headerTop) + "px"
            this.entities.content.style.top = t
            this.entities.source.style.top = t
        }
    }

    _resetContentTop = () => {
        this.entities.content.style.removeProperty("top")
        this.entities.source.style.removeProperty("top")
    }

    _startCheckTabsInterval = () => {
        if (this.checkTabsInterval) return
        const count = this.tab.count
        const interval = count > 30 ? 3000 : (count > 10 ? 2000 : 1000)
        this.checkTabsInterval = setInterval(() => this.tab.checkExist(), interval)
    }

    _stopCheckTabsInterval = () => {
        if (this.checkTabsInterval) {
            clearInterval(this.checkTabsInterval)
            this.checkTabsInterval = null
        }
    }

    _insertTabDiv = (filePath, showName, idx) => {
        const title = this.config.SHOW_FULL_PATH_ON_HOVER ? `title="${filePath}"` : ""
        const btn = this.config.SHOW_TAB_CLOSE_BUTTON ? `<span class="close-button"><div class="close-icon"></div></span>` : ""
        this.entities.tabBar.insertAdjacentHTML("beforeend", `
            <div class="tab-container" data-idx="${idx}" draggable="true" ${title}>
                <div class="active-indicator"></div><span class="window-tab-name">${showName}</span>${btn}
            </div>`)
    }

    _updateTabDiv = (tabDiv, filePath, showName, idx) => {
        tabDiv.dataset.idx = idx
        tabDiv.querySelector(".window-tab-name").innerText = showName
        if (this.config.SHOW_FULL_PATH_ON_HOVER) {
            tabDiv.setAttribute("title", filePath)
        } else {
            tabDiv.removeAttribute("title")
        }
    }

    _scrollContent = filepath => {
        const activeTab = this.tab.tabs.find(e => e.path === filepath)
        if (!activeTab) return

        const targetScrollTop = activeTab.scrollTop
        const contentEl = this.entities.content

        if (this._contentObserver) {
            this._contentObserver.disconnect()
            clearTimeout(this._scrollFallbackTimer)
        }

        const finalizeScroll = () => {
            if (this._contentObserver) {
                this._contentObserver.disconnect()
                this._contentObserver = null
            }
            if (this.utils.getFilePath() === filepath) {
                contentEl.scrollTop = targetScrollTop
            }
        }

        this._scrollFallbackTimer = setTimeout(finalizeScroll, 2000)
        const debouncedFinalize = this.utils.debounce(() => {
            clearTimeout(this._scrollFallbackTimer)
            finalizeScroll()
        }, 100)

        this._contentObserver = new ResizeObserver(() => {
            if (this.utils.getFilePath() !== filepath) {
                this._contentObserver.disconnect()
                return
            }
            debouncedFinalize()
        })
        this._contentObserver.observe(contentEl.firstElementChild || contentEl)
    }

    _renderTabs = wantOpenPath => {
        let currentTabEl = this.entities.tabBar.firstElementChild
        for (let idx = 0; idx < this.tab.tabs.length; idx++) {
            const tabObj = this.tab.tabs[idx]
            if (!currentTabEl) {
                this._insertTabDiv(tabObj.path, tabObj.showName, idx)
                currentTabEl = this.entities.tabBar.lastElementChild
            } else {
                this._updateTabDiv(currentTabEl, tabObj.path, tabObj.showName, idx)
            }
            const isActive = tabObj.path === wantOpenPath
            currentTabEl.classList.toggle("active", isActive)
            if (isActive) currentTabEl.scrollIntoView()
            currentTabEl = currentTabEl.nextElementSibling
        }

        while (currentTabEl) {
            const next = currentTabEl.nextElementSibling
            currentTabEl.remove()
            currentTabEl = next
        }
    }

    forceToggleTabBar = () => {
        const isHidden = this.entities.windowTab.style.display === "none"
        this.entities.windowTab.style.display = isHidden ? "initial" : "none"
        if (isHidden) this._adjustContentTop()
        else this._resetContentTop()
    }

    openFileNewWindow = (path, isFolder) => File.editor.library.openFileInNewWindow(path, isFolder)

    OpenFileLocal = filePath => {
        this.tab.setLocalOpen(true)
        this.utils.openFile(filePath)
        this.tab.setLocalOpen(false)
    }

    rerenderTabBar = () => {
        this.entities.tabBar.innerHTML = ""
        const p = this.tab.current?.path
        if (p) this.utils.openFile(p)
    }

    copyPath = idx => navigator.clipboard.writeText(this.tab.getTabPathByIdx(idx) || "")
    showInFinder = idx => this.utils.showInFinder(this.tab.getTabPathByIdx(idx))
    openInNewWindow = idx => this.openFileNewWindow(this.tab.getTabPathByIdx(idx), false)

    saveTabs = (storage) => {
        storage.set({
            mount_folder: this.utils.getMountFolder(),
            save_tabs: this.tab.tabs.map((tab, idx) => ({
                idx, path: tab.path, scrollTop: tab.scrollTop, active: idx === this.tab.activeIdx
            }))
        })
    }

    openSaveTabs = (storage, matchMountFolder = false) => {
        const { save_tabs, mount_folder } = storage.get() || {}
        this.tab.restoreSession(save_tabs, mount_folder, this.utils.getMountFolder(), matchMountFolder)
    }
}

module.exports = {
    plugin: WindowTabPlugin,
    TabManager,
}
