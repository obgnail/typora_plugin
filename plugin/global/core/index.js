const { i18n } = require("./i18n")
const { utils, hook } = require("./utils")
const { BasePlugin, BaseCustomPlugin, LoadPlugins } = require("./plugin")

async function entry() {
    /**
     * Initializes global variables.
     * The plugin system exposes a total of 8 global variables, but only 3 are actually useful: BasePlugin, BaseCustomPlugin, and LoadPlugins.
     * The remaining 4 are exposed by the static class `utils` and should never be referenced by business plugins.
     * Furthermore, `utils` is also an instance property of BasePlugin and BaseCustomPlugin, so `utils` itself doesn't need to be exposed.
     * If they will never be referenced by business plugins, why are they set as global variables? Answer: For debugging convenience.
     **/
    const initVariable = settings => {
        global.BasePlugin = BasePlugin
        global.BaseCustomPlugin = BaseCustomPlugin
        global.LoadPlugins = LoadPlugins

        global.__plugins__ = null
        global.__plugin_utils__ = utils
        global.__plugin_i18n__ = i18n
        global.__plugin_settings__ = settings
        global.__global_settings__ = settings.global

        delete settings.global
    }

    const initI18N = (locale) => i18n.init(locale)

    const loadPlugins = async () => {
        const { enable, disable, stop, error, nosetting } = await LoadPlugins(global.__plugin_settings__, false)
        global.__plugins__ = enable
    }

    /**
     * For Typora versions below 0.9.98, a compatibility warning is issued when running the plugin system.
     */
    const showWarn = () => {
        const need = global.__global_settings__.SHOW_INCOMPATIBLE_WARNING
        const incompatible = utils.compareVersion(utils.typoraVersion, "0.9.98") < 0
        if (need && incompatible) {
            const msg = i18n.t("global", "incompatibilityWarning")
            utils.notification.show(msg, "warning", 5000)
        }
    }

    const launch = async () => {
        const settings = await utils.runtime.readBasePluginSetting()
        const enable = settings && settings.global && settings.global.ENABLE
        if (!enable) {
            console.warn("disable typora plugin")
            return
        }

        await initI18N(settings.global.LOCALE)
        initVariable(settings)
        await hook(loadPlugins)
        showWarn()
    }

    await launch()
}

module.exports = {
    entry
}
