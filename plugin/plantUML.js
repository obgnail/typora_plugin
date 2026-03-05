class PlantUMLPlugin extends BasePlugin {
    call = () => this.utils.insertBlockCode(null, this.config.LANGUAGE, this.config.TEMPLATE)

    process = () => {
        const parser = this.utils.thirdPartyDiagramParser
        parser.register({
            lang: this.config.LANGUAGE,
            mappingLang: null,
            destroyWhenUpdate: false,
            interactiveMode: this.config.INTERACTIVE_MODE,
            metaConfigSchema: null,
            checkSelector: ".plugin-plantuml-content",
            wrapElement: '<div class="plugin-plantuml-content"></div>',
            lazyLoadFunc: this.lazyLoad,
            beforeRenderFunc: null,
            renderStyleGetter: parser.helpers.renderStyle.wrapDefault({
                height: this.config.DEFAULT_FENCE_HEIGHT,
                backgroundColor: this.config.DEFAULT_FENCE_BACKGROUND_COLOR,
            }),
            createFunc: this.create,
            updateFunc: null,
            destroyFunc: null,
            beforeExportToNative: null,
            beforeExportToHTML: null,
            exportStyleGetter: parser.helpers.exportStyle.svg,
            versionGetter: null,
        })
    }

    create = async ($wrap, content) => {
        const { buffer, contentType } = await this._memorizedRender(content)
        $wrap[0].innerHTML = contentType.startsWith("image/svg+xml") ? buffer.toString()
            : contentType.startsWith("text/plain") ? `<pre>${buffer.toString()}</pre>`
                : contentType.startsWith("image/png") ? `<img src="data:image/png;base64,${buffer.toString("base64")}">`
                    : new Error(`No Format Matched: ${contentType}`)
    }

    lazyLoad = () => {
        const zlib = require("zlib")
        const B64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
        const UML_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_"
        const B64_TO_UML = Object.fromEntries(this.utils.zip(B64_CHARS, UML_CHARS))
        const toUML = c => B64_TO_UML[c]
        const encode = (text) => zlib.deflateRawSync(text).toString("base64").replace(/[A-Za-z0-9+/]/g, toUML)

        this._memorizedRender = this.utils.memoizeLimited(async content => {
            const url = `${this.config.SERVER_URL}/${this.config.OUTPUT_FORMAT}/${encode(content)}`
            const resp = await this.utils.fetch(url, { timeout: this.config.SERVER_TIMEOUT })
            if (!resp.ok) {
                const errorText = await resp.text()
                return new Error(`${resp.status} ${resp.statusText}\n${errorText}`)
            }
            return {
                contentType: resp.headers.get("content-type") || "Unknown",
                buffer: Buffer.from(await resp.arrayBuffer()),
            }
        }, this.config.MEMORIZED_URL_COUNT)
    }
}

module.exports = {
    plugin: PlantUMLPlugin
}
