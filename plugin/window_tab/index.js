class windowTabBarPlugin extends BasePlugin {
    beforeProcess = () => {
        if (window._options.framelessWindow && this.config.HIDE_WINDOW_TITLE_BAR) {
            document.querySelector("header").style.zIndex = "897";
            document.getElementById("top-titlebar").style.display = "none";
        }
        if (this.config.WHEN_CLOSE_LAST_TAB === "blankPage" && this.utils.isBetaVersion) {
            this.config.WHEN_CLOSE_LAST_TAB = "reconfirm";
        }
    }

    styleTemplate = () => true

    html = () => `<div id="plugin-window-tab"><div class="tab-bar"></div></div>`

    hotkey = () => [
        { hotkey: this.config.SWITCH_NEXT_TAB_HOTKEY, callback: this.nextTab },
        { hotkey: this.config.SWITCH_PREVIOUS_TAB_HOTKEY, callback: this.previousTab },
        { hotkey: this.config.CLOSE_HOTKEY, callback: this.closeActiveTab },
        { hotkey: this.config.COPY_PATH_HOTKEY, callback: this.copyActiveTabPath }
    ]

    init = () => {
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
                // 调整notification组件的图层顺序，以免被tab遮挡
                const container = document.querySelector(".md-notification-container");
                if (container) {
                    container.style.zIndex = "99999";
                }

                if (!this.config.HIDE_WINDOW_TITLE_BAR) {
                    const { height, top } = document.querySelector("header").getBoundingClientRect();
                    this.entities.windowTab.style.top = height + top + "px";
                }

                // 调整正文区域的顶部位置，以免被tab遮挡
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
                if (this.config.HEIGHT_SCALE < 0) return;
                offsetY = Math.abs(offsetY);
                const { height } = this.entities.tabBar.getBoundingClientRect();
                if (offsetY > height * this.config.HEIGHT_SCALE) {
                    const idx = parseInt(tab.dataset.idx)
                    this.openFileNewWindow(this.tabUtil.getTabPathByIdx(idx), false);
                }
            }

            const sortIDEA = () => {
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
                let dragROI;
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
                    dragROI = height * that.config.Y_AXIS_LIMIT_RANGE_WHEN_DRAG

                    const fakeObj = dragBox.cloneNode(true);
                    fakeObj.style.height = dragBox.offsetHeight + 'px'; // dragBox使用了height: 100%，需要重新设置一下
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

                    if (that.config.LIMIT_TAB_ROI || (that.config.LIMIT_TAB_Y_AXIS_WHEN_DRAG && top < dragROI)) {
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

            if (this.config.JETBRAINS_DRAG_STYLE) {
                sortIDEA();
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
            let idx = -1;
            const map = this.utils.fromObject({
                closeTab: "关闭标签",
                closeOtherTabs: "关闭其他标签",
                closeLeftTabs: "关闭左侧全部标签",
                closeRightTabs: "关闭右侧全部标签",
                copyPath: "复制文件路径",
                showInFinder: "打开文件位置",
                openInNewWindow: "新窗口打开",
                sortTabs: "排序标签",
            }, this.config.CONTEXT_MENU);
            const showMenu = ({ target }) => {
                idx = parseInt(target.dataset.idx)
                return map
            }
            const callback = ({ key: func }) => idx !== -1 && func && this[func] && this[func](idx);
            this.utils.contextMenu.register("window-tab", "#plugin-window-tab .tab-container", showMenu, callback);
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
                // 将原先的click行为改成ctrl+click
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
        if (this.config.CTRL_WHEEL_TO_SCROLL) {
            handleWheel();
        }
        if (this.config.MIDDLE_CLICK_TO_CLOSE) {
            handleMiddleClick();
        }
        if (this.config.INTERCEPT_INTERNAL_AND_LOCAL_LINKS) {
            interceptLink();
        }
        if (this.config.CONTEXT_MENU) {
            handleContextMenu();
        }
    }

    dynamicCallArgsGenerator = () => {
        const args = [
            { arg_name: "保存当前标签页列表", arg_value: "save_tabs" },
            { arg_name: "启用功能：隐藏文件后缀", arg_value: "toggle_suffix", arg_state: this.config.REMOVE_FILE_SUFFIX },
            { arg_name: "启用功能：同名文件显示其目录", arg_value: "toggle_show_dir", arg_state: this.config.SHOW_DIR_FOR_SAME_NAME_FILE },
            { arg_name: "启用功能：显示标签页关闭按钮", arg_value: "toggle_show_close_button", arg_state: this.config.SHOW_TAB_CLOSE_BUTTON },
            { arg_name: "启用功能：鼠标悬停显示完整路径", arg_value: "toggle_show_path", arg_state: this.config.SHOW_FULL_PATH_WHEN_HOVER },
            { arg_name: "启用功能：JetBrains风格的标签拖拽方式", arg_value: "toggle_drag_style", arg_state: this.config.JETBRAINS_DRAG_STYLE },
            { arg_name: "启用功能：一体化窗口样式时隐藏标题栏", arg_value: "toggle_hide_title_bar", arg_state: this.config.HIDE_WINDOW_TITLE_BAR },
            { arg_name: "启用功能：在新标签打开", arg_value: "toggle_local", arg_state: !this.localOpen },
        ]
        if (this.config.JETBRAINS_DRAG_STYLE) {
            const arg = { arg_name: "启用功能：拖拽时竖直防抖", arg_value: "toggle_limit_y_axis", arg_state: this.config.LIMIT_TAB_Y_AXIS_WHEN_DRAG }
            args.splice(5, 0, arg)
        }
        if (this.utils.existPathSync(this.saveTabFilePath)) {
            const arg = { arg_name: "打开保存的标签页列表", arg_value: "open_save_tabs" }
            args.splice(1, 0, arg)
        }
        return args
    }

    call = type => {
        const toggleConfig = async (cfg, restart = false) => {
            this.config[cfg] = !this.config[cfg]
            await this.utils.runtime.saveConfig(this.fixedName, { [cfg]: this.config[cfg] })
            if (!restart) {
                this.rerenderTabBar()
            } else {
                const op = { type: "info", buttons: ["确定", "取消"], message: "重启后生效，确认重启？", title: "重启 Typora" }
                const { response } = await this.utils.showMessageBox(op)
                if (response === 0) {
                    this.utils.restartTypora()
                }
            }
        }
        const callMap = {
            toggle_local: () => this.localOpen = !this.localOpen,
            toggle_limit_y_axis: () => toggleConfig("LIMIT_TAB_Y_AXIS_WHEN_DRAG"),
            toggle_show_dir: () => toggleConfig("SHOW_DIR_FOR_SAME_NAME_FILE"),
            toggle_suffix: () => toggleConfig("REMOVE_FILE_SUFFIX"),
            toggle_show_path: () => toggleConfig("SHOW_FULL_PATH_WHEN_HOVER"),
            toggle_show_close_button: () => toggleConfig("SHOW_TAB_CLOSE_BUTTON"),
            toggle_hide_title_bar: () => toggleConfig("HIDE_WINDOW_TITLE_BAR", true),
            toggle_drag_style: () => toggleConfig("JETBRAINS_DRAG_STYLE", true),
            save_tabs: this.saveTabs,
            open_save_tabs: this.openSaveTabs,
        }
        const func = callMap[type]
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
        if (height + top === 0) {  // 等于0，说明没有任何一个tab
            this._resetContentTop();
        } else {
            const { height: headerHeight, top: headerTop } = document.querySelector("header").getBoundingClientRect();
            const _top = Math.max(top + height + this.config.GAP_BETWEEN_TAB_AND_CONTENT, headerHeight + headerTop);
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
        const leftCount = waitToClose.filter(idx => idx <= this.tabUtil.activeIdx).length;  // 删除了左侧X个tab
        this.tabUtil.activeIdx -= leftCount;
        if (closeActive && this.config.ACTIVE_TAB_WHEN_CLOSE !== "left") {
            this.tabUtil.activeIdx++;
        }
        if (this.tabUtil.tabCount === 0) {
            await this._onEmptyTabs();
        } else {
            this.switchTab(this.tabUtil.activeIdx);
        }
    }

    _setShowName = () => {
        this.tabUtil.tabs.forEach(tab => tab.showName = this.utils.getFileName(tab.path, this.config.REMOVE_FILE_SUFFIX));
        if (this.config.SHOW_DIR_FOR_SAME_NAME_FILE) {
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
            // 每次执行do逻辑都会给group下每个tab的showName都加一层父目录
            do {
                for (let i = 0; i < group.length; i++) {
                    const tab = group[i];
                    const dir = dirs[i].pop();
                    if (!dir) return;  // 文件系统决定了此分支不可能执行，不过还是防一手
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

    // openFile是一个延迟操作，需要等待content加载好，才能定位scrollTop
    // 问题是我压根不知道content什么时候加载好
    // 解决方法: 轮询设置scrollTop，当连续3次scrollTop不再改变，就判断content加载好了
    // 这种方法很不环保，很ugly。但是我确实也想不到在不修改frame.js的前提下该怎么做了
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

    // 新窗口打开
    openFileNewWindow = (path, isFolder) => File.editor.library.openFileInNewWindow(path, isFolder)

    // 当前标签页打开
    OpenFileLocal = filePath => {
        this.localOpen = true;
        this.utils.openFile(filePath);
        this.localOpen = false;  // 自动还原
    }

    openTab = wantOpenPath => {
        const { NEW_TAB_AT, TAB_MAX_NUM } = this.config;
        const include = this.tabUtil.tabs.some(tab => tab.path === wantOpenPath);
        if (!include) {
            // 原地打开并且不存在tab时，修改当前tab的文件路径
            if (this.localOpen) {
                this.tabUtil.currentTab.path = wantOpenPath;
            } else {
                const newTab = { path: wantOpenPath, scrollTop: 0 };
                if (NEW_TAB_AT === "end") {
                    this.tabUtil.tabs.push(newTab);
                } else if (NEW_TAB_AT === "right") {
                    this.tabUtil.spliceTabs(this.tabUtil.activeIdx + 1, 0, newTab)
                }
            }
        }
        if (0 < TAB_MAX_NUM && TAB_MAX_NUM < this.tabUtil.tabCount) {
            this.tabUtil.spliceTabs(0, this.tabUtil.tabCount - TAB_MAX_NUM)
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
        const { WHEN_CLOSE_LAST_TAB, ACTIVE_TAB_WHEN_CLOSE } = this.config;

        const getLatestTabIdx = () => tabUtil.tabs.reduce((maxIdx, tab, idx, array) => (tab.timestamp || 0) > (array[maxIdx].timestamp || 0) ? idx : maxIdx, 0)
        const handleLastTab = () => {
            const exit = () => {
                tabUtil.spliceTabs(idx, 1) // 删除全部的tab，保证【reopenClosedFiles】插件能正常工作
                this.utils.exitTypora();
            }
            switch (WHEN_CLOSE_LAST_TAB) {
                case "exit":
                    exit();
                    break;
                case "blankPage":
                    tabUtil.spliceTabs(idx, 1)
                    this._onEmptyTabs();
                    break;
                case "reconfirm":
                default:
                    this.utils.dialog.modal({ title: "退出 Typora", components: [{ label: "是否退出？", type: "p" }] }, exit);
            }
        }

        if (tabUtil.tabCount === 1) {
            handleLastTab();
            return;
        }

        tabUtil.spliceTabs(idx, 1)
        if (ACTIVE_TAB_WHEN_CLOSE === "latest") {
            tabUtil.activeIdx = getLatestTabIdx();
        } else if (tabUtil.activeIdx !== 0) {
            if (idx < tabUtil.activeIdx || (idx === tabUtil.activeIdx && ACTIVE_TAB_WHEN_CLOSE === "left")) {
                tabUtil.activeIdx--;
            } else {
                tabUtil.activeIdx = Math.min(tabUtil.activeIdx, tabUtil.maxTabIdx);
            }
        }
        this.switchTab(tabUtil.activeIdx);
    }

    closeActiveTab = () => this.closeTab(this.tabUtil.activeIdx)

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
