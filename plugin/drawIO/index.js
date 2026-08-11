const fixDiagramForExport = require("./fix_export.js")

const INTERACTION_TYPE = {
  default: {},
  showOnly: { highlight: "#0000ff", nav: false, resize: false, edit: null, editable: false, lightbox: false, zoom: "1", toolbar: null, "toolbar-nohide": true },
  clickable: { highlight: "#0000ff", nav: false, resize: true, edit: null, editable: false, toolbar: null, "toolbar-nohide": true },
  showToolbar: {
    highlight: "#0000ff", nav: true, resize: true, edit: null, editable: true, lightbox: false,
    zoom: "1", toolbar: "zoom lightbox layers", "toolbar-position": "inline", "toolbar-nohide": true,
  },
}

class DrawIOPlugin extends BasePlugin {
  _memorizedFetch = this.utils.memoizeLimited(async url => {
    const resp = await this.utils.fetch(url, { timeout: this.config.SERVER_TIMEOUT, proxy: this.config.PROXY })
    return resp.text()
  }, { cap: this.config.CACHED_URL_COUNT, keyResolver: this.utils.identity })

  style = () => `
#write .plugin-drawio-content, .geDiagramContainer svg { line-height: initial; }
@media print {
  .fix-drawio-unlocked {
    width: 100% !important;
    max-width: 100% !important;
    height: auto !important;
    min-width: 0 !important;
    margin: 0 auto !important;
    padding: 0 !important;
    display: block !important;
    overflow: visible !important;
  }
  svg.fix-drawio-svg {
    width: 100% !important;
    height: auto !important;
    background: transparent !important;
    display: block !important;
  }
}`

  hotkey = () => [{ hotkey: this.config.HOTKEY, callback: this.call }]

  call = () => this.utils.insertBlockCode(null, this.config.LANGUAGE, this.config.TEMPLATE)

  process = () => {
    const parser = this.utils.thirdPartyDiagramParser
    parser.register({
      lang: this.config.LANGUAGE,
      mappingLang: "javascript",
      destroyWhenUpdate: false,
      interactiveMode: this.config.INTERACTIVE_MODE,
      metaConfigSchema: {
        ...parser.helpers.styleMetaConfigSchema.wrapDefaultStyle({
          height: this.config.DEFAULT_FENCE_HEIGHT,
          backgroundColor: this.config.DEFAULT_FENCE_BACKGROUND_COLOR,
        }),
        interaction: { type: "string", enum: Object.keys(INTERACTION_TYPE), default: "showOnly" },
      },
      checkSelector: ".plugin-drawio-content",
      wrapElement: `<div class="plugin-drawio-content"></div>`,
      lazyLoadFunc: this.lazyLoad,
      beforeRenderFunc: null,
      renderStyleGetter: parser.helpers.renderStyle.base,
      createFunc: this.create,
      updateFunc: null,
      destroyFunc: null,
      beforeExportToNative: null,
      beforeExportToHTML: this.beforeExportToHTML,
      exportStyleGetter: this.getStyleContent,
      versionGetter: null,
    })
  }

  create = async ($wrap, content, meta) => {
    const graphConfig = this.utils.safeEval(content)
    if (!graphConfig.source && !graphConfig.xml) {
      throw new Error(this.i18n.t("error.missingSource"))
    }
    if (!graphConfig.xml) {
      graphConfig.xml = await this._getResource(
        graphConfig.source,
        async (source) => {
          $wrap[0].textContent = "Fetching Network Resource..."
          return this._memorizedFetch(source)
        },
        async (source) => {
          // $wrap[0].textContent = "Fetching Local Resource..."
          const dir = this.utils.getLocalRootUrl()
          const path = this.utils.Package.Path.resolve(dir, source)
          return this.utils.Package.FsExtra.readFile(path, "utf-8")
        },
      )
    }

    const presetConfig = INTERACTION_TYPE[meta.interaction]
    const mxGraphData = { ...presetConfig, ...graphConfig }
    return this._render($wrap[0], mxGraphData)
  }

  _getResource = async (source, onRemote, onLocal) => {
    const isNetwork = this.utils.isNetworkURI(source)
    try {
      const fetchFn = isNetwork ? onRemote : onLocal
      return fetchFn(source)
    } catch (e) {
      const msg = this.i18n.t(isNetwork ? "error.getFileFailedFromNetwork" : "error.getFileFailedFromLocal")
      throw new Error(`${msg}: ${source}\n\n${e}`)
    }
  }

  _refresh = this.utils.debounce(() => window.GraphViewer.processElements(), 100)

  _render = (container, mxGraphData) => {
    const viewer = document.createElement("div")
    viewer.className = "mxgraph"
    viewer.style.cssText = "max-width: 100%; margin: 26px auto 0;"
    viewer.dataset.mxgraph = JSON.stringify(mxGraphData)
    container.replaceChildren(viewer)
    this._refresh()

    return container
  }

  lazyLoad = async () => {
    const from = this.config.RESOURCE_URI
    const path = this.utils.isNetworkURI(from) ? from : this.utils.toFileProtocol(this.utils.Package.Path.resolve(from))
    await $.getScript(path)
    if (typeof window.Graph?.sanitizeHtml === "function") {
      window.Graph.sanitizeHtml = (html) => html
    }
    window.GraphViewer.prototype.toolbarZIndex = 7
  }

  beforeExportToHTML = (preview, instance) => {
    const graph = preview.querySelector(".mxgraph")
    fixDiagramForExport(graph, graph.querySelector("svg"))
    if (graph) {
      graph.removeAttribute("data-mxgraph")
      graph.querySelectorAll(":scope > *:not(svg)").forEach(el => el.remove())
    }
  }

  getStyleContent = () => this.utils.getStyleText(this.fixedName)
}

module.exports = {
  plugin: DrawIOPlugin,
}
