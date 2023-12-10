class extractRangeToNewFile extends BaseCustomPlugin {
    selector = () => {
        if (File.editor.selection.getRangy().collapsed) {
            return this.utils.nonExistSelector
        }
    }

    hotkey = () => [this.config.hotkey]

    callback = async anchorNode => {
        ClientCommand.copyAsMarkdown();
        this.text = await window.parent.navigator.clipboard.readText();
        if (this.config.delete_content) {
            File.editor.UserOp.backspaceHandler(File.editor, null, "Delete");
        }
        if (!this.config.show_modal) {
            this.extract("");
        } else {
            const components = [{label: "文件名", type: "input", value: "", placeholder: "请输入新文件名，为空则创建副本"}];
            this.modal({title: "提取选区文字到新文件", components}, ([component]) => this.extract(component.submit));
        }
    }

    extract = filepath => {
        filepath = this.utils.newFilePath(filepath);
        this.utils.Package.Fs.writeFileSync(filepath, this.text, "utf8");
        this.config.auto_open && this.utils.openFile(filepath);
        this.text = null;
    }
}

module.exports = {
    plugin: extractRangeToNewFile,
};