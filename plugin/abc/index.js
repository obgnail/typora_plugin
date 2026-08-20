class ABCPlugin extends BasePlugin {
  ABCJS = null

  hotkey = () => [{ hotkey: this.config.HOTKEY, callback: this.call }]

  call = () => this.utils.insertBlockCode(null, this.config.LANGUAGE, this.config.TEMPLATE)

  process = () => {
    const defaults = (prop, fallback) => Object.hasOwn(this.config.RENDER_OPTIONS, prop) ? this.config.RENDER_OPTIONS[prop] : fallback
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
        scale: { type: "number", default: defaults("scale", 1.0) },
        staffwidth: { type: "number", default: defaults("staffwidth", 400) },
        responsive: { type: "string", default: defaults("responsive", "resize") },
        selectionColor: { type: "string", default: defaults("selectionColor", "#FF0000") },
      },
      checkSelector: ".plugin-notation-content",
      wrapElement: `<div class="plugin-notation-content"></div>`,
      lazyLoadFunc: this.lazyLoad,
      beforeRenderFunc: null,
      renderStyleGetter: parser.helpers.renderStyle.base,
      createFunc: this.create,
      updateFunc: null,
      destroyFunc: null,
      beforeExportToNative: null,
      beforeExportToHTML: null,
      exportStyleGetter: null,
      versionGetter: this.getVersion,
    })
  }

  create = ($wrap, content, meta) => {
    this.ABCJS.renderAbc($wrap[0], content, { ...this.config.RENDER_OPTIONS, ...meta })
  }

  getVersion = () => this.ABCJS?.signature

  lazyLoad = () => this.ABCJS = require("./abcjs-basic-min.js")
}

module.exports = {
  plugin: ABCPlugin,
}
