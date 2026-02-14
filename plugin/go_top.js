class GoTopPlugin extends BasePlugin {
    hotkey = () => [
        { hotkey: this.config.HOTKEY_GO_TOP, callback: this.goTop },
        { hotkey: this.config.HOTKEY_GO_BOTTOM, callback: this.goBottom },
    ]

    call = (toTop) => this.utils.jumpToEdge(toTop)
    goTop = () => this.call(true)
    goBottom = () => this.call(false)
}

module.exports = {
    plugin: GoTopPlugin
}
