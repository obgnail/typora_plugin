/**
 * 处理升级过程中的迁移操作
 * 屎山代码的最终归宿，不得不品尝
 */
class migrate {
    constructor(utils) {
        this.utils = utils
    }

    moveHotkeySetting = async () => {
        const settings = await this.utils.runtime.readHotkeySetting()
        const hotkeys = Array.from(Object.values(settings))
        if (hotkeys.length === 0) return

        hotkeys.forEach(obj => {
            if (obj.evil && typeof obj.evil === "string") {
                obj.evil = obj.evil.replace(/\r\n/g, "\n")
            }
        })
        const ok = await this.utils.runtime._saveConfig("settings.user.toml", "hotkeys", { "CUSTOM_HOTKEYS": hotkeys })
        if (!ok) return

        const deleteFile = async file => {
            try {
                await this.utils.Package.Fs.promises.unlink(file)
            } catch (e) {
            }
        }
        const files = ["hotkey.default.toml", "hotkey.user.toml"]
        await Promise.all(files.map(file => Promise.all([deleteFile(this.utils.runtime.getOriginSettingPath(file)), deleteFile(this.utils.runtime.getHomeSettingPath(file))])))
    }

    deleteUselessPlugin = async () => {
        const custom = ["fullPathCopy", "extractRangeToNewFile", "bingSpeech", "autoTrailingWhiteSpace", "darkMode", "noImageMode", "hotkeyHub", "pluginUpdater"]
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

    cleanPluginSetting = async () => {
        const cleanInvalidPlugin = async (default_, user_) => {
            const plugins = new Set([...Object.keys(default_), ...Object.keys(user_)])
            plugins.delete("global")
            const promises = Array.from(plugins).map(async fixedName => {
                const promises = [`./plugin/custom/plugins/${fixedName}.js`, `./plugin/custom/plugins/${fixedName}/index.js`, `./plugin/${fixedName}.js`, `./plugin/${fixedName}/index.js`]
                    .map(path => this.utils.joinPath(path))
                    .map(path => this.utils.existPath(path))
                const candidate = await Promise.all(promises)
                if (!candidate.some(Boolean)) {
                    delete user_[fixedName]
                }
            })
            await Promise.all(promises)
        }
        const cleanInvalidKey = (default_, user_) => {
            const hasOwnProperty = (obj, attr) => Object.prototype.hasOwnProperty.call(obj, attr)
            Object.keys(user_)
                .filter(fixedName => hasOwnProperty(default_, fixedName))
                .map(fixedName => {
                    const plugin = user_[fixedName]
                    const invalidKeys = Object.keys(plugin).filter(key => !hasOwnProperty(default_[fixedName], key))
                    return [plugin, invalidKeys]
                })
                .forEach(([plugin, invalidKeys]) => invalidKeys.forEach(key => delete plugin[key]))
        }
        const saveFile = async (file, user_) => {
            const path = await this.utils.runtime.getActualSettingPath(file)
            const content = this.utils.stringifyToml(user_)
            return this.utils.writeFile(path, content)
        }

        const [baseDefault, baseUser_, baseHome_] = await this.utils.runtime._getSettingObjects("settings.default.toml", "settings.user.toml")
        const [customDefault, customUser_, customHome_] = (await this.utils.runtime._getSettingObjects("custom_plugin.default.toml", "custom_plugin.user.toml")).map(this.utils.runtime.fixCustomPluginSetting)
        const files = [
            { file: "settings.user.toml", default_: baseDefault, user_: this.utils.merge(baseUser_, baseHome_) },
            { file: "custom_plugin.user.toml", default_: customDefault, user_: this.utils.merge(customUser_, customHome_) },
        ]
        const promises = files.map(async ({ file, default_, user_ }) => {
            await cleanInvalidPlugin(default_, user_)
            cleanInvalidKey(default_, user_)
            await saveFile(file, user_)
        })
        await Promise.all(promises)
    }

    run = async () => {
        await this.deleteUselessPlugin()
        await this.cleanPluginSetting()
        await this.moveHotkeySetting()
    }

    afterProcess = () => {
        setTimeout(async () => await this.run(), 10 * 1000)
    }
}

module.exports = {
    migrate
}