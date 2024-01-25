class mdPaddingPlugin extends BasePlugin {
    hotkey = () => [{hotkey: this.config.HOTKEY, callback: this.call}]

    reload = content => File.reloadContent(content, {fromDiskChange: false});

    formatContent = content => {
        const {padMarkdown} = this.utils.requireFilePath("./plugin/md_padding/md-padding");
        return padMarkdown(content, {ignoreWords: this.config.IGNORE_WORDS})
    }
    removeMultiLineBreak = content => {
        const maxNum = this.config.LINE_BREAK_MAX_NUM;
        if (maxNum > 0) {
            const lineBreak = content.indexOf("\r\n") !== -1 ? "\r\n" : "\n";
            const regexp = new RegExp(`(${lineBreak}){${maxNum + 1},}`, "g");
            const breaks = lineBreak.repeat(maxNum);
            content = content.replace(regexp, breaks);
        }
        return content;
    }
    formatCodeBlocks(text) {
        const regex = /(\s*)\n*\s*```[\s\S]*?```/g;
        const codeBlocks = text.match(regex);
        if (codeBlocks) {
            const formattedText = text.replace(regex, (match, leadingSpaces) => {
                const trimmedMatch = match.trim();
                return `\n${leadingSpaces}${trimmedMatch}\n`;
            }).replace(/\n(\s*)\n/g, '\n\n');
            return formattedText;
        } else {
            return text;
        }
    }
    formatAndRemoveMultiLineBreak = content => this.removeMultiLineBreak(this.formatContent(content))

    formatSelection = async () => {
        ClientCommand.copyAsMarkdown();
        const content = await window.parent.navigator.clipboard.readText();
        const formattedContent = this.formatAndRemoveMultiLineBreak(this.formatCodeBlocks(content));
        await window.parent.navigator.clipboard.writeText(formattedContent);
        ClientCommand.paste();
    }

    formatFile = async () => {
        const filepath = this.utils.getFilePath();
        const content = await this.utils.Package.Fs.promises.readFile(filepath, 'utf-8');
        const formattedContent = this.formatAndRemoveMultiLineBreak(this.formatCodeBlocks(content));
        await this.utils.Package.Fs.promises.writeFile(filepath, formattedContent);
        this.reload(formattedContent);
    }

    call = async () => {
        await File.saveUseNode();
        const rangy = File.editor.selection.getRangy();
        if (this.config.FORMAT_IN_SELECTION_ONLY && rangy && !rangy.collapsed) {
            await this.formatSelection();
        } else {
            await this.formatFile()
        }
    }
}

module.exports = {
    plugin: mdPaddingPlugin
};