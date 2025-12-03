class Settings {
    constructor(utils) {
        this.utils = utils
        this.meta = { $id: "https://github.com/obgnail/typora_plugin", $version: "1" }
    }

    getOriginSettingPath = settingFile => this.utils.joinPath("./plugin/global/settings", settingFile)
    getHomeSettingPath = settingFile => this.utils.Package.Path.join(this.utils.getHomeDir(), ".config", "typora_plugin", settingFile)
    getActualSettingPath = async settingFile => {
        const homeSettingPath = this.getHomeSettingPath(settingFile)
        const exist = await this.utils.existPath(homeSettingPath)
        return exist ? homeSettingPath : this.getOriginSettingPath(settingFile)
    }
    getSettingFileName = (fixedName) => {
        if (this.utils.getBasePluginSetting(fixedName)) {
            return "settings.user.toml"
        } else if (this.utils.getCustomPluginSetting(fixedName)) {
            return "custom_plugin.user.toml"
        }
    }

    handleSettings = async (fixedName, handler) => {
        const settingFile = this.getSettingFileName(fixedName)
        const settingPath = await this.getActualSettingPath(settingFile)
        const allSettings = await this.utils.readTomlFile(settingPath)
        if (!allSettings[fixedName]) {
            allSettings[fixedName] = {}
        }
        handler(allSettings[fixedName], allSettings)
        const content = this.utils.stringifyToml(allSettings).replace(/\r\n/g, "\n")
        return this.utils.writeFile(settingPath, content)
    }

    clearSettings = async (fixedName) => {
        return this.handleSettings(fixedName, (_, allSettings) => delete allSettings[fixedName])
    }

    clearAllSettings = async () => {
        const files = ["settings.user.toml", "custom_plugin.user.toml"]
        const promises = files.map(async file => {
            const path = await this.getActualSettingPath(file)
            return this.utils.writeFile(path, "")
        })
        return Promise.all(promises)
    }

    saveSettings = async (fixedName, updateObj) => {
        return this.handleSettings(fixedName, (pluginSettings, allSettings) => {
            allSettings[fixedName] = this.utils.merge(pluginSettings, updateObj)
        })
    }

    autoSaveSettings = plugin => {
        const { saveSettings } = this
        plugin.config = new Proxy(plugin.config, {
            set(target, property, value, receiver) {
                saveSettings(plugin.fixedName, { [property]: value })
                return Reflect.set(...arguments)
            }
        })
    }

    getSettingObjects = async (defaultSetting, userSetting) => {
        const default_ = this.getOriginSettingPath(defaultSetting)
        const user_ = this.getOriginSettingPath(userSetting)
        const home_ = this.getHomeSettingPath(userSetting)
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
            return {}
        }
    }

    readSettings = async (defaultSetting, userSetting) => {
        const objs = await this.getSettingObjects(defaultSetting, userSetting)
        return objs.reduce(this.utils.merge)
    }
    readBasePluginSettings = async () => this.readSettings("settings.default.toml", "settings.user.toml")
    readCustomPluginSettings = async () => this.readSettings("custom_plugin.default.toml", "custom_plugin.user.toml")

    openSettingFolder = async (file = "settings.user.toml") => this.utils.showInFinder(await this.getActualSettingPath(file))

    backupSettings = async (backupDir, showInFinder = true) => {
        const { FsExtra, Path } = this.utils.Package
        await FsExtra.ensureDir(backupDir)
        const promises = ["settings.user.toml", "custom_plugin.user.toml"].map(async file => {
            const source = await this.getActualSettingPath(file)
            const target = Path.join(backupDir, file)
            await FsExtra.copy(source, target)
        })
        await Promise.all(promises)
        if (showInFinder) {
            this.utils.showInFinder(backupDir)
        }
    }

    exportSettings = async (exportPath, showInFinder = true) => {
        const [base, custom] = await Promise.all([this.readBasePluginSettings(), this.readCustomPluginSettings()])
        await this.utils.Package.FsExtra.writeJson(exportPath, { ...this.meta, ...base, ...custom })
        if (showInFinder) {
            this.utils.showInFinder(exportPath)
        }
    }

    importSettings = async (importPath) => {
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
            const path = await this.getActualSettingPath(file)
            const content = this.utils.stringifyToml(setting).replace(/\r\n/g, "\n")
            return this.utils.writeFile(path, content)
        })
        await Promise.all(promises)
    }
}

module.exports = Settings
