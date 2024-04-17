class templater extends BaseCustomPlugin {
    selector = () => this.utils.getFilePath() ? undefined : this.utils.nonExistSelector
    hint = isDisable => isDisable && "空白页不可使用此插件"
    hotkey = () => [this.config.hotkey]

    callback = anchorNode => {
        if (!File.editor.selection.getRangy().collapsed) {
            ClientCommand.copyAsMarkdown();
            window.parent.navigator.clipboard.readText().then(text => this.rangeText = text);
        }

        const components = [
            {label: "文件名", type: "input", value: "", placeholder: "请输入新文件名，为空则创建副本"},
            {label: "模板", type: "select", list: this.config.template.map(template => template.name)}
        ]
        const modal = {title: "新文件", components};

        this.modal(modal, async ([{submit: filepath}, {submit: template}]) => {
            const tpl = this.config.template.find(tpl => tpl.name === template);
            if (!tpl) return;

            if (filepath && !filepath.endsWith(".md")) {
                filepath += ".md";
            }
            filepath = await this.utils.newFilePath(filepath);
            const filename = this.utils.Package.Path.basename(filepath);
            const content = (new templateHelper(filename, this))._convert(tpl.text);
            await this.utils.Package.Fs.promises.writeFile(filepath, content);
            this.rangeText = "";
            this.config.auto_open && this.utils.openFile(filepath);
        })
    }
}

class templateHelper {
    constructor(title, controller) {
        this._title = title;
        this.rangeText = controller.rangeText || "";
        this.utils = controller.utils;
        this.config = controller.config;
        this.today = new Date();
        this.oneDay = 24 * 60 * 60 * 1000;
    }

    _getTemplateVars = () => {
        const map = {};
        this.config.template_variables.forEach(({enable, name, callback}) => {
            if (!enable) return;
            const func = eval(callback);
            if (func instanceof Function) {
                map[name] = func;
            }
        });
        Object.entries(this).forEach(([key, value]) => {
            if (value instanceof Function) {
                map[key] = value;
            }
        });
        return map
    }
    _convert = text => {
        const vm = reqnode("vm");
        const context = this._getTemplateVars();
        const parentheses = `\\(.*?\\)`;
        const LBrace = `\\{\\{`;
        const RBrace = `\\}\\}`;
        const space = `\\s`;
        for (const varName of Object.keys(context)) {
            const regExp = `${LBrace}${space}*${varName}(${parentheses})?${space}*${RBrace}`;
            text = text.replace(new RegExp(regExp, "g"), (origin, templateArgs) => {
                const callFunc = varName + (templateArgs || "()");
                return vm.runInNewContext(callFunc, context);
            });
        }
        return text
    }
    _padStart = (str, len = 2, symbol = "0") => (str + "").padStart(len, symbol);
    _formatDate = day => `${day.getFullYear()}/${day.getMonth() + 1}/${this._padStart(day.getDate())}`;
    _formatTime = day => `${this._padStart(day.getHours())}:${this._padStart(day.getMinutes())}:${this._padStart(day.getSeconds())}`;

    uuid = () => this.utils.getUUID();
    random = () => Math.random();
    randomInt = (floor, ceil) => this.utils.getRandomInt(floor, ceil);
    range = () => this.rangeText;
    title = () => this._title;
    folder = () => this.utils.getCurrentDirPath();
    filepath = () => this.utils.Package.Path.join(this.folder(), this.title());
    weekday = () => "周" + '日一二三四五六'.charAt(this.today.getDay());
    datetime = () => this.today.toLocaleString('chinese', {hour12: false});
    date = () => this._formatDate(this.today);
    time = () => this._formatTime(this.today);
    timestamp = () => this.today.getTime();
    dateOffset = offset => this._formatDate(new Date(this.timestamp() + parseInt(offset) * this.oneDay));
    yesterday = () => this.dateOffset(-1);
    tomorrow = () => this.dateOffset(1);
}

module.exports = {
    plugin: templater,
};