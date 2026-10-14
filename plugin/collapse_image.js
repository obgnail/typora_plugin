class CollapseImagePlugin extends BasePlugin {
  collapsedClass = "plugin-collapse-image-collapsed"
  expandedClass = "plugin-collapse-image-expanded"
  controlClass = "plugin-collapse-image-control"
  records = new Map()
  imageObserver = null
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
    // from IPugin
    const { eventHub } = this.utils
    // make sure function refresh function called once per 100ms at most.
    this.refreshDebounced = this.utils.debounce(() => this.refresh(), 100)
    // register event listeners
    eventHub.on(eventHub.eventType.fileContentLoaded, this.resetForFile)
    eventHub.on(eventHub.eventType.allPluginsHadInjected, this.refreshDebounced)
    eventHub.on(eventHub.eventType.fileOpened, this.refreshDebounced)

    // this.fixedName is the plugin name and is plugin name of js file, e.g., "collapse-image"
    this.utils.exportHelper.register(this.fixedName, null, this.afterExportToHTML)
    this.utils.exportHelper.registerNative(this.fixedName, this.beforeExportToNative, null, this.restoreAfterNativeExport)

    const { eWrite } = this.utils.entities
    eWrite.addEventListener("load", this.onImageLoad, true)
    eWrite.addEventListener("click", this.onClick)

    // Initialize observers
    if (typeof IntersectionObserver !== "undefined") {
      this.imageObserver = new IntersectionObserver(this.onIntersections)
    }

    // Initialize resize observer or fallback to window resize event
    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(this.refreshDebounced)
      this.resizeObserver.observe(this.utils.entities.eContent)
    } else {
      this.onWindowResize = this.refreshDebounced
      window.addEventListener("resize", this.onWindowResize)
    }
    // Initialize mutation observer to watch for changes in the DOM that may affect images
    this.mutationObserver = new MutationObserver(this.onMutations)
    this.mutationObserver.observe(eWrite, { childList: true, subtree: true, attributes: true, attributeOldValue: true, attributeFilter: ["src", "class"] })

    this.refresh()
  }

  // "image" is dom element of <img> tag
  isMarkdownImage = image => image?.matches?.(".md-image.md-img-loaded > img")

  // loaded markdown image and is in the write area
  isActiveImage = image => this.utils.entities.eWrite.contains(image) && this.isMarkdownImage(image)

  // get the source of the image, either from currentSrc or src attribute
  getSource = image => image.currentSrc || image.getAttribute("src") || ""

  isLongImage = image => image.offsetHeight > this.config.TRIGGER_HEIGHT

  //
  forEachMarkdownImage = (node, callback) => {
    // nodeType 1 is Element
    if (node?.nodeType !== 1) return
    // current node is a markdown image, call the callback
    if (this.isMarkdownImage(node)) callback(node)
    // find all markdown images in the subtree of the node and call the callback for each
    node.querySelectorAll?.(".md-image.md-img-loaded > img").forEach(callback)
  }

  getRecord = image => {
    // image is the key, record is the value in the records map. If not found, create a new record with image, wrapper, source, manual, control.
    let record = this.records.get(image)
    if (!record) {
      record = { image, wrapper: image.parentElement, source: this.getSource(image), manual: null, control: null }
      // store the record in the records map with image as the key
      this.records.set(image, record)
    }
    return record
  }

  createControl = record => {
    const control = document.createElement("div")
    control.className = this.controlClass
    // append the control to the wrapper of the image, because the wrapper is the parent of the image, and the control should be a sibling of the image
    record.wrapper.appendChild(control)
    // add the control to the record
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
    // make sure control exists, if not exist, create a new control and add it to the record
    const control = record.control?.isConnected ? record.control : this.createControl(record)
    // toggle the classes on the wrapper based on the collapsed state
    wrapper.classList.toggle(this.collapsedClass, collapsed)
    wrapper.classList.toggle(this.expandedClass, !collapsed)
    // set the height of the wrapper to the collapsed height if collapsed, otherwise remove the height property
    if (collapsed) {
      wrapper.style.setProperty("--plugin-collapse-image-height", `${this.config.COLLAPSED_HEIGHT}px`)
    } else {
      wrapper.style.removeProperty("--plugin-collapse-image-height")
    }
    const text = this.i18n.t(collapsed ? "act.expand" : "act.collapse")
    if (control.textContent !== text) control.textContent = text
  }

  refreshImage = image => {
    // no need to refresh if the image is not a markdown image
    if (!this.isMarkdownImage(image)) return
    // get the record and source of the image, if the source has changed, reset the manual state to null
    const record = this.getRecord(image)
    record.wrapper = image.parentElement
    const source = this.getSource(image)
    if (record.source !== source) {
      record.source = source
      record.manual = null
    }
    // if the image is not a long image, clear the presentation and reset the manual state to null
    if (!this.isLongImage(image)) {
      record.manual = null
      this.clearPresentation(record)
      return
    }
    // render the image based on the manual state, if manual state is null, use the default collapsed state from config
    this.render(record, record.manual !== "expanded")
  }

  // observeImage is called when the image is in the viewport and should be observed for changes. It adds the image to the observer and refreshes its presentation.
  observeImage = (image, force = false) => {
    // not a markdown image or not in the write area, forget it
    if (!this.isActiveImage(image)) return
    // if there is no image observer, refresh the image immediately and return
    if (!this.imageObserver) {
      this.refreshImage(image)
      return
    }
    // cancel the observation and refresh the image if force is true, otherwise just observe the image
    if (force) this.imageObserver.unobserve(image)
    this.imageObserver.observe(image)
  }

  // forgetImage is called when the image is no longer in the DOM or no longer active. It removes the image from the observer and clears its presentation.
  forgetImage = image => {
    this.imageObserver?.unobserve(image)
    const record = this.records.get(image)
    if (!record) return
    this.clearPresentation(record)
    this.records.delete(image)
  }

  refresh = () => {
    const { eWrite } = this.utils.entities
    // all images that are currently in the DOM and loaded
    const images = [
      ...eWrite.querySelectorAll(".md-image.md-img-loaded > img"),
    ]
    const active = new Set(images)
    images.forEach((image) => this.observeImage(image));
    //  Map: (value, key)
    this.records.forEach((record, image) => {
      if (active.has(image)) return
      this.forgetImage(image)
    });
  }

  resetForFile = () => {
    this.imageObserver?.disconnect()
    this.records.forEach(this.clearPresentation)
    this.records.clear()
    this.refresh()
  }

  onIntersections = entries => entries.forEach(entry => {
    // entry.target is the image element that is being observed
    const image = entry.target
    // if the image is no longer active, forget it and return
    if (!this.isActiveImage(image)) {
      this.forgetImage(image)
      return
    }
    // if the image is not intersecting (not in the viewport), return
    if (!entry.isIntersecting) return
    // refresh the image and unobserve it, because we only need to refresh it once when it comes into view
    this.refreshImage(image)
    this.imageObserver?.unobserve(image)
  })

  toggle = record => {
    // look the current state of the image, if it is collapsed, expand it, if it is expanded, collapse it
    record.manual = record.wrapper.classList.contains(this.collapsedClass) ? "expanded" : "collapsed"
    this.refreshImage(record.image)
    // make sure the image is in view after toggling, if it is collapsed, scroll it into view
    if (record.manual === "collapsed") record.control?.scrollIntoView({ block: "nearest" })
  }

  // onImageLoad is called when an image is loaded. It observes the image and refreshes its presentation.
  onImageLoad = ev => this.observeImage(ev.target, true)

  // click event handler for the control. It toggles the state of the image when the control is clicked.
  onClick = ev => {
    // find the closest control element to the click target, if it is not a control or not in the write area, return
    const control = ev.target.closest?.(`.${this.controlClass}`)
    if (!control || !this.utils.entities.eWrite.contains(control)) {
      return
    }
    // find the image element
    const image = control.closest(".md-image.md-img-loaded")?.querySelector(":scope > img")
    const record = image && this.records.get(image)
    if (record) this.toggle(record)
  }

  onMutations = mutations => mutations.forEach(mutation => {
    if (mutation.type === "attributes") {
      if (mutation.attributeName === "class") {
        // has the class now?
        const loaded = mutation.target.classList?.contains("md-img-loaded")
        // was the class before?
        const wasLoaded = mutation.oldValue?.split(/\s+/).includes("md-img-loaded")
        if (loaded === wasLoaded) return
        // if the image is now loaded, observe it, otherwise forget it
        this.forEachMarkdownImage(mutation.target, loaded ? image => this.observeImage(image, true) : this.forgetImage)
        return
      }
      this.forEachMarkdownImage(mutation.target, image => this.observeImage(image, true))
      return
    }
    mutation.addedNodes.forEach(node => this.forEachMarkdownImage(node, this.observeImage))
    mutation.removedNodes.forEach(node => this.forEachMarkdownImage(node, this.forgetImage))
  })

  // make sure export cleanly, without any plugin-collapse-image related elements or classes.
  beforeExportToNative = () => this.records.forEach(this.clearPresentation)

  restoreAfterNativeExport = () => this.refresh()

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
