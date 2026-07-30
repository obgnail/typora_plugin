class ServiceContainer {
  plugins = {}
  settings = {}

  setPlugins = (plugins) => this.plugins = plugins
  setSettings = (settings) => {
    // "global" is a general setting, not a specific plugin setting
    Object.defineProperty(settings, "global", { enumerable: false })
    this.settings = settings
  }

  connect = (utils, settings) => {
    utils.setContainer(this)
    this.setSettings(settings)
  }

  getAllPlugins = () => this.plugins
  getPlugin = (name) => this.plugins[name]

  getAllSettings = () => this.settings
  getSetting = (name, key) => {
    const setting = this.settings[name]
    return key === undefined ? setting : setting?.[key]
  }
}

module.exports = new ServiceContainer()
