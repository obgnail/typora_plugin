/**
 * `renderWaveForm` takes the numeric index and string prefix separately instead of a
 * single element ID string — the target element's ID is 'prefix+index':
 *   const wavedrom = require('wavedrom')
 *   const div = document.createElement('div')
 *   div.id = 'a0'
 *   document.body.appendChild(div)
 *   const notFirstSignal = false
 *   wavedrom.renderWaveForm(0, { signal: [] }, 'a', notFirstSignal)
 *
 * Rationale (per the author): the 'a0' SVG caches building blocks (wave bricks, CSS, etc.)
 * that later diagrams on the same page inherit, making them lighter.
 * See: https://github.com/wavedrom/wavedrom/issues/116
 *
 * This breaks in Typora, where diagrams are deleted and re-rendered frequently.
 * If the 'a0' SVG no longer exists (chart recreated after edit, or all charts re-rendered),
 * `notFirstSignal = true` throws. So it must always be `false`.
 *
 * Wavedrom is designed for static pages, not SPAs: it never removes its event listeners
 * and has no removal API, so listener-registering functions (e.g., `wavedrom.processAll`)
 * must be avoided to prevent memory leaks.
 *
 * Wavedrom's docs are incomplete — read the source when in doubt.
 */
class WavedromPlugin extends BasePlugin {
  Wavedrom = null
  skins = {}
  PREFIX = "WaveDrom_Display_"
  evalFn = this.config.SAFE_MODE ? this.utils.safeEval : this.utils.unsafeEval

  prepare = async () => {
    const { FsExtra, Path } = this.utils.Package
    try {
      const folder = this.utils.resolvePluginPath(this.config.SKIN_FOLDER)
      const modules = await FsExtra.readdir(folder)
      this.skins = Object.fromEntries(
        modules
          .map(file => this.utils.resolvePluginPath(folder, file))
          .map(path => [Path.parse(path).name, path]),
      )
    } catch (err) {
      console.error(err)
    }
  }

  hotkey = () => [{ hotkey: this.config.HOTKEY, callback: this.call }]

  call = () => this.utils.insertBlockCode(null, this.config.LANGUAGE, this.config.TEMPLATE)

  process = () => {
    let idx = 0
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
        skin: { type: "string", enum: ["default", ...Object.keys(this.skins)], default: "default" },
        hscale: { type: "number", default: 1 },
      },
      checkSelector: ".plugin-wavedrom-content",
      wrapElement: () => `<div class="plugin-wavedrom-content" id="${this.PREFIX + ++idx}"></div>`,
      lazyLoadFunc: this.lazyLoad,
      beforeRenderFunc: null,
      renderStyleGetter: parser.helpers.renderStyle.wrapMeta(meta => ({ display: "flex", justifyContent: meta.align })),
      createFunc: this.create,
      updateFunc: null,
      destroyFunc: null,
      beforeExportToNative: null,
      beforeExportToHTML: null,
      exportStyleGetter: parser.helpers.exportStyle.svg,
      versionGetter: this.getVersion,
    })
  }

  create = ($wrap, content, meta) => {
    const index = parseInt($wrap.attr("id").slice(this.PREFIX.length))
    const waveJson = Object.assign({ config: { skin: meta.skin, hscale: meta.hscale } }, this.evalFn(content))
    const notFirstSignal = false
    this.Wavedrom.renderWaveForm(index, waveJson, this.PREFIX, notFirstSignal)
  }

  getVersion = () => this.Wavedrom?.version

  lazyLoad = async () => {
    this.Wavedrom = require("./wavedrom.min.js")
    const skins = Object.values(this.skins).map(require)
    window.WaveSkin = Object.assign(this.Wavedrom.waveSkin, ...skins)  // renderWaveForm() will use window.WaveSkin
  }
}

module.exports = {
  plugin: WavedromPlugin,
}
