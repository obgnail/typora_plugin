class TemplaterPlugin extends BasePlugin {
    selector = () => this.utils.getMountFolder() ? undefined : this.utils.nonExistSelector

    hint = isDisable => isDisable ? this.i18n.t("error.onBlankPage") : undefined

    hotkey = () => [{ hotkey: this.config.HOTKEY, callback: this.call }]

    process = () => {
        this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.allPluginsHadInjected, () => {
            const { TEMPLATE_FOLDERS, TEMPLATE } = this.config
            const { Path: { extname }, FsExtra: { readFile } } = this.utils.Package

            if (!TEMPLATE_FOLDERS || TEMPLATE_FOLDERS.length === 0) return

            const maxDepth = 3  // Only recursively search for 3 sub depths
            const signal = AbortSignal.timeout(30 * 1000)
            const fileFilter = (name) => extname(name).toLowerCase() === ".md"
            const fileParamsGetter = async (path, file) => ({ file, content: await readFile(path, "utf-8") })
            const onFile = ({ file, content }) => TEMPLATE.push({ name: file.replace(/\.md$/i, ""), text: content })
            TEMPLATE_FOLDERS.forEach(folder => this.utils.walkDir({ dir: this.utils.resolvePath(folder), fileFilter, fileParamsGetter, onFile, maxDepth, signal }))
        })
    }

    call = async anchorNode => {
        const templates = this.config.TEMPLATE.map(tpl => tpl.name)
        const defaultTpl = this.config.TEMPLATE[0]
        const getTplCnt = (name) => this.config.TEMPLATE.find(tpl => tpl.name === name)?.text ?? ""
        const op = {
            title: this.pluginName,
            schema: ({ Group, Controls }) => [
                Group(
                    Controls.Select("template").Label(this.i18n.t("$label.TEMPLATE.text")).Options(templates),
                    Controls.Text("filename").Label(this.i18n.t("filename")).Placeholder(this.i18n.t("createCopyIfEmpty")),
                    Controls.Switch("autoOpen").Label(this.i18n.t("$label.AUTO_OPEN")),
                ),
                Controls.Textarea("preview").Label(this.i18n.t("preview")).Rows(8),
            ],
            data: {
                filename: "",
                autoOpen: this.config.AUTO_OPEN,
                template: defaultTpl.name,
                preview: defaultTpl.text,
            },
            watchers: [{
                triggers: ["template"],
                effect: { $update: { preview: (ctx) => getTplCnt(ctx.getValue("template")) } }
            }],
        }
        const { response, data } = await this.utils.formDialog.modal(op)
        if (response === 1) {
            const { filename, preview, autoOpen } = data
            await this._writeFile(filename, preview, autoOpen)
        }
    }

    _writeFile = async (filename, tpl, autoOpen) => {
        if (filename && !filename.endsWith(".md")) {
            filename += ".md"
        }
        filename = await this.utils.newFilePath(filename)
        const title = this.utils.Package.Path.basename(filename)
        const content = this._parseTemplate(tpl, title)
        const ok = await this.utils.writeFile(filename, content)
        if (!ok) return
        if (autoOpen) {
            this.utils.openFile(filename)
        }
    }

    _parseTemplate = (tpl, title) => {
        const _date = new Date()
        const _title = title.substring(0, title.lastIndexOf("."))

        const fns = {
            title: () => _title,
            folder: () => this.utils.getCurrentDirPath(),
            mountFolder: () => this.utils.getMountFolder(),
            filepath: () => this.utils.Package.Path.join(fns.folder(), _title),
            uuid: () => this.utils.getUUID(),
            randomInt: (floor, ceil) => this.utils.randomInt(floor, ceil),
            randomStr: (length) => this.utils.randomString(length),
            timestamp: () => _date.getTime(),
            formatDate: (format, locale) => this.utils.dateTimeFormat(_date, format, locale),
            datetime: (locale) => fns.formatDate("yyyy-MM-dd HH:mm:ss", locale),
            date: (locale) => fns.formatDate("yyyy-MM-dd", locale),
            time: (locale) => fns.formatDate("HH:mm:ss", locale),
            weekday: (locale) => fns.formatDate("ddd", locale),
            dateOffset: (offset = 0, format = "yyyy-MM-dd", locale) => {
                const timestamp = fns.timestamp() + parseInt(offset) * (24 * 60 * 60 * 1000)
                return this.utils.dateTimeFormat(new Date(timestamp), format, locale)
            },
            yesterday: (format, locale) => fns.dateOffset(-1, format, locale),
            tomorrow: (format, locale) => fns.dateOffset(1, format, locale),
        }
        this.config.TEMPLATE_VARIABLES.forEach(({ enable, name, callback }) => {
            if (!enable) return
            const fn = eval(callback)
            if (typeof fn === "function") {
                fns[name] = fn
            }
        })

        const regex = /\{\{\s*([a-zA-Z0-9_$]+)(?:\((.*?)\))?\s*\}\}/g
        return tpl.replace(regex, (origin, fnName, argsStr) => {
            const fn = fns[fnName]
            if (typeof fn !== "function") return origin
            try {
                const args = argsStr ? eval(`[${argsStr}]`) : []
                return fn.apply(this, args)
            } catch (e) {
                console.error(`Template error in ${fnName}:`, e)
                return origin
            }
        })
    }
}

module.exports = {
    plugin: TemplaterPlugin
}
