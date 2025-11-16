const FenceMarkmap = require("./fence.js")
const TOCMarkmap = require("./toc.js")

class MarkmapPlugin extends BasePlugin {
    beforeProcess = () => {
        this.Lib = {}
        this.tocMarkmap = this.config.ENABLE_TOC_MARKMAP ? new TOCMarkmap(this) : null
        this.fenceMarkmap = this.config.ENABLE_FENCE_MARKMAP ? new FenceMarkmap(this) : null
    }

    styleTemplate = () => this

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
        const getPath = file => this.utils.joinPath("./plugin/markmap/resource/", file)
        styles[0].data.href = getPath("katex.min.css")
        styles[1].data.href = getPath("default.min.css")
        scripts[1].data.src = getPath("webfontloader.js")

        await markmap.loadCSS(styles)
        await markmap.loadJS(scripts, { getMarkmap: () => markmap })
    }
}

module.exports = {
    plugin: MarkmapPlugin
}
