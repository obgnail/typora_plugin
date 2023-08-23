class templater extends BaseCustomPlugin {
    selector = () => ""

    callback = anchorNode => {
        if (!File.editor.selection.getRangy().collapsed) {
            ClientCommand.copyAsMarkdown();
            window.parent.navigator.clipboard.readText().then(text => this.rangeText = text);
        }

        const options = this.info.template.map(template => template.name);
        this.modal({
            id: "newTemplateFile",
            title: "新文件",
            components: [
                {
                    label: "文件名",
                    type: "input",
                    value: "",
                    placeholder: "请输入新文件名，为空则创建副本",
                },
                {
                    label: "模板",
                    type: "select",
                    list: options,
                }
            ]
        })
    }

    onEvent = (eventType, payload) => {
        if (eventType !== "submit"
            || !payload
            || !payload.id
            || payload.id !== "newTemplateFile"
            || !payload.components
        ) return;

        let filepath = payload.components[0].submit;
        filepath = this.utils.newFilePath(filepath);
        const filename = this.utils.Package.Path.basename(filepath);

        const option = payload.components[1].submit;
        const template = this.info.template.filter(template => template.name === option)[0];
        if (!template) return;

        const helper = new templateHelper(filename, this.rangeText, this.utils);
        const content = helper.convert(template.text);
        this.utils.Package.Fs.writeFileSync(filepath, content, "utf8");
        this.rangeText = "";
        if (this.config.auto_open) {
            this.utils.openFile(filepath);
        }
    }
}

class templateHelper {
    constructor(title, rangeText, utils) {
        this._title = title;
        this.rangeText = rangeText || "";
        this.utils = utils;
        this.templateVarMap = {
            date: "{{date}}",
            time: "{{time}}",
            weekday: "{{weekday}}",
            datetime: "{{datetime}}",
            yesterday: "{{yesterday}}",
            tomorrow: "{{tomorrow}}",
            random: "{{random}}",
            title: "{{title}}",
            folder: "{{folder}}",
            filepath: "{{filepath}}",
            range: "{{range}}",
            uuid: "{{uuid}}",
        }
    }

    convert = text => {
        for (let varName in this.templateVarMap) {
            const template = this.templateVarMap[varName];
            const regex = new RegExp(template, "g");
            text = text.replace(regex, this[varName](template));
        }
        return text
    }

    uuid = () => this.utils.getUUID();
    range = () => this.rangeText;
    random = () => Math.random();
    weekday = () => "周" + '日一二三四五六'.charAt(new Date().getDay())
    datetime = () => new Date().toLocaleString('chinese', {hour12: false})
    date = () => {
        const today = new Date();
        return `${today.getFullYear()}/${today.getMonth()}/${today.getDate()}`
    }
    time = () => {
        const today = new Date();
        return `${today.getHours()}:${today.getMinutes()}:${today.getSeconds()}`
    }
    yesterday = () => {
        const yesterday = new Date(new Date().getTime() - (24 * 60 * 60 * 1000));
        return `${yesterday.getFullYear()}/${yesterday.getMonth()}/${yesterday.getDate()}`
    }
    tomorrow = () => {
        const tomorrow = new Date(new Date().getTime() + (24 * 60 * 60 * 1000));
        return `${tomorrow.getFullYear()}/${tomorrow.getMonth()}/${tomorrow.getDate()}`
    }
    title = () => this._title
    folder = () => this.utils.Package.Path.dirname(this.utils.getFilePath())
    filepath = () => this.utils.Package.Path.join(this.folder(), this.title())
}


module.exports = {
    plugin: templater,
};