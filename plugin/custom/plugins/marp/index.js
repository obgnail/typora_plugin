class marpPlugin extends BaseCustomPlugin {
    styleTemplate = () => true;

    init = () => this.marpPkg = null;

    callback = anchorNode => this.utils.insertText(anchorNode, this.config.TEMPLATE);

    process = () => {
        this.utils.thirdPartyDiagramParser.register({
            lang: this.config.LANGUAGE,
            mappingLang: "markdown",
            destroyWhenUpdate: false,
            interactiveMode: this.config.INTERACTIVE_MODE,
            checkSelector: ".plugin-marp-content",
            wrapElement: '<div class="plugin-marp-content"></div>',
            css: {},
            lazyLoadFunc: this.lazyLoad,
            createFunc: this.create,
            destroyFunc: this.destroy,
            beforeExport: null,
            extraStyleGetter: null,
            versionGetter: this.versionGetter,
        })
    }

    create = ($wrap, content) => {
        const { Marp, marp } = this.marpPkg;  // more detail: https://github.com/marp-team/marp-core
        const shadowRoot = $wrap[0].shadowRoot || $wrap[0].attachShadow({ mode: "open" }); // use shadowDOM to isolate styles
        const { html, css } = marp.render(content);
        shadowRoot.innerHTML = `<style>${css}</style>` + html;
        return shadowRoot;
    }

    destroy = shadowRoot => shadowRoot.innerHTML = "";

    versionGetter = () => "marp-core@3.9.0"

    lazyLoad = () => this.marpPkg = this.marpPkg || require("./marp.min");
}

module.exports = {
    plugin: marpPlugin
};