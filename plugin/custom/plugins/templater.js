class templater extends BaseCustomPlugin {
    selector = () => {
        if (!this.utils.getFilePath()) {
            return this.utils.nonExistSelector
        }
    }

    hotkey = () => [this.config.hotkey]

    process = () => {
        this.utils.addEventListener(this.utils.eventType.allPluginsHadInjected, () => {
            if (!this.utils.getCustomPlugin("kanban")) return;
            this.config.template.push({
                name: "今日任务",
                text: "---\ntitle: {{title}}\ndate: {{date}} {{weekday}}\n---\n\n\n```kanban\n# {{date}} Task List\n\n## Todo\n- task1(task description)\n- task2\n- task3\n\n## In-Progress\n\n## Completed\n\n```\n\n"
            })
        })
    }

    callback = anchorNode => {
        if (!File.editor.selection.getRangy().collapsed) {
            ClientCommand.copyAsMarkdown();
            window.parent.navigator.clipboard.readText().then(text => this.rangeText = text);
        }

        const templateList = this.config.template;
        const modal = {
            title: "新文件",
            components: [
                {label: "文件名", type: "input", value: "", placeholder: "请输入新文件名，为空则创建副本"},
                {label: "模板", type: "select", list: templateList.map(template => template.name)}
            ]
        }

        this.modal(modal, components => {
            let filepath = components[0].submit;
            if (filepath && !filepath.endsWith(".md")) {
                filepath += ".md";
            }
            filepath = this.utils.newFilePath(filepath);
            const filename = this.utils.Package.Path.basename(filepath);

            const option = components[1].submit;
            const template = templateList.filter(template => template.name === option)[0];
            if (!template) return;

            const helper = new templateHelper(filename, this);
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
    constructor(title, controller) {
        this._title = title;
        this.rangeText = controller.rangeText || "";
        this.utils = controller.utils;
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
        for (let [varName, template] of Object.entries(this.templateVarMap)) {
            text = text.replace(new RegExp(template, "g"), this[varName](template));
        }
        return text
    }

    dateOffset = offset => {
        const day = new Date(this.today.getTime() + offset);
        return `${day.getFullYear()}/${day.getMonth() + 1}/${day.getDate()}`
    }

    uuid = () => this.utils.getUUID();
    random = () => Math.random();
    range = () => this.rangeText;
    title = () => this._title;
    folder = () => this.utils.Package.Path.dirname(this.utils.getFilePath());
    filepath = () => this.utils.Package.Path.join(this.folder(), this.title());
    weekday = () => "周" + '日一二三四五六'.charAt(this.today.getDay());
    datetime = () => this.today.toLocaleString('chinese', {hour12: false});
    date = () => `${this.today.getFullYear()}/${this.today.getMonth() + 1}/${this.today.getDate()}`;
    time = () => `${this.today.getHours()}:${this.today.getMinutes()}:${this.today.getSeconds()}`;
    yesterday = () => this.dateOffset(-24 * 60 * 60 * 1000);
    tomorrow = () => this.dateOffset(24 * 60 * 60 * 1000);
}


module.exports = {
    plugin: templater,
};