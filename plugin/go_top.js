class goTopPlugin extends BasePlugin {
    hotkey = () => [
        { hotkey: this.config.HOTKEY_GO_TOP, callback: this.goTop },
        { hotkey: this.config.HOTKEY_GO_BOTTOM, callback: this.goBottom },
    ]

    call = action => {
        const func = (action === "go-bottom") ? "jumpBottom" : "jumpTop"
        File.editor.selection[func]()
    }

    goTop = () => this.call("go-top")
    goBottom = () => this.call("go-bottom")
}

module.exports = {
    plugin: goTopPlugin,
}
