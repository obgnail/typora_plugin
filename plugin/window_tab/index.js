class windowTabBarPlugin extends BasePlugin {
    beforeProcess = () => {
        if (window._options.framelessWindow && this.config.HIDE_WINDOW_TITLE_BAR) {
            document.querySelector("header").style.zIndex = "897";
            document.getElementById("top-titlebar").style.display = "none";
        }
        if (this.config.LAST_TAB_CLOSE_ACTION === "blankPage" && this.utils.isBetaVersion) {
            this.config.LAST_TAB_CLOSE_ACTION = "reconfirm"
        }
    }

    styleTemplate = () => true

    html = () => `<div id="plugin-window-tab"><div class="tab-bar"></div></div>`

    hotkey = () => [
        { hotkey: this.config.SWITCH_NEXT_TAB_HOTKEY, callback: this.nextTab },
        { hotkey: this.config.SWITCH_PREVIOUS_TAB_HOTKEY, callback: this.previousTab },
        { hotkey: this.config.SORT_TABS_HOTKEY, callback: this.sortTabs },
        { hotkey: this.config.CLOSE_HOTKEY, callback: this.closeActiveTab },
        { hotkey: this.config.COPY_PATH_HOTKEY, callback: this.copyActiveTabPath },
        { hotkey: this.config.TOGGLE_TAB_BAR_HOTKEY, callback: this.forceToggleTabBar },
    ]

    init = () => {
        this.staticActions = this.i18n.fillActions([
            { act_value: "sort_tabs", act_hotkey: this.config.SORT_TABS_HOTKEY },
            { act_value: "save_tabs" },
        ])
        this.entities = {
            content: this.utils.entities.eContent,
            source: document.querySelector("#typora-source"),
            tabBar: document.querySelector("#plugin-window-tab .tab-bar"),
            windowTab: document.querySelector("#plugin-window-tab"),
        }
        this.localOpen = false
        this.checkTabsInterval = null
        this.saveTabFilePath = this.utils.joinPath("./plugin/window_tab/save_tabs.json")
        this.tabUtil = {
            tabs: [],
            activeIdx: 0,
            get currentTab() {
                return this.tabs[this.activeIdx]
            },
            get tabCount() {
                return this.tabs.length
            },
            get maxTabIdx() {
                return this.tabs.length - 1
            },
            getTabPathByIdx(idx) {
                return this.tabs[idx].path
            },
            spliceTabs(start, deleteCount, ...items) {
                return this.tabs.splice(start, deleteCount, ...items)
            },
            reset(tabList = []) {
                this.spliceTabs(0, this.tabs.length, ...tabList)
                this.activeIdx = 0
            },
        }
    }

    process = () => {
        const handleLifeCycle = () => {
            this._hideTabBar();
            this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.fileOpened, this.openTab);
            this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.firstFileInit, this.openTab);
            this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.fileContentLoaded, this._scrollContent);
            this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.toggleSettingPage, hide => this.entities.windowTab.style.visibility = hide ? "hidden" : "initial");
            const isHeaderReady = () => this.utils.isBetaVersion ? document.querySelector("header").getBoundingClientRect().height : true
            const adjustTop = () => setTimeout(() => {
                // Adjust z-index of the notification component to prevent it from being obscured by the tab.
                const container = document.querySelector(".md-notification-container");
                if (container) {
                    container.style.zIndex = "99999";
                }
                if (!this.config.HIDE_WINDOW_TITLE_BAR) {
                    const { height, top } = document.querySelector("header").getBoundingClientRect();
                    this.entities.windowTab.style.top = height + top + "px";
                }
                // Adjust the top position of the content Tag to prevent it from being obscured by the tab.
                this._adjustContentTop();
            }, 200);
            this.utils.loopDetector(isHeaderReady, adjustTop, 35, 1000);
        }
        const handleClick = () => {
            this.entities.tabBar.addEventListener("click", ev => {
                const closeButton = ev.target.closest(".close-button");
                const tabContainer = ev.target.closest(".tab-container");
                if (!closeButton && !tabContainer) return;
                ev.stopPropagation();
                ev.preventDefault();
                const tab = closeButton ? closeButton.closest(".tab-container") : tabContainer;
                const idx = parseInt(tab.dataset.idx)
                if (this.config.CTRL_CLICK_TO_NEW_WINDOW && this.utils.metaKeyPressed(ev)) {
                    this.openFileNewWindow(this.tabUtil.getTabPathByIdx(idx), false);
                } else if (closeButton) {
                    this.closeTab(idx);
                } else {
                    this.switchTab(idx);
                }
            })
        }
        const handleScroll = () => {
            this.entities.content.addEventListener("scroll", this.utils.debounce(() => {
                const current = this.tabUtil.currentTab;
                if (current) {
                    current.scrollTop = this.entities.content.scrollTop;
                }
            }), 100)
        }
        const handleDrag = () => {
            const newWindowIfNeed = (offsetY, tab) => {
                if (this.config.DRAG_NEW_WINDOW_THRESHOLD < 0) return;
                offsetY = Math.abs(offsetY);
                const { height } = this.entities.tabBar.getBoundingClientRect();
                if (offsetY > height * this.config.DRAG_NEW_WINDOW_THRESHOLD) {
                    const idx = parseInt(tab.dataset.idx)
                    this.openFileNewWindow(this.tabUtil.getTabPathByIdx(idx), false);
                }
            }

            const sortJetBrains = () => {
                const that = this;

                const resetTabBar = () => {
                    const all = that.entities.windowTab.querySelectorAll(".tab-container")
                    const activeIdx = parseInt(that.entities.tabBar.querySelector(".tab-container.active").dataset.idx)
                    const activePath = that.tabUtil.getTabPathByIdx(activeIdx)
                    that.tabUtil.reset(Array.from(all, tab => that.tabUtil.tabs[parseInt(tab.dataset.idx)]))
                    that.openTab(activePath)
                }

                const tabBar = $("#plugin-window-tab .tab-bar");
                let currentDragItem = null;
                let _offsetX = 0;

                tabBar.on("dragstart", ".tab-container", function (ev) {
                    _offsetX = ev.offsetX;
                    currentDragItem = this;
                }).on("dragend", ".tab-container", function () {
                    currentDragItem = null;
                }).on("dragover", ".tab-container", function (ev) {
                    ev.preventDefault();
                    if (currentDragItem) {
                        const func = ev.offsetX > _offsetX ? 'after' : 'before';
                        this[func](currentDragItem);
                    }
                }).on("dragenter", function () {
                    return false
                })

                let dragBox = null;
                let cloneObj = null;
                let offsetX = 0;
                let offsetY = 0;
                let startX = 0;
                let startY = 0;
                let axis, _axis;
                let threshold
                const previewImage = new Image();

                tabBar.on("dragstart", ".tab-container", function (ev) {
                    dragBox = this;
                    axis = dragBox.getAttribute('axis');
                    _axis = axis;
                    ev.originalEvent.dataTransfer.setDragImage(previewImage, 0, 0);
                    ev.originalEvent.dataTransfer.effectAllowed = "move";
                    ev.originalEvent.dataTransfer.dropEffect = "move";
                    let { left, top, height } = dragBox.getBoundingClientRect();
                    startX = ev.clientX;
                    startY = ev.clientY;
                    offsetX = startX - left;
                    offsetY = startY - top;
                    threshold = height * that.config.DETACHMENT_THRESHOLD

                    const fakeObj = dragBox.cloneNode(true);
                    fakeObj.style.height = dragBox.offsetHeight + 'px'; // dragBox uses height: 100%, needs to be reset.
                    fakeObj.style.transform = 'translate3d(0,0,0)';
                    fakeObj.setAttribute('dragging', '');
                    cloneObj = document.createElement('div');
                    cloneObj.appendChild(fakeObj);
                    cloneObj.className = 'drag-obj';
                    cloneObj.style.transform = `translate3d(${left}px, ${top}px, 0)`;
                    that.entities.tabBar.appendChild(cloneObj);
                }).on("dragend", ".tab-container", function (ev) {
                    newWindowIfNeed(ev.offsetY, this);

                    if (!cloneObj) return;
                    const { left, top } = this.getBoundingClientRect();
                    const resetAnimation = cloneObj.animate(
                        [{ transform: cloneObj.style.transform }, { transform: `translate3d(${left}px, ${top}px, 0)` }],
                        { duration: 70, easing: "ease-in-out" }
                    )

                    resetAnimation.onfinish = function () {
                        if (cloneObj && cloneObj.parentNode === that.entities.tabBar) {
                            that.entities.tabBar.removeChild(cloneObj);
                        }
                        cloneObj = null;
                        dragBox.style.visibility = 'visible';
                        resetTabBar();
                    }
                })

                document.addEventListener('dragover', function (ev) {
                    if (!cloneObj) return;

                    ev.preventDefault();
                    ev.stopPropagation();
                    ev.dataTransfer.dropEffect = 'move';
                    dragBox.style.visibility = 'hidden';
                    let left = ev.clientX - offsetX;
                    let top = ev.clientY - offsetY;
                    if (axis) {
                        if (_axis === 'X') {
                            top = startY - offsetY;
                        } else if (_axis === 'Y') {
                            left = startX - offsetX;
                        } else {
                            const x = Math.abs(ev.clientX - startX);
                            const y = Math.abs(ev.clientY - startY);
                            _axis = ((x > y && 'X') || (x < y && 'Y') || '');
                        }
                    } else {
                        _axis = '';
                    }
                    startX = left + offsetX;
                    startY = top + offsetY;

                    const detachment = that.config.TAB_DETACHMENT
                    if (detachment === "lockVertical" || (detachment === "resistant" && top < threshold)) {
                        top = 0;
                    }
                    cloneObj.style.transform = `translate3d(${left}px, ${top}px, 0)`;
                })
            }

            const sortVscode = () => {
                const that = this;

                const toggleOver = (target, f) => {
                    if (f === "add") {
                        target.classList.add("over");
                        lastOver = target;
                    } else {
                        target.classList.remove("over");
                    }
                }

                let lastOver = null;
                $("#plugin-window-tab .tab-bar").on("dragstart", ".tab-container", function (ev) {
                    ev.originalEvent.dataTransfer.effectAllowed = "move";
                    ev.originalEvent.dataTransfer.dropEffect = 'move';
                    this.style.opacity = 0.5;
                    lastOver = null;
                }).on("dragend", ".tab-container", function (ev) {
                    this.style.opacity = ""
                    newWindowIfNeed(ev.offsetY, this)
                    if (lastOver) {
                        lastOver.classList.remove("over")
                        const activeIdx = parseInt(that.entities.tabBar.querySelector(".tab-container.active").dataset.idx)
                        const activePath = that.tabUtil.getTabPathByIdx(activeIdx)
                        const toIdx = parseInt(lastOver.dataset.idx)
                        const fromIdx = parseInt(this.dataset.idx)
                        const ele = that.tabUtil.spliceTabs(fromIdx, 1)[0]
                        that.tabUtil.spliceTabs(toIdx, 0, ele)
                        that.openTab(activePath)
                    }
                }).on("dragover", ".tab-container", function () {
                    toggleOver(this, "add");
                    return false
                }).on("dragenter", ".tab-container", function () {
                    toggleOver(this, "add");
                    return false
                }).on("dragleave", ".tab-container", function () {
                    toggleOver(this, "remove");
                })
            }

            if (this.config.DRAG_STYLE === "JetBrains") {
                sortJetBrains()
            } else {
                sortVscode();
            }
        }
        const handleRename = () => {
            reqnode("electron").ipcRenderer.on("didRename", (sender, { oldPath, newPath }) => {
                const isDir = this.utils.Package.Fs.statSync(newPath).isDirectory();
                if (isDir) {
                    this.tabUtil.tabs
                        .filter(tab => tab.path.startsWith(oldPath))
                        .forEach(tab => tab.path = newPath + tab.path.slice(oldPath.length))
                } else {
                    const renameTab = this.tabUtil.tabs.find(tab => tab.path === oldPath);
                    if (renameTab) {
                        renameTab.path = newPath;
                    }
                }
                const current = this.tabUtil.currentTab;
                if (current && current.path) {
                    this.openTab(current.path);
                }
            })
        }
        const handleFocusChange = () => {
            window.addEventListener("focus", async () => {
                if (this.tabUtil.tabCount > 0) {
                    await this._checkTabsExist();
                    this._startCheckTabsInterval();
                }
            });
            window.addEventListener("blur", this._stopCheckTabsInterval);
        }
        const handleWheel = () => {
            this.entities.tabBar.addEventListener("wheel", ev => {
                const target = ev.target.closest("#plugin-window-tab .tab-bar");
                if (!target) return;
                if (this.utils.metaKeyPressed(ev)) {
                    (ev.deltaY < 0) ? this.previousTab() : this.nextTab();
                } else {
                    target.scrollLeft += ev.deltaY * 0.5;
                }
            }, { passive: true })
        }
        const handleMiddleClick = () => {
            this.entities.tabBar.addEventListener("mousedown", ev => {
                if (ev.button === 1) {
                    const tabContainer = ev.target.closest(".tab-container");
                    tabContainer && tabContainer.querySelector(".close-button").click();
                }
            })
        }
        const handleContextMenu = () => {
            let tabIdx = -1
            this.utils.contextMenu.register(
                this.entities.tabBar,
                (ev) => {
                    const target = ev.target.closest(".tab-container")
                    if (target) {
                        tabIdx = parseInt(target.dataset.idx)
                        const all = ["closeTab", "closeOtherTabs", "closeLeftTabs", "closeRightTabs", "copyPath", "showInFinder", "openInNewWindow", "sortTabs"]
                        const menuItems = this.i18n.entries(all, "func.")
                        return this.utils.pick(menuItems, this.config.CONTEXT_MENU)
                    }
                },
                (ev, key) => {
                    const fn = this[key]
                    if (fn) {
                        fn(tabIdx)
                    }
                },
            )
        }
        const adjustQuickOpen = () => {
            const open = (item, ev) => {
                ev.preventDefault();
                ev.stopPropagation();
                const path = item.dataset.path;
                const isDir = item.dataset.isDir + "" === "true";
                if (isDir) {
                    this.utils.openFolder(path);
                } else {
                    this.utils.openFile(path);
                }
                $("#typora-quick-open:visible").hide().length && File.isMac && bridge.callHandler("quickOpen.stopQuery")
            }
            document.querySelector(".typora-quick-open-list").addEventListener("mousedown", ev => {
                const target = ev.target.closest(".typora-quick-open-item");
                if (!target) return;
                // Changed the original click behavior to ctrl+click.
                if (this.utils.metaKeyPressed(ev)) return;
                open(target, ev);
            }, true)

            document.querySelector("#typora-quick-open-input > input").addEventListener("keydown", ev => {
                if (ev.key === "Enter") {
                    const ele = document.querySelector(".typora-quick-open-item.active");
                    ele && open(ele, ev);
                }
            }, true)
        }

        // Typora version 1.1 and later supports using anchor links to jump to local files
        // Intercept internal and local file links, and change the jump behavior to open in a new tab
        const interceptLink = () => {
            const _linkUtils = { file: "", anchor: "" };
            this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.fileContentLoaded, () => {
                const { file, anchor } = _linkUtils;
                if (!file) return;

                _linkUtils.file = "";
                _linkUtils.anchor = "";
                const ele = File.editor.EditHelper.findAnchorElem(anchor);
                ele && this.utils.scroll(ele, 10);
            });
            this.utils.decorate(() => JSBridge, "invoke", (...args) => {
                if (args.length < 3 || args[0] !== "app.openFileOrFolder") return;

                const anchor = args[2]["anchor"];
                if (!anchor || typeof anchor !== "string" || !anchor.match(/^#/)) return;

                const filePath = args[1];
                _linkUtils.file = filePath;
                _linkUtils.anchor = anchor;
                this.utils.openFile(filePath);
                return this.utils.stopCallError
            })
        }

        handleLifeCycle();
        handleClick();
        handleScroll();
        handleDrag();
        handleRename();
        handleFocusChange();
        adjustQuickOpen();
        interceptLink();
        if (this.config.CTRL_WHEEL_TO_SWITCH) {
            handleWheel();
        }
        if (this.config.MIDDLE_CLICK_TO_CLOSE) {
            handleMiddleClick();
        }
        if (this.config.USE_CONTEXT_MENU && this.config.CONTEXT_MENU.length) {
            handleContextMenu();
        }
    }

    getDynamicActions = () => this.i18n.fillActions([
        { act_value: "open_save_tabs", act_hidden: !this.utils.existPathSync(this.saveTabFilePath) },
        { act_value: "toggle_file_ext", act_state: this.config.TRIM_FILE_EXT },
        { act_value: "toggle_show_dir", act_state: this.config.SHOW_DIR_ON_DUPLICATE },
        { act_value: "toggle_show_close_button", act_state: this.config.SHOW_TAB_CLOSE_BUTTON },
        { act_value: "toggle_tab_bar", act_state: this.entities.windowTab.style.display === "none", act_hotkey: this.config.TOGGLE_TAB_BAR_HOTKEY },
        { act_value: "toggle_local", act_state: !this.localOpen },
    ])

    call = action => {
        const toggleConfig = async (cfg) => {
            this.config[cfg] = !this.config[cfg]
            await this.utils.settings.saveSettings(this.fixedName, { [cfg]: this.config[cfg] })
            this.rerenderTabBar()
        }
        const callMap = {
            toggle_local: () => this.localOpen = !this.localOpen,
            toggle_show_dir: () => toggleConfig("SHOW_DIR_ON_DUPLICATE"),
            toggle_file_ext: () => toggleConfig("TRIM_FILE_EXT"),
            toggle_show_close_button: () => toggleConfig("SHOW_TAB_CLOSE_BUTTON"),
            save_tabs: this.saveTabs,
            sort_tabs: this.sortTabs,
            open_save_tabs: this.openSaveTabs,
            toggle_tab_bar: this.forceToggleTabBar,
        }
        const func = callMap[action]
        func && func()
    }

    _hideTabBar = () => {
        if (this.utils.isShow(this.entities.windowTab) && this.tabUtil.tabCount === 0) {
            this.utils.hide(this.entities.windowTab);
            this._resetContentTop();
        }
    }

    _showTabBar = () => {
        if (this.utils.isHidden(this.entities.windowTab)) {
            this.utils.show(this.entities.windowTab);
            this._adjustContentTop();
        }
    }

    _adjustContentTop = () => {
        const { height, top } = this.entities.windowTab.getBoundingClientRect();
        if (height + top === 0) {  // Equal to 0, indicating that there are no tabs.
            this._resetContentTop();
        } else {
            const { height: headerHeight, top: headerTop } = document.querySelector("header").getBoundingClientRect();
            const _top = Math.max(top + height, headerHeight + headerTop)
            const t = _top + "px";
            this.entities.content.style.top = t;
            this.entities.source.style.top = t;
        }
    }

    _resetContentTop = () => {
        this.entities.content.style.removeProperty("top");
        this.entities.source.style.removeProperty("top");
    }

    _startCheckTabsInterval = () => {
        if (this.checkTabsInterval) return;
        const getDynamicInterval = () => {
            const tabCount = this.tabUtil.tabCount;
            let interval = 1000;
            if (tabCount > 10 && tabCount <= 20) {
                interval = 2000;
            } else if (tabCount > 30) {
                interval = 3000;
            }
            return interval;
        };
        const interval = getDynamicInterval();
        this.checkTabsInterval = setInterval(this._checkTabsExist, interval);
    }

    _stopCheckTabsInterval = () => {
        if (this.checkTabsInterval) {
            clearInterval(this.checkTabsInterval);
            this.checkTabsInterval = null;
        }
    }

    _onEmptyTabs = async () => {
        const _resetAndSetTitle = async () => {
            this.tabUtil.reset();
            File.bundle = {
                filePath: '',
                originalPath: null,
                untitledId: +new Date,
                fileName: null,
                fileEncode: null,
                removed: false,
                useCRLF: File.useCRLF || false,
                unsupported: "",
                hasModified: false,
                modifiedDate: null,
                lastSnapDate: null,
                savedContent: null,
                isLocked: false,
                oversize: false,
                fileMissingWhenOpen: false,
                bundleFile: null,
                zip: null
            };

            await this.utils.reload();
            document.getElementById("title-text").innerHTML = "Typora";
            const activeElement = document.querySelector(".file-library-node.active");
            activeElement && activeElement.classList.remove("active");
        }
        this._hideTabBar();
        this._stopCheckTabsInterval();
        await _resetAndSetTitle();
    }

    _checkTabsExist = async () => {
        if (this.tabUtil.tabCount === 0) {
            await this._onEmptyTabs();
            return;
        }
        const result = await Promise.all(this.tabUtil.tabs.map(async (tab, idx) => {
            const exist = await this.utils.existPath(tab.path);
            return !exist ? idx : undefined
        }));
        const waitToClose = result.filter(idx => idx !== undefined);
        if (waitToClose.length === 0) return;

        const closeActive = waitToClose.includes(this.tabUtil.activeIdx);
        waitToClose.reverse().forEach(idx => this.tabUtil.spliceTabs(idx, 1))
        const leftCount = waitToClose.filter(idx => idx <= this.tabUtil.activeIdx).length;  // Removed X tabs from the left
        this.tabUtil.activeIdx -= leftCount;
        if (closeActive && this.config.TAB_SWITCH_ON_CLOSE !== "left") {
            this.tabUtil.activeIdx++;
        }
        if (this.tabUtil.tabCount === 0) {
            await this._onEmptyTabs();
        } else {
            this.switchTab(this.tabUtil.activeIdx);
        }
    }

    _setShowName = () => {
        this.tabUtil.tabs.forEach(tab => tab.showName = this.utils.getFileName(tab.path, this.config.TRIM_FILE_EXT));
        if (this.config.SHOW_DIR_ON_DUPLICATE) {
            this._addDir();
        }
    }

    _addDir = () => {
        const mapName2Tabs = new Map();
        let unique = true;

        this.tabUtil.tabs.forEach(tab => {
            const tabList = mapName2Tabs.get(tab.showName)
            if (!tabList) {
                mapName2Tabs.set(tab.showName, [tab])
            } else {
                unique = false
                tabList.push(tab)
            }
        })
        if (unique) return;

        const isUnique = tabList => new Set(tabList.map(tab => tab.showName)).size === tabList.length

        for (const group of mapName2Tabs.values()) {
            if (group.length === 1) continue;
            const dirs = group.map(tab => tab.path.split(this.utils.separator).slice(0, -1));
            // Each execution of the do logic adds a parent directory to the showName of each tab under the group.
            do {
                for (let i = 0; i < group.length; i++) {
                    const tab = group[i];
                    const dir = dirs[i].pop();
                    if (!dir) return
                    tab.showName = dir + this.utils.separator + tab.showName;
                }
            } while (!isUnique(group))
        }
    }

    _insertTabDiv = (filePath, showName, idx) => {
        const title = this.config.SHOW_FULL_PATH_WHEN_HOVER ? `title="${filePath}"` : ""
        const btn = this.config.SHOW_TAB_CLOSE_BUTTON ? `<span class="close-button"><div class="close-icon"></div></span>` : ""
        const tabDiv = `
            <div class="tab-container" data-idx="${idx}" draggable="true" ${title}>
                <div class="active-indicator"></div>
                <span class="name">${showName}</span>
                ${btn}
            </div>`
        this.entities.tabBar.insertAdjacentHTML("beforeend", tabDiv)
    }

    _updateTabDiv = (tabDiv, filePath, showName, idx) => {
        tabDiv.dataset.idx = idx
        tabDiv.querySelector(".name").innerText = showName
        if (this.config.SHOW_FULL_PATH_WHEN_HOVER) {
            tabDiv.setAttribute("title", filePath)
        } else {
            tabDiv.removeAttribute("title")
        }
    }

    // openFile is a delayed operation, and it needs to wait for content to load before setting scrollTop
    // The problem is that I have no idea when the content is fully loaded
    // Solution: Poll to set scrollTop, and if scrollTop does not change for 3 consecutive times, it is judged that the content is loaded
    // This method is not environmentally friendly and very ugly. However, I can't think of any other way to do it without modifying frame.js.
    _scrollContent = filepath => {
        const activeTab = this.tabUtil.tabs.find(e => e.path === filepath);
        if (!activeTab) return;

        let count = 0;
        const stopCount = 3;
        const timeout = 2000;
        const end = new Date().getTime() + timeout;
        const scrollTop = activeTab.scrollTop;
        const _timer = setInterval(() => {
            const filePath = this.utils.getFilePath();
            if (filePath === activeTab.path && this.entities.content.scrollTop !== scrollTop) {
                this.entities.content.scrollTop = scrollTop;
                count = 0;
            } else {
                count++;
            }
            if (count === stopCount || new Date().getTime() > end) {
                clearInterval(_timer);
            }
        }, 70);
    }

    _renderDOM = wantOpenPath => {
        this._setShowName();

        let tabDiv = this.entities.tabBar.firstElementChild;
        this.tabUtil.tabs.forEach((tab, idx) => {
            if (!tabDiv) {
                this._insertTabDiv(tab.path, tab.showName, idx);
                tabDiv = this.entities.tabBar.lastElementChild;
            } else {
                this._updateTabDiv(tabDiv, tab.path, tab.showName, idx);
            }

            const active = tab.path === wantOpenPath;
            tabDiv.classList.toggle("active", active);
            if (active) {
                tabDiv.scrollIntoView();
            }

            tabDiv = tabDiv.nextElementSibling;
        })

        while (tabDiv) {
            const next = tabDiv.nextElementSibling;
            tabDiv.parentElement.removeChild(tabDiv);
            tabDiv = next;
        }
    }

    forceToggleTabBar = () => {
        const windowTab = this.entities.windowTab
        const isHidden = windowTab.style.display === "none"
        windowTab.style.display = isHidden ? "initial" : "none"
        if (isHidden) {
            this._adjustContentTop()
        } else {
            this._resetContentTop()
        }
    }

    openFileNewWindow = (path, isFolder) => File.editor.library.openFileInNewWindow(path, isFolder)

    OpenFileLocal = filePath => {
        this.localOpen = true;
        this.utils.openFile(filePath);
        this.localOpen = false;  // Auto restore
    }

    openTab = wantOpenPath => {
        const { NEW_TAB_POSITION, MAX_TAB_NUM } = this.config;
        const include = this.tabUtil.tabs.some(tab => tab.path === wantOpenPath);
        if (!include) {
            // Modify the file path of the current tab when opening in place and no tab exists.
            if (this.localOpen) {
                this.tabUtil.currentTab.path = wantOpenPath;
            } else {
                const newTab = { path: wantOpenPath, scrollTop: 0 };
                if (NEW_TAB_POSITION === "end") {
                    this.tabUtil.tabs.push(newTab);
                } else if (NEW_TAB_POSITION === "right") {
                    this.tabUtil.spliceTabs(this.tabUtil.activeIdx + 1, 0, newTab)
                }
            }
        }
        if (0 < MAX_TAB_NUM && MAX_TAB_NUM < this.tabUtil.tabCount) {
            this.tabUtil.spliceTabs(0, this.tabUtil.tabCount - MAX_TAB_NUM)
        }
        this.tabUtil.activeIdx = this.tabUtil.tabs.findIndex(tab => tab.path === wantOpenPath);
        this.tabUtil.currentTab.timestamp = new Date().getTime();
        this._showTabBar();
        this._startCheckTabsInterval();
        this._renderDOM(wantOpenPath);
    }

    rerenderTabBar = () => {
        this.entities.tabBar.innerHTML = ""
        this.utils.openFile(this.tabUtil.currentTab.path)
    }

    switchTab = idx => {
        idx = Math.max(0, idx);
        idx = Math.min(idx, this.tabUtil.maxTabIdx);
        this.tabUtil.activeIdx = idx;
        this.utils.openFile(this.tabUtil.currentTab.path);
    }

    switchTabByPath = path => {
        const tabIndex = this.tabUtil.tabs.findIndex(tab => tab.path === path);
        if (tabIndex !== -1) {
            this.switchTab(tabIndex);
        }
    }

    previousTab = () => {
        const idx = (this.tabUtil.activeIdx === 0) ? this.tabUtil.maxTabIdx : this.tabUtil.activeIdx - 1;
        this.switchTab(idx);
    }

    nextTab = () => {
        const idx = (this.tabUtil.activeIdx === this.tabUtil.maxTabIdx) ? 0 : this.tabUtil.activeIdx + 1;
        this.switchTab(idx);
    }

    closeTab = idx => {
        const tabUtil = this.tabUtil;
        const { LAST_TAB_CLOSE_ACTION, TAB_SWITCH_ON_CLOSE } = this.config

        const getLatestTabIdx = () => tabUtil.tabs.reduce((maxIdx, tab, idx, array) => (tab.timestamp || 0) > (array[maxIdx].timestamp || 0) ? idx : maxIdx, 0)
        const handleLastTab = () => {
            const exit = () => {
                tabUtil.spliceTabs(idx, 1)  // Delete all tabs to ensure the `reopenClosedFiles` plugin works properly.
                this.utils.exitTypora();
            }
            switch (LAST_TAB_CLOSE_ACTION) {
                case "exit":
                    exit();
                    break;
                case "blankPage":
                    tabUtil.spliceTabs(idx, 1)
                    this._onEmptyTabs();
                    break;
                case "reconfirm":
                default:
                    this.utils.showMessageBox({
                        type: "info",
                        title: this.i18n.t("modal.exit"),
                        message: this.i18n.t("modal.reconfirmExit"),
                    }).then(ret => {
                        if (ret.response === 0) {
                            exit()
                        }
                    })
            }
        }

        if (tabUtil.tabCount === 1) {
            handleLastTab();
            return;
        }

        tabUtil.spliceTabs(idx, 1)
        if (TAB_SWITCH_ON_CLOSE === "latest") {
            tabUtil.activeIdx = getLatestTabIdx();
        } else if (tabUtil.activeIdx !== 0) {
            if (idx < tabUtil.activeIdx || (idx === tabUtil.activeIdx && TAB_SWITCH_ON_CLOSE === "left")) {
                tabUtil.activeIdx--;
            } else {
                tabUtil.activeIdx = Math.min(tabUtil.activeIdx, tabUtil.maxTabIdx);
            }
        }
        this.switchTab(tabUtil.activeIdx);
    }

    closeActiveTab = () => {
        if (this.tabUtil.tabCount !== 0) {
            this.closeTab(this.tabUtil.activeIdx)
        }
    }

    closeOtherTabs = idx => {
        this.tabUtil.reset([this.tabUtil.tabs[idx]])
        this.switchTab(0)
    }

    closeLeftTabs = idx => {
        const origin = this.tabUtil.currentTab.path
        this.tabUtil.spliceTabs(0, idx)
        if (this.tabUtil.activeIdx < idx) {
            this.switchTab(0)
        } else {
            this.switchTabByPath(origin)
        }
    }

    closeRightTabs = idx => {
        const origin = this.tabUtil.currentTab.path
        this.tabUtil.spliceTabs(idx + 1, this.tabUtil.tabCount - idx)
        if (this.tabUtil.activeIdx > idx) {
            this.switchTab(this.tabUtil.tabCount - 1)
        } else {
            this.switchTabByPath(origin)
        }
    }

    sortTabs = () => {
        if (this.tabUtil.tabCount === 1) return
        const current = this.tabUtil.currentTab
        this.tabUtil.tabs.sort(({ showName: n1 }, { showName: n2 }) => n1.localeCompare(n2))
        this.switchTab(this.tabUtil.tabs.indexOf(current))
    }

    copyPath = idx => navigator.clipboard.writeText(this.tabUtil.getTabPathByIdx(idx))

    copyActiveTabPath = () => this.copyPath(this.tabUtil.activeIdx)

    showInFinder = idx => this.utils.showInFinder(this.tabUtil.getTabPathByIdx(idx))

    openInNewWindow = idx => this.openFileNewWindow(this.tabUtil.getTabPathByIdx(idx), false)

    saveTabs = async filepath => {
        filepath = filepath || this.saveTabFilePath
        const mount_folder = this.utils.getMountFolder()
        const save_tabs = this.tabUtil.tabs.map((tab, idx) => ({
            idx: idx,
            path: tab.path,
            active: idx === this.tabUtil.activeIdx,
            scrollTop: tab.scrollTop,
        }))
        const str = JSON.stringify({ mount_folder, save_tabs }, null, "\t")
        await this.utils.Package.Fs.promises.writeFile(filepath, str)
    }

    openSaveTabs = async (filepath, matchMountFolder = false) => {
        filepath = filepath || this.saveTabFilePath
        const data = await this.utils.Package.Fs.promises.readFile(filepath, "utf8")
        const { save_tabs, mount_folder } = JSON.parse(data || "{}")
        if (!save_tabs || save_tabs.length === 0) return
        if (matchMountFolder && mount_folder !== this.utils.getMountFolder()) return

        let activePath
        const existTabs = new Map(this.tabUtil.tabs.map(tab => [tab.path, tab]))
        save_tabs.forEach(tab => {
            const existTab = existTabs.get(tab.path)
            if (!existTab) {
                this.tabUtil.tabs.push({ path: tab.path, scrollTop: tab.scrollTop })
            } else {
                existTab.scrollTop = tab.scrollTop
            }
            if (tab.active) {
                activePath = tab.path
            }
        })
        if (activePath) {
            this.switchTabByPath(activePath)
        } else if (this.tabUtil.tabCount) {
            this.switchTab(this.tabUtil.activeIdx)
        }
    }
}

module.exports = {
    plugin: windowTabBarPlugin
}
