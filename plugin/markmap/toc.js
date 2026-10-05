const PanelController = require("./panel.js")

const CID_SYM = Symbol("NodeCid")

class TOCMarkmap {
  mm = null
  _ctx = null

  constructor(plugin) {
    this.plugin = plugin
    this.utils = plugin.utils
    this.i18n = plugin.i18n
    this.config = plugin.config
    this.Lib = plugin.Lib
  }

  html = () => {
    const ICONS = {
      download: "fa fa-download", settings: "fa fa-cog", unfold: "fa fa-sitemap fa-rotate-270", fit: "fa fa-compress",
      pinRight: "fa fa-chevron-right", pinTop: "fa fa-chevron-up", expand: "fa fa-expand", close: "fa fa-times",
    }
    const buttons = this.config.TITLE_BAR_BUTTONS.map(name => {
      const hint = this.i18n.t(`$option.TITLE_BAR_BUTTONS.${name}`)
      return `<div class="plugin-markmap-icon" action="${name}" ty-hint="${hint}"><i class="${ICONS[name]}"></i></div>`
    }).join("")
    const resizeButton = `<div class="plugin-markmap-icon" action="resize"><svg viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg"><path d="M14.228 16.227a1 1 0 0 1-.707-1.707l1-1a1 1 0 0 1 1.416 1.414l-1 1a1 1 0 0 1-.707.293zm-5.638 0a1 1 0 0 1-.707-1.707l6.638-6.638a1 1 0 0 1 1.416 1.414l-6.638 6.638a1 1 0 0 1-.707.293zm-5.84 0a1 1 0 0 1-.707-1.707L14.52 2.043a1 1 0 1 1 1.415 1.414L3.457 15.934a1 1 0 0 1-.707.293z"></path></svg></div>`
    return `
      <div id="plugin-markmap" class="plugin-common-panel plugin-common-hidden">
        <div class="plugin-markmap-header">${buttons}${resizeButton}</div>
        <svg id="plugin-markmap-svg"></svg>
        <div class="plugin-markmap-grip-top plugin-common-hidden"></div>
        <div class="plugin-markmap-grip-right plugin-common-hidden"></div>
      </div>`
  }

  hotkey = () => [{ hotkey: this.config.TOC_HOTKEY, callback: this.callback }]

  init = () => {
    fixConfig(this.config)
    this.entities = {
      content: this.utils.entities.eContent,
      panel: document.querySelector("#plugin-markmap"),
      header: document.querySelector(".plugin-markmap-header"),
      gripTop: document.querySelector(".plugin-markmap-grip-top"),
      gripRight: document.querySelector(".plugin-markmap-grip-right"),
      svg: document.querySelector("#plugin-markmap-svg"),
      resize: document.querySelector(`.plugin-markmap-icon[action="resize"]`),
      fullScreen: document.querySelector(`.plugin-markmap-icon[action="expand"]`),
    }
    this.panelCtl = new PanelController({
      entities: this.entities,
      config: this.config,
      utils: this.utils,
      i18n: this.i18n,
      hooks: { fit: () => this.fit(), isChartActive: () => this.mm != null },
    })
    this.actions = {
      pinTop: () => this.panelCtl.pinTop(),
      pinRight: () => this.panelCtl.pinRight(),
      expand: () => this.panelCtl.expand(),
      shrink: () => this.panelCtl.shrink(),
      showToolbar: () => this.panelCtl.showToolbar(),
      hideToolbar: () => this.panelCtl.hideToolbar(),
      fit: () => this.fit(true),
      unfold: () => this.unfold(),
      settings: () => this.settings(),
      download: () => this.download(),
      close: () => this.close(),
    }
  }

  process = () => {
    this._onEvent()
    this._onSvgClick()
    this._onSvgHover()
    this._registerContextMenu()
    this.panelCtl.bindMove()
    this.panelCtl.bindResize()
  }

  _onEvent = () => {
    const { eventHub } = this.utils
    const { panel, header } = this.entities
    const repositioning = () => this.panelCtl.reposition()
    eventHub.on(eventHub.eventType.afterToggleSidebar, repositioning)
    eventHub.on(eventHub.eventType.afterSetSidebarWidth, repositioning)
    eventHub.on(eventHub.eventType.toggleSettingPage, hide => hide && this.mm && this.close())
    eventHub.on(eventHub.eventType.outlineUpdated, () => {
      if (!this.utils.isShown(panel)) return
      this.draw()
      if (this.config.AUTO_FIT_ON_UPDATE) this.fit()
    })

    const fitDelay = this.utils.debounce(() => this.fit(), 30)
    panel.addEventListener("transitionend", ev => ev.target === ev.currentTarget && fitDelay())
    header.addEventListener("click", ev => {
      const action = ev.target.closest(".plugin-markmap-icon")?.getAttribute("action")
      if (action) this.doAction(action)
    })
  }

