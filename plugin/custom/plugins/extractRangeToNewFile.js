class extractRangeToNewFile extends BaseCustomPlugin {
    selector = () => {
        // 当没有选区时,返回一个不存在的selector
        if (File.editor.selection.getRangy().collapsed) {
            return this.utils.nonExistSelector
        }
    }

    callback = anchorNode => {
        ClientCommand.copyAsMarkdown();
        this.promise = window.parent.navigator.clipboard.readText();

        if (!this.config.show_modal) {
            this.extract("");
            return;
        }

        const modal = {
            title: "提取选区文字到新文件",
            components: [
                {
                    label: "文件名",
                    type: "input",
                    value: "",
                    placeholder: "请输入新文件名，为空则创建副本",
                }
            ]
        }

        this.modal(modal, components => this.extract(components[0].submit))
    }

    extract = filepath => {
        filepath = this.utils.newFilePath(filepath);
        this.promise.then(text => {
            this.utils.Package.Fs.writeFileSync(filepath, text, "utf8");
            if (this.config.auto_open) {
                this.utils.openFile(filepath);
            }
        });
    }
}

module.exports = {
    plugin: extractRangeToNewFile,
};