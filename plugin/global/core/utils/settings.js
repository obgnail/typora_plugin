class Settings {
    constructor(utils) {
        this.utils = utils
        this.meta = { $id: "https://github.com/obgnail/typora_plugin", $version: "1" }
    }

    getOriginPath = file => this.utils.joinPath("./plugin/global/settings", file)
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

    clear = async (fixedName) => this.handle(fixedName, (_, allSettings) => delete allSettings[fixedName])

    clearAll = async () => {
        const files = ["settings.user.toml", "custom_plugin.user.toml"]
        const promises = files.map(async file => {
            const path = await this.getActualPath(file)
            return this.utils.writeFile(path, "")
        })
        return Promise.all(promises)
    }

    save = async (fixedName, updateObject) => {
        return this.handle(fixedName, (pluginSettings, allSettings) => {
            allSettings[fixedName] = this.utils.merge(pluginSettings, updateObject)
        })
    }

    autoSave = (plugin) => {
        const saveSettings = this.save
        plugin.config = new Proxy(plugin.config, {
            set(target, property, value, receiver) {
                saveSettings(plugin.fixedName, { [property]: value })
                return Reflect.set(...arguments)
            }
        })
    }

    getObjects = async (defaultSetting, userSetting) => {
        const default_ = this.getOriginPath(defaultSetting)
        const user_ = this.getOriginPath(userSetting)
        const home_ = this.getHomePath(userSetting)
        const contentList = await this.utils.readFiles([default_, user_, home_])
        try {
            return contentList.map(c => c ? this.utils.readToml(c) : {})
        } catch (e) {
            // At this time, i18n has not been loaded yet. Using English
            const message = `Invalid TOML document: ${userSetting}`
            const detail = e.toString().replace("Invalid TOML document: ", "")
            const buttons = ["Confirm", "Cancel"]
            const op = { type: "error", title: "Typora Plugin", buttons, message, detail }
            await this.utils.showMessageBox(op)
            return contentList.map(() => ({}))
        }
    }

    read = async (defaultSetting, userSetting) => {
        const objs = await this.getObjects(defaultSetting, userSetting)
        return objs.reduce(this.utils.merge)
    }
    readBase = async () => this.read("settings.default.toml", "settings.user.toml")
    readCustom = async () => this.read("custom_plugin.default.toml", "custom_plugin.user.toml")

    export = async (exportPath, showInFinder = true) => {
        const [base, custom] = await Promise.all([this.readBase(), this.readCustom()])
        await this.utils.Package.FsExtra.writeJson(exportPath, { ...this.meta, ...base, ...custom })
        if (showInFinder) {
            this.utils.showInFinder(exportPath)
        }
    }

    import = async (importPath) => {
        const settings = await this.utils.Package.FsExtra.readJson(importPath)
        const mismatch = [...Object.keys(this.meta)].some(key => settings[key] !== this.meta[key])
        if (mismatch) {
            throw new Error(`${importPath} is not the correct settings file.`)
        }
        const basePlugins = this.utils.getAllBasePluginSettings()
        const isObject = x => x != null && !Array.isArray(x) && typeof x === "object"
        const settingFiles = {
            "settings.user.toml": this.utils.pickBy(settings, (obj, key) => isObject(obj) && basePlugins.hasOwnProperty(key)),
            "custom_plugin.user.toml": this.utils.pickBy(settings, (obj, key) => isObject(obj) && !basePlugins.hasOwnProperty(key)),
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
