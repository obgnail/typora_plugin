const FenceMarkmap = require("./fence.js")
const TOCMarkmap = require("./toc.js")

class MarkmapPlugin extends BasePlugin {
    beforeProcess = () => {
        this.Lib = {}
        this.tocMarkmap = this.config.ENABLE_TOC_MARKMAP ? new TOCMarkmap(this) : null
        this.fenceMarkmap = this.config.ENABLE_FENCE_MARKMAP ? new FenceMarkmap(this) : null
    }

    styleTemplate = () => true

    html = () => this.tocMarkmap?.html()

    hotkey = () => [this.tocMarkmap, this.fenceMarkmap].filter(Boolean).flatMap(p => p.hotkey())

    init = () => {
        this.staticActions = this.i18n.fillActions([
            { act_value: "draw_fence_outline", act_hotkey: this.config.FENCE_HOTKEY, act_hidden: !this.fenceMarkmap },
            { act_value: "draw_fence_template", act_hidden: !this.fenceMarkmap },
            { act_value: "toggle_toc", act_hotkey: this.config.TOC_HOTKEY, act_hidden: !this.tocMarkmap }
        ])
    }

    process = () => {
        if (this.tocMarkmap) {
            this.tocMarkmap.init()
            this.tocMarkmap.process()
        }
        if (this.fenceMarkmap) {
            this.fenceMarkmap.process()
        }
    }

    call = async action => {
        if (action === "toggle_toc") {
            if (this.tocMarkmap) {
                await this.tocMarkmap.callback(action)
            }
        } else if (action === "draw_fence_template" || action === "draw_fence_outline") {
            if (this.fenceMarkmap) {
                await this.fenceMarkmap.callback(action)
            }
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

        const { Transformer, transformerVersions, markmap } = require("./resource/markmap.min.js")
        const transformer = new Transformer()
        Object.assign(this.Lib, markmap, { transformer, Transformer, transformerVersions })

        const { styles, scripts } = transformer.getAssets()
        this.localizeResources(styles, scripts)

        await markmap.loadCSS(styles)
        await markmap.loadJS(scripts, { getMarkmap: () => markmap })
    }

    localizeResources = (styles = [], scripts = []) => {
        const katexBase = "./plugin/global/core/lib/katex"
        const pluginBase = "./plugin/markmap/resource/"
        const localResources = {
            "katex.min.js": this.utils.joinPath(katexBase, "katex.js"),
            "katex.min.css": this.utils.joinPath(katexBase, "katex.min.css"),
            "default.min.css": this.utils.joinPath(pluginBase, "default.min.css"),
            "webfontloader.js": this.utils.joinPath(pluginBase, "webfontloader.js"),
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

module.exports = {
    plugin: MarkmapPlugin
}
