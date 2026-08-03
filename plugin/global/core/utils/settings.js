class Settings {
  USER_TOML = "settings.user.toml"
  DEFAULT_TOML = "settings.default.toml"
  META = { $id: "https://github.com/obgnail/typora_plugin", $version: "1" }

  constructor(utils) {
    this.utils = utils
  }

  get defaultTomlPath() {
    return this.utils.joinPluginPath("./plugin/global/settings", this.DEFAULT_TOML)
  }

  get userTomlOriginPath() {
    return this.utils.joinPluginPath("./plugin/global/settings", this.USER_TOML)
  }

  get userTomlHomePath() {
    return this.utils.Package.Path.join(this.utils.getHomeDir(), ".config", "typora_plugin", this.USER_TOML)
  }

  getUserTomlPath = async () => {
    const homePath = this.userTomlHomePath
    const exist = await this.utils.existPath(homePath)
    return exist ? homePath : this.userTomlOriginPath
  }

  handle = async (fixedName, handler) => {
    const path = await this.getUserTomlPath()
    const all = await this.utils.readTomlFile(path)
    if (!all[fixedName]) {
      all[fixedName] = {}
    }
    handler(all[fixedName], all)
    const content = this.utils.stringifyToml(all).replace(/\r\n/g, "\n")
    return this.utils.writeFile(path, content)
  }

  clear = async (fixedName) => this.handle(fixedName, (_, all) => delete all[fixedName])
  save = async (fixedName, updateObject) => this.handle(fixedName, (target, all) => all[fixedName] = this.utils.merge(target, updateObject))

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
    const paths = [this.defaultTomlPath, this.userTomlOriginPath, this.userTomlHomePath]
    try {
      const contents = await this.utils.readFiles(paths)
      return contents.map(c => c ? this.utils.readToml(c) : {})
    } catch (e) {
      const prefix = "Invalid TOML document: "
      await this.utils.showMessageBox({
        type: "error",
        buttons: ["Confirm", "Cancel"],
        message: prefix,
        detail: e.toString().replace(prefix, ""),
      })
      return paths.map(() => ({}))
    }
  }

  read = async () => {
    const objs = await this.getObjects()
    return objs.reduce(this.utils.merge)
  }

  openFolder = async () => this.utils.showInFinder(await this.getUserTomlPath())

  export = async (exportPath) => {
    const base = await this.read()
    await this.utils.Package.FsExtra.outputJson(exportPath, { ...this.META, ...base })
  }

  import = async (importPath) => {
    const settings = await this.utils.Package.FsExtra.readJson(importPath)
    const mismatch = Object.keys(this.META).some(key => settings[key] !== this.META[key])
    if (mismatch) {
      throw new Error(`${importPath} is not the correct settings file.`)
    }
    const plugins = this.utils.getAllSettings()
    const isObject = x => x != null && !Array.isArray(x) && typeof x === "object"
    const obj = this.utils.pickBy(settings, (obj, key) => isObject(obj) && Object.hasOwn(plugins, key))
    const content = this.utils.stringifyToml(obj).replace(/\r\n/g, "\n")
    return this.utils.writeFile(await this.getUserTomlPath(), content)
  }
}

module.exports = Settings
