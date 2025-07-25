class templaterPlugin extends BaseCustomPlugin {
    selector = () => this.utils.getMountFolder() ? undefined : this.utils.nonExistSelector

    hint = isDisable => isDisable ? this.i18n._t("global", "error.onBlankPage") : undefined

    hotkey = () => [this.config.hotkey]

    process = () => {
        this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.allPluginsHadInjected, () => {
            const { template_folders, template } = this.config
            const { Path: { extname }, Fs: { promises: { readFile } } } = this.utils.Package

            if (!template_folders || template_folders.length === 0) return

            const maxDepth = 3  // Only recursively search for 3 sub depths
            const signal = AbortSignal.timeout(30 * 1000)
            const fileFilter = (name) => extname(name).toLowerCase() === ".md"
            const createFileParams = async (path, file) => ({ file, content: (await readFile(path)).toString() })
            const onFile = ({ file, content }) => template.push({ name: file.replace(/\.md$/i, ""), text: content })
            template_folders.forEach(dir => this.utils.walkDir({ dir, fileFilter, createFileParams, onFile, maxDepth, signal }))
        })
    }

    callback = async anchorNode => {
        const defaultTpl = this.config.template[0]
        const templates = Object.fromEntries(this.config.template.map(tpl => [tpl.name, tpl.name]))
        const settingFields = [
            { key: "template", type: "select", label: this.i18n.t("$label.template.text"), options: templates },
            { key: "filename", type: "text", label: this.i18n.t("filename"), placeholder: this.i18n.t("createCopyIfEmpty") },
            { key: "autoOpen", type: "switch", label: this.i18n.t("$label.auto_open") },
        ]
        const op = {
            title: this.pluginName,
            schema: [
                { title: undefined, fields: settingFields },
                { title: this.i18n.t("preview"), fields: [{ key: "preview", type: "textarea", rows: 8 }] },
            ],
            data: {
                filename: "",
                autoOpen: this.config.auto_open,
                template: defaultTpl.name,
                preview: defaultTpl.text,
            },
            listener: ({ key, value }) => {
                if (key !== "template") return
                const tpl = this.config.template.find(tpl => tpl.name === value)
                if (tpl) {
                    this.utils.formDialog.updateModal(op => op.data = { ...op.data, template: tpl.name, preview: tpl.text })
                }
            }
        }
        const { response, data } = await this.utils.formDialog.modal(op)
        if (response === 1) {
            const { filename, preview, autoOpen } = data
            await this.writeTemplateFile(filename, preview, autoOpen)
        }
    }

    writeTemplateFile = async (filename, template, autoOpen) => {
        if (filename && !filename.endsWith(".md")) {
            filename += ".md"
        }
        filename = await this.utils.newFilePath(filename)
        const title = this.utils.Package.Path.basename(filename)
        const content = (new templateHelper(title, this))._convert(template)
        const ok = await this.utils.writeFile(filename, content)
        if (!ok) return
        if (autoOpen) {
            this.utils.openFile(filename)
        }
    }
}

class templateHelper {
    constructor(title, plugin) {
        this._title = title.substring(0, title.lastIndexOf("."))
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
    randomInt = (floor, ceil) => this.utils.randomInt(floor, ceil);
    randomStr = len => this.utils.randomString(len);
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
