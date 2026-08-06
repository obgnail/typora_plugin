class Migrate {
  constructor(utils) {
    this.utils = utils
  }

  cleanPlugins = async (conf) => {
    const userKeys = Object.keys(conf.user).filter(key => key !== "global")
    await Promise.all(
      userKeys.map(async fixedName => {
        const [hasJs, hasIndexJs] = await Promise.all([
          this.utils.existPath(this.utils.joinPluginPath(`./plugin/${fixedName}.js`)),
          this.utils.existPath(this.utils.joinPluginPath(`./plugin/${fixedName}/index.js`)),
        ])
        if (!hasJs && !hasIndexJs) {
          delete conf.user[fixedName]
        }
      }),
    )
  }

  cleanPluginKeys = (conf) => {
    for (const [pluginName, userPlugin] of Object.entries(conf.user)) {
      if (Object.hasOwn(conf.default, pluginName)) {
        const defaultPlugin = conf.default[pluginName]
        for (const key of Object.keys(userPlugin)) {
          if (!Object.hasOwn(defaultPlugin, key) || this.utils.deepEqual(defaultPlugin[key], userPlugin[key])) {
            delete userPlugin[key]
          }
        }
      }
      if (Object.keys(userPlugin).length === 0) {
        delete conf.user[pluginName]
      }
    }
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
