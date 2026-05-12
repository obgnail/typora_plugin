const utils = require("./utils")
const i18n = require("./i18n")

class IPlugin {
  constructor(fixedName, config, i18n) {
    this.fixedName = fixedName
    this.pluginName = config.NAME || config.name || i18n.t("pluginName")
    this.config = config
    this.utils = utils
    this.i18n = i18n
  }

  /** Execute first, prepares data. If utils.PLUGIN_LOAD_ABORT is returned, plugin loading stops. */
  async prepare() {}

  /** Import styles. */
  style() {}

  /** Insert HTML tags. */
  html() {}

  /** Register hotkeys. */
  hotkey() {}

  /** Initialize data. */
  init() {}

  /** Main processing. */
  process() {}

  /** Cleanup */
  finalize() {}
}

class BasePlugin extends IPlugin {
  call(action, meta) {}
}

class BaseCustomPlugin extends IPlugin {
  selector(context) {}
  hint(context) {}
  callback(anchorNode) {}
}

const LoadPlugin = async (fixedName, config, isBasePlugin) => {
  const path = isBasePlugin ? "./plugin" : "./plugin/custom/plugins"
  const { plugin } = utils.require(path, fixedName)
  if (!plugin) {
    return new Error(`There is not ${fixedName} in ${path}`)
  }
  const instance = new plugin(fixedName, config, i18n.bind(fixedName))
  if (await instance.prepare() === utils.PLUGIN_LOAD_ABORT) return

  await loadStyle(instance, instance.style())
  utils.insertElements(instance.html())
  if (isBasePlugin) {
    utils.hotkeyHub.register(instance.hotkey())
  }
  instance.init()
  instance.process()
  instance.finalize()
  return instance
}

const loadStyle = async (instance, style) => {
  if (!style) return
  if (typeof style === "string") {
    utils.insertStyle(instance.fixedName, style)
  } else {
    await utils.styleManager.register(instance.fixedName, { ...style, this: instance })
  }
}

const LoadPlugins = async (configs, logging = true) => {
  const isBase = Object.hasOwn(configs, "global")
  const plugins = { enable: {}, disable: {}, stop: {}, error: {}, unconfigure: {} }
  const promises = Object.entries(configs).map(async ([fixedName, config]) => {
    if (!config) {
      plugins.unconfigure[fixedName] = fixedName
    } else if (!config.ENABLE && !config.enable) {
      plugins.disable[fixedName] = config
    } else {
      try {
        const instance = await LoadPlugin(fixedName, config, isBase)
        if (instance) {
          plugins.enable[fixedName] = instance
        } else {
          plugins.stop[fixedName] = config
        }
      } catch (error) {
        console.error(error)
        plugins.error[fixedName] = error
      }
    }
  })
  await Promise.all(promises)

  if (logging) {
    const COLORS = { enable: "32", disable: "33", stop: "34", error: "31", unconfigure: "35" }
    console.group(`${isBase ? "Base" : "Custom"} Plugin`)
    Object.entries(plugins).forEach(([t, p]) => console.debug(`[ \x1B[${COLORS[t]}m${t}\x1b[0m ] [ ${Object.keys(p).length} ]:`, p))
    console.groupEnd()
  }

  return plugins
}

module.exports = {
  BasePlugin,
  BaseCustomPlugin,
  LoadPlugins,
}
