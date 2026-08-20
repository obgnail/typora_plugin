class ChartPlugin extends BasePlugin {
  Chart = null

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
        align: { type: "string", enum: ["left", "center", "right"], valueAliases: { l: "left", c: "center", r: "right" }, default: this.config.CHART_ALIGN },
      },
      checkSelector: ".plugin-chart-content",
      wrapElement: `<div class="plugin-chart-content"><canvas></canvas></div>`,
      lazyLoadFunc: this.lazyLoad,
      beforeRenderFunc: null,
      renderStyleGetter: parser.helpers.renderStyle.wrapMeta(meta => ({ display: "flex", justifyContent: meta.align })),
      createFunc: this.create,
      updateFunc: null,
      destroyFunc: this.destroy,
      beforeExportToNative: null,
      beforeExportToHTML: this.beforeExportToHTML,
      exportStyleGetter: null,
      versionGetter: this.getVersion,
    })
  }

  create = ($wrap, content) => {
    const canvas = $wrap.find("canvas")?.[0]
    if (canvas) {
      return this.drawChart(canvas.getContext("2d"), content)
    }
  }

  destroy = instance => {
    instance.clear()
    instance.destroy()
  }

  drawChart = (ctx, content) => {
    let config = {}
    const Chart = this.Chart.Chart
    eval(content)
    return new Chart(ctx, config)
  }

  beforeExportToHTML = (preview, instance) => {
    const img = new Image()
    img.src = instance.toBase64Image()
    $(preview).html(img)
  }

  getVersion = () => this.Chart?.version

  lazyLoad = () => this.Chart = require("./chart.min.js")
}

module.exports = {
  plugin: ChartPlugin,
}
