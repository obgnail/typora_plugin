class ServiceContainer {
    plugins = {}
    settings = {}

    setPlugins = (plugins) => this.plugins = plugins
    setSettings(settings) {
        // "global" is a general setting, not a specific plugin setting
        Object.defineProperty(settings, "global", { enumerable: false })
        this.settings = settings
    }
    connect = (utils) => utils.setContainer(this)

    getAllBasePlugins = () => this.plugins
    getAllCustomPlugins = () => this.plugins.custom?.plugins
    getBasePlugin = (fixedName) => this.plugins[fixedName]
    getCustomPlugin = (fixedName) => this.plugins.custom?.plugins[fixedName]

    getAllBasePluginSettings = () => this.settings
    getAllCustomPluginSettings = () => this.plugins.custom?.settings
    getGlobalSetting = () => this.settings.global
    getBasePluginSetting = (fixedName) => this.settings[fixedName]
    getCustomPluginSetting = (fixedName) => this.plugins.custom?.settings[fixedName]

    tryGetPlugin = (fixedName) => this.plugins[fixedName] || this.plugins.custom?.plugins[fixedName]
    tryGetPluginSetting = (fixedName) => this.settings[fixedName] || this.plugins.custom?.settings[fixedName]
}

module.exports = new ServiceContainer()
