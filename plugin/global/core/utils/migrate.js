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
            "noImageMode", "hotkeyHub", "pluginUpdater", "openInTotalCommander", "resourceOperation", "__modal_example",
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
        const config = files.find(e => e.file === "custom_plugin.user.toml")
        Object.values(config.configUser).forEach(plugin => {
            if (plugin.config) {
                Object.assign(plugin, plugin.config)
                delete plugin.config
            }
        })
    }

    cleanInvalidPlugin = async (files) => {
        const promises = files.flatMap(async ({ configDefault, configUser }) => {
            const fixedNames = new Set([...Object.keys(configDefault), ...Object.keys(configUser)])
            fixedNames.delete("global")
            return [...fixedNames].map(async fixedName => {
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
                    delete configUser[fixedName]
                }
            })
        })
        await Promise.all(promises)
    }

    cleanPluginAndKey = (files) => {
        files.forEach(({ configDefault, configUser }) => {
            Object.keys(configUser)
                .filter(fixedName => configDefault.hasOwnProperty(fixedName))
                .map(fixedName => {
                    const pluginUser = configUser[fixedName]
                    const pluginDefault = configDefault[fixedName]
                    const toDeleteKeys = Object.keys(pluginUser).filter(key => !pluginDefault.hasOwnProperty(key) || pluginDefault[key] === pluginUser[key])
                    return [pluginUser, toDeleteKeys]
                })
                .forEach(([plugin, toDeleteKeys]) => toDeleteKeys.forEach(key => delete plugin[key]))
        })
        files.forEach(file => {
            file.configUser = this.utils.pickBy(file.configUser, cfg => Object.keys(cfg).length !== 0)
        })
    }

    getConfigs = async () => {
        const [baseDefault, baseUser, baseHome] = await this.utils.settings.getSettingObjects("settings.default.toml", "settings.user.toml")
        const [customDefault, customUser, customHome] = await this.utils.settings.getSettingObjects("custom_plugin.default.toml", "custom_plugin.user.toml")
        return [
            { file: "settings.user.toml", configDefault: baseDefault, configUser: this.utils.merge(baseUser, baseHome) },
            { file: "custom_plugin.user.toml", configDefault: customDefault, configUser: this.utils.merge(customUser, customHome) },
        ]
    }

    saveFile = async (files) => {
        const promises = files.map(async ({ file, configUser }) => {
            const path = await this.utils.settings.getActualSettingPath(file)
            const content = this.utils.stringifyToml(configUser)
            return this.utils.writeFile(path, content)
        })
        await Promise.all(promises)
    }

    run = async () => {
        const files = await this.getConfigs()
        await this.deleteUselessPlugin()
        await this.fixCustomPluginConfigs(files)
        await this.cleanInvalidPlugin(files)
        await this.cleanPluginAndKey(files)
        await this.saveFile(files)
    }

    afterProcess = () => {
        setTimeout(async () => await this.run(), 5 * 1000)
    }
}

module.exports = {
    migrate
}
