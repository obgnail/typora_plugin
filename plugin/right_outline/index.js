const buildStateManager = () => {
  let currentType, currentSignature
  const collapsedCids = new Set()

  const generateSignature = (node) => {
    const parts = []
    const validCids = new Set()
    const traverse = (n) => {
      parts.push(n.cid || "", n.text || "", n.class_ || "")
      if (n.cid) validCids.add(n.cid)
      if (n.children && n.children.length > 0) {
        parts.push(n.children.length)
        for (const child of n.children) traverse(child)
      }
    }
    traverse(node)
    return { signature: parts.join("\x00"), validCids }
  }
  const shouldUpdate = (type, rootNode) => {
    const { signature, validCids } = generateSignature(rootNode)
    if (currentType === type && currentSignature === signature) return false
    currentType = type
    currentSignature = signature
    for (const cid of collapsedCids) {
      if (!validCids.has(cid)) {
        collapsedCids.delete(cid)
      }
    }
    return true
  }
  const clear = () => {
    currentType = null
    currentSignature = null
  }
  const isCollapsed = (cid) => collapsedCids.has(cid)
  const setCollapse = (cid, collapse) => collapse ? collapsedCids.add(cid) : collapsedCids.delete(cid)

  return { shouldUpdate, clear, isCollapsed, setCollapse }
}

const buildRenderer = (utils, isCollapsed) => {
  const getRootHTML = (rootNode, sortable) => {
    const drag = sortable ? `draggable="true"` : ""
    const genLi = node => {
      const { text, cid, depth, class_ = "", children = [] } = node
      const toggleEl = children.length === 0 ? "" : `<span class="toc-toggle fa fa-caret-down"></span>`
      const textEl = `<span class="toc-text">${utils.escape(text)}</span>`
      let nodeEl = `<div class="toc-node ${class_}" data-ref="${cid}" ${drag}>${toggleEl}${textEl}</div>`
      if (children.length !== 0) {
        const li = children.map(genLi).join("")
        nodeEl += `<ul>${li}</ul>`
      }
      const depthAttr = depth ? `data-depth="${depth}"` : ""
      const collapsedAttr = isCollapsed(cid, depth) ? `class="collapsed"` : ""
      return `<li ${collapsedAttr} ${depthAttr}>${nodeEl}</li>`
    }
    const li = rootNode.children.map(genLi).join("")
    return `<ul class="toc-root">${li}</ul>`
  }
  return { getRootHTML }
}

