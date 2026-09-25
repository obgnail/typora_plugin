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
      await this.tocMarkmap?.callback()
    } else if (action === "draw_fence_template" || action === "draw_fence_outline") {
      await this.fenceMarkmap?.callback(action)
    }
  }

  onButtonClick = () => this.call("toggle_toc")

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

  lazyLoad = this.utils.once(async () => {
    const load = require("./loader.js")
    Object.assign(this.Lib, await load(this.utils))
  })
}

module.exports = {
  plugin: MarkmapPlugin,
}
