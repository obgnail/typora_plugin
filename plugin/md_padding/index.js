class mdPaddingPlugin extends BasePlugin {
    hotkey = () => [{hotkey: this.config.HOTKEY, callback: this.call}]

    reload = content => File.reloadContent(content, {fromDiskChange: false});

    formatFile = content => {
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

    call = async () => {
        await File.saveUseNode();
        const filepath = this.utils.getFilePath();
        const content = await this.utils.Package.Fs.promises.readFile(filepath, 'utf-8');
        let formattedContent = this.formatFile(content);
        formattedContent = this.removeMultiLineBreak(formattedContent);
        await this.utils.Package.Fs.promises.writeFile(filepath, formattedContent);
        this.reload(formattedContent);
    }
}

module.exports = {
    plugin: mdPaddingPlugin
};