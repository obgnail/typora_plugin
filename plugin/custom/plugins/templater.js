class templater extends BaseCustomPlugin {
    selector = () => ""

    callback = anchorNode => {
        if (!File.editor.selection.getRangy().collapsed) {
            ClientCommand.copyAsMarkdown();
            window.parent.navigator.clipboard.readText().then(text => this.rangeText = text);
        }

        const modal = {
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
                    list: this.info.template.map(template => template.name),
                }
            ]
        }

        this.modal(modal, components => {
            let filepath = components[0].submit;
            filepath = this.utils.newFilePath(filepath);
            const filename = this.utils.Package.Path.basename(filepath);

            const option = components[1].submit;
            const template = this.info.template.filter(template => template.name === option)[0];
            if (!template) return;

            const helper = new templateHelper(filename, this.rangeText, this.utils);
            const content = helper.convert(template.text);
            this.utils.Package.Fs.writeFileSync(filepath, content, "utf8");
            this.rangeText = "";
            if (this.config.auto_open) {
                this.utils.openFile(filepath);
            }
        })
    }
}

class templateHelper {
    constructor(title, rangeText, utils) {
        this._title = title;
        this.rangeText = rangeText || "";
        this.utils = utils;
        this.today = new Date();
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

    dateOffset = offset => {
        const day = new Date(this.today.getTime() + offset);
        return `${day.getFullYear()}/${day.getMonth()}/${day.getDate()}`
    }

    uuid = () => this.utils.getUUID();
    random = () => Math.random();
    range = () => this.rangeText;
    title = () => this._title;
    folder = () => this.utils.Package.Path.dirname(this.utils.getFilePath());
    filepath = () => this.utils.Package.Path.join(this.folder(), this.title());
    weekday = () => "周" + '日一二三四五六'.charAt(this.today.getDay());
    datetime = () => this.today.toLocaleString('chinese', {hour12: false});
    date = () => `${this.today.getFullYear()}/${this.today.getMonth()}/${this.today.getDate()}`;
    time = () => `${this.today.getHours()}:${this.today.getMinutes()}:${this.today.getSeconds()}`;
    yesterday = () => this.dateOffset(-24 * 60 * 60 * 1000);
    tomorrow = () => this.dateOffset(24 * 60 * 60 * 1000);
}


module.exports = {
    plugin: templater,
};