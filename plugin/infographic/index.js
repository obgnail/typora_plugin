class InfographicPlugin extends BasePlugin {
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
      checkSelector: ".plugin-infographic-content",
      wrapElement: `<div class="plugin-infographic-content"></div>`,
      lazyLoadFunc: this.lazyLoad,
      beforeRenderFunc: null,
      renderStyleGetter: parser.helpers.renderStyle.base,
      createFunc: this.create,
      updateFunc: this.update,
      destroyFunc: this.destroy,
      beforeExportToNative: null,
      beforeExportToHTML: null,
      exportStyleGetter: null,
      versionGetter: this.getVersion,
    })
  }

  lazyLoad = async () => this.utils.insertScript(this.config.RESOURCE_URI)

  create = async ($wrap, content, meta) => {
    const { Infographic } = global.AntVInfographic
    const infographic = new Infographic({ container: $wrap[0] })
    infographic.render(content)
    return infographic
  }

  update = ($wrap, content, instance) => instance.update(content)

  destroy = instance => instance.destroy()

  getVersion = () => global.AntVInfographic.VERSION
}

module.exports = {
  plugin: InfographicPlugin,
}
