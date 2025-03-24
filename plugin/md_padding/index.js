class mdPaddingPlugin extends BasePlugin {
    hotkey = () => [{ hotkey: this.config.HOTKEY, callback: this.call }]

    format = content => {
        const { padMarkdown } = require("./md-padding.min.js")
        const options = { ignoreWords: this.config.IGNORE_WORDS, ignorePatterns: this.config.IGNORE_PATTERNS }
        return padMarkdown(content, options)
    }

    call = async () => {
        const running = this.i18n.t("running")
        const done = this.i18n.t("done")
        this.utils.notification.show(running, "info")
        await this.utils.editCurrentFile(this.format)
        this.utils.notification.show(done)
    }
}

module.exports = {
    plugin: mdPaddingPlugin
}
