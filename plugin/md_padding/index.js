class mdPaddingPlugin extends BasePlugin {
    hotkey = () => [{hotkey: this.config.HOTKEY, callback: this.call}]

    reload = content => File.reloadContent(content, {fromDiskChange: false});

    formatFile = content => {
        const {padMarkdown} = this.utils.requireFilePath("./plugin/md_padding/md-padding");
        return padMarkdown(content, {ignoreWords: this.config.IGNORE_WORDS})
    }

    call = async () => {
        await File.saveUseNode();
        const filepath = this.utils.getFilePath();
        const content = await this.utils.Package.Fs.promises.readFile(filepath, 'utf-8');
        const formattedContent = this.formatFile(content);
        await this.utils.Package.Fs.promises.writeFile(filepath, formattedContent);
        this.reload(formattedContent);
    }
}

module.exports = {
    plugin: mdPaddingPlugin
};