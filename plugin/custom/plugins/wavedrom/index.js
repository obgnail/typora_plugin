/**
 * Wavedrom's API requires an element ID string in the 'prefix+index' format,
 * but it separates the numeric index and string prefix into distinct arguments
 * rather than accepting the full ID as a single string representing a DOM element.
 *
 * This unconventional approach is illustrated below:
 *    const wavedrom = require('wavedrom');
 *    const div = document.createElement('div');
 *    div.id = 'a0';
 *    document.body.appendChild(div);
 *    let notFirstSignal = false;
 *    wavedrom.renderWaveForm(0, { signal:[] }, 'a', notFirstSignal);  // Index (0) and prefix ('a') are passed separately
 *
 * The rationale behind this design, as explained by the author, is:
 *    When having multiple diagrams on the same page, the id === 'a0' SVG has special properties.
 *    It holds a stash of building blocks (wave bricks), CSS attributes, and who knows what else...
 *    So, when the second diagram comes to the page, it inherits all this treasure, and thus weighs less.
 * See: https://github.com/wavedrom/wavedrom/issues/116
 *
 * This legacy approach presents challenges in environments like Typora, where charts are frequently deleted and re-rendered, hindering reuse.
 *    For instance, if only one chart exists on the page and the user modifies it, the existing instance needs to be removed and recreated.
 *        In this scenario, setting `notFirstSignal` to `true` will result in an error.
 *    Similarly, Typora's frequent re-rendering of all charts, involving deletion and recreation, leads to issues.
 *        Regardless of the number of diagrams, setting `notFirstSignal` to `true` will cause an error.
 *    Therefore, `notFirstSignal = false` is necessary to ensure correct rendering.
 *
 * These examples highlight that Wavedrom is primarily designed for static pages and exhibits limited support for single-page applications (SPAs).
 *    Wavedrom lacks automatic event listener removal and doesn't provide a dedicated removal interface, potentially leading to memory leaks.
 *    Consequently, in Typora, functions that create event listeners (e.g., `wavedrom.processAll`) should be avoided.
 *
 * Wavedrom's documentation is incomplete; source code inspection is often required.
 */
class WavedromPlugin extends BaseCustomPlugin {
    init = () => {
        this.wavedromPkg = null
        this.prefix = "WaveDrom_Display_"
        this.evalFunc = this.config.SAFE_MODE ? this.utils.safeEval : this.utils.unsafeEval
    }

    callback = anchorNode => this.utils.insertText(anchorNode, this.config.TEMPLATE)

    process = () => {
        let idx = 0
        const parser = this.utils.thirdPartyDiagramParser
        parser.register({
            lang: this.config.LANGUAGE,
            mappingLang: "javascript",
            destroyWhenUpdate: false,
            interactiveMode: this.config.INTERACTIVE_MODE,
            checkSelector: ".plugin-wavedrom-content",
            wrapElement: () => `<div class="plugin-wavedrom-content" id="${this.prefix + ++idx}"></div>`,
            lazyLoadFunc: this.lazyLoad,
            beforeRenderFunc: null,
            setStyleFunc: parser.STYLE_SETTER({
                height: this.config.DEFAULT_FENCE_HEIGHT,
                "background-color": this.config.DEFAULT_FENCE_BACKGROUND_COLOR
            }),
            createFunc: this.create,
            updateFunc: null,
            destroyFunc: null,
            beforeExportToNative: null,
            beforeExportToHTML: null,
            extraStyleGetter: null,
            versionGetter: this.getVersion,
        })
    }

    create = ($wrap, content) => {
        const id = $wrap.attr("id")
        const index = parseInt(id.slice(this.prefix.length))
        const waveJson = this.evalFunc(content)
        const notFirstSignal = false
        this.wavedromPkg.renderWaveForm(index, waveJson, this.prefix, notFirstSignal)
    }

    getVersion = () => this.wavedromPkg?.version

    lazyLoad = () => {
        this.wavedromPkg = require("./wavedrom.min.js")
        const skins = this.config.SKIN_FILES.map(file => require(this.utils.resolvePath(file)))
        window.WaveSkin = Object.assign(this.wavedromPkg.waveSkin, ...skins)  // renderWaveForm() will use window.WaveSkin
    }
}

module.exports = {
    plugin: WavedromPlugin
}
