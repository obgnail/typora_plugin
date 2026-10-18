const MARKDOWN_IMAGE_SELECTOR = ".md-image.md-img-loaded > img"
const COLLAPSED_CLASS = "plugin-collapse-image-collapsed"
const EXPANDED_CLASS = "plugin-collapse-image-expanded"
const CONTROL_LABEL_ATTRIBUTE = "data-plugin-collapse-image-label"
const COLLAPSED_CONTROL_HEIGHT = 64
const EXPANDED_CONTROL_HEIGHT = 44

const createImageRecords = ({ getSource, clearPresentation }) => {
  const records = new Map()

  const get = image => {
    let record = records.get(image)
    if (!record) {
      record = { image, wrapper: image.parentElement, source: getSource(image), manual: null }
      records.set(image, record)
    }
    return record
  }

  const forget = image => {
    const record = records.get(image)
    if (!record) return
    clearPresentation(record)
    records.delete(image)
  }

  return {
    get,
    forget,
    reset: () => {
      records.forEach(clearPresentation)
      records.clear()
    },
    forEach: callback => records.forEach(callback),
    has: image => records.has(image),
  }
}

class CollapseImagePlugin extends BasePlugin {
  _records = null
  _imageObserver = null
  _mutationObserver = null

  style = () => `
#write .md-image.${COLLAPSED_CLASS},
#write .md-image.${EXPANDED_CLASS} {
  position: relative;
  display: block;
}
#write .md-image.${COLLAPSED_CLASS} {
  max-height: var(--plugin-collapse-image-height);
  overflow: hidden;
}
#write .md-image.${COLLAPSED_CLASS} > img {
  display: block;
}
#write .md-image[${CONTROL_LABEL_ATTRIBUTE}]::before {
  content: attr(${CONTROL_LABEL_ATTRIBUTE});
  box-sizing: border-box;
  width: 100%;
  min-height: 36px;
  padding: 12px 16px 8px;
  color: var(--text-color);
  cursor: pointer;
  text-align: center;
  user-select: none;
}
#write .${COLLAPSED_CLASS}[${CONTROL_LABEL_ATTRIBUTE}]::before {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  padding-top: 36px;
  background: linear-gradient(to bottom, transparent, var(--bg-color) 60%);
}
#write .md-image.${EXPANDED_CLASS} {
  margin-bottom: ${EXPANDED_CONTROL_HEIGHT}px;
}
#write .${EXPANDED_CLASS}[${CONTROL_LABEL_ATTRIBUTE}]::before {
  position: absolute;
  top: 100%;
  right: 0;
  left: 0;
}`

  process = () => {
    const { eWrite, eContent } = this.utils.entities
    const { eventHub, exportHelper } = this.utils
    this._records = createImageRecords({ getSource: this._getSource, clearPresentation: this._clearPresentation })
    this._refreshDebounced = this.utils.debounce(this._refresh, 100)

    eventHub.on(eventHub.eventType.fileContentLoaded, this._resetForFile)
    eventHub.on(eventHub.eventType.allPluginsHadInjected, this._refreshDebounced)
    eventHub.on(eventHub.eventType.fileOpened, this._refreshDebounced)

    exportHelper.register(this.fixedName, null, this._afterExportToHTML)
    this._handleNativeExport()

    eWrite.addEventListener("load", this._onImageLoad, true)
    eWrite.addEventListener("click", this._onClick)

    this._imageObserver = new IntersectionObserver(this._onIntersections)
    new ResizeObserver(this._refreshDebounced).observe(eContent)

    this._mutationObserver = new MutationObserver(this._onMutations)
    this._mutationObserver.observe(eWrite, { childList: true, subtree: true, attributes: true, attributeOldValue: true, attributeFilter: ["src", "class"] })

    this._refresh()
  }

    // "image" is dom element of <img> tag
  _isMarkdownImage = image => image?.matches?.(MARKDOWN_IMAGE_SELECTOR)

  // loaded markdown image and is in the write area
  _isActiveImage = image => this.utils.entities.eWrite.contains(image) && this._isMarkdownImage(image)

  // Typora keeps the original Markdown URL on the wrapper and mutates img.src.
  _getSource = image => image.parentElement?.getAttribute("data-src") || image.getAttribute("src") || image.currentSrc || ""

  _isLongImage = image => image.offsetHeight > this.config.TRIGGER_HEIGHT

  _forEachMarkdownImage = (node, callback) => {
    if (node?.nodeType !== document.ELEMENT_NODE) return
    if (this._isMarkdownImage(node)) callback(node)
    node.querySelectorAll?.(MARKDOWN_IMAGE_SELECTOR).forEach(callback)
  }

  _clearPresentation = record => {
    const { wrapper } = record
    wrapper.classList.remove(COLLAPSED_CLASS, EXPANDED_CLASS)
    wrapper.style.removeProperty("--plugin-collapse-image-height")
    wrapper.removeAttribute(CONTROL_LABEL_ATTRIBUTE)
  }

  _render = (record, collapsed) => {
    const { wrapper } = record
    // toggle the classes on the wrapper based on the collapsed state
    // set the height of the wrapper to the collapsed height if collapsed, otherwise remove the height property
    wrapper.classList.toggle(COLLAPSED_CLASS, collapsed)
    wrapper.classList.toggle(EXPANDED_CLASS, !collapsed)
    if (collapsed) {
      wrapper.style.setProperty("--plugin-collapse-image-height", `${this.config.COLLAPSED_HEIGHT}px`)
    } else {
      wrapper.style.removeProperty("--plugin-collapse-image-height")
    }
    wrapper.setAttribute(CONTROL_LABEL_ATTRIBUTE, this.i18n.t(collapsed ? "act.expand" : "act.collapse"))
  }