  _onSvgClick = () => {
    this.entities.svg.addEventListener("click", ev => {
      const node = ev.target.closest(".markmap-node")
      // `.__data__` is the d3 hierarchy node; `.data` is the decorated tree node (see topology note below).
      const cid = node?.__data__?.data?.[CID_SYM]
      if (!cid) return

      const circle = ev.target.closest("circle")
      if (circle) {
        if (this.config.AUTO_COLLAPSE_PARAGRAPH_ON_FOLD) {
          const head = this.utils.entities.querySelectorInWrite(`[cid="${cid}"]`)
          const isFold = node.classList.contains("markmap-fold")
          this.utils.callPluginFn("collapse_paragraph", "trigger", head, !isFold)
        }
        if (this.config.AUTO_FIT_WHEN_FOLD) {
          this.fit()
        }
      } else {
        if (this.config.CLICK_TO_POSITION) {
          const { height, top } = this.entities.content.getBoundingClientRect()
          this.utils.scrollTo(cid, {
            height: height * this.config.POSITIONING_VIEWPORT_HEIGHT + top,
            showHiddenEls: !this.config.AUTO_COLLAPSE_PARAGRAPH_ON_FOLD,
            moveCursor: true,
          })
        }
      }
    })
  }

  _onSvgHover = () => {
    const svg = this.entities.svg
    const DIM = "markmap-dim-others"
    const ACTIVE = "markmap-path-active"
    let hoveredEl = null

    const clear = () => {
      if (!this.config.HIGHLIGHT_PATH_ON_HOVER) return
      svg.querySelectorAll(`.${ACTIVE}`).forEach(el => el.classList.remove(ACTIVE))
      svg.classList.remove(DIM)
      hoveredEl = null
    }

    svg.addEventListener("mouseleave", clear)
    svg.addEventListener("mouseover", ev => {
      if (!this.config.HIGHLIGHT_PATH_ON_HOVER) return
      const node = ev.target.closest(".markmap-node")
      if (node === hoveredEl) return
      clear()
      const path = node && svg.contains(node) ? node.dataset.path : null
      if (!path) return

      const parts = path.split(".")
      const selector = parts.map((_, i) => `[data-path="${parts.slice(0, i + 1).join(".")}"]`).join(",")
      svg.querySelectorAll(selector).forEach(el => el.classList.add(ACTIVE))
      svg.classList.add(DIM)
      hoveredEl = node
    })
  }

  _registerContextMenu = () => {
    if (!this.config.USE_CONTEXT_MENU) return
    this.utils.contextMenu.register(this.entities.svg, () => {
      const activeKeys = [
        this.utils.isHidden(this.entities.header) ? "showToolbar" : "hideToolbar",
        this.entities.fullScreen.getAttribute("action"),
        "fit", "unfold", "pinTop", "pinRight", "settings", "download", "close",
      ]
      const availableItems = this.utils.pick(this.i18n.entries(Object.keys(this.actions), "$option.TITLE_BAR_BUTTONS."), activeKeys)
      return Object.entries(availableItems).map(([key, label]) => ({ label, action: () => this.doAction(key) }))
    })
  }

  callback = async () => {
    if (this.utils.isShown(this.entities.panel)) {
      this.close()
    } else {
      this.utils.show(this.entities.panel)
      this.panelCtl.initRect()
      await this.plugin.lazyLoad()
      this.draw()
    }
  }

  close = () => {
    this.panelCtl.reset()
    this.mm.destroy()
    this.mm = null
    this._ctx = null
  }

  fit = (notify = false) => {
    if (!this.mm) return
    this.mm.fit()
    if (notify) this.utils.notification.show(this.i18n.t("success.fit"))
  }

  unfold = () => {
    const root = this.mm.state.data
    unfoldAll(root)
    this.mm.setData(root)
    this.utils.notification.show(this.i18n.t("success.unfold"))
  }

  settings = async () => {
    const { openTOCSettings } = require("./settings.js")
    const saved = await openTOCSettings({ config: this.config, utils: this.utils, i18n: this.i18n, fixedName: this.plugin.fixedName })
    if (!saved) return
    this.draw()
    this.utils.notification.show(this.i18n.t("success.edit"))
  }

