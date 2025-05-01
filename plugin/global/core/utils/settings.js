class settings {
    constructor(utils) {
        this.utils = utils
    }

    getOriginSettingPath = settingFile => this.utils.joinPath("./plugin/global/settings", settingFile)
    getHomeSettingPath = settingFile => this.utils.Package.Path.join(this.utils.getHomeDir(), ".config", "typora_plugin", settingFile)
    getActualSettingPath = async settingFile => {
        const homeSettingPath = this.getHomeSettingPath(settingFile)
        const exist = await this.utils.existPath(homeSettingPath)
        return exist ? homeSettingPath : this.getOriginSettingPath(settingFile)
    }
    getSettingFileName = (fixedName) => {
        if (this.utils.getPluginSetting(fixedName)) {
            return "settings.user.toml"
        } else if (this.utils.getCustomPluginSetting(fixedName)) {
            return "custom_plugin.user.toml"
        }
    }

    handleSettings = async (fixedName, handler) => {
        const settingFileName = this.getSettingFileName(fixedName)
        const settingPath = await this.getActualSettingPath(settingFileName)
        const settingObj = await this.utils.readTomlFile(settingPath)
        const resultObj = handler(settingObj)
        const content = this.utils.stringifyToml(resultObj).replace(/\r\n/g, "\n")
        return this.utils.writeFile(settingPath, content)
    }

    clearSettings = async (fixedName) => {
        const handler = settingObj => {
            delete settingObj[fixedName]
            return settingObj
        }
        return this.handleSettings(fixedName, handler)
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
        const handler = settingObj => this.utils.merge(settingObj, { [fixedName]: updateObj })
        return this.handleSettings(fixedName, handler)
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

    backupSettingFile = async (showInFinder = true) => {
        const { FsExtra, Path } = this.utils.Package
        const backupDir = Path.join(this.utils.tempFolder, "typora_plugin_config")
        await FsExtra.emptyDir(backupDir)
        const settingFiles = ["settings.user.toml", "custom_plugin.user.toml"]
        for (const file of settingFiles) {
            const source = await this.getActualSettingPath(file)
            const target = Path.join(backupDir, file)
            try {
                await FsExtra.copy(source, target)
            } catch (e) {
                console.error(e)
            }
        }
        if (showInFinder) {
            this.utils.showInFinder(backupDir)
        }
    }
}

module.exports = {
    settings
}