  _refreshImage = image => {
    // no need to refresh if the image is not a markdown image
    if (!this._isMarkdownImage(image)) return
    const record = this._records.get(image)
    record.wrapper = image.parentElement
    const source = this._getSource(image)
    if (record.source !== source) {
      record.source = source
      record.manual = null
    }
    if (!this._isLongImage(image)) {
      record.manual = null
      this._clearPresentation(record)
      return
    }
    // render the image based on the manual state, if manual state is null, use the default collapsed state from config
    this._render(record, record.manual !== "expanded")
  }

  // observeImage is called when the image is in the viewport and should be observed for changes. It adds the image to the observer and refreshes its presentation.
  _observeImage = (image, force = false) => {
    if (!this._isActiveImage(image)) return
    if (force) this._imageObserver.unobserve(image)
    this._imageObserver.observe(image)
  }

// forgetImage is called when the image is no longer in the DOM or no longer active. It removes the image from the observer and clears its presentation.
  _forgetImage = image => {
    this._imageObserver.unobserve(image)
    this._records.forget(image)
  }

  _refresh = () => {
    const images = [...this.utils.entities.eWrite.querySelectorAll(MARKDOWN_IMAGE_SELECTOR)]
    const active = new Set(images)
    images.forEach(this._observeImage)
    this._records.forEach((record, image) => {
      if (!active.has(image)) this._forgetImage(image)
    })
  }

  _resetForFile = () => {
    this._imageObserver.disconnect()
    this._records.reset()
    this._refresh()
  }

  _onIntersections = entries => entries.forEach(({ target: image, isIntersecting }) => {
    if (!this._isActiveImage(image)) {
      this._forgetImage(image)
      return
    }
    if (!isIntersecting) return
    this._refreshImage(image)
    this._imageObserver.unobserve(image)
  })

  _toggle = record => {
    // look the current state of the image, if it is collapsed, expand it, if it is expanded, collapse it
    record.manual = record.wrapper.classList.contains(COLLAPSED_CLASS) ? "expanded" : "collapsed"
    this._refreshImage(record.image)
    if (record.manual === "collapsed") record.wrapper.scrollIntoView({ block: "nearest" })
  }

  // onImageLoad is called when an image is loaded. It observes the image and refreshes its presentation.
  _onImageLoad = ev => this._observeImage(ev.target, true)

  // click event handler for the control. It toggles the state of the image when the control is clicked.
  _onClick = ev => {
    const wrapper = ev.target.closest?.(".md-image.md-img-loaded")
    if (ev.target !== wrapper || !this.utils.entities.eWrite.contains(wrapper)) return
    const controlHeight = wrapper.classList.contains(COLLAPSED_CLASS) ? COLLAPSED_CONTROL_HEIGHT : EXPANDED_CONTROL_HEIGHT
    if (ev.offsetY < wrapper.offsetHeight - controlHeight) return
    const record = this._records.get(wrapper.querySelector(":scope > img"))
    if (record) this._toggle(record)
  }

  _onMutations = mutations => mutations.forEach(mutation => {
    if (mutation.type === "attributes") {
      if (mutation.attributeName === "class") {
        const loaded = mutation.target.classList?.contains("md-img-loaded")
        const wasLoaded = mutation.oldValue?.split(/\s+/).includes("md-img-loaded")
        if (loaded === wasLoaded) return
        // if the image is now loaded, observe it, otherwise forget it
        this._forEachMarkdownImage(mutation.target, loaded ? image => this._observeImage(image, true) : this._forgetImage)
        return
      }
      this._forEachMarkdownImage(mutation.target, image => this._observeImage(image, true))
      return
    }
    mutation.addedNodes.forEach(node => this._forEachMarkdownImage(node, this._observeImage))
    mutation.removedNodes.forEach(node => this._forEachMarkdownImage(node, this._forgetImage))
  })

  _handleNativeExport = () => {
    let manualStates = new Map()
    const getImages = () => [...this.utils.entities.eWrite.querySelectorAll(MARKDOWN_IMAGE_SELECTOR)]
    const before = () => {
      manualStates = new Map()
      getImages().forEach((image, index) => {
        const manual = this._records.get(image)?.manual
        if (manual) manualStates.set(index, manual)
      })
      this._records.forEach(this._clearPresentation)
    }
    const restore = () => {
      getImages().forEach((image, index) => {
        const manual = manualStates.get(index)
        if (manual) this._records.get(image).manual = manual
      })
      manualStates.clear()
      this._refresh()
    }
    this.utils.exportHelper.registerNative(this.fixedName, before, null, restore)
  }

  _afterExportToHTML = html => html
    .replace(/\splugin-collapse-image-(?:collapsed|expanded)\b/g, "")
    .replace(/\sdata-plugin-collapse-image-label="[^"]*"/g, "")
    .replace(/\sstyle="([^"]*?)"/g, (_, style) => {
      const cleaned = style.split(";").filter(item => !item.trim().startsWith("--plugin-collapse-image-height")).join(";").trim()
      return cleaned ? ` style="${cleaned}"` : ""
    })
}

module.exports = {
  plugin: CollapseImagePlugin,
}
