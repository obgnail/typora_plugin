/**
 * 处理升级过程中的迁移操作
 */
class migrate {
    constructor(utils) {
        this.utils = utils
    }

    moveHotkeySetting = async (files) => {
        const hotkeySetting = await this.utils.runtime.readHotkeySetting()
        const customHotkeys = [...Object.values(hotkeySetting)]
        if (customHotkeys.length === 0) return

        customHotkeys.forEach(obj => {
            if (obj.evil && typeof obj.evil === "string") {
                obj.evil = obj.evil.replace(/\r\n/g, "\n")
            }
        })

        const base = files.find(e => e.file === "settings.user.toml")
        base.user_ = this.utils.merge(base.user_, { "hotkeys": { "CUSTOM_HOTKEYS": customHotkeys } })

        const promises = ["hotkey.default.toml", "hotkey.user.toml"]
            .flatMap(file => [
                this.utils.runtime.getOriginSettingPath(file),
                this.utils.runtime.getHomeSettingPath(file),
            ])
            .map(async file => {
                try {
                    await this.utils.Package.Fs.promises.unlink(file)
                } catch (e) {
                }
            })
        await Promise.all(promises)
    }

    deleteUselessPlugin = async () => {
        const custom = ["fullPathCopy", "extractRangeToNewFile", "bingSpeech", "autoTrailingWhiteSpace", "darkMode", "noImageMode", "hotkeyHub", "pluginUpdater", "openInTotalCommander"]
        const promises = custom
            .map(plugin => this.utils.joinPath("./plugin/custom/plugins", `${plugin}.js`))
            .map(async path => {
                const exist = await this.utils.existPath(path)
                if (exist) {
                    await this.utils.Package.Fs.promises.unlink(path)
                }
            })
        await Promise.all(promises)
    }

    fixCustomPluginSetting = (files) => {
        const customPluginSetting = files.find(e => e.file === "custom_plugin.user.toml")
        this._fixCustomPluginSetting(customPluginSetting.user_)
    }

    _fixCustomPluginSetting = settings => {
        Object.values(settings).map(plugin => {
            if (plugin.config) {
                Object.assign(plugin, plugin.config)
                delete plugin.config
            }
        })
        return settings
    }

    cleanInvalidPlugin = async (files) => {
        const promises = files.flatMap(async ({ default_, user_ }) => {
            const plugins = new Set([...Object.keys(default_), ...Object.keys(user_)])
            plugins.delete("global")
            return [...plugins].map(async fixedName => {
                const paths = [`./plugin/custom/plugins/${fixedName}.js`, `./plugin/custom/plugins/${fixedName}/index.js`, `./plugin/${fixedName}.js`, `./plugin/${fixedName}/index.js`]
                const promises = paths
                    .map(path => this.utils.joinPath(path))
                    .map(path => this.utils.existPath(path))
                const candidate = await Promise.all(promises)
                if (!candidate.some(Boolean)) {
                    delete user_[fixedName]
                }
            })
        })
        await Promise.all(promises)
    }

    cleanPluginAndKey = (files) => {
        const hasOwnProperty = (obj, attr) => Object.prototype.hasOwnProperty.call(obj, attr)
        files.forEach(({ default_, user_ }) => {
            Object.keys(user_)
                .filter(fixedName => hasOwnProperty(default_, fixedName))
                .map(fixedName => {
                    const pluginUser = user_[fixedName]
                    const pluginDefault = default_[fixedName]
                    const toDeleteKeys = Object.keys(pluginUser).filter(key => {
                        return !hasOwnProperty(pluginDefault, key) || pluginDefault[key] === pluginUser[key]
                    })
                    return [pluginUser, toDeleteKeys]
                })
                .forEach(([plugin, invalidKeys]) => invalidKeys.forEach(key => delete plugin[key]))
        })
        files.forEach(file => {
            const reserved = Object.keys(file.user_).filter(fixedName => Object.keys(file.user_[fixedName]).length !== 0)
            file.user_ = this.utils.fromObject(file.user_, reserved)
        })
    }

    _getConfigs = async () => {
        const [baseDefault, baseUser_, baseHome_] = await this.utils.runtime.getSettingObjects("settings.default.toml", "settings.user.toml")
        const [customDefault, customUser_, customHome_] = await this.utils.runtime.getSettingObjects("custom_plugin.default.toml", "custom_plugin.user.toml")
        return [
            { file: "settings.user.toml", default_: baseDefault, user_: this.utils.merge(baseUser_, baseHome_) },
            { file: "custom_plugin.user.toml", default_: customDefault, user_: this.utils.merge(customUser_, customHome_) },
        ]
    }

    _saveFile = async (files) => {
        const promises = files.map(async ({ file, user_ }) => {
            const path = await this.utils.runtime.getActualSettingPath(file)
            const content = this.utils.stringifyToml(user_)
            return this.utils.writeFile(path, content)
        })
        await Promise.all(promises)
    }

    run = async () => {
        const files = await this._getConfigs()
        await this.deleteUselessPlugin()
        await this.fixCustomPluginSetting(files)
        await this.cleanInvalidPlugin(files)
        await this.cleanPluginAndKey(files)
        await this.moveHotkeySetting(files)
        await this._saveFile(files)
    }

    afterProcess = () => {
        setTimeout(async () => await this.run(), 5 * 1000)
    }
}

module.exports = {
    migrate
}