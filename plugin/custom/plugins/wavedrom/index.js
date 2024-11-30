/**
 * 太搞了，第一次见到如此奇葩的API：
 *    var div = document.createElement('div')
 *    div.id = 'a0'
 *    document.body.appendChild(div)
 *    var wavedrom = require('wavedrom')
 *    var notFirstSignal = false
 *    wavedrom.renderWaveForm(0, { signal:[] }, 'a', notFirstSignal)
 * 你没有看错，wavedrom不能通过传入ELEMENT的方式创建instance，只能传入element_id，而且element_id必须为prefix+index的形式，而且还是分开传入的
 * 为什么会采用上述如此反常的方式？
 *    作者回答：When having multiple diagrams on the same page the id === 'a0' SVG has special property.
 *            It holds stash of building blocks (wave bricks), CSS attributes, and god knows what else...
 *            So, when the second diagram comes to the page it inherits all this treasure, and thus weight less.
 *    详见：https://github.com/wavedrom/wavedrom/issues/116
 * 遗憾的是，这种old school的做法在Typora水土不服，Typora总是轻易的删除和重新渲染图表，导致很难复用
 *    比如说，当页面上只有一个图表，用户编辑此图表时，此时虽然页面上存在一个instance，但是这个instance是需要remove后重新渲染的，notFirstSignal为true会报错
 *    再比如说，Typora喜欢动不动就重新渲染全部的图表，其表现为删除所有图表的HTML标签，之后再重新渲染。此时页面有再多的instance都没有用，notFirstSignal为true时会报错
 *    所以renderWaveForm函数的notFirstSignal参数只能被设置为false
 * 从上面的举例可以看出，wavedrom的底层设计逻辑是静态页面，对于单页应用(SPA)的支持极差
 *    wavedrom中的所有事件都是管生不管养的，所有事件都不会remove，也没有提供remove接口。所以在Typora不能使用会创建事件的wavedrom函数，会造成内存泄漏。
 *    进而，不能使用wavedrom.processAll函数（其子函数appendSaveAsDialog会创建大量事件）
 * wavedrom没有文档，坑很多，要想了解具体细节只能去阅读源码
 */
class wavedromPlugin extends BaseCustomPlugin {
    init = () => {
        this.wavedromPkg = null
        this.prefix = "WaveDrom_Display_"
        this.evalFunc = this.config.SAFE_MODE ? this._safeEval : this._dangerousEval
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
            setStyleFunc: parser.STYLE_SETTER({
                height: this.config.DEFAULT_FENCE_HEIGHT,
                "background-color": this.config.DEFAULT_FENCE_BACKGROUND_COLOR
            }),
            lazyLoadFunc: this.lazyLoad,
            createFunc: this.create,
            updateFunc: null,
            destroyFunc: null,
            beforeExport: null,
            extraStyleGetter: null,
            versionGetter: this.versionGetter,
        })
    }

    create = ($wrap, content) => {
        const id = $wrap.attr("id")
        const index = parseInt(id.slice(this.prefix.length))
        const waveJson = this.evalFunc(content)
        const notFirstSignal = false
        this.wavedromPkg.renderWaveForm(index, waveJson, this.prefix, notFirstSignal)
    }

    versionGetter = () => this.wavedromPkg && this.wavedromPkg.version

    lazyLoad = () => {
        this.wavedromPkg = require("./wavedrom.min.js")
        window.WaveSkin = this.wavedromPkg.waveSkin  // renderWaveForm() will use window.WaveSkin
    }

    _safeEval = content => new Function(`return (${content})`)()
    _dangerousEval = content => eval(`(${content})`)
}

module.exports = {
    plugin: wavedromPlugin
}