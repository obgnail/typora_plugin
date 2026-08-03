class Migrate {
  constructor(utils) {
    this.utils = utils
  }

  cleanPlugins = async (conf) => {
    const fixedNames = new Set([...Object.keys(conf.default), ...Object.keys(conf.user)])
    fixedNames.delete("global")
    await Promise.all(
      [...fixedNames].flatMap(async fixedName => {
        const promises = [`./plugin/${fixedName}.js`, `./plugin/${fixedName}/index.js`]
          .map(p => this.utils.joinPluginPath(p))
          .map(p => this.utils.existPath(p))
        const implemented = (await Promise.all(promises)).some(Boolean)
        if (!implemented) {
          delete conf.user[fixedName]
        }
      }),
    )
  }

  cleanPluginKeys = (conf) => {
    Object.keys(conf.user)
      .filter(fixedName => Object.hasOwn(conf.default, fixedName))
      .map(fixedName => {
        const user_ = conf.user[fixedName]
        const default_ = conf.default[fixedName]
        const toDeleteKeys = Object.keys(user_).filter(key => !Object.hasOwn(default_, key) || this.utils.deepEqual(default_[key], user_[key]))
        return [user_, toDeleteKeys]
      })
      .forEach(([plugin, toDeleteKeys]) => toDeleteKeys.forEach(key => delete plugin[key]))
    conf.user = this.utils.pickBy(conf.user, cfg => Object.keys(cfg).length !== 0)
  }

  getConfigs = async () => {
    const [Default, User, Home] = await this.utils.settings.getObjects()
    return { default: Default, user: this.utils.merge(User, Home) }
  }

  saveConfigs = async (conf) => {
    const p = await this.utils.settings.getUserTomlPath()
    const cnt = this.utils.stringifyToml(conf.user)
    return this.utils.writeFile(p, cnt)
  }

  run = async () => {
    const configs = await this.getConfigs()
    await this.cleanPlugins(configs)
    this.cleanPluginKeys(configs)
    await this.saveConfigs(configs)
    console.log("[ Migration ] Typora-Plugin setting files migration completed")
  }

  postprocess = () => {
    setTimeout(this.run, 5 * 1000)
  }
}

module.exports = Migrate
