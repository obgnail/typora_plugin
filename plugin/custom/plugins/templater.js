class templaterPlugin extends BaseCustomPlugin {
    selector = () => this.utils.getMountFolder() ? undefined : this.utils.nonExistSelector
    hint = isDisable => isDisable && "空白页不可使用此插件"

    hotkey = () => [this.config.hotkey]

    callback = anchorNode => {
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
            {label: "文件名", type: "input", value: "", placeholder: "请输入新文件名，为空则创建副本"},
            {label: "模板", type: "select", list: this.config.template.map(tpl => tpl.name), onchange},
            {label: "预览", type: "textarea", rows: 10, readonly: "readonly", content: this.config.template[0].text},
        ]
        const modal = {title: "新文件", components};

        this.utils.modal(modal, async ([{submit: filepath}, {submit: template}]) => {
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
        })
    }
}

class dateFormatter {
    constructor(date) {
        this.date = date;
        this.year = date.getFullYear();
        this.month = date.getMonth() + 1;
        this.day = date.getDate();
        this.hour = date.getHours();
        this.minute = date.getMinutes();
        this.second = date.getSeconds();
        this.millisecond = date.getMilliseconds();
    }

    _getMonthName(date, locale) {
        const months = locale === "en"
            ? ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
            : ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
        return months[date.getMonth()];
    }

    _getMonthNameAbbr(date, locale) {
        const months = locale === "en"
            ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
            : ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'];
        return months[date.getMonth()];
    }

    _getDayName(date, locale) {
        const days = locale === "en"
            ? ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
            : ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        return days[date.getDay()];
    }

    _getDayNameAbbr(date, locale) {
        const days = locale === "en"
            ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
            : ['日', '一', '二', '三', '四', '五', '六'];
        return days[date.getDay()];
    }

    _getAmPm(hour, locale) {
        const [am, pm] = locale === "en" ? ["AM", "PM"] : ["上午", "下午"];
        return hour < 12 ? am : pm
    }

    _padStart(str, len = 2, symbol = "0") {
        return (str + "").padStart(len, symbol)
    }

    _getReplacement(locale) {
        return {
            yyyy: this.year.toString(),
            yyy: this.year.toString().substr(1),
            yy: this.year.toString().substr(2),
            MMMM: this._getMonthName(this.date, locale),
            MMM: this._getMonthNameAbbr(this.date, locale),
            MM: this._padStart(this.month),
            M: this.month,
            dddd: this._getDayName(this.date, locale),
            ddd: this._getDayNameAbbr(this.date, locale),
            dd: this._padStart(this.day),
            d: this.day,
            HH: this._padStart(this.hour),
            H: this.hour,
            hh: this._padStart(this.hour % 12),
            h: this.hour % 12,
            mm: this._padStart(this.minute),
            m: this.minute,
            ss: this._padStart(this.second),
            s: this.second,
            SSS: this._padStart(this.millisecond, 3),
            S: this.millisecond,
            a: this._getAmPm(this.hour),
        }
    }

    getTime(format = "yyyy-MM-dd HH:mm:ss", locale = "en") {
        const regexp = /(yyyy|yyy|yy|MMMM|MMM|MM|M|dddd|ddd|dd|d|HH|H|hh|h|mm|m|ss|s|SSS|S|a)/g;
        const replacement = this._getReplacement(locale);
        return format.replace(regexp, (match) => replacement[match] || match);
    }

    getTimestamp() {
        return this.date.getTime()
    }
}

class templateHelper {
    constructor(title, controller) {
        this._title = title.substring(0, title.lastIndexOf("."));
        this.rangeText = controller.rangeText || "";
        this.utils = controller.utils;
        this.config = controller.config;
        this.formatter = new dateFormatter(new Date());
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
    dateOffset = (offset = 0, format = "yyyy-MM-dd", locale) => new dateFormatter(new Date(this.timestamp() + parseInt(offset) * (24 * 60 * 60 * 1000))).getTime(format, locale);
    yesterday = (format, locale) => this.dateOffset(-1, format, locale);
    tomorrow = (format, locale) => this.dateOffset(1, format, locale);
}

module.exports = {
    plugin: templaterPlugin,
};