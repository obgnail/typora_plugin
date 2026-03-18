class Settings {
    constructor(utils) {
        this.utils = utils
        this.META = { $id: "https://github.com/obgnail/typora_plugin", $version: "1" }
    }

    getOriginPath = file => this.utils.joinPluginPath("./plugin/global/settings", file)
    getHomePath = file => this.utils.Package.Path.join(this.utils.getHomeDir(), ".config", "typora_plugin", file)
    getActualPath = async file => {
        const homePath = this.getHomePath(file)
        const exist = await this.utils.existPath(homePath)
        return exist ? homePath : this.getOriginPath(file)
    }

    openFolder = async (file = "settings.user.toml") => {
        const path = await this.getActualPath(file)
        this.utils.showInFinder(path)
    }

    handle = async (fixedName, handler) => {
        const file = this.utils.getBasePluginSetting(fixedName) ? "settings.user.toml" : "custom_plugin.user.toml"
        const path = await this.getActualPath(file)
        const allSettings = await this.utils.readTomlFile(path)
        if (!allSettings[fixedName]) {
            allSettings[fixedName] = {}
        }
        handler(allSettings[fixedName], allSettings)
        const content = this.utils.stringifyToml(allSettings).replace(/\r\n/g, "\n")
        return this.utils.writeFile(path, content)
    }

    clear = async (fixedName) => {
        return this.handle(fixedName, (_, allSettings) => delete allSettings[fixedName])
    }

    save = async (fixedName, updateObject) => {
        return this.handle(fixedName, (pluginSettings, allSettings) => {
            allSettings[fixedName] = this.utils.merge(pluginSettings, updateObject)
        })
    }

    autoSave = (plugin) => {
        const save = this.save
        plugin.config = new Proxy(plugin.config, {
            set(target, property, value, receiver) {
                save(plugin.fixedName, { [property]: value })
                return Reflect.set(...arguments)
            }
        })
    }

    getObjects = async (defaultFile, userFile) => {
        const default_ = this.getOriginPath(defaultFile)
        const user_ = this.getOriginPath(userFile)
        const home_ = this.getHomePath(userFile)
        const contents = await this.utils.readFiles([default_, user_, home_])
        try {
            return contents.map(c => c ? this.utils.readToml(c) : {})
        } catch (e) {
            const prefix = "Invalid TOML document: "
            const detail = e.toString().replace(prefix, "")
            const message = prefix + userFile
            const buttons = ["Confirm", "Cancel"]
            const op = { type: "error", buttons, message, detail }
            await this.utils.showMessageBox(op)
            return contents.map(() => ({}))
        }
    }

    read = async (defaultFile, userFile) => {
        const objs = await this.getObjects(defaultFile, userFile)
        return objs.reduce(this.utils.merge)
    }
    readBase = async () => this.read("settings.default.toml", "settings.user.toml")
    readCustom = async () => this.read("custom_plugin.default.toml", "custom_plugin.user.toml")

    export = async (exportPath) => {
        const [base, custom] = await Promise.all([this.readBase(), this.readCustom()])
        await this.utils.Package.FsExtra.writeJson(exportPath, { ...this.META, ...base, ...custom })
    }

    import = async (importPath) => {
        const settings = await this.utils.Package.FsExtra.readJson(importPath)
        const mismatch = [...Object.keys(this.META)].some(key => settings[key] !== this.META[key])
        if (mismatch) {
            throw new Error(`${importPath} is not the correct settings file.`)
        }
        const basePlugins = this.utils.getAllBasePluginSettings()
        const isObject = x => x != null && !Array.isArray(x) && typeof x === "object"
        const settingFiles = {
            "settings.user.toml": this.utils.pickBy(settings, (obj, key) => isObject(obj) && Object.hasOwn(basePlugins, key)),
            "custom_plugin.user.toml": this.utils.pickBy(settings, (obj, key) => isObject(obj) && !Object.hasOwn(basePlugins, key)),
        }
        const promises = Object.entries(settingFiles).map(async ([file, setting]) => {
            const path = await this.getActualPath(file)
            const content = this.utils.stringifyToml(setting).replace(/\r\n/g, "\n")
            return this.utils.writeFile(path, content)
        })
        await Promise.all(promises)
    }
}

module.exports = Settings
