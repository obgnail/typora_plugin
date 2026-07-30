class Settings {
  USER_TOML = "settings.user.toml"
  DEFAULT_TOML = "settings.default.toml"
  META = { $id: "https://github.com/obgnail/typora_plugin", $version: "1" }

  constructor(utils) {
    this.utils = utils
  }

  getOriginPath = file => this.utils.joinPluginPath("./plugin/global/settings", file)
  getHomePath = file => this.utils.Package.Path.join(this.utils.getHomeDir(), ".config", "typora_plugin", file)
  getActualPath = async file => {
    const homePath = this.getHomePath(file)
    const exist = await this.utils.existPath(homePath)
    return exist ? homePath : this.getOriginPath(file)
  }

  openFolder = async () => {
    const path = await this.getActualPath(this.USER_TOML)
    this.utils.showInFinder(path)
  }

  handle = async (fixedName, handler) => {
    const path = await this.getActualPath(this.USER_TOML)
    const allSettings = await this.utils.readTomlFile(path)
    if (!allSettings[fixedName]) {
      allSettings[fixedName] = {}
    }
    handler(allSettings[fixedName], allSettings)
    const content = this.utils.stringifyToml(allSettings).replace(/\r\n/g, "\n")
    return this.utils.writeFile(path, content)
  }

  clear = async (fixedName) => {
    return this.handle(fixedName, (_, allSettings) => delete allSettings[fixedName])
  }

  save = async (fixedName, updateObject) => {
    return this.handle(fixedName, (pluginSettings, allSettings) => {
      allSettings[fixedName] = this.utils.merge(pluginSettings, updateObject)
    })
  }

  autoSave = (plugin) => {
    const save = this.save
    plugin.config = new Proxy(plugin.config, {
      set(target, property, value, receiver) {
        save(plugin.fixedName, { [property]: value })
        return Reflect.set(...arguments)
      },
    })
  }

  getObjects = async () => {
    const default_ = this.getOriginPath(this.DEFAULT_TOML)
    const user_ = this.getOriginPath(this.USER_TOML)
    const home_ = this.getHomePath(this.USER_TOML)
    const contents = await this.utils.readFiles([default_, user_, home_])
    try {
      return contents.map(c => c ? this.utils.readToml(c) : {})
    } catch (e) {
      const prefix = "Invalid TOML document: "
      await this.utils.showMessageBox({
        type: "error",
        buttons: ["Confirm", "Cancel"],
        message: prefix,
        detail: e.toString().replace(prefix, ""),
      })
      return contents.map(() => ({}))
    }
  }

  read = async () => {
    const objs = await this.getObjects()
    return objs.reduce(this.utils.merge)
  }

  export = async (exportPath) => {
    const base = await this.read()
    await this.utils.Package.FsExtra.writeJson(exportPath, { ...this.META, ...base })
  }

  import = async (importPath) => {
    const settings = await this.utils.Package.FsExtra.readJson(importPath)
    const mismatch = Object.keys(this.META).some(key => settings[key] !== this.META[key])
    if (mismatch) {
      throw new Error(`${importPath} is not the correct settings file.`)
    }
    const plugins = this.utils.getAllSettings()
    const isObject = x => x != null && !Array.isArray(x) && typeof x === "object"
    const path = await this.getActualPath(this.USER_TOML)
    const obj = this.utils.pickBy(settings, (obj, key) => isObject(obj) && Object.hasOwn(plugins, key))
    const content = this.utils.stringifyToml(obj).replace(/\r\n/g, "\n")
    return this.utils.writeFile(path, content)
  }
}

module.exports = Settings
