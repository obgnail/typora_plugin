class windowTabBarPlugin extends global._basePlugin {
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
    ]

    init = () => {
        this.entities = {
            content: document.querySelector("content"),
            tabBar: document.querySelector("#plugin-window-tab .tab-bar"),
        }
        this.tabUtil = {tabs: [], activeIdx: 0,}
        this.loopDetectInterval = 35;
        this.callMap = {
            new_tab_open: () => this.config.LOCAL_OPEN = false,
            local_open: () => this.config.LOCAL_OPEN = true,
            save_tabs: this.saveTabs,
            open_save_tabs: this.openSaveTabs,
        }
    }

    process = () => {
        this.init();

        this.utils.addEventListener(this.utils.eventType.fileOpened, this.openTab);
        this.utils.addEventListener(this.utils.eventType.firstFileInit, this.openTab);
        // 打开配置页面的时候自动隐藏
        this.utils.addEventListener(this.utils.eventType.toggleSettingPage, this.showTabsIfNeed);

        this.utils.loopDetector(
            () => (this.utils.isBetaVersion) ? document.querySelector("header").getBoundingClientRect().height : true,
            this.adjustTop,
            this.loopDetectInterval,
            1000
        )

        if (this.config.DRAG_STYLE === 1) {
            this.sort1();
        } else {
            this.sort2();
        }

        this.entities.tabBar.addEventListener("click", ev => {
            const closeButton = ev.target.closest(".close-button");
            const tabContainer = ev.target.closest(".tab-container");
            if (!closeButton && !tabContainer) return;

            ev.stopPropagation();
            ev.preventDefault();

            const tab = closeButton ? closeButton.closest(".tab-container") : tabContainer;
            const idx = parseInt(tab.getAttribute("idx"));

            if (this.utils.metaKeyPressed(ev)) {
                this.openFileNewWindow(this.tabUtil.tabs[idx].path, false);
            } else if (closeButton) {
                this.closeTab(idx);
            } else {
                this.switchTab(idx);
            }
        })

        if (this.config.CTRL_WHEEL_TO_SCROLL) {
            this.entities.tabBar.addEventListener("wheel", ev => {
                const target = ev.target.closest("#plugin-window-tab .tab-bar");
                if (!target) return;

                if (this.utils.metaKeyPressed(ev)) {
                    (ev.deltaY < 0) ? this.previousTab() : this.nextTab();
                } else {
                    target.scrollLeft += ev.deltaY;
                }
            })
        }

        this.entities.content.addEventListener("scroll", () => {
            if (this.tabUtil.tabs[this.tabUtil.activeIdx]) {
                this.tabUtil.tabs[this.tabUtil.activeIdx].scrollTop = this.entities.content.scrollTop;
            }
        })

        if (this.config.INTERCEPT_INTERNAL_AND_LOCAL_LINKS) {
            this.utils.decorate(
                () => (JSBridge && JSBridge.invoke),
                "JSBridge.invoke",
                (...args) => {
                    if (args.length < 3 || args[0] !== "app.openFileOrFolder") return;

                    const anchor = args[2]["anchor"];
                    if (!anchor || typeof anchor !== "string" || !anchor.match(/^#/)) return;

                    const filePath = args[1];
                    this.openFile(filePath);
                    setTimeout(() => {
                        const ele = File.editor.EditHelper.findAnchorElem(anchor);
                        if (ele) {
                            File.editor.selection.jumpIntoElemBegin(ele);
                            File.editor.selection.scrollAdjust(ele, 10);
                        }
                    }, 1000)
                    return this.utils.stopCallError
                }
            )
        }

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

    adjustTop = () => {
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
                document.querySelector("content").style.top = top + height + "px";
                document.querySelector("#typora-source").style.top = top + height + "px";
            }
        }, 200)
    }

    showTabsIfNeed = hide => document.querySelector("#plugin-window-tab").style.display = (hide) ? "none" : "";

    // 新窗口打开
    openFileNewWindow = (path, isFolder) => File.editor.library.openFileInNewWindow(path, isFolder)
    // 新标签页打开
    openFile = filePath => File.editor.library.openFile(filePath);
    // 当前标签页打开
    OpenFileLocal = filePath => {
        this.config.LOCAL_OPEN = true;
        File.editor.library.openFile(filePath);
        this.config.LOCAL_OPEN = false;  // 自动还原
    }
    // 关闭窗口
    closeWindow = () => JSBridge.invoke("window.close");

    insertTabDiv = (filePath, idx) => {
        const fileName = this.utils.getFileName(filePath);
        const tabDiv = `
                <div class="tab-container" idx="${idx}" draggable="true" title="${filePath}">
                    <div class="active-indicator"></div><span class="name">${fileName}</span>
                    <span class="close-button"><div class="close-icon"></div></span>
                </div>`
        this.entities.tabBar.insertAdjacentHTML('beforeend', tabDiv);
    }

    updateTabDiv = (tabDiv, filePath, idx) => {
        tabDiv.setAttribute("idx", idx + "");
        tabDiv.querySelector(".name").innerText = this.utils.getFileName(filePath);
        tabDiv.setAttribute("title", filePath);
    }

    // tabs->DOM的简易数据单向绑定
    renderDOM = wantOpenPath => {
        let tabDiv = this.entities.tabBar.firstElementChild;
        this.tabUtil.tabs.forEach((tab, idx) => {
            if (!tabDiv) {
                this.insertTabDiv(tab.path, idx);
                tabDiv = this.entities.tabBar.lastElementChild;
            } else {
                this.updateTabDiv(tabDiv, tab.path, idx);
            }

            if (tab.path === wantOpenPath) {
                tabDiv.classList.add("active");
                tabDiv.scrollIntoViewIfNeeded();
                this.scrollContent(tab);
            } else {
                tabDiv.classList.remove("active");
            }

            tabDiv = tabDiv.nextElementSibling;
        })

        while (tabDiv) {
            tabDiv.parentElement.removeChild(tabDiv);
            tabDiv = tabDiv.nextElementSibling;
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
        const scrollTop = activeTab.scrollTop;
        const _timer = setInterval(() => {
            const filePath = this.utils.getFilePath();
            if (filePath === activeTab.path && this.entities.content.scrollTop !== scrollTop) {
                this.entities.content.scrollTop = scrollTop;
                count = 0;
            } else {
                count++;
            }
            if (count === stopCount) {
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
            this.tabUtil.tabs.push({path: wantOpenPath, scrollTop: 0});
            this.tabUtil.activeIdx = this.tabUtil.tabs.length - 1;
        } else if (pathIdx !== -1) {
            this.tabUtil.activeIdx = pathIdx;
        }
        this.renderDOM(wantOpenPath);
    }

    switchTab = idx => {
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
        this.tabUtil.tabs.splice(idx, 1);
        if (this.tabUtil.tabs.length === 0) {
            this.closeWindow();
            return
        }
        if (this.tabUtil.activeIdx !== 0 && idx <= this.tabUtil.activeIdx) {
            this.tabUtil.activeIdx--;
        }
        this.switchTab(this.tabUtil.activeIdx);
    }

    closeActiveTab = () => this.closeTab(this.tabUtil.activeIdx);

    newWindowIfNeed = (offsetY, tab) => {
        offsetY = Math.abs(offsetY);
        const height = this.entities.tabBar.getBoundingClientRect().height;
        if (offsetY > height * this.config.HEIGHT_SCALE) {
            const idx = parseInt(tab.getAttribute("idx"));
            const _path = this.tabUtil.tabs[idx].path;
            this.openFileNewWindow(_path, false);
        }
    }

    sort1 = () => {
        const that = this;

        const resetTabBar = () => {
            const tabs = document.querySelectorAll("#plugin-window-tab .tab-container");
            const activeIdx = parseInt(that.entities.tabBar.querySelector(".tab-container.active").getAttribute("idx"));
            const activePath = that.tabUtil.tabs[activeIdx].path;
            const newTabList = []
            tabs.forEach(tab => {
                const idx = parseInt(tab.getAttribute("idx"));
                newTabList.push(that.tabUtil.tabs[idx]);
            })
            that.tabUtil.tabs = newTabList;
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
            if (!currentDragItem) return;
            this[ev.offsetX > _offsetX ? 'after' : 'before'](currentDragItem);
        }).on("dragenter", function () {
            return false
        })

        let cloneObj = null;
        let offsetX = 0;
        let offsetY = 0;
        let startX = 0;
        let startY = 0;
        let dragBox = null;
        let axis, _axis;

        tabBar.on("dragstart", ".tab-container", function (ev) {
            dragBox = this;
            dragBox.dragData = {};
            axis = dragBox.getAttribute('axis');
            _axis = axis;
            ev.originalEvent.dataTransfer.effectAllowed = "move";
            ev.originalEvent.dataTransfer.dropEffect = 'move';
            let rect = dragBox.getBoundingClientRect();
            let left = rect.left;
            let top = rect.top;
            startX = ev.clientX;
            startY = ev.clientY;
            offsetX = startX - left;
            offsetY = startY - top;
            dragBox.style.transition = 'none';

            const fakeObj = dragBox.cloneNode(true);
            fakeObj.style.width = dragBox.offsetWidth + 'px';
            fakeObj.style.height = dragBox.offsetHeight + 'px';
            fakeObj.style.transform = 'translate3d(0,0,0)';
            fakeObj.setAttribute('dragging', '');
            cloneObj = document.createElement('DIV');
            cloneObj.appendChild(fakeObj);
            cloneObj.className = 'drag-obj';
            cloneObj.style.transform = `translate3d(${left}px, ${top}px, 0)`;
            document.querySelector("content").appendChild(cloneObj);
        }).on("dragend", ".tab-container", function (ev) {
            that.newWindowIfNeed(ev.offsetY, this);

            if (!cloneObj) return;
            const rect = this.getBoundingClientRect();
            const reset = cloneObj.animate(
                [
                    {transform: cloneObj.style.transform},
                    {transform: `translate3d(${rect.left}px, ${rect.top}px, 0)`}
                ],
                {
                    duration: 150,
                    easing: "ease-in-out",
                }
            )

            reset.onfinish = function () {
                document.querySelector("content").removeChild(cloneObj);
                cloneObj = null;
                dragBox.dragData = null;
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
            let left = ~~(ev.clientX - offsetX);
            let top = ~~(ev.clientY - offsetY);
            if (ev.shiftKey || axis) {
                if (_axis === 'X') {
                    top = ~~(startY - offsetY);
                } else if (_axis === 'Y') {
                    left = ~~(startX - offsetX);
                } else {
                    _axis = (
                        ~~Math.abs(ev.clientX - startX) > ~~Math.abs(ev.clientY - startY) && 'X'
                        || ~~Math.abs(ev.clientX - startX) < ~~Math.abs(ev.clientY - startY) && 'Y'
                        || ''
                    )
                }
            } else {
                _axis = '';
            }
            startX = left + offsetX;
            startY = top + offsetY;

            cloneObj.style.transform = `translate3d(${left}px, ${top}px, 0)`;
            dragBox.dragData.left = left;
            dragBox.dragData.top = top;
        })
    }

    sort2 = () => {
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
        return this.utils.existPath(filepath)
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
            } else {
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
        return args
    }

    call = type => {
        const func = this.callMap[type];
        func && func();
    }
}

module.exports = {
    plugin: windowTabBarPlugin
};

