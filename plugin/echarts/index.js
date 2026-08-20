class EchartsPlugin extends BasePlugin {
  ECharts = null
  DECAL_OPTIONS = { aria: { enabled: true, decal: { show: true } } }

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
        locale: { type: "string", enum: ["en", "zh"], default: this.config.LOCALE },
        theme: { type: "string", enum: ["light", "dark"], default: this.config.THEME },
        renderer: { type: "string", enum: ["svg", "canvas"], default: this.config.RENDERER },
        useDirtyRect: { type: "boolean", default: this.config.USE_DIRTY_RECT },
        decal: { type: "boolean", default: this.config.DECAL_PATTERN },
        resize: { type: "boolean", default: this.config.AUTO_RESIZE },
      },
      checkSelector: ".plugin-echarts-content",
      wrapElement: `<div class="plugin-echarts-content"></div>`,
      lazyLoadFunc: this.lazyLoad,
      beforeRenderFunc: null,
      renderStyleGetter: parser.helpers.renderStyle.base,
      createFunc: this.create,
      updateFunc: null,
      destroyFunc: this.destroy,
      beforeExportToNative: null,
      beforeExportToHTML: this.beforeExportToHTML,
      exportStyleGetter: null,
      versionGetter: this.getVersion,
    })
  }

  create = ($wrap, content, meta) => {
    const { theme, locale, renderer, useDirtyRect, decal, resize } = meta
    const myChart = this.ECharts.init($wrap[0], theme, { locale, renderer, useDirtyRect })
    this._draw(myChart, content, decal, resize)
    return myChart
  }

  _draw = (myChart, content, decal, resize) => {
    // myChart.showLoading()
    let echarts = this.ECharts
    let option = {}
    eval(content)
    if (decal) Object.assign(option, this.DECAL_OPTIONS)
    myChart.clear()
    myChart.setOption(option)
    if (resize) myChart.resize()
    // myChart.hideLoading()
  }

  destroy = instance => {
    instance.clear()
    instance.dispose()
  }

  beforeExportToHTML = (preview, instance) => {
    instance.setOption({ animation: false })
    if (this.config.RENDERER.toLowerCase() === "canvas") {
      const t = this.config.EXPORT_TYPE.toLowerCase()
      const type = ["png", "jpg"].includes(t) ? t : "jpg"
      const img = new Image()
      img.src = instance.getDataURL({ type })
      $(preview).html(img)
    } else {
      const svg = instance.renderToSVGString()
      $(preview).html(svg)
    }
  }

  getVersion = () => this.ECharts?.version

  lazyLoad = () => this.ECharts = require("./echarts.min.js")
}

module.exports = {
  plugin: EchartsPlugin,
}
