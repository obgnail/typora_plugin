class extractRangeToNewFile extends BaseCustomPlugin {
    selector = onClick => {
        if (onClick) return;
        this.savedSelection = window.getSelection().getRangeAt(0);
        if (this.savedSelection.collapsed) {
            this.savedSelection = null;
            return this.utils.nonExistSelector
        }
    }

    hint = isDisable => isDisable && "请框选待提取的文段"

    hotkey = () => [this.config.hotkey]

    callback = async anchorNode => {
        if (this.savedSelection) {
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(this.savedSelection);
        }
        ClientCommand.copyAsMarkdown();
        this.text = await window.parent.navigator.clipboard.readText();
        if (this.config.delete_content) {
            File.editor.UserOp.backspaceHandler(File.editor, null, "Delete");
        }
        this.savedSelection = null;

        if (!this.config.show_modal) {
            this.extract("");
        } else {
            const components = [{label: "文件名", type: "input", value: "", placeholder: "请输入新文件名，为空则创建副本"}];
            this.modal({title: "提取选区文字到新文件", components}, ([component]) => this.extract(component.submit));
        }
    }

    extract = filepath => {
        if (filepath && !filepath.endsWith(".md")) {
            filepath += ".md";
        }
        filepath = this.utils.newFilePath(filepath);
        this.utils.Package.Fs.writeFileSync(filepath, this.text, "utf8");
        this.config.auto_open && this.utils.openFile(filepath);
        this.text = null;
    }
}

module.exports = {
    plugin: extractRangeToNewFile,
};