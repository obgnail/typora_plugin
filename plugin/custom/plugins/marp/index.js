class marpPlugin extends BaseCustomPlugin {
    styleTemplate = () => true

    init = () => this.marpPkg = null

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
        const { Marp, marp } = this.marpPkg  // more detail: https://github.com/marp-team/marp-core
        const shadowRoot = $wrap[0].shadowRoot || $wrap[0].attachShadow({ mode: "open" }) // use shadowDOM to isolate styles
        const { html, css } = marp.render(content)
        shadowRoot.innerHTML = `<style>${css}</style>` + html
        return shadowRoot
    }

    destroy = shadowRoot => shadowRoot.innerHTML = ""

    getVersion = () => "marp-core@4.1.0"

    lazyLoad = () => this.marpPkg = require("./marp.min.js")
}

module.exports = {
    plugin: marpPlugin
}