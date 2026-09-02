require("./polyfill")
require("./components")
const i18n = require("./i18n")
const utils = require("./utils")
const container = require("./serviceContainer")
const BasePlugin = require("./plugin")

async function entry() {
  if (utils.compareVersion(utils.typoraVersion, "0.9.98") < 0) return

  const settings = await utils.settings.read()
  if (!settings?.global?.ENABLE) return

  global.BasePlugin = BasePlugin
  container.connect(utils, settings)
  utils.setDarkMode(settings.global.DARK_MODE)
  await i18n.init(settings.global.LOCALE)
  await bootstrap(settings)
}

async function bootstrap(settings) {
  const invoke = (mixins, method) => Promise.all(mixins.map(mixin => mixin[method]?.()))

  const {
    logger, unstableRequire, styleManager,
    contextMenu, notification, formDialog, stateRecorder, hotkeyHub, exportHelper,
    eventHub, diagramParser, thirdPartyDiagramParser,
  } = utils.mixins

  await invoke([logger, unstableRequire, styleManager], "process")
  await invoke([contextMenu, notification, formDialog, stateRecorder, hotkeyHub, exportHelper], "process")

  container.setPlugins(await loadPlugins(settings))

  await invoke([eventHub], "process")
  await invoke([diagramParser, thirdPartyDiagramParser], "process")

  eventHub.emit(eventHub.eventType.allPluginsHadInjected)

  await invoke(Object.values(utils.mixins), "postprocess")

  // Re-emit events (e.g., afterAddCodeBlock) that may have been missed due to async execution.
  if (File.getMountFolder() != null) {
    setTimeout(() => {
      const queue = File.editor.fences.queue || {}
      Object.keys(queue).forEach(cid => File.editor.fences.addCodeBlock(cid))
      const path = utils.getFilePath()
      if (path) File.editor.library.openFile(path)
    }, 80)
  }
}

async function loadPlugins(configs) {
  const STATE = { enable: "enable", disable: "disable", abort: "abort", error: "error", unconfigure: "unconfigure" }
  const COLORS = { [STATE.enable]: "32", [STATE.disable]: "33", [STATE.abort]: "34", [STATE.error]: "31", [STATE.unconfigure]: "35" }
  const PLUGINS = Object.fromEntries(Object.keys(STATE).map(key => [key, {}]))
  const record = (state, name, data) => PLUGINS[state][name] = data

  const logging = (plugins) => {
    console.group("Typora-Plugin")
    Object.entries(plugins).forEach(([typ, p]) => console.debug(`[ \x1B[${COLORS[typ]}m${typ}\x1b[0m ] [ ${Object.keys(p).length} ]:`, p))
    console.groupEnd()
  }

  await Promise.all(
    Object.entries(configs).map(async ([fixedName, config]) => {
      if (!config) {
        return record(STATE.unconfigure, fixedName, fixedName)
      }
      if (!config.ENABLE) {
        return record(STATE.disable, fixedName, config)
      }
      try {
        const instance = await loadPlugin(fixedName, config)
        const status = instance ? STATE.enable : STATE.abort
        record(status, fixedName, instance)
      } catch (err) {
        console.error(`[Plugin Error] ${fixedName}:`, err)
        record(STATE.error, fixedName, err)
      }
    }),
  )

  logging(PLUGINS)
  return PLUGINS
}

async function loadPlugin(fixedName, config) {
  const { plugin: PluginClass } = utils.require("./plugin", fixedName)
  if (!PluginClass) {
    throw new Error(`Plugin not found: ${fixedName}`)
  }

  const instance = new PluginClass(fixedName, config, i18n.bind(fixedName))
  if (await instance.prepare() === utils.PLUGIN_LOAD_ABORT) return null
  await loadStyle(instance, instance.style())
  utils.insertElements(instance.html())
  utils.hotkeyHub.register(instance.hotkey())
  instance.init()
  instance.process()
  instance.postprocess()

  return instance
}

async function loadStyle(instance, style) {
  if (!style) return
  if (typeof style === "string") {
    utils.insertStyle(instance.fixedName, style)
  } else {
    await utils.styleManager.register(instance.fixedName, { ...style, this: instance })
  }
}

module.exports = entry
