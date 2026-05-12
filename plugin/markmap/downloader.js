class Downloader {
  static _toSVG = (
    plugin,
    svg = plugin.entities.svg,
    options = {
      nodeMinHeight: plugin.config.DEFAULT_TOC_OPTIONS.nodeMinHeight,
      paddingX: plugin.config.DEFAULT_TOC_OPTIONS.paddingX,
      paddingH: plugin.config.DOWNLOAD_OPTIONS.PADDING_HORIZONTAL,
      paddingV: plugin.config.DOWNLOAD_OPTIONS.PADDING_VERTICAL,
      imageScale: plugin.config.DOWNLOAD_OPTIONS.IMAGE_SCALE,
      textColor: plugin.config.DOWNLOAD_OPTIONS.TEXT_COLOR,
      openCircleColor: plugin.config.DOWNLOAD_OPTIONS.OPEN_CIRCLE_COLOR,
      removeForeignObject: plugin.config.DOWNLOAD_OPTIONS.REMOVE_FOREIGN_OBJECT,
      removeUselessClasses: plugin.config.DOWNLOAD_OPTIONS.REMOVE_USELESS_CLASSES,
    },
  ) => {
    const normalizeAttributes = (svg, clonedSVG) => {
      const { x, y, width, height } = svg.querySelector("g").getBBox()
      const { paddingH, paddingV, imageScale } = options
      const svgWidth = width + paddingH * 2  // both sides
      const svgHeight = height + paddingV * 2
      const scaledWidth = svgWidth * imageScale
      const scaledHeight = svgHeight * imageScale
      clonedSVG.removeAttribute("id")
      clonedSVG.setAttribute("xmlns", "http://www.w3.org/2000/svg")
      clonedSVG.setAttribute("class", "markmap")
      clonedSVG.setAttribute("width", scaledWidth)
      clonedSVG.setAttribute("height", scaledHeight)
      clonedSVG.setAttribute("viewBox", `${x} ${y} ${svgWidth} ${svgHeight}`)
      clonedSVG.querySelector("g").setAttribute("transform", `translate(${paddingH}, ${paddingV})`)
    }

    const normalizeStyles = clonedSVG => {
      const styleEl = clonedSVG.querySelector("style")
      if (!styleEl) return

      const staticUseless = [
        ".markmap-dark .markmap",
        ".markmap-node > circle",
        ".markmap-foreign svg",
        ".markmap-foreign img",
        ".markmap-foreign pre",
        ".markmap-foreign pre > code",
        ".markmap-foreign-testing-max",
        ".markmap-foreign-testing-max img",
        ".markmap-foreign table, .markmap-foreign th, .markmap-foreign td",
      ]
      const dynamicUseless = [
        ".markmap-foreign p",
        ".markmap-foreign a",
        ".markmap-foreign code",
        ".markmap-foreign del",
        ".markmap-foreign em",
        ".markmap-foreign strong",
        ".markmap-foreign mark",
      ].filter(sel => !clonedSVG.querySelector(sel))
      const uselessSet = new Set([
        ...staticUseless,
        ...dynamicUseless,
        ...(dynamicUseless.includes(".markmap-foreign a") ? [".markmap-foreign a:hover"] : []),
      ])

      const sheet = new CSSStyleSheet()
      sheet.replaceSync(styleEl.textContent)
      const usefulRules = Array.from(sheet.cssRules).filter(rule => !rule.selectorText || !uselessSet.has(rule.selectorText))
      if (!usefulRules.length) return

      const rootStyle = usefulRules[0].style
      const cssVars =
        Array.from(rootStyle)
          .filter(key => key.startsWith("--"))
          .map(key => ({
            key,
            val: key === "--markmap-text-color" ? options.textColor : rootStyle.getPropertyValue(key).trim(),
          }))

      styleEl.textContent =
        cssVars
          .reduce(
            (cssText, { key, val }) => cssText.replace(new RegExp(`var\\(\\s*${key}\\s*(?:,[^)]+)?\\)`, "g"), val),
            usefulRules.map(r => r.cssText).join(" "),
          )
          .replace(/--[\w\-]+?\s*:\s*.*?;/g, "")
          .replace(/\s+/g, " ")

      clonedSVG.querySelectorAll(`circle[fill="var(--markmap-circle-open-bg)"]`).forEach(el => el.setAttribute("fill", options.openCircleColor))
    }

    const removeForeignObject = clonedSVG => {
      clonedSVG.querySelectorAll("foreignObject").forEach(foreign => {
        const x = options.paddingX
        const y = 16  // font size
        // const y = parseInt(foreign.closest("g").querySelector("line").getAttribute("y1")) - (options.nodeMinHeight - 16)
        const text = document.createElement("text")
        text.setAttribute("x", x)
        text.setAttribute("y", y)

        // TODO: handle math
        const katex = foreign.querySelector(".katex")
        if (katex) {
          katex.innerHTML = katex.querySelector(".katex-html")?.textContent ?? ""
        }

        text.textContent = foreign.textContent
        foreign.parentNode.replaceChild(text, foreign)
      })
    }

    const removeUselessClasses = clonedSVG => {
      clonedSVG.querySelectorAll(".markmap-node").forEach(el => el.removeAttribute("class"))
    }

    const clonedSVG = svg.cloneNode(true)
    normalizeAttributes(svg, clonedSVG)
    normalizeStyles(clonedSVG)
    if (options.removeForeignObject) removeForeignObject(clonedSVG)
    if (options.removeUselessClasses) removeUselessClasses(clonedSVG)

    return clonedSVG
  }

  static _toString = (svg) => new XMLSerializer().serializeToString(svg)

  static _toImage = async (
    plugin,
    format,
    options = {
      imageQuality: plugin.config.DOWNLOAD_OPTIONS.IMAGE_QUALITY,
      keepAlphaChannel: plugin.config.DOWNLOAD_OPTIONS.KEEP_ALPHA_CHANNEL,
      backgroundColor: plugin.config.DOWNLOAD_OPTIONS.BACKGROUND_COLOR,
    },
  ) => {
    const svg = this._toSVG(plugin)
    const img = new Image()
    const ok = await new Promise(resolve => {
      const str = this._toString(svg)
      img.src = `data:image/svg+xml;utf8,${encodeURIComponent(str)}`
      img.onerror = () => resolve(false)
      img.onload = () => resolve(true)
    })
    if (!ok) {
      return Buffer.alloc(0)
    }

    const canvas = document.createElement("canvas")
    const dpr = File.canvasratio || window.devicePixelRatio || 1
    const width = svg.getAttribute("width") * dpr
    const height = svg.getAttribute("height") * dpr
    canvas.width = width
    canvas.height = height
    canvas.style.width = width + "px"
    canvas.style.height = height + "px"

    const ctx = canvas.getContext("2d")
    if (format === "jpeg" || !options.keepAlphaChannel) {
      ctx.fillStyle = options.backgroundColor
      ctx.fillRect(0, 0, width, height)
    }
    ctx.drawImage(img, 0, 0, width, height)

    const encoderOptions = parseFloat(options.imageQuality)
    const base64 = canvas.toDataURL(`image/${format}`, encoderOptions).replace(`data:image/${format};base64,`, "")
    return Buffer.from(base64, "base64")
  }

  static svg = (plugin) => this._toString(this._toSVG(plugin))

  static png = async (plugin) => this._toImage(plugin, "png")

  static jpg = async (plugin) => this._toImage(plugin, "jpeg")

  static webp = async (plugin) => this._toImage(plugin, "webp")

  static html = (plugin) => {
    const escapeHtml = text => text.replace(/[&<"]/g, char => ({ "&": "&amp;", "<": "&lt;", "\"": "&quot;" })[char])
    const createTag = (tagName, attributes, content) => {
      const attrs = Object.entries(attributes || {})
        .filter(([_, value]) => value != null && value !== false)
        .map(([key, value]) => {
          const escapedKey = escapeHtml(key)
          return value === true ? escapedKey : `${escapedKey}="${escapeHtml(value)}"`
        })
        .join(" ")
      const attrStr = (attrs ? " " : "") + attrs
      return content != null
        ? `<${tagName}${attrStr}>${content}</${tagName}>`
        : `<${tagName}${attrStr} />`
    }

    const handleStyles = styles => styles.map(style => {
      const isLink = style.type === "stylesheet"
      const tagName = isLink ? "link" : "style"
      const attributes = isLink ? { rel: "stylesheet", ...style.data } : style.data
      return createTag(tagName, attributes)
    })

    const getExternalScripts = (transformer) => {
      const provider = "jsdelivr"
      transformer.urlBuilder.setProvider(provider, e => `https://cdn.jsdelivr.net/npm/${e}`)
      return ["d3@7.9.0/dist/d3.min.js", "markmap-view@0.17.2/dist/browser/index.js"]
        .map(asset => transformer.urlBuilder.getFullUrl(asset, provider))
        .map(src => ({ type: "script", data: { src } }))
    }

    const deepDeleteAttr = (obj, attr) => {
      if (obj == null || typeof obj !== "object") return
      for (const key of Object.keys(obj)) {
        if (obj[key] != null && typeof obj[key] === "object") {
          deepDeleteAttr(obj[key], attr)
        }
      }
      delete obj[attr]
    }

    const handleScripts = (external, scripts, root) => {
      const entry = {
        type: "iife",
        data: {
          getParams: ({ getMarkmap, root, options }) => [getMarkmap, root, options],
          fn: (getMarkmap, root, options) => {
            const markmap = getMarkmap()
            const op = markmap.deriveOptions(options)
            window.mm = markmap.Markmap.create("svg#mindmap", op, root)
          },
        },
      }
      const context = {
        getMarkmap: () => window.markmap,
        root,
        options: { ...plugin.mm.options, ...plugin.config.DEFAULT_TOC_OPTIONS },
      }
      const createIIFE = (fn, params) => {
        const args = params
          .map(param => typeof param === "function" ? param.toString().replace(/\s+/g, " ") : JSON.stringify(param))
          .join(", ")
          .replace(/<\s*\/script\s*>/gi, "\\x3c$&")
        return `(${fn.toString()})(${args})`
      }

      return [...external, ...scripts, entry].map(script => {
        switch (script.type) {
          case "script":
            return createTag("script", { src: script.data.src }, "")
          case "iife":
            const { fn, getParams } = script.data
            const params = getParams ? getParams(context) : []
            const iife = createIIFE(fn, params)
            return createTag("script", null, iife)
          default:
            return script
        }
      })
    }

    const toHTML = (title, styles, scripts) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>* { margin: 0; padding: 0; } #mindmap { display: block; width: 100vw; height: 100vh; }</style>
  ${styles.join("\n    ")}
</head>
<body>
  <svg id="mindmap"></svg>
  ${scripts.join("\n    ")}
</body>
</html>`

    const run = (title = "MINDMAP") => {
      const { transformer } = plugin.Lib
      const { root, features } = plugin.transformContext
      const { styles, scripts } = transformer.getUsedAssets(features)
      deepDeleteAttr(root, "__path")
      const external = getExternalScripts(transformer)
      const styleEls = handleStyles(styles)
      const scriptEls = handleScripts(external, scripts, root)
      return toHTML(title, styleEls, scriptEls)
    }

    return run()
  }

  static md = (plugin) => plugin.transformContext.content

  static getFormats = () => {
    const formats = Object.keys(this).filter(k => !k.startsWith("_") && !["getFormats", "download"].includes(k))
    const separate = formats.map(k => ({ name: k.toUpperCase(), extensions: [k] }))
    const total = { name: "ALL", extensions: formats }
    return [total, ...separate]
  }

  static download = async (plugin, file) => {
    const ext = plugin.utils.Package.Path.extname(file).toLowerCase().replace(/^\./, "")
    const func = this[ext] || this.svg
    const content = await func(plugin)
    return plugin.utils.writeFile(file, content)
  }
}

module.exports = Downloader
