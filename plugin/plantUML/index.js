const { defaultModeResolver, createRenderEngine } = require("./server.js")

class PlantUMLPlugin extends BasePlugin {
  hotkey = () => [{ hotkey: this.config.HOTKEY, callback: this.call }]

  call = () => this.utils.insertBlockCode(null, this.config.LANGUAGE, this.config.TEMPLATE)

  process = () => {
    const parser = this.utils.thirdPartyDiagramParser
    parser.register({
      lang: this.config.LANGUAGE,
      mappingLang: null,
      destroyWhenUpdate: false,
      interactiveMode: this.config.INTERACTIVE_MODE,
      metaConfigSchema: null,
      checkSelector: ".plugin-plantuml-content",
      wrapElement: `<div class="plugin-plantuml-content"></div>`,
      lazyLoadFunc: this.lazyLoad,
      beforeRenderFunc: null,
      renderStyleGetter: parser.helpers.renderStyle.wrapDefault({
        height: this.config.DEFAULT_FENCE_HEIGHT,
        backgroundColor: this.config.DEFAULT_FENCE_BACKGROUND_COLOR,
      }),
      createFunc: this.create,
      updateFunc: null,
      destroyFunc: null,
      beforeExportToNative: null,
      beforeExportToHTML: null,
      exportStyleGetter: parser.helpers.exportStyle.svg,
      versionGetter: null,
    })
  }

  create = async ($wrap, content) => {
    $wrap[0].textContent = "Querying..."
    const result = await this._memorizedRender(content)
    if (result instanceof Error) throw result
    $wrap[0].innerHTML = this._buildHTML(result)
  }

  _buildHTML({ contentType, buffer }) {
    if (contentType.includes("svg")) return buffer.toString("utf-8")
    if (contentType.includes("image/")) return `<img src="data:${contentType};base64,${buffer.toString("base64")}">`
    if (contentType.includes("text/plain")) return `<pre>${buffer.toString("utf-8")}</pre>`
    throw new Error(`Unsupported Format: ${contentType}`)
  }

  lazyLoad = () => {
    this._memorizedRender = this.utils.memoizeLimited(
      createRenderEngine({
        fetch: this.utils.fetch,
        getBaseUrl: () => this.config.SERVER_URL.replace(/\/+$/, ""),
        getFormat: () => this.config.OUTPUT_FORMAT,
        getTimeout: () => this.config.SERVER_TIMEOUT,
        getProxy: () => this.config.PROXY,
        resolveMode: defaultModeResolver,
      }),
      { cap: this.config.CACHED_URL_COUNT, keyResolver: this.utils.identity },
    )
  }
}

module.exports = {
  plugin: PlantUMLPlugin,
}
