class ServiceContainer {
    constructor() {
        this.services = new Map()
        this.plugins = {}
        this.settings = {}
        this.utils = null
    }

    registerService(name, instance) {
        this.services.set(name, instance)
    }

    getService(name) {
        return this.services.get(name)
    }

    setPlugins(plugins) {
        this.plugins = plugins
    }

    setSettings(settings) {
        // "global" is a general setting, not a specific plugin setting
        Object.defineProperty(settings, "global", { enumerable: false })
        this.settings = settings
    }

    setUtils(utils) {
        this.utils = utils
        utils.registerContainer(this)
    }

    getAllBasePlugins() {
        return this.plugins
    }

    getBasePlugin(fixedName) {
        return this.plugins[fixedName]
    }

    getAllCustomPlugins() {
        return this.plugins.custom?.plugins
    }

    getCustomPlugin(fixedName) {
        return this.plugins.custom?.plugins[fixedName]
    }

    getAllBasePluginSettings() {
        return this.settings
    }

    getAllCustomPluginSettings() {
        return this.plugins.custom?.settings
    }

    getGlobalSetting() {
        return this.settings.global
    }

    getBasePluginSetting(fixedName) {
        return this.settings[fixedName]
    }

    getCustomPluginSetting(fixedName) {
        return this.plugins.custom?.settings[fixedName]
    }

    tryGetPlugin(fixedName) {
        return this.plugins[fixedName] || this.plugins.custom?.plugins[fixedName]
    }

    tryGetPluginSetting(fixedName) {
        return this.settings[fixedName] || this.plugins.custom?.settings[fixedName]
    }
}

module.exports = new ServiceContainer()