const buildTreeParser = ({ utils, config }, displayNames) => {
  const TYPE_SELECTORS = {
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
  const HEADER_SELECTORS = [1, 2, 3, 4, 5, 6].map(d => `:scope > h${d}`)
  const headerDepthOf = tagName => tagName.length === 2 && tagName[0] === "H" ? Number(tagName[1]) : 0
  const getKindRoot = (type) => {
    const root = { depth: 0, cid: "", text: "root", children: [], parent: null }
    const stack = [root]
    let idx = 0

    const sel = [TYPE_SELECTORS[type], ...HEADER_SELECTORS.slice(0, config.HEADER_GROUP_DEPTH[type] || 0)].join(", ")
    utils.entities.eWrite.querySelectorAll(sel).forEach(el => {
      if (el.style.display === "none") return

      const depth = headerDepthOf(el.tagName)
      if (depth) {
        while (stack.at(-1).depth >= depth) stack.pop()
        const parent = stack.at(-1)
        const header = {
          cid: el.getAttribute("cid"),
          text: el.textContent,
          class_: "toc-header-node",
          children: [],
          depth,
          parent,
        }
        parent.children.push(header)
        stack.push(header)
        return
      }
      const matchedClass = Object.keys(TYPE_MAPPINGS).find(cls => el.classList.contains(cls))
      if (matchedClass && TYPE_MAPPINGS[matchedClass] === type) {
        const parent = stack.at(-1)
        const cid = el.closest("[cid]").getAttribute("cid")
        const text = displayNames[type]({ idx: ++idx, cid, el, parent })
        parent.children.push({ cid, text, parent, depth: parent.depth + 1, children: [] })
      }
    })
    return root
  }

  return {
    getTree: (type) => type === "header" ? utils.getTocTree(config.REMOVE_HEADER_STYLES) : getKindRoot(type),
  }
}

const buildScrollSyncer = ({ utils }, highlighter) => {
  const rafManager = utils.getRafManager()
  let activeCid

  const highlight = () => rafManager.schedule(() => {
    const headers = utils.entities.$eWrite.children(File.editor.library.outline.headerStr)
    if (!headers || !headers.length) return

    const contentScrollTop = utils.entities.$eContent.scrollTop()
    const viewHeight = window.innerHeight
    const compare = (el) => {
      if (el.offsetTop < contentScrollTop) return -1
      if (el.offsetTop > contentScrollTop + viewHeight) return 1
      return 0
    }
    const findActiveIndex = index => {
      for (index--; headers[index] && compare(headers[index]) === 0;) index--
      return index + 1
    }

    const isBelowViewBox = 1 === compare(headers[headers.length - 1])
    let start = isBelowViewBox ? 0 : headers.length - 1
    let end = headers.length - 1
    let activeIndex
    while (1 < end - start && activeIndex === undefined) {
      const middleIndex = Math.floor((start + end) / 2)
      const position = compare(headers[middleIndex])
      if (position === 1) end = middleIndex
      else if (position === -1) start = middleIndex
      else activeIndex = findActiveIndex(middleIndex)
    }

    if (activeIndex === undefined) activeIndex = start
    if (activeIndex >= headers.length) return

    const targetCid = headers[activeIndex].getAttribute("cid")
    if (activeCid !== targetCid) {
      activeCid = targetCid
      highlighter(targetCid)
    }
  })

  const clearCache = () => {
    activeCid = null
    rafManager.cancel()
  }

  return { highlight, clearCache }
}

class RightOutlinePlugin extends BasePlugin {
  ctx = { utils: this.utils, config: this.config }
  stateManager = buildStateManager()
  renderer = buildRenderer(this.utils, (cid, depth) => this.stateManager.isCollapsed(cid) || (depth != null && depth > this.config.AUTO_COLLAPSE_DEPTH))
  treeParser = buildTreeParser(this.ctx, {
    fence: ({ idx, cid }) => this.utils.getFenceContentByCid(cid)?.slice(0, 20) || `Code ${idx}`,
    table: ({ idx, el }) => el.querySelector(".td-span")?.textContent || `Table ${idx}`,
    link: ({ idx, el }) => el.querySelector("a")?.textContent || `Link ${idx}`,
    image: ({ idx, el }) => el.querySelector("img")?.getAttribute("alt") || `Image ${idx}`,
    math: ({ idx, el }) => el.querySelector("mjx-assistive-mml")?.textContent?.slice(0, 30) || `Math ${idx}`,
  })
  scrollSyncer = buildScrollSyncer(this.ctx, cid => {
    this.entities.list.querySelectorAll(".toc-node.active").forEach(el => el.classList.remove("active"))
    const activeNode = this.entities.list.querySelector(`.toc-node[data-ref="${cid}"]`)
    activeNode?.classList.add("active")
    activeNode?.scrollIntoViewIfNeeded()
  })

  style = () => true

  html = () => {
    const ICONS = { header: "fa-header", image: "fa-image", table: "fa-table", fence: "fa-code", link: "fa-link", math: "fa-dollar" }
    const buttons = this.config.TITLE_BAR_BUTTONS.map(btn => {
      const icon = `<div class="fa ${ICONS[btn]}"></div>`
      const hint = this.i18n.t(`$option.TITLE_BAR_BUTTONS.${btn}`)
      return `<div class="plugin-right-outline-icon" data-type="${btn}" ty-hint="${hint}">${icon}</div>`
    })
    const cls = buttons.length > 1 ? "plugin-right-outline-header" : "plugin-right-outline-header plugin-common-hidden"
    return `
      <div id="plugin-right-outline" class="plugin-common-panel plugin-common-hidden">
        <div class="grip-right"></div>
        <div class="plugin-right-outline-wrap">
          <div class="${cls}">${buttons.join("")}</div>
          <div class="plugin-right-outline-list"></div>
        </div>
      </div>`
  }

  hotkey = () => [{ hotkey: this.config.HOTKEY, callback: this.call }]

  init = () => {
    this.entities = {
      content: this.utils.entities.eContent,
      panel: document.querySelector("#plugin-right-outline"),
      grip: document.querySelector("#plugin-right-outline .grip-right"),
      list: document.querySelector("#plugin-right-outline .plugin-right-outline-list"),
      header: document.querySelector("#plugin-right-outline .plugin-right-outline-header"),
    }
  }

  process = () => {
    this._onEvent()
    this._onClick()
    this._onResize()
    this._onDrag()
  }

  call = () => this.togglePanel()

  _onEvent = () => {
    const { eventHub } = this.utils
    eventHub.on(eventHub.eventType.outlineUpdated, () => this.refreshPanel())
    eventHub.on(eventHub.eventType.toggleSettingPage, hide => hide && this.isPanelShown() && this.hidePanel())
    eventHub.on(eventHub.eventType.fileEdited, this.utils.debounce(this.refreshPanel, 300))
    this.utils.decorator.afterCall(() => File?.editor?.library?.outline, "highlightVisibleHeader", () => {
      if (this.isPanelShown() && this._getCurrentType() === "header") this.scrollSyncer.highlight()
    })
    const resetPosition = () => {
      const { right: contentRight } = this.entities.content.getBoundingClientRect()
      const { right: panelRight } = this.entities.panel.getBoundingClientRect()
      Object.assign(this.entities.panel.style, { left: `${contentRight}px`, width: `${panelRight - contentRight}px` })
    }
    eventHub.on(eventHub.eventType.afterToggleSidebar, resetPosition)
    eventHub.on(eventHub.eventType.afterSetSidebarWidth, resetPosition)
    if (this.config.DEFAULT_SHOW_OUTLINE) {
      eventHub.on(eventHub.eventType.allPluginsHadInjected, this.togglePanel)
    }
  }

  _onClick = () => {
    this.entities.panel.addEventListener("click", ev => {
      const toggleLi = ev.target.closest(".toc-toggle")?.closest("li")
      if (toggleLi) {
        toggleLi.classList.toggle("collapsed")
        const ref = toggleLi.querySelector(".toc-node")?.dataset.ref
        if (ref) this.stateManager.setCollapse(ref, toggleLi.classList.contains("collapsed"))
        return
      }

      const ref = ev.target.closest(".toc-node")?.dataset.ref
      if (ref) {
        if (File.editor.sourceView.inSourceMode) File.toggleSourceMode()
        this.utils.scrollTo(ref, { moveCursor: true })
        return
      }

      const type = ev.target.closest(".plugin-right-outline-icon")?.dataset.type
      if (type) this.refreshPanel(type)
    })

    if (this.config.RIGHT_CLICK_OUTLINE_BUTTON_TO_TOGGLE) {
      const panelTitle = document.querySelector("#info-panel-tab-outline .info-panel-tab-title")
      panelTitle?.addEventListener("mousedown", ev => ev.button === 2 && this.togglePanel())
    }
  }

  _onResize = () => {
    let contentStartRight = 0
    let contentStartWidth = 0
    let panelStartLeft = 0
    let contentMaxRight = 0
    const onMouseDown = () => {
      const contentRect = this.entities.content.getBoundingClientRect()
      const panelRect = this.entities.panel.getBoundingClientRect()
      contentStartRight = contentRect.right
      contentStartWidth = contentRect.width
      panelStartLeft = panelRect.left
      contentMaxRight = panelRect.right - 100
    }
    const onMouseMove = (deltaX, deltaY) => {
      deltaX = -deltaX
      deltaY = -deltaY
      let newContentRight = contentStartRight - deltaX
      if (newContentRight > contentMaxRight) {
        deltaX = contentStartRight - contentMaxRight
      }
      this.entities.content.style.width = contentStartWidth - deltaX + "px"
      this.entities.panel.style.left = panelStartLeft - deltaX + "px"
      return { deltaX, deltaY }
    }
    this.utils.resizeElement({
      targetEl: this.entities.grip,
      resizeEl: this.entities.panel,
      resizeWidth: true,
      resizeHeight: false,
      onMouseDown,
      onMouseMove,
      onMouseUp: null,
    })
  }

  _onDrag = () => {
    if (!this.config.SORTABLE) return

    let dragItem
    const that = this
    const classAbove = "plugin-right-outline-drag-above"
    const classBelow = "plugin-right-outline-drag-below"
    const classSource = "plugin-right-outline-drag-source"
    const isAncestorOf = (ancestor, descendant) => !!ancestor?.parentElement?.contains(descendant)
    const isPreceding = (el, otherEl) => el.compareDocumentPosition(otherEl) === document.DOCUMENT_POSITION_PRECEDING
    const setStyle = function (ev) {
      if (!dragItem) return false
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
        if (!dragItem) return
        if (isAncestorOf(dragItem, this)) return

        const headers = []
        const blocks = []
        File.editor.nodeMap.blocks.sortedForEach(node => blocks.push(node))
        blocks.forEach((node, idx) => {
          if (node.attributes.type === Node.TYPE.heading) headers.push({ idx: idx, node: node })
        })

        const drag = getHeader(dragItem.dataset.ref, headers, blocks)
        const drop = getHeader(this.dataset.ref, headers, blocks)
        if (!drag || !drop) return

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
        dragItem = null
      })
  }

  isPanelShown = () => this.utils.isShown(this.entities.panel)

  hidePanel = () => {
    const { panel, content } = this.entities
    this.utils.entities.eWrite.style.width = ""
    this.utils.hide(panel)
    panel.style.removeProperty("left")
    panel.style.removeProperty("width")
    content.style.removeProperty("width")
  }

  showPanel = (forceRefresh = true) => {
    this.utils.show(this.entities.panel)
    const { width } = this.entities.content.getBoundingClientRect()
    const panelWidth = width * this.config.DEFAULT_WIDTH_PERCENT / 100
    this.entities.panel.style.width = panelWidth + "px"
    this.entities.content.style.width = `${width - panelWidth}px`
    this.utils.entities.eWrite.style.width = "initial"

    if (forceRefresh) {
      // Bypass the visibility check and yield the main thread.
      // This ensures the browser completes layout reflows before rendering the outline,
      // preventing blank panels due to race conditions and smoothing the UI expansion.
      setTimeout(() => {
        this.stateManager.clear()
        this._refreshPanel()
      }, 100)
    }
  }

  togglePanel = () => this.isPanelShown() ? this.hidePanel() : this.showPanel()

  refreshPanel = type => this.isPanelShown() && this._refreshPanel(type)

  _refreshPanel = (type = this._getCurrentType()) => {
    this.entities.header.children.forEach(el => el.classList.toggle("select", el.dataset.type === type))
    const root = this.treeParser.getTree(type)
    if (this.stateManager.shouldUpdate(`${type}:${this.config.AUTO_COLLAPSE_DEPTH}`, root)) {
      this.entities.list.innerHTML = this.renderer.getRootHTML(root, this.config.SORTABLE && type === "header")
      this.scrollSyncer.clearCache()
    }
    if (type === "header") {
      this.scrollSyncer.highlight()
    }
  }

  _getCurrentType = () => {
    const btn = this.entities.header.querySelector(".select") || this.entities.header.firstElementChild
    return btn?.dataset.type ?? "header"
  }
}

module.exports = {
  plugin: RightOutlinePlugin,
}
