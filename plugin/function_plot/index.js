class FunctionPlotPlugin extends BasePlugin {
  driver = this.utils.identity

  hotkey = () => [{ hotkey: this.config.HOTKEY, callback: this.call }]

  call = () => this.utils.insertBlockCode(null, this.config.LANGUAGE, this.config.TEMPLATE)

  process = () => {
    const parser = this.utils.thirdPartyDiagramParser
    parser.register({
      lang: this.config.LANGUAGE,
      mappingLang: "javascript",
      destroyWhenUpdate: false,
      interactiveMode: this.config.INTERACTIVE_MODE,
      metaConfigSchema: parser.helpers.styleMetaConfigSchema.wrapDefaultStyle({
        height: this.config.DEFAULT_FENCE_HEIGHT,
        backgroundColor: this.config.DEFAULT_FENCE_BACKGROUND_COLOR,
      }),
      checkSelector: ".plugin-function-plot-content",
      wrapElement: `<div class="plugin-function-plot-content"></div>`,
      lazyLoadFunc: this.lazyLoad,
      beforeRenderFunc: null,
      renderStyleGetter: parser.helpers.renderStyle.base,
      createFunc: this.create,
      updateFunc: this.update,
      destroyFunc: this.destroy,
      beforeExportToNative: null,
      beforeExportToHTML: this.beforeExportToHTML,
      exportStyleGetter: null,
      versionGetter: this.getVersion,
    })
  }

  create = ($wrap, content, meta) => {
    const options = this._toOptions(content)
    return this.driver().create($wrap[0], options)
  }

  update = ($wrap, content, instance) => {
    const options = this._toOptions(content)
    instance.update(options)
  }

  _toOptions = (content) => {
    let options = {}
    eval(content)
    return options
  }

  destroy = instance => instance.destroy()

  lazyLoad = () => this.driver = require("./factory.js")

  beforeExportToHTML = (preview, instance) => {
    preview.querySelector(".tip")?.remove()
    preview.querySelector(".top-right-legend")?.remove()
  }

  getVersion = () => "1.25.4"
}

module.exports = {
  plugin: FunctionPlotPlugin,
}
