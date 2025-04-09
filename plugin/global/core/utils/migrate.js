/**
 * Handles migration operations during the upgrade process.
 */
class migrate {
    constructor(utils) {
        this.utils = utils
    }

    deleteUselessPlugin = async () => {
        const custom = [
            "fullPathCopy", "extractRangeToNewFile", "bingSpeech", "autoTrailingWhiteSpace", "darkMode",
            "noImageMode", "hotkeyHub", "pluginUpdater", "openInTotalCommander", "__modal_example"
        ]
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

    fixCustomPluginConfigs = (files) => {
        const settings = files.find(e => e.file === "custom_plugin.user.toml")
        Object.values(settings.user_).forEach(plugin => {
            if (plugin.config) {
                Object.assign(plugin, plugin.config)
                delete plugin.config
            }
        })
    }

    cleanInvalidPlugin = async (files) => {
        const promises = files.flatMap(async ({ default_, user_ }) => {
            const plugins = new Set([...Object.keys(default_), ...Object.keys(user_)])
            plugins.delete("global")
            return [...plugins].map(async fixedName => {
                const paths = [
                    `./plugin/custom/plugins/${fixedName}.js`,
                    `./plugin/custom/plugins/${fixedName}/index.js`,
                    `./plugin/${fixedName}.js`,
                    `./plugin/${fixedName}/index.js`,
                ]
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
                    const toDeleteKeys = Object.keys(pluginUser).filter(key => !hasOwnProperty(pluginDefault, key) || pluginDefault[key] === pluginUser[key])
                    return [pluginUser, toDeleteKeys]
                })
                .forEach(([plugin, invalidKeys]) => invalidKeys.forEach(key => delete plugin[key]))
        })
        files.forEach(file => {
            const reserved = Object.keys(file.user_).filter(fixedName => Object.keys(file.user_[fixedName]).length !== 0)
            file.user_ = this.utils.pick(file.user_, reserved)
        })
    }

    _getConfigs = async () => {
        const [baseDefault, baseUser, baseHome] = await this.utils.settings.getSettingObjects("settings.default.toml", "settings.user.toml")
        const [customDefault, customUser, customHome] = await this.utils.settings.getSettingObjects("custom_plugin.default.toml", "custom_plugin.user.toml")
        return [
            { file: "settings.user.toml", default_: baseDefault, user_: this.utils.merge(baseUser, baseHome) },
            { file: "custom_plugin.user.toml", default_: customDefault, user_: this.utils.merge(customUser, customHome) },
        ]
    }

    _saveFile = async (files) => {
        const promises = files.map(async ({ file, user_ }) => {
            const path = await this.utils.settings.getActualSettingPath(file)
            const content = this.utils.stringifyToml(user_)
            return this.utils.writeFile(path, content)
        })
        await Promise.all(promises)
    }

    run = async () => {
        const files = await this._getConfigs()
        await this.deleteUselessPlugin()
        await this.fixCustomPluginConfigs(files)
        await this.cleanInvalidPlugin(files)
        await this.cleanPluginAndKey(files)
        await this._saveFile(files)
    }

    afterProcess = () => {
        setTimeout(async () => await this.run(), 5 * 1000)
    }
}

module.exports = {
    migrate
}
