class TabManager {
  _tabs = []
  _activeIdx = 0
  _inPlace = false

  constructor(context) {
    this.utils = context.utils
    this.i18n = context.i18n
    this.config = context.config
    this.hooks = {
      onRender: context.onRender,
      onEmpty: context.onEmpty,
      onExit: context.onExit,
    }
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

  get inPlace() {
    return this._inPlace
  }

  toggleInPlace() {
    this._inPlace = !this._inPlace
  }

  setInPlace(inPlace) {
    this._inPlace = inPlace
  }

  getByIdx(idx) {
    return this._tabs[idx]
  }

  getByPath(path) {
    return this._tabs.find(e => e.path === path)
  }

  getPathByIdx(idx) {
    return this._tabs[idx]?.path
  }

  getIdxByPath(path) {
    return this._tabs.findIndex(tab => tab.path === path)
  }

  _clamp(idx) {
    return Math.min(Math.max(0, idx), this.maxIdx)
  }

  reset(tabs = [], activeIdx = 0) {
    this._tabs = [...tabs]
    this._activeIdx = this._clamp(activeIdx)
    this._formatShowNames()
  }

  open(wantOpenPath) {
    const { NEW_TAB_POSITION, MAX_TAB_NUM } = this.config
    const isNewTab = this.getIdxByPath(wantOpenPath) === -1
    if (isNewTab) {
      if (this._inPlace && this.current) {
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

    this._activeIdx = this.getIdxByPath(wantOpenPath)
    if (this.current) {
      this.current.timestamp = Date.now()
    }
    this.refresh(wantOpenPath)
  }

  refresh(path = this.current?.path) {
    this._formatShowNames()
    this.hooks.onRender(path)
  }

  switch(idx) {
    this._activeIdx = this._clamp(idx)
    this.utils.openFile(this.current?.path, true)
  }

  switchByPath(path) {
    const idx = this.getIdxByPath(path)
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

  first() {
    this.switch(0)
  }

  last() {
    this.switch(this.maxIdx)
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
      this._activeIdx = this._clamp(this._activeIdx)
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
      this.first()
    }
  }

  closeLeft(idx) {
    const originPath = this.current?.path
    this._tabs.splice(0, idx)
    if (!originPath || this.getIdxByPath(originPath) === -1) {
      this.first()
    } else {
      this.switchByPath(originPath)
    }
  }

  closeRight(idx) {
    const originPath = this.current?.path
    this._tabs.splice(idx + 1)
    if (!originPath || this.getIdxByPath(originPath) === -1) {
      this.last()
    } else {
      this.switchByPath(originPath)
    }
  }

  sort(compareFn = (a, b) => (a.showName || "").localeCompare(b.showName || "")) {
    if (this.count <= 1) return
    this._formatShowNames()
    const cur = this.current
    this._tabs.sort(compareFn)
    if (cur) this.switch(this._tabs.indexOf(cur))
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
    this._activeIdx = this._clamp(this._activeIdx)

    if (this.count === 0) {
      await this.hooks.onEmpty()
    } else {
      this.switch(this._activeIdx)
    }
  }

  updateScroll(scrollTop) {
    if (this.current) this.current.scrollTop = scrollTop
  }

  rename(oldPath, newPath, isDir) {
    let isMutated = false
    if (isDir) {
      const dirPrefix = oldPath + this.utils.separator
      for (const tab of this._tabs) {
        if (tab.path === oldPath || tab.path.startsWith(dirPrefix)) {
          tab.path = newPath + tab.path.slice(oldPath.length)
          isMutated = true
        }
      }
    } else {
      const targetTab = this.getByPath(oldPath)
      if (targetTab) {
        targetTab.path = newPath
        isMutated = true
      }
    }
    if (isMutated) {
      this.refresh()
    }
  }

  restoreSession(saveTabs, mountFolder, currentMountFolder, matchMountFolder = false) {
    if (!saveTabs || saveTabs.length === 0) return
    if (matchMountFolder && mountFolder !== currentMountFolder) return

    const activePath = saveTabs.find(tab => tab.active)?.path
    this._tabs = saveTabs.map(({ path, scrollTop }) => ({ path, scrollTop: scrollTop || 0 }))

    this._formatShowNames()

    if (activePath) {
      this.switchByPath(activePath)
    } else if (this.count) {
      this.switch(this._activeIdx)
    }
  }

  exportSession() {
    return this._tabs.map((tab, idx) => ({
      idx,
      path: tab.path,
      scrollTop: tab.scrollTop || 0,
      active: idx === this._activeIdx,
    }))
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

class TabMonitor {
  timer = null
  isRunning = false

  constructor(tabManager, intervalFn) {
    this.tab = tabManager
    this.intervalFn = intervalFn
    this._bindEvents()
  }

  _bindEvents() {
    window.addEventListener("focus", async () => {
      if (this.tab.count > 0) {
        await this.tab.checkExist()
        if (document.hasFocus()) this.start()
      }
    })
    window.addEventListener("blur", () => this.pause())
  }

  start() {
    if (this.isRunning) return
    this.isRunning = true
    this._scheduleNext()
  }

  pause() {
    this.isRunning = false
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  async _scheduleNext() {
    if (!this.isRunning || this.tab.count === 0) {
      this.pause()
      return
    }
    this.timer = setTimeout(async () => {
      await this.tab.checkExist()
      this._scheduleNext()
    }, this.intervalFn(this.tab.count))
  }
}

class ScrollSynchronizer {
  observer = null
  fallbackTimer = null

  constructor(utils) {
    this.utils = utils
  }

  restore(filepath, targetScrollTop, contentEl) {
    if (this.observer) {
      this.observer.disconnect()
      clearTimeout(this.fallbackTimer)
    }

    const finalizeScroll = () => {
      if (this.observer) {
        this.observer.disconnect()
        this.observer = null
      }
      if (this.utils.getFilePath() === filepath) {
        contentEl.scrollTop = targetScrollTop
      }
    }

    this.fallbackTimer = setTimeout(finalizeScroll, 2000)
    const debouncedFinalize = this.utils.debounce(() => {
      clearTimeout(this.fallbackTimer)
      finalizeScroll()
    }, 100)

    this.observer = new ResizeObserver(() => {
      if (this.utils.getFilePath() !== filepath) {
        this.observer.disconnect()
        return
      }
      debouncedFinalize()
    })
    this.observer.observe(contentEl.firstElementChild || contentEl)
  }
}

class TabDragManager {
  constructor(plugin) {
    this.plugin = plugin
    this.tab = plugin.tab
    this.config = plugin.config
    this.utils = plugin.utils
    this.entities = plugin.entities
  }

  init() {
    if (this.config.DRAG_STYLE === "JetBrains") {
      this._sortJetBrains()
    } else {
      this._sortVscode()
    }
  }

  _newWindowIfNeed(offsetY, el) {
    if (this.config.TAB_DETACHMENT === "lockVertical" || this.config.DRAG_NEW_WINDOW_THRESHOLD <= 0) return
    offsetY = Math.abs(offsetY)
    const { height } = this.entities.tabBar.getBoundingClientRect()
    if (offsetY > height * this.config.DRAG_NEW_WINDOW_THRESHOLD) {
      this.plugin.openInNewWindow(parseInt(el.dataset.idx))
    }
  }

  _sortJetBrains() {
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

    $("#plugin-window-tab .tab-wrapper").on("dragstart", ".tab-container", function (ev) {
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
      self._newWindowIfNeed(ev.offsetY, this)
      if (!cloned) {
        dragged = null
        return
      }
      const { left, top } = this.getBoundingClientRect()
      const resetAnimation = cloned.animate(
        [{ transform: cloned.style.transform }, { transform: `translate3d(${left}px, ${top}px, 0)` }],
        { duration: 70, easing: "ease-in-out" },
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

  _sortVscode() {
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

    $("#plugin-window-tab .tab-wrapper").on("dragstart", ".tab-container", function (ev) {
      ev.originalEvent.dataTransfer.effectAllowed = "move"
      ev.originalEvent.dataTransfer.dropEffect = "move"
      this.style.opacity = 0.5
      lastOver = null
    }).on("dragend", ".tab-container", function (ev) {
      this.style.opacity = ""
      self._newWindowIfNeed(ev.offsetY, this)
      if (lastOver) {
        lastOver.classList.remove("over")
        const toIdx = parseInt(lastOver.dataset.idx)
        const fromIdx = parseInt(this.dataset.idx)
        self.tab.move(fromIdx, toIdx)
        self.tab.refresh()
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
}

class WindowTabPlugin extends BasePlugin {
  renderRafManager = this.utils.getRafManager()
  manualSaveStorage = this.utils.getStorage(`${this.fixedName}.manual`)
  autoSaveStorage = this.utils.getStorage(`${this.fixedName}.auto`)
  staticActions = this.i18n.fillActions([
    { act_value: "sort_tabs", act_hotkey: this.config.SORT_TABS_HOTKEY, act_name: this.i18n.t("$label.SORT_TABS_HOTKEY") },
    { act_value: "save_tabs", act_hotkey: this.config.SAVE_TABS_HOTKEY, act_name: this.i18n.t("$label.SAVE_TABS_HOTKEY") },
  ])
  tab = new TabManager({
    utils: this.utils,
    i18n: this.i18n,
    config: this.config,
    onRender: (wantOpenPath) => {
      this.renderRafManager.schedule(() => {
        this._showTabBar()
        this.monitor.start()
        this._renderTabs(wantOpenPath)
      })
    },
    onEmpty: async () => {
      this._hideTabBar()
      this.monitor.pause()
      this.tab.reset()
      File.bundle = {
        filePath: "", originalPath: null, untitledId: +new Date,
        fileName: null, fileEncode: null, removed: false,
        useCRLF: File.useCRLF || false, unsupported: "",
        hasModified: false, modifiedDate: null, lastSnapDate: null,
        savedContent: null, isLocked: false, oversize: false,
        fileMissingWhenOpen: false, bundleFile: null, zip: null,
      }
      await this.utils.reload()
      document.getElementById("title-text").textContent = "Typora"
      document.querySelector(".file-library-node.active")?.classList.remove("active")
    },
    onExit: () => this.utils.exitTypora(),
  })
  monitor = new TabMonitor(this.tab, count => count > 30 ? 3000 : (count > 10 ? 2000 : 1000))
  scrollSync = new ScrollSynchronizer(this.utils)

  prepare = () => {
    if (this.utils.isBetaVersion && this.config.LAST_TAB_CLOSE_ACTION === "blankPage") {
      this.config.LAST_TAB_CLOSE_ACTION = "reconfirm"
    }
    if (window._options.framelessWindow && this.config.HIDE_WINDOW_TITLE_BAR) {
      document.querySelector("header").style.zIndex = "897"
      document.getElementById("top-titlebar").style.display = "none"
    }
  }

  style = () => true

  html = () => `<div id="plugin-window-tab"><div class="tab-bar"><div class="tab-wrapper"></div><div class="add-button"><div class="add-icon"></div></div></div></div>`

  hotkey = () => [
    { hotkey: this.config.SWITCH_NEXT_TAB_HOTKEY, callback: () => this.tab.next() },
    { hotkey: this.config.SWITCH_PREVIOUS_TAB_HOTKEY, callback: () => this.tab.previous() },
    { hotkey: this.config.SWITCH_LAST_ACTIVE_TAB_HOTKEY, callback: () => this.tab.switchToLastActive() },
    { hotkey: this.config.CLOSE_HOTKEY, callback: () => this.tab.closeActive() },
    { hotkey: this.config.COPY_PATH_HOTKEY, callback: () => this.copyPath(this.tab.activeIdx) },
    { hotkey: this.config.SORT_TABS_HOTKEY, callback: () => this.call("sort_tabs") },
    { hotkey: this.config.SAVE_TABS_HOTKEY, callback: () => this.call("save_tabs") },
    { hotkey: this.config.OPEN_SAVED_TABS_HOTKEY, callback: () => this.call("open_saved_tabs") },
    { hotkey: this.config.TOGGLE_TAB_BAR_HOTKEY, callback: () => this.call("toggle_tab_bar") },
  ]

  init = () => {
    this.entities = {
      content: this.utils.entities.eContent,
      header: document.querySelector("header"),
      source: document.querySelector("#typora-source"),
      tabBar: document.querySelector("#plugin-window-tab .tab-bar"),
      tabWrapper: document.querySelector("#plugin-window-tab .tab-wrapper"),
      newTabButton: document.querySelector("#plugin-window-tab .add-button"),
      windowTab: document.querySelector("#plugin-window-tab"),
    }
  }

  process = () => {
    this._handleLifeCycle()
    this._handleClick()
    this._handleScroll()
    this._handleDrag()
    this._handleRename()
    this._adjustQuickOpen()
    if (this.utils.compareVersion(this.utils.typoraVersion, "1.1.0") >= 0) this._interceptLink()
    if (this.config.WHEEL_TO_SCROLL_TAB_BAR) this._handleWheel()
    if (this.config.MIDDLE_CLICK_TO_CLOSE) this._handleMiddleClick()
    if (this.config.REOPEN_TABS_ON_STARTUP) this._reopenTabsWhenInit()
    if (this.config.CONTEXT_MENU.length) this._handleContextMenu()
  }

  getDynamicActions = () => this.i18n.fillActions([
    { act_value: "open_saved_tabs", act_hidden: !this.manualSaveStorage.exist(), act_hotkey: this.config.OPEN_SAVED_TABS_HOTKEY, act_name: this.i18n.t("$label.OPEN_SAVED_TABS_HOTKEY") },
    { act_value: "toggle_file_ext", act_state: this.config.TRIM_FILE_EXT, act_name: this.i18n.t("$label.TRIM_FILE_EXT") },
    { act_value: "toggle_show_dir", act_state: this.config.SHOW_DIR_ON_DUPLICATE, act_name: this.i18n.t("$label.SHOW_DIR_ON_DUPLICATE") },
    { act_value: "toggle_show_close_button", act_state: this.config.SHOW_TAB_CLOSE_BUTTON, act_name: this.i18n.t("$label.SHOW_TAB_CLOSE_BUTTON") },
    { act_value: "toggle_tab_bar", act_state: this.entities.windowTab.style.display === "none", act_hotkey: this.config.TOGGLE_TAB_BAR_HOTKEY },
    { act_value: "toggle_in_place", act_state: !this.tab.inPlace },
  ])

  call = action => {
    const toggleConfig = async (cfg) => {
      this.config[cfg] = !this.config[cfg]
      await this.utils.settings.save(this.fixedName, { [cfg]: this.config[cfg] })
      this.rerenderTabBar()
    }
    const callMap = {
      toggle_in_place: () => this.tab.toggleInPlace(),
      toggle_show_dir: () => toggleConfig("SHOW_DIR_ON_DUPLICATE"),
      toggle_file_ext: () => toggleConfig("TRIM_FILE_EXT"),
      toggle_show_close_button: () => toggleConfig("SHOW_TAB_CLOSE_BUTTON"),
      sort_tabs: () => this.tab.sort(),
      save_tabs: () => this.saveTabs(this.manualSaveStorage),
      open_saved_tabs: () => this.openSavedTabs(this.manualSaveStorage),
      toggle_tab_bar: () => this.forceToggleTabBar(),
    }
    callMap[action]?.()
  }

  _handleLifeCycle = () => {
    this._hideTabBar()
    this.utils.eventHub.on(this.utils.eventHub.eventType.fileOpened, path => this.tab.open(path))
    this.utils.eventHub.on(this.utils.eventHub.eventType.fileContentLoaded, path => {
      const active = this.tab.getByPath(path)
      if (active) this.scrollSync.restore(path, active.scrollTop, this.entities.content)
    })
    this.utils.eventHub.on(this.utils.eventHub.eventType.toggleSettingPage, hide => this.entities.windowTab.style.visibility = hide ? "hidden" : "initial")

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

  _handleClick = () => {
    this.entities.newTabButton.addEventListener("click", async ev => {
      const { canceled, filePaths } = await JSBridge.invoke("dialog.showOpenDialog", {
        properties: ["openFile"],
        filters: [{ name: "Markdown Files", extensions: ["md", "markdown", "mdown", "mkd", "mdx"] }],
      })
      if (!canceled && filePaths?.length > 0) {
        this.utils.openFile(filePaths[0], true)
      }
    })

    this.entities.tabWrapper.addEventListener("click", async ev => {
      const closeButton = ev.target.closest(".close-button")
      const tabContainer = ev.target.closest(".tab-container")
      if (!closeButton && !tabContainer) return
      const el = closeButton ? closeButton.closest(".tab-container") : tabContainer
      const idx = parseInt(el.dataset.idx)
      if (this.config.CTRL_CLICK_TO_NEW_WINDOW && this.utils.metaKeyPressed(ev)) {
        this.openInNewWindow(idx)
      } else if (closeButton) {
        this.tab.close(idx)
        this._saveOnSwitch()
      } else {
        this.tab.switch(idx)
      }
    })
  }

  _handleScroll = () => {
    this.entities.content.addEventListener("scroll", this.utils.debounce(() => this.tab.updateScroll(this.entities.content.scrollTop)), 100)
  }

  _handleDrag = () => new TabDragManager(this).init()

  _handleRename = () => {
    reqnode("electron").ipcRenderer.on("didRename", (sender, { oldPath, newPath }) => {
      try {
        const isDir = this.utils.Package.FsExtra.statSync(newPath).isDirectory()
        this.tab.rename(oldPath, newPath, isDir)
      } catch (err) {
        console.error("Rename failed to stat file", err)
      }
    })
  }

  _handleWheel = () => {
    this.entities.tabBar.addEventListener("wheel", ev => ev.currentTarget.scrollLeft += ev.deltaY * 0.5, { passive: true })
  }

  _handleMiddleClick = () => {
    this.entities.tabWrapper.addEventListener("mousedown", ev => {
      if (ev.button !== 1) return
      const idx = parseInt(ev.target.closest(".tab-container")?.dataset.idx)
      if (isNaN(idx)) return
      ev.stopPropagation()
      ev.preventDefault()
      this.tab.close(idx)
      this._saveOnSwitch()
    })
  }

  _handleContextMenu = () => {
    this.utils.contextMenu.register(this.entities.tabWrapper, ev => {
      const tabEl = ev.target.closest(".tab-container")
      if (!tabEl) return null
      const tabIdx = parseInt(tabEl.dataset.idx, 10)
      const actions = {
        closeTab: () => this.tab.close(tabIdx),
        closeOtherTabs: () => this.tab.closeOthers(tabIdx),
        closeLeftTabs: () => this.tab.closeLeft(tabIdx),
        closeRightTabs: () => this.tab.closeRight(tabIdx),
        sortTabs: () => this.tab.sort(),
        copyPath: () => this.copyPath(tabIdx),
        showInFinder: () => this.showInFinder(tabIdx),
        openInNewWindow: () => this.openInNewWindow(tabIdx),
      }
      const availableItems = this.utils.pick(this.i18n.entries(Object.keys(actions), "$option.CONTEXT_MENU."), this.config.CONTEXT_MENU)
      return Object.entries(availableItems).map(([key, label]) => ({
        label,
        action: () => {
          actions[key]?.()
          if (key.startsWith("close")) this._saveOnSwitch()
        },
      }))
    })
  }

  _adjustQuickOpen = () => {
    const openQuickTab = (item, ev) => {
      if (!item) return
      ev.preventDefault()
      ev.stopPropagation()
      const { path, isDir } = item.dataset
      if (isDir === "true") {
        this.utils.openFolder(path)
      } else {
        this.utils.openFile(path, true)
      }
      if (File.isMac && $("#typora-quick-open:visible").hide().length) {
        bridge.callHandler("quickOpen.stopQuery")
      }
    }
    // Change click to Ctrl-click
    document.querySelector(".typora-quick-open-list").addEventListener("mousedown", ev => {
      if (!this.utils.metaKeyPressed(ev)) openQuickTab(ev.target.closest(".typora-quick-open-item"), ev)
    }, true)
    document.querySelector("#typora-quick-open-input > input").addEventListener("keydown", ev => {
      if (ev.key === "Enter") openQuickTab(document.querySelector(".typora-quick-open-item.active"), ev)
    }, true)
  }

  _reopenTabsWhenInit = () => {
    this.utils.eventHub.on(this.utils.eventHub.eventType.allPluginsHadInjected, () => {
      // Redirection is disabled when opening specific files (isDiscardableUntitled === false).
      // Register autoSave AFTER restoreSession completes, so the restore's fileContentLoaded
      // does not overwrite the saved state with stale data.
      this.utils.waitUntil(this.utils.isDiscardableUntitled, 50, 2000)
        .then(() => this.openSavedTabs(this.autoSaveStorage))
        .catch(this.utils.noop)
        .finally(() => this.utils.eventHub.on(this.utils.eventHub.eventType.fileContentLoaded, () => this.saveTabs(this.autoSaveStorage)))
    })
  }

  _interceptLink = () => {
    let context = {}
    this.utils.decorator.preventCallIf(() => JSBridge, "invoke", (cmd, file, options) => {
      if (cmd !== "app.openFileOrFolder" || !file || typeof options?.anchor !== "string") return false
      context = { ...options }
      this.utils.openFile(file)
      return true
    })
    this.utils.eventHub.on(this.utils.eventHub.eventType.fileContentLoaded, () => {
      if (context.anchor?.startsWith("#")) {
        const $target = File.editor.EditHelper.findAnchorElem(context.anchor)
        if ($target.length) this.utils.scrollTo($target, { height: 10 })
        context = {}
      }
    })
  }

  _saveOnSwitch = () => this.config.REOPEN_TABS_ON_STARTUP && this.saveTabs(this.autoSaveStorage)

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

  _insertTabEl = (filePath, showName, idx) => {
    const hint = this.config.SHOW_FULL_PATH_ON_HOVER ? `ty-hint="${filePath}"` : ""
    const btn = this.config.SHOW_TAB_CLOSE_BUTTON ? `<div class="close-button"><div class="close-icon"></div></div>` : ""
    this.entities.tabWrapper.insertAdjacentHTML("beforeend", `<div class="tab-container" data-idx="${idx}" draggable="true" ${hint}><div class="tab-name">${showName}</div>${btn}</div>`)
  }

  _updateTabEl = (tabEl, filePath, showName, idx) => {
    tabEl.dataset.idx = idx
    tabEl.querySelector(".tab-name").textContent = showName
    if (this.config.SHOW_FULL_PATH_ON_HOVER) {
      tabEl.setAttribute("ty-hint", filePath)
    } else {
      tabEl.removeAttribute("ty-hint")
    }
  }

  _renderTabs = wantOpenPath => {
    let currentTabEl = this.entities.tabWrapper.firstElementChild

    for (let idx = 0; idx < this.tab.tabs.length; idx++) {
      const tabObj = this.tab.tabs[idx]
      if (!currentTabEl) {
        this._insertTabEl(tabObj.path, tabObj.showName, idx)
        currentTabEl = this.entities.tabWrapper.lastElementChild
      } else {
        this._updateTabEl(currentTabEl, tabObj.path, tabObj.showName, idx)
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

  openInPlace = filePath => {
    try {
      this.tab.setInPlace(true)
      this.utils.openFile(filePath)
    } finally {
      this.tab.setInPlace(false)
    }
  }

  rerenderTabBar = () => {
    this.entities.tabWrapper.replaceChildren()
    this.tab.refresh()
  }

  copyPath = idx => navigator.clipboard.writeText(this.tab.getPathByIdx(idx) || "")
  showInFinder = idx => this.utils.showInFinder(this.tab.getPathByIdx(idx))
  openInNewWindow = idx => File.editor.library.openFileInNewWindow(this.tab.getPathByIdx(idx), false)

  saveTabs = (storage) => storage.set({ mount_folder: this.utils.getMountFolder(), save_tabs: this.tab.exportSession() })
  openSavedTabs = (storage, matchMountFolder = false) => {
    const { save_tabs, mount_folder } = storage.get() || {}
    this.tab.restoreSession(save_tabs, mount_folder, this.utils.getMountFolder(), matchMountFolder)
  }
}

module.exports = {
  plugin: WindowTabPlugin,
  TabManager,
}
