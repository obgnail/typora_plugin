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

  getToc = (options = this.config) => {
    const { REMOVE_HEADER_STYLES: removeStyles, FIX_SKIPPED_LEVEL_HEADERS: fixSkippedLevels, NODE_TEXT_TEMPLATE: nodeTemplate = "{{text}}" } = options
    const tree = this.utils.getTocTree(removeStyles)
    const md = serializeToc(tree, { fixSkippedLevels, nodeTemplate })
    return { tree, md }
  }

  lazyLoad = this.utils.once(async () => {
    const load = require("./loader.js")
    Object.assign(this.Lib, await load(this.utils))
  })
}

const TOKEN_RESOLVERS = {
  text: node => node.text,
  cid: node => node.cid,
  level: node => node.depth,
  index: (node, numbers) => numbers.at(-1),
  number: (node, numbers) => numbers.join("."),
  children: node => node.children.length,
}

function serializeToc(tree, { fixSkippedLevels, nodeTemplate }) {
  const lines = []
  const counters = []

  const visit = (node, depth) => {
    counters[depth] = (counters[depth] || 0) + 1
    counters.length = depth + 1

    const heading = "#".repeat(fixSkippedLevels ? depth : node.depth)
    const numbers = counters.slice(1)
    const content = nodeTemplate.replace(/\{\{\s*(\w+)\s*}}/g, (raw, token) => TOKEN_RESOLVERS[token]?.(node, numbers) ?? raw)
    lines.push(`${heading} ${content}`)

    for (const child of node.children) {
      visit(child, depth + 1)
    }
  }

  visit(tree, 0)
  return lines.slice(1).join("\n")  // root is virtual: drop its line
}

module.exports = {
  plugin: MarkmapPlugin,
}
