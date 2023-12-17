class windowTabBarPlugin extends BasePlugin {
    beforeProcess = () => {
        if (window._options.framelessWindow && this.config.HIDE_WINDOW_TITLE_BAR) {
            document.querySelector("header").style.zIndex = "897";
            document.getElementById("top-titlebar").style.display = "none";
        }
    }
    styleTemplate = () => true
    htmlTemplate = () => [{id: "plugin-window-tab", children: [{class_: "tab-bar"}]}]
    hotkey = () => [
        {hotkey: this.config.SWITCH_NEXT_TAB_HOTKEY, callback: this.nextTab},
        {hotkey: this.config.SWITCH_PREVIOUS_TAB_HOTKEY, callback: this.previousTab},
        {hotkey: this.config.CLOSE_HOTKEY, callback: this.closeActiveTab},
        {hotkey: this.config.COPY_PATH_HOTKEY, callback: this.copyActiveTabPath}
    ]
    init = () => {
        this.entities = {
            content: document.querySelector("content"),
            tabBar: document.querySelector("#plugin-window-tab .tab-bar"),
        }
        this.tabUtil = {tabs: [], activeIdx: 0};
        this.loopDetectInterval = 35;
    }
    process = () => {
        this.init();
        this.handleLifeCycle();
        this.handleClick();
        this.handleScroll();
        this.handleDrag();
        this.adjustQuickOpen();
        if (this.config.CTRL_WHEEL_TO_SCROLL) {
            this.handleWheel();
        }
        if (this.config.MIDDLE_CLICK_TO_CLOSE) {
            this.handleMiddleClick();
        }
        if (this.config.INTERCEPT_INTERNAL_AND_LOCAL_LINKS) {
            this.interceptLink();
        }
        if (this.config.CONTEXT_MENU) {
            this.handleContextMenu();
        }
    }

    handleLifeCycle = () => {
        this.utils.addEventListener(this.utils.eventType.fileOpened, this.openTab);
        this.utils.addEventListener(this.utils.eventType.firstFileInit, this.openTab);
        this.utils.addEventListener(this.utils.eventType.toggleSettingPage, this.showTabsIfNeed);
        const isHeaderReady = () => this.utils.isBetaVersion ? document.querySelector("header").getBoundingClientRect().height : true
        const adjustTop = () => {
            setTimeout(() => {
                if (this.config.CHANGE_NOTIFICATION_Z_INDEX) {
                    const container = document.querySelector(".md-notification-container");
                    if (container) {
                        container.style.zIndex = "99999";
                    }
                }
                const windowTab = document.querySelector("#plugin-window-tab");
                if (!this.config.HIDE_WINDOW_TITLE_BAR) {
                    const {height, top} = document.querySelector("header").getBoundingClientRect();
                    windowTab.style.top = height + top + "px";
                }
                if (this.config.CHANGE_CONTENT_TOP) {
                    const {height, top} = windowTab.getBoundingClientRect();
                    this.entities.content.style.top = top + height + "px";
                    document.querySelector("#typora-source").style.top = top + height + "px";
                }
            }, 200)
        }
        this.utils.loopDetector(isHeaderReady, adjustTop, this.loopDetectInterval, 1000);
    }

    handleClick = () => {
        this.entities.tabBar.addEventListener("click", ev => {
            const closeButton = ev.target.closest(".close-button");
            const tabContainer = ev.target.closest(".tab-container");
            if (!closeButton && !tabContainer) return;
            ev.stopPropagation();
            ev.preventDefault();
            const tab = closeButton ? closeButton.closest(".tab-container") : tabContainer;
            const idx = parseInt(tab.getAttribute("idx"));
            if (this.config.CTRL_CLICK_TO_NEW_WINDOW && this.utils.metaKeyPressed(ev)) {
                this.openFileNewWindow(this.tabUtil.tabs[idx].path, false);
            } else if (closeButton) {
                this.closeTab(idx);
            } else {
                this.switchTab(idx);
            }
        })
    }

    handleScroll = () => {
        this.entities.content.addEventListener("scroll", () => {
            const activeTab = this.tabUtil.tabs[this.tabUtil.activeIdx];
            if (activeTab) {
                activeTab.scrollTop = this.entities.content.scrollTop;
            }
        })
    }

    handleDrag = () => {
        if (this.config.DRAG_STYLE === 1) {
            this.sortIDEA();
        } else {
            this.sortVscode();
        }
    }

    adjustQuickOpen = () => {
        document.querySelector(".typora-quick-open-list").addEventListener("mousedown", ev => {
            const target = ev.target.closest(".typora-quick-open-item");
            if (!target) return;

            // 将原先的click行为改成ctrl+click
            if (this.utils.metaKeyPressed(ev)) return;

            ev.preventDefault();
            ev.stopPropagation();
            const filePath = target.getAttribute("data-path");
            this.openFile(filePath);
        }, true)
    }

    handleWheel = () => {
        this.entities.tabBar.addEventListener("wheel", ev => {
            const target = ev.target.closest("#plugin-window-tab .tab-bar");
            if (!target) return;
            if (this.utils.metaKeyPressed(ev)) {
                (ev.deltaY < 0) ? this.previousTab() : this.nextTab();
            } else {
                target.scrollLeft += ev.deltaY * 0.5;
            }
        })
    }

    handleMiddleClick = () => {
        this.entities.tabBar.addEventListener("mousedown", ev => {
            if (ev.button === 1) {
                const tabContainer = ev.target.closest(".tab-container");
                tabContainer && tabContainer.querySelector(".close-button").click();
            }
        })
    }

    interceptLink = () => {
        const _linkUtils = {file: "", anchor: ""};
        this.utils.addEventListener(this.utils.eventType.fileContentLoaded, () => {
            const {file, anchor} = _linkUtils;
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
                this.openFile(filePath);
                return this.utils.stopCallError
            }
        )
    }

    handleContextMenu = () => {
        let idx = -1;
        const map = {
            closeTab: "关闭标签",
            closeOtherTabs: "关闭其他标签",
            closeLeftTabs: "关闭左侧全部标签",
            closeRightTabs: "关闭右侧全部标签",
            copyPath: "复制文件路径",
            showInFinder: "打开文件位置",
            openInNewWindow: "新窗口打开",
            sortTabs: "排序标签",
            toggleSuffix: "显示/隐藏文件名后缀",
        }
        const name = "window-tab";
        const showMenu = ({target}) => {
            idx = parseInt(target.getAttribute("idx"));
            return this.config.CONTEXT_MENU.map(ele => map[ele]).filter(Boolean)
        }
        const callback = ({text}) => {
            if (idx === -1) return;
            const [func, _] = Object.entries(map).find(([_, name]) => name === text);
            func && this[func] && this[func](idx);
        }
        this.utils.registerMenu(name, "#plugin-window-tab .tab-container", showMenu, callback);
    }

    showTabsIfNeed = hide => document.querySelector("#plugin-window-tab").style.visibility = hide ? "hidden" : "initial";

    // 新窗口打开
    openFileNewWindow = (path, isFolder) => File.editor.library.openFileInNewWindow(path, isFolder)
    // 新标签页打开
    openFile = filePath => File.editor.library.openFile(filePath);
    // 当前标签页打开
    OpenFileLocal = filePath => {
        this.config.LOCAL_OPEN = true;
        this.utils.openFile(filePath);
        this.config.LOCAL_OPEN = false;  // 自动还原
    }

    setShowName = () => {
        this.tabUtil.tabs.forEach(tab => tab.showName = this.utils.getFileName(tab.path, this.config.REMOVE_FILE_SUFFIX));
        if (this.config.SHOW_DIR_FOR_SAME_NAME_FILE) {
            this.addDir();
        }
    }

    addDir = () => {
        const map = new Map();
        let unique = true;

        this.tabUtil.tabs.forEach(tab => {
            const tabs = map.get(tab.showName);
            if (!tabs) {
                map.set(tab.showName, [tab]);
            } else {
                unique = false;
                tabs.push(tab);
            }
        });
        if (unique) return;

        const isUnique = tabs => new Set(tabs.map(tab => tab.showName)).size === tabs.length

        for (const group of map.values()) {
            if (group.length === 1) continue;
            const parts = group.map(tab => tab.path.split(this.utils.separator).slice(0, -1));
            // 每次执行do逻辑都会给group下每个tab的showName都加一层父目录
            do {
                for (let i = 0; i < group.length; i++) {
                    const tab = group[i];
                    const dir = parts[i].pop();
                    if (!dir) return;  // 文件系统决定了此分支不可能执行，不过还是防一手
                    tab.showName = dir + this.utils.separator + tab.showName;
                }
            } while (!isUnique(group))
        }
    }

    insertTabDiv = (filePath, showName, idx) => {
        const title = this.config.SHOW_FULL_PATH_WHEN_HOVER ? `title="${filePath}"` : "";
        const btn = this.config.SHOW_TAB_CLOSE_BUTTON ? `<span class="close-button"><div class="close-icon"></div></span>` : "";
        const tabDiv = `
                <div class="tab-container" idx="${idx}" draggable="true" ${title}>
                    <div class="active-indicator"></div><span class="name">${showName}</span>${btn}
                </div>`
        this.entities.tabBar.insertAdjacentHTML('beforeend', tabDiv);
    }

    updateTabDiv = (tabDiv, filePath, showName, idx) => {
        tabDiv.setAttribute("idx", idx + "");
        tabDiv.querySelector(".name").innerText = showName;
        if (this.config.SHOW_FULL_PATH_WHEN_HOVER) {
            tabDiv.setAttribute("title", filePath);
        }
    }

    // tabs->DOM的简易数据单向绑定
    renderDOM = wantOpenPath => {
        this.setShowName();

        let tabDiv = this.entities.tabBar.firstElementChild;
        this.tabUtil.tabs.forEach((tab, idx) => {
            if (!tabDiv) {
                this.insertTabDiv(tab.path, tab.showName, idx);
                tabDiv = this.entities.tabBar.lastElementChild;
            } else {
                this.updateTabDiv(tabDiv, tab.path, tab.showName, idx);
            }

            const active = tab.path === wantOpenPath;
            tabDiv.classList.toggle("active", active);
            if (active) {
                tabDiv.scrollIntoView();
                this.scrollContent(tab);
            }

            tabDiv = tabDiv.nextElementSibling;
        })

        while (tabDiv) {
            const next = tabDiv.nextElementSibling;
            tabDiv.parentElement.removeChild(tabDiv);
            tabDiv = next;
        }
    }

    // openFile是一个延迟操作，需要等待content加载好，才能定位scrollTop
    // 问题是我压根不知道content什么时候加载好
    // 解决方法: 轮询设置scrollTop，当连续3次scrollTop不再改变，就判断content加载好了
    // 这种方法很不环保，很ugly。但是我确实也想不到在不修改frame.js的前提下该怎么做了
    scrollContent = activeTab => {
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
                this.utils.publishEvent(this.utils.eventType.fileContentLoaded, filePath);
            }
        }, this.loopDetectInterval);
    }

    openTab = wantOpenPath => {
        const pathIdx = this.tabUtil.tabs.findIndex(tab => tab.path === wantOpenPath);
        // 原地打开并且不存在tab时，修改当前tab的文件路径
        if (this.config.LOCAL_OPEN && pathIdx === -1) {
            this.tabUtil.tabs[this.tabUtil.activeIdx].path = wantOpenPath;
        } else if (pathIdx === -1) {
            const newTab = {path: wantOpenPath, scrollTop: 0};
            if (this.config.NEW_TAB_AT === "end") {
                this.tabUtil.tabs.push(newTab);
                this.tabUtil.activeIdx = this.tabUtil.tabs.length - 1;
            } else if (this.config.NEW_TAB_AT === "right") {
                this.tabUtil.tabs.splice(this.tabUtil.activeIdx + 1, 0, newTab);
                this.tabUtil.activeIdx++;
            }
        } else if (pathIdx !== -1) {
            this.tabUtil.activeIdx = pathIdx;
        }
        if (0 < this.config.TAB_MAX_NUM && this.config.TAB_MAX_NUM < this.tabUtil.tabs.length) {
            this.tabUtil.tabs = this.tabUtil.tabs.slice(-this.config.TAB_MAX_NUM);
        }
        this.renderDOM(wantOpenPath);
    }

    switchTab = idx => {
        idx = Math.max(0, idx);
        idx = Math.min(idx, this.tabUtil.tabs.length - 1);
        this.tabUtil.activeIdx = idx;
        this.openFile(this.tabUtil.tabs[this.tabUtil.activeIdx].path);
    }

    switchTabByPath = path => {
        for (let idx = 0; idx < this.tabUtil.tabs.length; idx++) {
            if (this.tabUtil.tabs[idx].path === path) {
                this.switchTab(idx);
                return
            }
        }
    }

    previousTab = () => {
        const idx = (this.tabUtil.activeIdx === 0) ? this.tabUtil.tabs.length - 1 : this.tabUtil.activeIdx - 1;
        this.switchTab(idx);
    }

    nextTab = () => {
        const idx = (this.tabUtil.activeIdx === this.tabUtil.tabs.length - 1) ? 0 : this.tabUtil.activeIdx + 1;
        this.switchTab(idx);
    }

    closeTab = idx => {
        const tabUtil = this.tabUtil;

        if (tabUtil.tabs.length === 1) {
            if (this.config.RECONFIRM_WHEN_CLOSE_LAST_TAB) {
                const modal = {title: "退出 Typora", components: [{label: "是否退出？", type: "p"}]};
                this.utils.modal(modal, this.utils.exitTypora);
            } else {
                this.utils.exitTypora();
            }
            return;
        }

        tabUtil.tabs.splice(idx, 1);
        if (tabUtil.activeIdx !== 0) {
            const isLeft = this.config.ACTIVETE_TAB_WHEN_CLOSE === "left";
            if (idx < tabUtil.activeIdx || (idx === tabUtil.activeIdx && isLeft)) {
                tabUtil.activeIdx--;
            } else {
                tabUtil.activeIdx = Math.min(tabUtil.activeIdx, tabUtil.tabs.length - 1);
            }
        }
        this.switchTab(tabUtil.activeIdx);
    }

    closeActiveTab = () => this.closeTab(this.tabUtil.activeIdx);

    closeOtherTabs = idx => {
        this.tabUtil.tabs = [this.tabUtil.tabs[idx]];
        this.switchTab(0);
    }

    closeLeftTabs = idx => {
        const originFile = this.tabUtil.tabs[this.tabUtil.activeIdx].path;
        this.tabUtil.tabs = this.tabUtil.tabs.slice(idx);
        if (this.tabUtil.activeIdx < idx) {
            this.switchTab(0);
        } else {
            this.switchTabByPath(originFile);
        }
    }

    closeRightTabs = idx => {
        const originFile = this.tabUtil.tabs[this.tabUtil.activeIdx].path;
        this.tabUtil.tabs = this.tabUtil.tabs.slice(0, idx + 1);
        if (this.tabUtil.activeIdx > idx) {
            this.switchTab(this.tabUtil.tabs.length - 1);
        } else {
            this.switchTabByPath(originFile);
        }
    }

    sortTabs = () => {
        if (this.tabUtil.tabs.length === 1) return;
        const current = this.tabUtil.tabs[this.tabUtil.activeIdx];
        this.tabUtil.tabs.sort(({showName: n1}, {showName: n2}) => n1.localeCompare(n2));
        this.switchTab(this.tabUtil.tabs.indexOf(current));
    }

    copyPath = idx => navigator.clipboard.writeText(this.tabUtil.tabs[idx].path)
    copyActiveTabPath = () => this.copyPath(this.tabUtil.activeIdx)

    toggleSuffix = () => {
        this.config.REMOVE_FILE_SUFFIX = !this.config.REMOVE_FILE_SUFFIX;
        this.switchTab(this.tabUtil.activeIdx);
    }

    showInFinder = idx => this.utils.showInFinder(this.tabUtil.tabs[idx].path);

    openInNewWindow = idx => this.openFileNewWindow(this.tabUtil.tabs[idx].path, false)

    newWindowIfNeed = (offsetY, tab) => {
        if (this.config.HEIGHT_SCALE < 0) return;
        offsetY = Math.abs(offsetY);
        const {height} = this.entities.tabBar.getBoundingClientRect();
        if (offsetY > height * this.config.HEIGHT_SCALE) {
            const idx = parseInt(tab.getAttribute("idx"));
            const _path = this.tabUtil.tabs[idx].path;
            this.openFileNewWindow(_path, false);
        }
    }

    sortIDEA = () => {
        const that = this;

        const resetTabBar = () => {
            const tabs = document.querySelectorAll("#plugin-window-tab .tab-container");
            const activeIdx = parseInt(that.entities.tabBar.querySelector(".tab-container.active").getAttribute("idx"));
            const activePath = that.tabUtil.tabs[activeIdx].path;
            that.tabUtil.tabs = Array.from(tabs, tab => that.tabUtil.tabs[parseInt(tab.getAttribute("idx"))]);
            that.openTab(activePath);
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
            let {left, top, height} = dragBox.getBoundingClientRect();
            startX = ev.clientX;
            startY = ev.clientY;
            offsetX = startX - left;
            offsetY = startY - top;
            dragROI = height / 2;

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
            that.newWindowIfNeed(ev.offsetY, this);

            if (!cloneObj) return;
            const {left, top} = this.getBoundingClientRect();
            const reset = cloneObj.animate(
                [{transform: cloneObj.style.transform}, {transform: `translate3d(${left}px, ${top}px, 0)`}],
                {duration: 70, easing: "ease-in-out"}
            )

            reset.onfinish = function () {
                that.entities.tabBar.removeChild(cloneObj);
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

    sortVscode = () => {
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
            this.style.opacity = "";
            that.newWindowIfNeed(ev.offsetY, this);
            if (lastOver) {
                lastOver.classList.remove("over");
                const activeIdx = parseInt(that.entities.tabBar.querySelector(".tab-container.active").getAttribute("idx"));
                const activePath = that.tabUtil.tabs[activeIdx].path;
                const toIdx = parseInt(lastOver.getAttribute("idx"));
                const fromIdx = parseInt(this.getAttribute("idx"));
                const ele = that.tabUtil.tabs.splice(fromIdx, 1)[0];
                that.tabUtil.tabs.splice(toIdx, 0, ele);
                that.openTab(activePath);
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

    getTabFile = () => this.utils.joinPath("./plugin/window_tab/save_tabs.json");

    exitTabFile = () => {
        const filepath = this.getTabFile();
        return this.utils.existPathSync(filepath)
    }

    saveTabs = filepath => {
        const dataset = this.tabUtil.tabs.map((tab, idx) => ({
            idx: idx,
            path: tab.path,
            active: idx === this.tabUtil.activeIdx,
            scrollTop: tab.scrollTop,
        }))
        filepath = filepath || this.getTabFile();
        const str = JSON.stringify({"save_tabs": dataset}, null, "\t");
        this.utils.Package.Fs.writeFileSync(filepath, str);
    }

    openSaveTabs = filepath => {
        filepath = filepath || this.getTabFile();
        this.utils.Package.Fs.readFile(filepath, 'utf8', (error, data) => {
            if (error) {
                window.alert(error);
                return;
            }
            const dataset = JSON.parse(data);
            const tabs = dataset["save_tabs"];

            let activePath;
            tabs.forEach(tab => {
                const existTab = this.tabUtil.tabs.filter(t => t.path === tab.path)[0];
                if (!existTab) {
                    this.tabUtil.tabs.push({path: tab.path, scrollTop: tab.scrollTop});
                } else {
                    existTab.scrollTop = tab.scrollTop;
                }

                if (tab.active) {
                    activePath = tab.path;
                }
            })
            if (activePath) {
                this.switchTabByPath(activePath);
            } else if (this.tabUtil.tabs.length) {
                this.switchTab(this.tabUtil.activeIdx);
            }
        })
    }

    dynamicCallArgsGenerator = () => {
        let args = [];
        if (!this.exitTabFile()) {
            args.push({arg_name: "保存所有的标签页", arg_value: "save_tabs"});
        } else {
            args.push({arg_name: "覆盖保存的标签页", arg_value: "save_tabs"});
            args.push({arg_name: "打开保存的标签页", arg_value: "open_save_tabs"});
        }
        if (this.config.LOCAL_OPEN) {
            args.push({arg_name: "在新标签打开文件", arg_value: "new_tab_open"});
            // 空白标签不允许当前标签打开
        } else if (this.utils.getFilePath()) {
            args.push({arg_name: "在当前标签打开文件", arg_value: "local_open"});
        }
        if (this.tabUtil.tabs.length > 1) {
            args.push({arg_name: "排序标签", arg_value: "sort_tabs"});
        }
        return args
    }

    call = type => {
        const callMap = {
            new_tab_open: () => this.config.LOCAL_OPEN = false,
            local_open: () => this.config.LOCAL_OPEN = true,
            save_tabs: this.saveTabs,
            open_save_tabs: this.openSaveTabs,
            sort_tabs: this.sortTabs,
        }
        const func = callMap[type];
        func && func();
    }
}

module.exports = {
    plugin: windowTabBarPlugin
};
