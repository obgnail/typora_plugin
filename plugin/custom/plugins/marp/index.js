class marpPlugin extends BaseCustomPlugin {
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
        this.marp = new Marp(this.config.MARP_CORE_OPTIONS)
    }
}

module.exports = {
    plugin: marpPlugin
}
