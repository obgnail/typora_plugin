class mdPaddingPlugin extends BasePlugin {
    hotkey = () => [{ hotkey: this.config.HOTKEY, callback: this.call }]

    formatContent = content => {
        const { padMarkdown } = require("./md-padding.min.js")
        const options = { ignoreWords: this.config.IGNORE_WORDS, ignorePatterns: this.config.IGNORE_PATTERNS }
        return padMarkdown(content, options)
    }

    formatSelection = () => {
        const content = File.editor.UserOp.getSpeechText()
        const formattedContent = this.formatContent(content)
        this.utils.insertText(null, formattedContent, false)
    }

    formatFile = async () => await this.utils.editCurrentFile(this.formatContent)

    call = async () => {
        const running = this.i18n.t("running")
        const done = this.i18n.t("done")

        this.utils.notification.show(running, "info")
        if (this.config.FORMAT_IN_SELECTION_ONLY && !File.editor.selection.getRangy().collapsed) {
            await this.formatSelection()
        } else {
            await this.formatFile()
        }
        this.utils.notification.show(done)
    }
}

module.exports = {
    plugin: mdPaddingPlugin
}
