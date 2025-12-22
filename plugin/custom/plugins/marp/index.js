class MarpPlugin extends BaseCustomPlugin {
    styleTemplate = () => true

    init = () => this.marp = null

    callback = anchorNode => this.utils.insertText(anchorNode, this.config.TEMPLATE)

    process = () => {
        const parser = this.utils.thirdPartyDiagramParser
        parser.register({
            lang: this.config.LANGUAGE,
            mappingLang: "markdown",
            destroyWhenUpdate: false,
            interactiveMode: this.config.INTERACTIVE_MODE,
            checkSelector: ".plugin-marp-content",
            wrapElement: '<div class="plugin-marp-content"></div>',
            lazyLoadFunc: this.lazyLoad,
            beforeRenderFunc: null,
            setStyleFunc: null,
            createFunc: this.create,
            updateFunc: null,
            destroyFunc: this.destroy,
            beforeExportToNative: null,
            beforeExportToHTML: null,
            extraStyleGetter: null,
            versionGetter: this.getVersion,
        })
    }

    create = ($wrap, content) => {
        const { html, css } = this.marp.render(content)
        const shadowRoot = $wrap[0].shadowRoot || $wrap[0].attachShadow({ mode: "open" }) // Use shadowDOM to isolate styles
        shadowRoot.innerHTML = `<style>${css}</style>` + html
        return shadowRoot
    }

    destroy = shadowRoot => shadowRoot.innerHTML = ""

    getVersion = () => "marp-core@4.2.0"

    // More detail: https://github.com/marp-team/marp-core
    lazyLoad = () => {
        const { Marp } = require("./marp-core.min.js")
        this.Marp = Marp
        this.marp = new Marp(this.config.MARP_CORE_OPTIONS).use(this._marpAbsoluteImagePath())
    }

    _marpAbsoluteImagePath = () => {
        const toAbsPath = (url) => {
            const decodedURL = decodeURIComponent(url)
            const dir = this.utils.getLocalRootUrl()
            const absPath = (this.utils.isNetworkImage(decodedURL) || this.utils.isSpecialImage(decodedURL))
                ? decodedURL
                : this.utils.Package.Path.resolve(dir, decodedURL)
            return absPath.split(this.utils.Package.Path.sep).join("/")
        }

        return function (marp) {
            // Image commands (`![bg](...) `): They will be processed by `marp.normalizeLink`, replaced to the `background-image: url(...)` in `style` attribute.
            const originalNormalizeLink = marp.normalizeLink
            marp.normalizeLink = (url) => {
                const normalized = originalNormalizeLink(url)
                return toAbsPath(normalized)
            }
            const originalImageRule = marp.renderer.rules.image

            // Ordinary images (`![alt](...) `): They will be processed by `md.renderer.rules.images`, replaced to the `src` attribute of the `<img>` tag.
            marp.renderer.rules.image = (tokens, idx, options, env, self) => {
                const token = tokens[idx]
                const srcIndex = token.attrIndex("src")
                if (srcIndex >= 0) {
                    token.attrs[srcIndex][1] = toAbsPath(token.attrs[srcIndex][1])
                }
                return originalImageRule ? originalImageRule(tokens, idx, options, env, self) : self.renderToken(tokens, idx, options)
            }
        }
    }
}

module.exports = {
    plugin: MarpPlugin
}
