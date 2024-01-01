class mdPaddingPlugin extends BasePlugin {
    hotkey = () => [{hotkey: this.config.HOTKEY, callback: this.call}]

    reload = content => File.reloadContent(content, {fromDiskChange: false});

    formatFile = content => {
        const {padMarkdown} = this.utils.requireFilePath("./plugin/md_padding/md-padding");
        return padMarkdown(content, {ignoreWords: this.config.IGNORE_WORDS})
    }

    removeMultiLineBreak = content => {
        const lineBreak = content.indexOf("\r\n") !== -1 ? "\r\n" : "\n";
        const reg = new RegExp(`(${lineBreak}){3,}`, "g");
        const double = lineBreak + lineBreak;
        return content.replace(reg, double);
    }

    call = async () => {
        await File.saveUseNode();
        const filepath = this.utils.getFilePath();
        const content = await this.utils.Package.Fs.promises.readFile(filepath, 'utf-8');
        let formattedContent = this.formatFile(content);
        if (this.config.REMOVE_MULTI_LINE_BREAK) {
            formattedContent = this.removeMultiLineBreak(formattedContent);
        }
        await this.utils.Package.Fs.promises.writeFile(filepath, formattedContent);
        this.reload(formattedContent);
    }
}

module.exports = {
    plugin: mdPaddingPlugin
};