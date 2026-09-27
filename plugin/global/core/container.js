class Container {
  plugins = {}
  settings = {}

  setPlugins = (plugins) => this.plugins = plugins.enable
  setSettings = (settings) => {
    // "global" is a general setting, not a specific plugin setting
    Object.defineProperty(settings, "global", { enumerable: false })
    this.settings = settings
  }

  getAllPlugins = () => this.plugins
  getPlugin = (name) => this.plugins[name]

  getAllSettings = () => this.settings
  getSetting = (name, key) => {
    const setting = this.settings[name]
    return key === undefined ? setting : setting?.[key]
  }
}

module.exports = new Container()
