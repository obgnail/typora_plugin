require("./polyfill")
const { i18n } = require("./i18n")
const { utils, hook } = require("./utils")
const { BasePlugin, BaseCustomPlugin, LoadPlugins } = require("./plugin")

async function entry() {
    /**
     * Initializes global variables.
     * The plugin system exposes the following global variables, but only 3 are actually useful: BasePlugin, BaseCustomPlugin, and LoadPlugins.
     * The remaining variables are exposed by the static class `utils` and should never be referenced by business plugins.
     * Furthermore, `utils` is also an instance property of BasePlugin and BaseCustomPlugin, so `utils` itself doesn't need to be exposed.
     * Since they will never be referenced by business plugins, why are they set as global variables? Answer: For debugging convenience.
     **/
    const initGlobalVars = settings => {
        // "global" is a general setting, not a plugin setting
        Object.defineProperty(settings, "global", { enumerable: false })

        global.BasePlugin = BasePlugin
        global.BaseCustomPlugin = BaseCustomPlugin
        global.LoadPlugins = LoadPlugins
        global.__plugins__ = null
        global.__plugin_utils__ = utils
        global.__plugin_i18n__ = i18n
        global.__plugin_settings__ = settings
    }

    const loadPlugins = async () => {
        const { enable, disable, stop, error, nosetting } = await LoadPlugins(global.__plugin_settings__)
        global.__plugins__ = enable
    }

    /** For Typora versions below 0.9.98, a compatibility warning is issued when running the plugin system. */
    const warn = () => {
        const incompatible = utils.compareVersion(utils.typoraVersion, "0.9.98") < 0
        if (incompatible) {
            const msg = i18n.t("global", "incompatibilityWarning")
            utils.notification.show(msg, "warning", 5000)
        }
    }

    const settings = await utils.settings.readBasePluginSettings()
    const enable = settings && settings.global && settings.global.ENABLE
    if (enable) {
        initGlobalVars(settings)
        await i18n.init(settings.global.LOCALE)
        await hook(loadPlugins)
        warn()
    } else {
        console.warn("typora plugin disabled")
    }
}

module.exports = {
    entry
}
