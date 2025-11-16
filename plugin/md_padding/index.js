class MdPaddingPlugin extends BasePlugin {
    hotkey = () => [{ hotkey: this.config.HOTKEY, callback: this.call }]

    format = content => {
        const { padMarkdown } = require("./md-padding.min.js")
        const options = { ignoreWords: this.config.IGNORE_WORDS, ignorePatterns: this.config.IGNORE_PATTERNS }
        return padMarkdown(content, options)
    }

    call = async () => {
        await this.utils.editCurrentFile(this.format)
        this.utils.notification.show(this.i18n.t("done"))
    }
}

module.exports = {
    plugin: MdPaddingPlugin
}
