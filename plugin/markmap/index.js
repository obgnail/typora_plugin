const FenceMarkmap = require("./fence.js")
const TOCMarkmap = require("./toc.js")

class MarkmapPlugin extends BasePlugin {
  Lib = {}
  tocMarkmap = this.config.ENABLE_TOC_MARKMAP ? new TOCMarkmap(this) : null
  fenceMarkmap = this.config.ENABLE_FENCE_MARKMAP ? new FenceMarkmap(this) : null
  staticActions = this.i18n.fillActions([
    { act_value: "draw_fence_outline", act_hotkey: this.config.FENCE_HOTKEY, act_hidden: !this.fenceMarkmap },
    { act_value: "draw_fence_template", act_hidden: !this.fenceMarkmap },
    { act_value: "toggle_toc", act_hotkey: this.config.TOC_HOTKEY, act_hidden: !this.tocMarkmap },
  ])

  style = () => true

  html = () => this.tocMarkmap?.html()

  hotkey = () => [this.tocMarkmap, this.fenceMarkmap].filter(Boolean).flatMap(p => p.hotkey())

  process = () => {
    this.tocMarkmap?.init()
    this.tocMarkmap?.process()
    this.fenceMarkmap?.process()
  }

  call = async action => {
    if (action === "toggle_toc") {
      await this.tocMarkmap?.callback(action)
    } else if (action === "draw_fence_template" || action === "draw_fence_outline") {
      await this.fenceMarkmap?.callback(action)
    }
  }

  onButtonClick = () => this.tocMarkmap?.callback()

  getToc = (
    fixSkip = this.config.FIX_SKIPPED_LEVEL_HEADERS,
    removeStyles = this.config.REMOVE_HEADER_STYLES,
  ) => {
    const tree = this.utils.getTocTree(removeStyles)
    const getHeaders = (node, ret, indent) => {
      const head = "#".repeat(fixSkip ? indent : node.depth)
      ret.push(`${head} ${node.text}`)
      for (const child of node.children) {
        getHeaders(child, ret, indent + 1)
      }
      return ret
    }
    return getHeaders(tree, [], 0).slice(1).join("\n")
  }

  assignOptions = (update, origin) => {
    const options = this.Lib.deriveOptions({ ...origin, ...update })
    // `toggleRecursively` is deleted after calling deriveOptions
    options.toggleRecursively = update.toggleRecursively
    return options
  }

  lazyLoad = async () => {
    if (this.Lib.transformerVersions) return

    const localImagePlugin = resolveImageSrcPlugin(
      src => src && !this.utils.isNetworkImage(src) && !this.utils.isSpecialImage(src),
      src => this.utils.Package.Path.resolve(this.utils.getLocalRootUrl(), src),
    )
    const { Transformer, transformerVersions, builtInPlugins, markmap } = require("./resource/markmap.min.js")
    const transformer = new Transformer([...builtInPlugins, localImagePlugin])
    Object.assign(this.Lib, markmap, { transformer, transformerVersions })

    const { styles, scripts } = transformer.getAssets()
    this.localizeResources(styles, scripts)

    await markmap.loadCSS(styles)
    await markmap.loadJS(scripts, { getMarkmap: () => markmap })
  }

  localizeResources = (styles = [], scripts = []) => {
    const katexBase = "./plugin/global/core/lib/katex"
    const pluginBase = "./plugin/markmap/resource/"
    const localResources = {
      "katex.min.js": this.utils.joinPluginPath(katexBase, "katex.js"),
      "katex.min.css": this.utils.joinPluginPath(katexBase, "katex.min.css"),
      "default.min.css": this.utils.joinPluginPath(pluginBase, "default.min.css"),
      "webfontloader.js": this.utils.joinPluginPath(pluginBase, "webfontloader.js"),
    }
    const localize = (items, expectedType, urlProp) => {
      for (const item of items) {
        if (item?.type === expectedType && typeof item?.data?.[urlProp] === "string") {
          const url = item.data[urlProp]
          const filename = url.slice(url.lastIndexOf("/") + 1)
          const localResource = localResources[filename]
          if (localResource) {
            item.data[urlProp] = localResource
          }
        }
      }
    }
    localize(styles, "stylesheet", "href")
    localize(scripts, "script", "src")
  }
}

function wrapFunction(fn, wrapper) {
  return (...args) => wrapper(fn, ...args)
}

function resolveImageSrcPlugin(filter, resolve) {
  return {
    name: "resolveImageSrc",
    transform(transformHooks) {
      transformHooks.parser.tap(md => {
        md.renderer.renderAttrs = wrapFunction(md.renderer.renderAttrs, (renderAttrs, token) => {
          if (token.tag === "img") {
            const src = token.attrGet("src")
            if (filter(src)) {
              token.attrSet("src", resolve(src))
            }
          }
          return renderAttrs(token)
        })
      })
      return {}
    },
  }
}

module.exports = {
  plugin: MarkmapPlugin,
}
