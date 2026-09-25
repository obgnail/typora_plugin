const { wrapFunction, Transformer, transformerVersions, builtInPlugins, markmap } = require("./resource/markmap.min.js")
const { loadCSS, loadJS, Markmap, deriveOptions } = markmap

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

function getLocalResources(utils) {
  const toLocal = (...args) => utils.toFileProtocol(utils.joinPluginPath(...args))
  const katexBase = "./plugin/global/core/lib/katex"
  const pluginBase = "./plugin/markmap/resource/"
  return {
    "katex.min.js": toLocal(katexBase, "katex.js"),
    "katex.min.css": toLocal(katexBase, "katex.min.css"),
    "default.min.css": toLocal(pluginBase, "default.min.css"),
    "webfontloader.js": toLocal(pluginBase, "webfontloader.js"),
  }
}

function localizeResources(styles, scripts, localPaths) {
  const localize = (items, expectedType, uriProp) => {
    for (const item of items) {
      if (item?.type === expectedType && typeof item?.data?.[uriProp] === "string") {
        const url = item.data[uriProp]
        const filename = url.slice(url.lastIndexOf("/") + 1)
        const path = localPaths[filename]
        if (path) item.data[uriProp] = path
      }
    }
  }
  localize(styles, "stylesheet", "href")
  localize(scripts, "script", "src")
}

function getPlugins(utils) {
  const localImagePlugin = resolveImageSrcPlugin(
    src => src && !utils.isNetworkImage(src) && !utils.isSpecialImage(src),
    src => utils.toFileProtocol(utils.resolveLocalPath(src)),
  )
  return [...builtInPlugins, localImagePlugin]
}

async function loadResources(utils, transformer) {
  const { styles, scripts } = transformer.getAssets()
  localizeResources(styles, scripts, getLocalResources(utils))
  await loadCSS(styles)
  await loadJS(scripts, { getMarkmap: () => markmap })
}

const strategies = {
  colorByParent: (options, fallback) => {
    const colors = options.color
    const m = new Map()
    return node => {
      const path = node?.state?.path
      if (!colors?.length || typeof path !== "string") return fallback?.(node)
      const parentPath = path.includes(".") ? path.slice(0, path.lastIndexOf(".")) : ""
      if (!m.has(parentPath)) {
        m.set(parentPath, m.size)
      }
      return colors[m.get(parentPath) % colors.length]
    }
  },
  colorByLevel: (options, fallback) => {
    const colors = options.color
    const len = colors?.length
    const freezeLevel = options.colorFreezeLevel ?? len
    return node => {
      const depth = node?.state?.depth
      return len && Number.isFinite(depth) ? colors[Math.min(depth, freezeLevel) % len] : fallback?.(node)
    }
  },
}

function assignOptions(update, origin) {
  const merged = { ...origin, ...update }
  const options = deriveOptions(merged)

  // `toggleRecursively` is deleted after calling deriveOptions
  options.toggleRecursively = update.toggleRecursively

  const name = Object.keys(strategies).find(key => merged[key] === true)
  if (name) {
    options.color = strategies[name](merged, options.color)
  }

  return options
}

function createMarkmap(...args) {
  return Markmap.create(...args)
}

async function load(utils) {
  const transformer = new Transformer(getPlugins(utils))
  await loadResources(utils, transformer)
  return { markmap, transformer, assignOptions, createMarkmap, version: transformerVersions["markmap-lib"] }
}

module.exports = load
