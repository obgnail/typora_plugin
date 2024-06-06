class chatPlugin extends BaseCustomPlugin {
    styleTemplate = () => true

    callback = anchorNode => this.utils.insertText(anchorNode, this.config.TEMPLATE)

    process = () => {
        this.utils.registerDiagramParser({
            lang: this.config.LANGUAGE,
            mappingLang: "markdown",
            destroyWhenUpdate: false,
            renderFunc: this.render,
            cancelFunc: null,
            destroyAllFunc: null,
            extraStyleGetter: this.getStyleContent,
            interactiveMode: this.config.INTERACTIVE_MODE
        });
    }

    render = (cid, content, $pre) => {
        let chat = $pre.find(".plugin-chat");
        if (chat.length === 0) {
            chat = $(`<div class="plugin-chat"></div>`);
        }
        const {yamlObject, remainContent, yamlLineCount} = this.utils.splitFrontMatter(content);
        const contentElement = this.genChatContent(remainContent, yamlObject, yamlLineCount);
        chat.html(`<div class="plugin-chat-content">${contentElement}</div>`);
        $pre.find(".md-diagram-panel-preview").html(chat);
    }

    genChatContent = (content, options, yamlLineCount) => {
        options = this.utils.merge(this.config.DEFAULT_OPIONS, options || {});
        const {useStrict, showNickname, showAvatar, notAllowShowTime, allowMarkdown, avatars = {}} = options;

        const avatarPaths = {};
        const dir = this.utils.getCurrentDirPath();
        Object.entries(avatars).map(([name, src]) => {
            if (!this.utils.isNetworkImage(src) && !this.utils.isSpecialImage(src)) {
                src = this.utils.Package.Path.resolve(dir, src);
            }
            avatarPaths[name] = src;
        });

        const lines = content.split("\n").map(line => line.trim());
        const throwErrorIfNeed = (errorLine, reason) => useStrict && this.utils.throwParseError(errorLine, reason)
        const results = lines.map((line, idx) => {
            if (!line) return;
            idx += (1 + yamlLineCount);

            const i = line.indexOf(":");
            if (i === -1) {
                throwErrorIfNeed(idx, "无法通过冒号切分出 nickname 和 text");
                return;
            }
            let [name, text] = [line.slice(0, i), line.slice(i + 1)].map(s => s.trim());
            text = text.replace(/\\n/g, "\n").replace(/\\r/g, "\r").replace(/\\t/g, "\t");
            if (!name || !text) {
                throwErrorIfNeed(idx, "nickname 或 text 为空");
                return;
            }
            if (allowMarkdown) {
                text = this.utils.markdownInlineStyleToHTML(text, dir);
            }

            const lowerName = name.toLowerCase();
            const isTime = lowerName === "time";
            const isSender = lowerName === "me";
            if (isTime) {
                if (notAllowShowTime) {
                    this.utils.throwParseError(idx, "notAllowShowTime 为 true 时不允许添加时间");
                    return;
                }
                return `<div class="plugin-chat-time">${text}</div>`;
            }

            const class_ = isSender ? "plugin-chat-send" : "plugin-chat-receive";
            const nickname = (showNickname && !isSender) ? `<div class="plugin-chat-nickname">${name}</div>` : "";
            let avatar = "";
            if (showAvatar) {
                avatar = avatarPaths[name]
                    ? `<img class="plugin-chat-avatar" src="${avatarPaths[name]}">`
                    : `<div class="plugin-chat-avatar"><div class="avatar-font">${name[0].toUpperCase()}</div></div>`
            }
            return `<div class="${class_}">${avatar}<div class="plugin-chat-quote">${nickname}<div class="plugin-chat-text">${text}</div></div></div>`
        })
        return results.join("")
    }

    getStyleContent = () => this.utils.getStyleContent(this.fixedName)
}

module.exports = {
    plugin: chatPlugin,
};
