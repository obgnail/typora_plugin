class extractRangeToNewFile extends BaseCustomPlugin {
    selector = () => {
        // 当没有选区时,返回一个不存在的selector
        if (File.editor.selection.getRangy().collapsed) {
            return "#write #__has_not_this_element_id__"
        }
    }

    callback = anchorNode => {
        ClientCommand.copyAsMarkdown();
        this.promise = window.parent.navigator.clipboard.readText();

        if (!this.config.show_modal) {
            this.extract("");
            return;
        }

        this.modal({
            id: "newFile",
            title: "提取选区文字到新文件",
            components: [
                {
                    label: "文件名",
                    type: "input",
                    value: "",
                    placeholder: "请输入新文件名，为空则创建副本",
                }
            ]
        })
    }

    onEvent = (eventType, payload) => {
        if (eventType !== "submit"
            || !payload
            || !payload.id
            || payload.id !== "newFile"
            || !payload.components
        ) return;

        this.extract(payload.components[0].submit);
    }

    extract = filepath => {
        const path = this.utils.Package.Path;
        if (filepath) {
            filepath = path.join(path.dirname(this.utils.getFilePath()), filepath);
        } else {
            filepath = this.utils.getFilePath();
        }

        if (this.existPath(filepath)) {
            const ext = path.extname(filepath);
            if (ext) {
                const regex = new RegExp(`${ext}$`);
                filepath = filepath.replace(regex, `--copy${ext}`);
            } else {
                filepath = filepath + "--copy.md";
            }
        }
        this.promise.then(text => this.utils.Package.Fs.writeFileSync(filepath, text, "utf8"));
    }

    existPath = filepath => {
        try {
            this.utils.Package.Fs.accessSync(filepath, this.utils.Package.Fs.constants.F_OK);
            return true
        } catch (err) {
        }
    }
}

module.exports = {
    plugin: extractRangeToNewFile,
};