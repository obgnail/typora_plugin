class templaterPlugin extends BaseCustomPlugin {
    selector = () => this.utils.getMountFolder() ? undefined : this.utils.nonExistSelector

    hint = isDisable => isDisable ? this.i18n._t("global", "error.onBlankPage") : undefined

    hotkey = () => [this.config.hotkey]

    callback = async anchorNode => {
        const i18n = {
            Filename: this.i18n.t("filename"),
            Template: this.i18n.t("template"),
            Preview: this.i18n.t("preview"),
            createCopyIfEmpty: this.i18n.t("createCopyIfEmpty"),
        }

        const range = File.editor.selection.getRangy()
        if (range && !range.collapsed) {
            ClientCommand.copyAsMarkdown()
            window.parent.navigator.clipboard.readText().then(text => this.rangeText = text)
        }

        const onchange = ev => {
            const value = ev.target.value
            const tpl = this.config.template.find(tpl => tpl.name === value)
            if (tpl) {
                const textarea = ev.target.closest(".plugin-custom-modal-body").querySelector("textarea")
                textarea.value = tpl.text
            }
        }
        const components = [
            { label: i18n.Filename, type: "input", value: "", placeholder: i18n.createCopyIfEmpty },
            { label: i18n.Template, type: "select", list: this.config.template.map(tpl => tpl.name), onchange },
            { label: i18n.Preview, type: "textarea", rows: 10, readonly: "readonly", content: this.config.template[0].text },
        ]
        const op = { title: this.pluginName, components }
        const { response, submit: [filepath, template] } = await this.utils.dialog.modalAsync(op)
        if (response === 1) {
            await this.writeTemplateFile(filepath, template)
        }
    }

    writeTemplateFile = async (filepath, template) => {
        const tpl = this.config.template.find(tpl => tpl.name === template);
        if (!tpl) return;
        if (filepath && !filepath.endsWith(".md")) {
            filepath += ".md";
        }
        filepath = await this.utils.newFilePath(filepath);
        const filename = this.utils.Package.Path.basename(filepath);
        const content = (new templateHelper(filename, this))._convert(tpl.text);
        const ok = await this.utils.writeFile(filepath, content);
        if (!ok) return;
        this.rangeText = "";
        this.config.auto_open && this.utils.openFile(filepath);
    }
}

class templateHelper {
    constructor(title, plugin) {
        this._title = title.substring(0, title.lastIndexOf("."))
        this.rangeText = plugin.rangeText || ""
        this.utils = plugin.utils
        this.config = plugin.config
        this._date = new Date()
    }

    _getTemplateVars = () => {
        const map = {};
        this.config.template_variables.forEach(({ enable, name, callback }) => {
            if (!enable) return;
            const func = eval(callback);
            if (func instanceof Function) {
                map[name] = func;
            }
        });
        Object.entries(this).forEach(([key, value]) => {
            if (!key.startsWith("_") && value instanceof Function) {
                map[key] = value;
            }
        });
        return map
    }
    _convert = text => {
        const context = this._getTemplateVars();
        const parentheses = `\\((.*?)\\)`;
        const LBrace = `\\{\\{`;
        const RBrace = `\\}\\}`;
        const space = `\\s`;
        for (const [symbol, func] of Object.entries(context)) {
            const regExp = `${LBrace}${space}*${symbol}(${parentheses})?${space}*${RBrace}`;
            text = text.replace(new RegExp(regExp, "g"), (origin, _, templateArgs) => {
                const args = !templateArgs ? [] : eval(`[${templateArgs}]`);
                return func.apply(this, args);
            });
        }
        return text
    }

    uuid = () => this.utils.getUUID();
    username = () => process.env.username || this.utils.Package.OS.userInfo().username
    random = () => Math.random();
    randomInt = (floor, ceil) => this.utils.randomInt(floor, ceil);
    randomStr = len => this.utils.randomString(len);
    range = () => this.rangeText;
    title = () => this._title;
    folder = () => this.utils.getCurrentDirPath();
    mountFolder = () => this.utils.getMountFolder();
    filepath = () => this.utils.Package.Path.join(this.folder(), this.title());
    formatDate = (format, locale) => this.utils.dateTimeFormat(this._date, format, locale)
    timestamp = () => this._date.getTime()
    datetime = locale => this.formatDate("yyyy-MM-dd HH:mm:ss", locale);
    date = locale => this.formatDate("yyyy-MM-dd", locale);
    time = locale => this.formatDate("HH:mm:ss", locale);
    weekday = locale => this.formatDate("ddd", locale);
    dateOffset = (offset = 0, format = "yyyy-MM-dd", locale) => {
        const timestamp = this.timestamp() + parseInt(offset) * (24 * 60 * 60 * 1000)
        return this.utils.dateTimeFormat(new Date(timestamp), format, locale)
    }
    yesterday = (format, locale) => this.dateOffset(-1, format, locale);
    tomorrow = (format, locale) => this.dateOffset(1, format, locale);
}

module.exports = {
    plugin: templaterPlugin,
}
