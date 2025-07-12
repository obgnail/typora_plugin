class downloader {
    static _toSVG = (
        plugin,
        svg = plugin.entities.svg.cloneNode(true),
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
        const _getRect = svg => {
            const { width, height } = plugin.entities.svg.querySelector("g").getBoundingClientRect()
            const match = svg.querySelector("g").getAttribute("transform").match(/scale\((?<scale>.+?\))/)
            const scale = (match && match.groups && match.groups.scale) ? parseFloat(match.groups.scale) : 1
            const realWidth = parseInt(width / scale)
            const realHeight = parseInt(height / scale)
            let minY = 0
            svg.querySelectorAll("g.markmap-node").forEach(node => {
                const match = node.getAttribute("transform").match(/translate\((?<x>.+?),\s+(?<y>.+?)\)/)
                if (!match || !match.groups || !match.groups.x || !match.groups.y) return
                const y = parseInt(match.groups.y)
                minY = Math.min(minY, y)
            })
            return { minX: 0, width: realWidth, minY: minY, height: realHeight }
        }

        const setAttrs = svg => {
            const { minX, minY, width, height } = _getRect(svg)
            const { paddingH, paddingV, imageScale } = options
            const svgWidth = width + paddingH * 2  // both sides
            const svgHeight = height + paddingV * 2
            const scaledWidth = svgWidth * imageScale
            const scaledHeight = svgHeight * imageScale
            svg.removeAttribute("id")
            svg.setAttribute("xmlns", "http://www.w3.org/2000/svg")
            svg.setAttribute("class", "markmap")
            svg.setAttribute("width", scaledWidth)
            svg.setAttribute("height", scaledHeight)
            svg.setAttribute("viewBox", `${minX} ${minY} ${svgWidth} ${svgHeight}`)
            svg.querySelector("g").setAttribute("transform", `translate(${paddingH}, ${paddingV})`)
        }

        const fixStyles = svg => {
            // remove useless styles
            const _useless1 = [
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
            const _useless2 = [
                ".markmap-foreign p",
                ".markmap-foreign a",
                ".markmap-foreign code",
                ".markmap-foreign del",
                ".markmap-foreign em",
                ".markmap-foreign strong",
                ".markmap-foreign mark",
            ].filter(selector => !svg.querySelector(selector))
            const _useless3 = _useless2.includes(".markmap-foreign a") ? [".markmap-foreign a:hover"] : []
            const useless = new Set([..._useless1, ..._useless2, ..._useless3])
            const style = svg.querySelector("style")
            // The `sheet` property of <style> in cloned <svg> is undefined, parse the style text to get it
            const styleEle = new DOMParser().parseFromString(`<style>${style.textContent}</style>`, "text/html").querySelector("style")
            const usefulRules = [...styleEle.sheet.cssRules].filter(rule => !useless.has(rule.selectorText))

            // CSS variables cannot be parsed by some SVG parsers, replace them
            let cssText = usefulRules
                .map(rule => rule.cssText)
                .join(" ")
                .replace(/--[\w\-]+?\s*?:\s*?.+?;/g, "")
                .replace(/\s+/g, " ")
            const markmapClassStyleMap = usefulRules[0].styleMap  // All CSS variables are here
            markmapClassStyleMap.forEach((value, key) => {
                if (key.startsWith("--")) {
                    const regex = new RegExp(`var\\(${key}\\);?`, "g")
                    const replacement = key === "--markmap-text-color" ? options.textColor : value[0][0]
                    cssText = cssText.replace(regex, replacement + ";")
                }
            })

            // replace style element
            style.replaceChild(document.createTextNode(cssText), style.firstChild)
            // replace CSS variables `--markmap-circle-open-bg`
            svg.querySelectorAll('circle[fill="var(--markmap-circle-open-bg)"]').forEach(ele => ele.setAttribute("fill", options.openCircleColor))
        }

        const removeForeignObject = svg => {
            svg.querySelectorAll("foreignObject").forEach(foreign => {
                const x = options.paddingX
                const y = 16  // font size
                // const y = parseInt(foreign.closest("g").querySelector("line").getAttribute("y1")) - (options.nodeMinHeight - 16)
                const text = document.createElement("text")
                text.setAttribute("x", x)
                text.setAttribute("y", y)

                // TODO: handle math
                const katex = foreign.querySelector(".katex")
                if (katex) {
                    const base = katex.querySelector(".katex-html")
                    katex.innerHTML = base ? base.textContent : ""
                }

                text.textContent = foreign.textContent
                foreign.parentNode.replaceChild(text, foreign)
            })
        }

        const removeUselessClasses = svg => {
            svg.querySelectorAll(".markmap-node").forEach(ele => ele.removeAttribute("class"))
        }

        setAttrs(svg)
        fixStyles(svg)
        if (options.removeForeignObject) {
            removeForeignObject(svg)
        }
        if (options.removeUselessClasses) {
            removeUselessClasses(svg)
        }
        return svg
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
        const escapeHtml = text => text.replace(/[&<"]/g, char => ({ '&': '&amp;', '<': '&lt;', '"': '&quot;' })[char])
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

        const handleScripts = (external, scripts, root) => {
            const entry = {
                type: "iife",
                data: {
                    getParams: ({ getMarkmap, root, options }) => [getMarkmap, root, options],
                    fn: (getMarkmap, root, options) => {
                        const markmap = getMarkmap()
                        const op = markmap.deriveOptions(options)
                        window.mm = markmap.Markmap.create("svg#mindmap", op, root)
                    }
                }
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

module.exports = {
    downloader
}
