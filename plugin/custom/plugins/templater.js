class templaterPlugin extends BaseCustomPlugin {
    selector = () => this.utils.getMountFolder() ? undefined : this.utils.nonExistSelector

    hint = isDisable => isDisable ? this.i18n.t("error.onBlankPage") : undefined

    hotkey = () => [this.config.hotkey]

    callback = async anchorNode => {
        const i18n = {
            Filename: this.i18n.t("filename"),
            Template: this.i18n.t("template"),
            Preview: this.i18n.t("preview"),
            createCopyIfEmpty: this.i18n.t("createCopyIfEmpty"),
        }

        if (!File.editor.selection.getRangy().collapsed) {
            ClientCommand.copyAsMarkdown();
            window.parent.navigator.clipboard.readText().then(text => this.rangeText = text);
        }

        const onchange = ev => {
            const value = ev.target.value;
            const tpl = this.config.template.find(tpl => tpl.name === value);
            if (tpl) {
                ev.target.closest(".plugin-custom-modal-body").querySelector("textarea").value = tpl.text;
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
            await this.writeTemplateFile(filepath, template);
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

class DateTimeFormatter {
    constructor(date) {
        this.date = date
    }

    getTime(format = "yyyy-MM-dd HH:mm:ss", locale = "en") {
        const replacements = {
            yyyy: this.date.getFullYear().toString(),
            yyy: (this.date.getFullYear() % 1000).toString().padStart(3, '0'),
            yy: (this.date.getFullYear() % 100).toString().padStart(2, '0'),
            MMMM: new Intl.DateTimeFormat(locale, { month: 'long' }).format(this.date),
            MMM: new Intl.DateTimeFormat(locale, { month: 'short' }).format(this.date),
            MM: this._padStart((this.date.getMonth() + 1).toString()),
            M: (this.date.getMonth() + 1).toString(),
            dddd: new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(this.date),
            ddd: new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(this.date),
            dd: this._padStart(this.date.getDate().toString()),
            d: this.date.getDate().toString(),
            HH: this._padStart(this.date.getHours().toString()),
            H: this.date.getHours().toString(),
            hh: this._padStart((this.date.getHours() % 12 || 12).toString()),
            h: (this.date.getHours() % 12 || 12).toString(),
            mm: this._padStart(this.date.getMinutes().toString()),
            m: this.date.getMinutes().toString(),
            ss: this._padStart(this.date.getSeconds().toString()),
            s: this.date.getSeconds().toString(),
            SSS: this._padStart(this.date.getMilliseconds().toString(), 3),
            S: this.date.getMilliseconds().toString(),
            a: (() => {
                const time = new Intl.DateTimeFormat(locale, { hour: 'numeric', hour12: true })
                    .formatToParts(this.date)
                    .find(part => part.type === 'dayPeriod')
                return time ? time.value : ''
            })()
        }
        const regex = /(yyyy|yyy|yy|MMMM|MMM|MM|M|dddd|ddd|dd|d|HH|H|hh|h|mm|m|ss|s|SSS|S|a)/g
        return format.replace(regex, (match) => replacements[match] || match)
    }

    _padStart(str, len = 2, symbol = "0") {
        return str.padStart(len, symbol)
    }

    getTimestamp() {
        return this.date.getTime()
    }
}

class templateHelper {
    constructor(title, plugin) {
        this._title = title.substring(0, title.lastIndexOf("."))
        this.rangeText = plugin.rangeText || ""
        this.utils = plugin.utils
        this.config = plugin.config
        this.formatter = new DateTimeFormatter(new Date())
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
    formatDate = (format, locale) => this.formatter.getTime(format, locale);
    timestamp = () => this.formatter.getTimestamp();
    datetime = locale => this.formatDate("yyyy-MM-dd HH:mm:ss", locale);
    date = locale => this.formatDate("yyyy-MM-dd", locale);
    time = locale => this.formatDate("HH:mm:ss", locale);
    weekday = locale => this.formatDate("ddd", locale);
    dateOffset = (offset = 0, format = "yyyy-MM-dd", locale) => {
        const timestamp = this.timestamp() + parseInt(offset) * (24 * 60 * 60 * 1000)
        const formatter = new DateTimeFormatter(new Date(timestamp))
        return formatter.getTime(format, locale)
    }
    yesterday = (format, locale) => this.dateOffset(-1, format, locale);
    tomorrow = (format, locale) => this.dateOffset(1, format, locale);
}

module.exports = {
    plugin: templaterPlugin,
}
