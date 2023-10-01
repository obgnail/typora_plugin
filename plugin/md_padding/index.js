class mdPaddingPlugin extends global._basePlugin {
    hotkey = () => [{hotkey: this.config.HOTKEY, callback: this.call}]

    read = filepath => this.utils.Package.Fs.readFileSync(filepath, 'utf-8');
    write = (filepath, content) => this.utils.Package.Fs.writeFileSync(filepath, content);
    save = () => File.saveUseNode();

    reload = content => {
        // const scrollTop = document.querySelector("content").scrollTop;
        File.reloadContent(content, {"fromDiskChange": false})
        // document.querySelector("content").scrollTop = scrollTop;
    };

    getFormatter = () => {
        const {padMarkdown} = this.utils.requireFilePath("./plugin/md_padding/md-padding");
        return padMarkdown;
    }

    formatFile = content => {
        const formatter = this.getFormatter();
        return formatter(content, {ignoreWords: this.config.IGNORE_WORDS})
    }

    call = () => {
        this.save().then(() => {
            const filepath = this.utils.getFilePath();
            const content = this.read(filepath);
            const formattedContent = this.formatFile(content);
            this.write(filepath, formattedContent);
            this.reload(formattedContent);
        })
    }
}

module.exports = {
    plugin: mdPaddingPlugin
};