class marpPlugin extends BaseCustomPlugin {
    styleTemplate = () => true;

    init = () => this.marpPkg = null;

    callback = anchorNode => this.utils.insertText(anchorNode, this.config.TEMPLATE);

    process = () => {
        this.utils.registerThirdPartyDiagramParser(
            this.config.LANGUAGE,
            false,
            this.config.INTERACTIVE_MODE,
            ".plugin-marp-content",
            '<div class="plugin-marp-content"></div>',
            {},
            this.lazyLoad,
            this.create,
            this.destroy,
        );
    }

    create = ($wrap, content) => {
        const {Marp, marp} = this.marpPkg;  // more detail: https://github.com/marp-team/marp-core
        const shadowRoot = $wrap[0].shadowRoot || $wrap[0].attachShadow({mode: "open"}); // use shadowDOM to isolate styles
        const {html, css} = marp.render(content);
        shadowRoot.innerHTML = `<style>${css}</style>` + html;
        return shadowRoot;
    }

    destroy = shadowRoot => shadowRoot.innerHTML = "";

    lazyLoad = () => this.marpPkg = this.marpPkg || this.utils.requireFilePath("./plugin/custom/plugins/marp/marp.min.js");
}

module.exports = {
    plugin: marpPlugin
};