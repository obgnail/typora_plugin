class ChatPlugin extends BaseCustomPlugin {
    styleTemplate = () => true

    callback = anchorNode => this.utils.insertText(anchorNode, this.config.TEMPLATE)

    process = () => {
        this.utils.diagramParser.register({
            lang: this.config.LANGUAGE,
            mappingLang: "markdown",
            destroyWhenUpdate: false,
            renderFunc: this.render,
            cancelFunc: null,
            destroyAllFunc: null,
            extraStyleGetter: this.getStyleContent,
            interactiveMode: this.config.INTERACTIVE_MODE
        })
    }

    render = (cid, content, $pre) => {
        const { yamlObject, remainContent, yamlLineCount } = this.utils.splitFrontMatter(content)
        const contentEl = this._toElement(remainContent, yamlObject, yamlLineCount)
        $pre.find(".md-diagram-panel-preview").html(contentEl)
    }

    _toElement = (content, options, yamlLineNum) => {
        const mergedOptions = { ...this.config.DEFAULT_OPTIONS, ...options }
        const { useStrict, showNickname, showAvatar, notAllowShowTime, allowMarkdown, avatars = {}, senderNickname = "me", timeNickname = "time" } = mergedOptions

        const dir = this.utils.getLocalRootUrl()
        const avatarPaths = Object.fromEntries(
            Object.entries(avatars).map(([name, src]) => {
                if (!this.utils.isNetworkImage(src) && !this.utils.isSpecialImage(src)) {
                    src = this.utils.Package.Path.resolve(dir, src)
                }
                return [name, src]
            })
        )

        const assertOK = (must, errorLine, reason) => {
            if (useStrict) this.utils.diagramParser.assertOK(must, errorLine, this.i18n.t(reason))
        }

        const contentEl = content.split("\n").map(line => line.trim()).map((line, idx) => {
            if (!line) return
            idx += (1 + yamlLineNum)

            const i = line.indexOf(":")
            assertOK(i !== -1, idx, "error.noColon")

            const name = line.slice(0, i).trim()
            let text = line.slice(i + 1).trim().replace(/\\n/g, "\n").replace(/\\r/g, "\r").replace(/\\t/g, "\t")
            assertOK(name && text, idx, "error.emptyNicknameOrEmptyText")
            if (allowMarkdown) {
                text = this.utils.markdownInlineStyleToHTML(text, dir)
            }

            const lowerName = name.toLowerCase()
            const isTime = lowerName === timeNickname
            const isSender = lowerName === senderNickname

            if (isTime && !notAllowShowTime) {
                return `<div class="plugin-chat-time">${text}</div>`
            }

            const class_ = isSender ? "plugin-chat-send" : "plugin-chat-receive"
            const nickname = (showNickname && !isSender) ? `<div class="plugin-chat-nickname">${name}</div>` : ""
            let avatar = ""
            if (showAvatar) {
                avatar = avatarPaths[name]
                    ? `<img class="plugin-chat-avatar" src="${avatarPaths[name]}" alt="${name}">`
                    : `<div class="plugin-chat-avatar"><div class="avatar-font">${name[0].toUpperCase()}</div></div>`
            }
            return `<div class="${class_}">${avatar}<div class="plugin-chat-quote">${nickname}<div class="plugin-chat-text">${text}</div></div></div>`
        }).join("")

        return `<div class="plugin-chat"><div class="plugin-chat-content">${contentEl}</div></div>`
    }

    getStyleContent = () => this.utils.styleTemplater.getStyleContent(this.fixedName)
}

module.exports = {
    plugin: ChatPlugin
}
