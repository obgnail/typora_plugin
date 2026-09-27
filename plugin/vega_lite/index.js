class VegaLitePlugin extends BasePlugin {
  hotkey = () => [{ hotkey: this.config.HOTKEY, callback: this.call }]

  call = () => this.utils.insertBlockCode(null, this.config.LANGUAGE, this.config.TEMPLATE)

  process = () => {
    const parser = this.utils.thirdPartyDiagramParser
    parser.register({
      lang: this.config.LANGUAGE,
      mappingLang: "application/json",
      destroyWhenUpdate: false,
      interactiveMode: this.config.INTERACTIVE_MODE,
      metaConfigSchema: {
        ...parser.helpers.styleMetaConfigSchema.wrapDefaultStyle({
          height: this.config.DEFAULT_FENCE_HEIGHT,
          backgroundColor: this.config.DEFAULT_FENCE_BACKGROUND_COLOR,
        }),
        renderer: { type: "string", enum: ["svg", "canvas"], default: this.config.RENDERER },
        theme: { type: "string", enum: ["excel", "ggplot2", "quartz", "vox", "fivethirtyeight", "dark"], default: this.config.THEME },
      },
      checkSelector: ".plugin-vega-lite-content",
      wrapElement: `<div class="plugin-vega-lite-content"></div>`,
      lazyLoadFunc: this.lazyLoad,
      beforeRenderFunc: null,
      renderStyleGetter: parser.helpers.renderStyle.base,
      createFunc: this.create,
      updateFunc: null,
      destroyFunc: this.destroy,
      beforeExportToNative: null,
      beforeExportToHTML: null,
      exportStyleGetter: null,
      versionGetter: this.getVersion,
    })
  }

  create = async ($wrap, content, meta) => {
    const spec = JSON.parse(content)
    const options = { renderer: meta.renderer, theme: meta.theme, actions: false }
    return await window.vegaEmbed($wrap[0], spec, options)
  }

  destroy = instance => instance.finalize()

  getVersion = () => window.vegaLite?.version

  lazyLoad = async () => {
    for (const lib of ["vega", "vega_lite", "vega_embed"]) {
      await this.utils.insertScript(this.config.RESOURCE_URI[lib])
    }
  }
}

module.exports = {
  plugin: VegaLitePlugin,
}
