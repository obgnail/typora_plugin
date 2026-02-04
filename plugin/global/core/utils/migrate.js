/**
 * Handles migration operations during the upgrade process.
 */
class Migrate {
    constructor(utils) {
        this.utils = utils
    }

    deleteUselessPlugins = async () => {
        const dirs = ["scrollBookmarker"]
        const files = [
            "fullPathCopy", "extractRangeToNewFile", "bingSpeech", "autoTrailingWhiteSpace", "darkMode",
            "noImageMode", "hotkeyHub", "pluginUpdater", "openInTotalCommander", "resourceOperation",
            "reopenClosedFiles", "sortableOutline", "blockSideBySide", "__modal_example",
        ]
        const toDir = name => this.utils.joinPath("./plugin/custom/plugins", name)
        const toFile = name => this.utils.joinPath("./plugin/custom/plugins", `${name}.js`)
        const promises = [...files.map(toFile), ...dirs.map(toDir)].map(path => this.utils.Package.FsExtra.remove(path))
        await Promise.all(promises)
    }

    cleanInvalidPlugins = async (files) => {
        const promises = files.map(({ configDefault, configUser }) => {
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
        await Promise.all(promises.flat())
    }

    cleanPluginsAndKeys = (files) => {
        files.forEach(({ configDefault, configUser }) => {
            Object.keys(configUser)
                .filter(fixedName => configDefault.hasOwnProperty(fixedName))
                .map(fixedName => {
                    const pluginUser = configUser[fixedName]
                    const pluginDefault = configDefault[fixedName]
                    const toDeleteKeys = Object.keys(pluginUser).filter(key => !pluginDefault.hasOwnProperty(key) || this.utils.deepEqual(pluginDefault[key], pluginUser[key]))
                    return [pluginUser, toDeleteKeys]
                })
                .forEach(([plugin, toDeleteKeys]) => toDeleteKeys.forEach(key => delete plugin[key]))
        })
        files.forEach(file => {
            file.configUser = this.utils.pickBy(file.configUser, cfg => Object.keys(cfg).length !== 0)
        })
    }

    getConfigs = async () => {
        const [baseDefault, baseUser, baseHome] = await this.utils.settings.getObjects("settings.default.toml", "settings.user.toml")
        const [customDefault, customUser, customHome] = await this.utils.settings.getObjects("custom_plugin.default.toml", "custom_plugin.user.toml")
        return [
            { file: "settings.user.toml", configDefault: baseDefault, configUser: this.utils.merge(baseUser, baseHome) },
            { file: "custom_plugin.user.toml", configDefault: customDefault, configUser: this.utils.merge(customUser, customHome) },
        ]
    }

    saveFiles = async (files) => {
        const promises = files.map(async ({ file, configUser }) => {
            const path = await this.utils.settings.getActualPath(file)
            const content = this.utils.stringifyToml(configUser)
            return this.utils.writeFile(path, content)
        })
        await Promise.all(promises)
    }

    run = async () => {
        const files = await this.getConfigs()
        await this.deleteUselessPlugins()
        await this.cleanInvalidPlugins(files)
        await this.cleanPluginsAndKeys(files)
        await this.saveFiles(files)
        console.log("[Migrate] Migrated Typora Plugin settings file")
    }

    afterProcess = () => {
        setTimeout(this.run, 5 * 1000)
    }
}

module.exports = Migrate
