class CollapseImagePlugin extends BasePlugin {
  collapsedClass = "plugin-collapse-image-collapsed"
  expandedClass = "plugin-collapse-image-expanded"
  controlClass = "plugin-collapse-image-control"
  records = new Map()
  resizeObserver = null
  mutationObserver = null
  onWindowResize = null

  style = () => `
#write .md-image.${this.collapsedClass} {
  position: relative;
  display: block;
  max-height: var(--plugin-collapse-image-height);
  overflow: hidden;
}
#write .md-image.${this.collapsedClass} > img {
  display: block;
}
#write .${this.controlClass} {
  box-sizing: border-box;
  width: 100%;
  min-height: 36px;
  padding: 12px 16px 8px;
  color: var(--text-color);
  cursor: pointer;
  text-align: center;
  user-select: none;
}
#write .${this.controlClass}:focus {
  outline: 2px solid var(--active-file-border-color, var(--text-color));
  outline-offset: -2px;
}
#write .${this.collapsedClass} > .${this.controlClass} {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  padding-top: 36px;
  background: linear-gradient(to bottom, transparent, var(--bg-color) 60%);
}
#write .${this.expandedClass} > .${this.controlClass} {
  display: block;
}`

  process = () => {
    const { eventHub } = this.utils
    eventHub.on(eventHub.eventType.fileContentLoaded, this.refresh)
    eventHub.on(eventHub.eventType.allPluginsHadInjected, this.scheduleRefresh)
    eventHub.on(eventHub.eventType.fileOpened, this.scheduleRefresh)
    this.utils.exportHelper.register(this.fixedName, null, this.afterExportToHTML)
    this.utils.exportHelper.registerNative(this.fixedName, this.beforeExportToNative, this.afterExportToNative)

    const { eWrite } = this.utils.entities
    eWrite.addEventListener("load", this.onImageLoad, true)
    this.onWindowResize = this.utils.debounce(() => this.refresh(), 100)
    window.addEventListener("resize", this.onWindowResize)

    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(entries => entries.forEach(entry => this.refreshImage(entry.target)))
    }
    this.mutationObserver = new MutationObserver(this.onMutations)
    this.mutationObserver.observe(eWrite, { childList: true, subtree: true, attributes: true, attributeFilter: ["src"] })
    this.refresh()
  }

  isMarkdownImage = image => image?.matches?.(".md-image.md-img-loaded > img")

  getSource = image => image.currentSrc || image.getAttribute("src") || ""

  getViewportHeight = () => this.utils.entities.eContent?.clientHeight || window.innerHeight

  scheduleRefresh = () => setTimeout(this.refresh, 80)

  isLongImage = image => image.getBoundingClientRect().height > this.getViewportHeight() * this.config.TRIGGER_HEIGHT_PERCENT / 100

  getRecord = image => {
    let record = this.records.get(image)
    if (!record) {
      record = { image, wrapper: image.parentElement, source: this.getSource(image), manual: null, control: null }
      this.records.set(image, record)
      this.resizeObserver?.observe(image)
    }
    return record
  }

  createControl = record => {
    const control = document.createElement("div")
    control.className = this.controlClass
    control.setAttribute("role", "button")
    control.setAttribute("tabindex", "0")
    control.addEventListener("click", () => this.toggle(record))
    control.addEventListener("keydown", ev => {
      if (ev.key !== "Enter" && ev.key !== " ") return
      ev.preventDefault()
      this.toggle(record)
    })
    record.wrapper.appendChild(control)
    record.control = control
    return control
  }

  clearPresentation = record => {
    const { wrapper, control } = record
    wrapper.classList.remove(this.collapsedClass, this.expandedClass)
    wrapper.style.removeProperty("--plugin-collapse-image-height")
    control?.remove()
    record.control = null
  }

  render = (record, collapsed) => {
    const { wrapper } = record
    const control = record.control?.isConnected ? record.control : this.createControl(record)
    wrapper.classList.toggle(this.collapsedClass, collapsed)
    wrapper.classList.toggle(this.expandedClass, !collapsed)
    if (collapsed) {
      wrapper.style.setProperty("--plugin-collapse-image-height", `${this.getViewportHeight() * this.config.COLLAPSED_HEIGHT_PERCENT / 100}px`)
    } else {
      wrapper.style.removeProperty("--plugin-collapse-image-height")
    }
    control.textContent = this.i18n.t(collapsed ? "act.expand" : "act.collapse")
  }

  refreshImage = image => {
    if (!this.isMarkdownImage(image)) return
    const record = this.getRecord(image)
    record.wrapper = image.parentElement
    const source = this.getSource(image)
    if (record.source !== source) {
      record.source = source
      record.manual = null
    }
    if (!this.isLongImage(image)) {
      record.manual = null
      this.clearPresentation(record)
      return
    }
    this.render(record, record.manual !== "expanded")
  }

  refresh = () => {
    const { eWrite } = this.utils.entities
    const images = [...eWrite.querySelectorAll(".md-image.md-img-loaded > img")]
    const active = new Set(images)
    images.forEach(this.refreshImage)
    this.records.forEach((record, image) => {
      if (active.has(image)) return
      this.clearPresentation(record)
      this.resizeObserver?.unobserve?.(image)
      this.records.delete(image)
    })
  }

  toggle = record => {
    record.manual = record.wrapper.classList.contains(this.collapsedClass) ? "expanded" : "collapsed"
    this.refreshImage(record.image)
    if (record.manual === "collapsed") record.control?.scrollIntoView({ block: "nearest" })
  }

  onImageLoad = ev => this.refreshImage(ev.target)

  onMutations = mutations => {
    mutations.forEach(mutation => {
      if (mutation.type === "attributes") {
        this.refreshImage(mutation.target)
      } else {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType !== Node.ELEMENT_NODE) return
          if (node.matches?.(".md-image.md-img-loaded > img")) this.refreshImage(node)
          node.querySelectorAll?.(".md-image.md-img-loaded > img").forEach(this.refreshImage)
        })
      }
    })
  }

  beforeExportToNative = () => this.records.forEach(this.clearPresentation)

  afterExportToNative = () => this.refresh()

  afterExportToHTML = html => html
    .replace(/<div\b[^>]*\bplugin-collapse-image-control\b[^>]*>[\s\S]*?<\/div>/g, "")
    .replace(/\splugin-collapse-image-(?:collapsed|expanded)\b/g, "")
    .replace(/\sstyle="([^"]*?)"/g, (_, style) => {
      const cleaned = style.split(";").filter(item => !item.trim().startsWith("--plugin-collapse-image-height")).join(";").trim()
      return cleaned ? ` style="${cleaned}"` : ""
    })
}

module.exports = {
  plugin: CollapseImagePlugin,
}
