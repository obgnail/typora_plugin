class PlantUMLPlugin extends BaseCustomPlugin {
    callback = anchorNode => this.utils.insertText(anchorNode, this.config.TEMPLATE)

    process = () => {
        const parser = this.utils.thirdPartyDiagramParser
        parser.register({
            lang: this.config.LANGUAGE,
            mappingLang: null,
            destroyWhenUpdate: false,
            interactiveMode: this.config.INTERACTIVE_MODE,
            checkSelector: ".plugin-plantuml-content",
            wrapElement: '<div class="plugin-plantuml-content"></div>',
            lazyLoadFunc: this.lazyLoad,
            beforeRenderFunc: null,
            setStyleFunc: parser.STYLE_SETTER_SIMPLE({
                height: this.config.DEFAULT_FENCE_HEIGHT,
                "background-color": this.config.DEFAULT_FENCE_BACKGROUND_COLOR,
            }),
            createFunc: this.create,
            updateFunc: null,
            destroyFunc: null,
            beforeExportToNative: null,
            beforeExportToHTML: null,
            extraStyleGetter: parser.SVG_PRINT_STYLE_FIXER(
                this.config.LANGUAGE,
                ".plugin-plantuml-content",
            ),
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
        const BASE64_TO_PLANTUML_MAP = {
            'A': '0', 'B': '1', 'C': '2', 'D': '3', 'E': '4', 'F': '5', 'G': '6', 'H': '7',
            'I': '8', 'J': '9', 'K': 'A', 'L': 'B', 'M': 'C', 'N': 'D', 'O': 'E', 'P': 'F',
            'Q': 'G', 'R': 'H', 'S': 'I', 'T': 'J', 'U': 'K', 'V': 'L', 'W': 'M', 'X': 'N',
            'Y': 'O', 'Z': 'P', 'a': 'Q', 'b': 'R', 'c': 'S', 'd': 'T', 'e': 'U', 'f': 'V',
            'g': 'W', 'h': 'X', 'i': 'Y', 'j': 'Z', 'k': 'a', 'l': 'b', 'm': 'c', 'n': 'd',
            'o': 'e', 'p': 'f', 'q': 'g', 'r': 'h', 's': 'i', 't': 'j', 'u': 'k', 'v': 'l',
            'w': 'm', 'x': 'n', 'y': 'o', 'z': 'p', '0': 'q', '1': 'r', '2': 's', '3': 't',
            '4': 'u', '5': 'v', '6': 'w', '7': 'x', '8': 'y', '9': 'z', '+': '-', '/': '_',
        }
        const encodeContent = (content) => {
            const compressed = zlib.deflateRawSync(content)
            const base64String = compressed.toString("base64")
            return base64String.replace(/[A-Za-z0-9+/]/g, (char) => BASE64_TO_PLANTUML_MAP[char])
        }
        this._memorizedRender = this.utils.memoizeLimited(async content => {
            const encoded = encodeContent(content)
            const url = `${this.config.SERVER_URL}/${this.config.OUTPUT_FORMAT}/${encoded}`
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