  download = async () => {
    const { download, getFormats } = require("./downloader.js")
    const options = this.config.DOWNLOAD_OPTIONS
    let downloadPath = await resolveDownloadPath(options, this.utils)
    if (options.SHOW_PATH_INQUIRY_DIALOG) {
      const { canceled, filePath } = await JSBridge.invoke("dialog.showSaveDialog", {
        title: this.i18n.t("$option.TITLE_BAR_BUTTONS.download"),
        properties: ["saveFile", "showOverwriteConfirmation"],
        defaultPath: downloadPath,
        filters: getFormats(),
      })
      if (canceled) return
      downloadPath = filePath
    }
    const ok = await download({
      svg: this.entities.svg,
      mmOptions: this.mm?.options || {},
      transformer: this.Lib.transformer,
      root: this._ctx.root,
      features: this._ctx.features,
      content: this._ctx.content,
      tocOps: this.config.DEFAULT_TOC_OPTIONS,
      downloadOps: options,
      utils: this.utils,
    }, downloadPath)
    if (!ok) return
    if (options.SHOW_IN_FINDER) {
      this.utils.showInFinder(downloadPath)
    }
    this.utils.notification.show(this.i18n.t("success.download"))
  }

  draw = () => {
    const { md, tree } = this.plugin.getToc()
    const options = this.Lib.assignOptions(this.config.DEFAULT_TOC_OPTIONS, this.mm?.options)
    const oldRoot = this.mm?.state?.data
    this._ctx = this.Lib.transformer.transform(md)
    const { root } = this._ctx
    annotate(root, tree)
    if (this.mm) {
      if (this.config.RETAIN_FOLD_STATE_ON_UPDATE && oldRoot) {
        retainFoldState(oldRoot, root)
      }
      this.mm.setData(root, options)
    } else {
      this.mm = this.Lib.createMarkmap(this.entities.svg, options, root)
    }
  }

  doAction = action => this.actions[action]?.()
}

function traverse(node, fn) {
  fn(node)
  for (const child of node.children) {
    traverse(child, fn)
  }
}

function preorder(root) {
  const nodes = []
  traverse(root, node => nodes.push(node))
  return nodes
}

function zipAligned(arr1, arr2) {
  const n = Math.min(arr1.length, arr2.length)
  const offset1 = arr1.length - n
  const offset2 = arr2.length - n
  return Array.from({ length: n }, (_, i) => [arr1[offset1 + i], arr2[offset2 + i]])
}

/**
 * Node topology across the d3 boundary:
 *
 *   ELEMENT (<g class="markmap-node">)
 *     +-- __data__        d3 hierarchy node
 *           +-- data      tree node (same object as in mm.state.data's tree)
 *           |     +-- children
 *           |     +-- payload.fold
 *           |     +-- state
 *           |     +-- CID_SYM   <- written by `annotate`
 *           +-- depth/x/y/children/...
 */
function annotate(mmRoot, tocRoot) {
  const tocNodes = preorder(tocRoot)
  const mmNodes = preorder(mmRoot)
  // markmap may prepend a virtual root that has no toc counterpart; tail alignment cancels out whichever side carries one.
  for (const [mmNode, tocNode] of zipAligned(mmNodes, tocNodes)) {
    mmNode[CID_SYM] = tocNode.cid
  }
}

function retainFoldState(oldRoot, newRoot) {
  const foldedCids = new Set()
  traverse(oldRoot, node => {
    if (node.payload?.fold && node[CID_SYM] != null) {
      foldedCids.add(node[CID_SYM])
    }
  })
  traverse(newRoot, node => {
    if (foldedCids.has(node[CID_SYM])) {
      if (!node.payload) node.payload = {}
      node.payload.fold = 1
    }
  })
}

function unfoldAll(root) {
  traverse(root, node => {
    if (node.payload) node.payload.fold = 0
  })
}

function fixConfig(config) {
  const { DEFAULT_TOC_OPTIONS: op } = config
  op.color = op.color.map(e => e.toUpperCase())
  if (op.initialExpandLevel <= 0 || isNaN(op.initialExpandLevel)) {
    op.initialExpandLevel = 7
  }
  if (op.colorFreezeLevel < 0 || isNaN(op.colorFreezeLevel)) {
    op.colorFreezeLevel = 7
  }
}

async function resolveDownloadPath({ FOLDER: folder, FILENAME: file = "{{filename}}.svg" }, utils) {
  if (folder) {
    folder = utils.resolvePluginPath(folder)
  }
  if (!folder || !(await utils.existPath(folder))) {
    folder = utils.tempFolder
  }
  const tpl = {
    timestamp: Date.now(),
    random: utils.randomString(),
    filename: utils.getFileName() || "MARKMAP",
  }
  const name = file.replace(/\{\{([\S\s]+?)\}\}/g, (origin, arg) => tpl[arg.trim().toLowerCase()] || origin)
  return utils.Package.Path.join(folder, name)
}

module.exports = TOCMarkmap
