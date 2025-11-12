class GoTopPlugin extends BasePlugin {
    hotkey = () => [
        { hotkey: this.config.HOTKEY_GO_TOP, callback: this.goTop },
        { hotkey: this.config.HOTKEY_GO_BOTTOM, callback: this.goBottom },
    ]

    call = action => {
        const func = (action === "go-bottom") ? "jumpBottom" : "jumpTop"
        File.editor.selection[func]()
        if (File.isTypeWriterMode) {
            const scrollTop = (action === "go-bottom") ? this.utils.entities.eWrite.getBoundingClientRect().height : "0"
            this.utils.entities.$eContent.animate({ scrollTop }, "100", "swing", () => File.editor.library.outline.highlightVisibleHeader())
        }
    }

    goTop = () => this.call("go-top")
    goBottom = () => this.call("go-bottom")
}

module.exports = {
    plugin: GoTopPlugin
}
