class extractRangeToNewFilePlugin extends BaseCustomPlugin {
    selector = isClick => {
        if (isClick) return;
        this.savedSelection = window.getSelection().getRangeAt(0);
        if (this.savedSelection.collapsed) {
            this.savedSelection = null;
            return this.utils.nonExistSelector
        }
    }

    hint = isDisable => isDisable && "请框选待提取的文段"

    hotkey = () => [this.config.hotkey]

    callback = async anchorNode => {
        const extract = async filepath => {
            if (filepath && !filepath.endsWith(".md")) {
                filepath += ".md";
            }
            filepath = await this.utils.newFilePath(filepath);
            const ok = await this.utils.writeFile(filepath, this.text);
            if (!ok) return;
            this.config.auto_open && this.utils.openFile(filepath);
            this.text = null;
        }

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
            await extract("");
        } else {
            const components = [{ label: "文件名", type: "input", value: "", placeholder: "请输入新文件名，为空则创建副本" }];
            this.utils.dialog.modal({ title: "提取选区文字到新文件", components }, ([{ submit }]) => extract(submit));
        }
    }
}

module.exports = {
    plugin: extractRangeToNewFilePlugin,
};