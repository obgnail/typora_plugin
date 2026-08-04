require("./polyfill")
require("./components")
const i18n = require("./i18n")
const utils = require("./utils")
const container = require("./serviceContainer")
const BasePlugin = require("./plugin")

const PLUGIN_COLORS = { enable: "32", disable: "33", stop: "34", error: "31", unconfigure: "35" }

async function entry() {
  if (utils.compareVersion(utils.typoraVersion, "0.9.98") < 0) return

  const settings = await utils.settings.read()
  if (!settings?.global?.ENABLE) return

  setGlobalVars()
  container.connect(utils, settings)
  toggleDark(settings.global.DARK_MODE)

  await i18n.init(settings.global.LOCALE)
  await setup(settings)
}

function setGlobalVars() {
  Object.assign(global, {
    BasePlugin,
    __plugin_i18n__: i18n,
    __plugin_utils__: utils,
    __plugin_container__: container,
  })
}

async function setup(settings) {
  await loadMixins(async () => {
    const plugins = await loadPlugins(settings)
    logging(plugins)
    container.setPlugins(plugins.enable)
  })
  reemit()
}

async function loadMixins(loadFn) {
  const invoke = (mixins, method) => Promise.all(mixins.map(m => m[method]?.()))

  const {
    logger, unstableRequire, styleManager,
    contextMenu, notification, formDialog, stateRecorder, hotkeyHub, exportHelper,
    eventHub, diagramParser, thirdPartyDiagramParser,
  } = utils.mixins

  await invoke([logger, unstableRequire, styleManager], "process")
  await invoke([contextMenu, notification, formDialog, stateRecorder, hotkeyHub, exportHelper], "process")

  await loadFn()

  await invoke([eventHub], "process")
  await invoke([diagramParser, thirdPartyDiagramParser], "process")

  eventHub.publishEvent(eventHub.eventType.allPluginsHadInjected)

  await invoke(Object.values(utils.mixins), "postprocess")
}

async function loadPlugins(configs) {
  const plugins = { enable: {}, disable: {}, stop: {}, error: {}, unconfigure: {} }

  const promises = Object.entries(configs).map(async ([fixedName, config]) => {
    if (!config) {
      plugins.unconfigure[fixedName] = fixedName
      return
    }
    if (!config.ENABLE) {
      plugins.disable[fixedName] = config
      return
    }

    try {
      const instance = await loadPlugin(fixedName, config)
      if (instance) {
        plugins.enable[fixedName] = instance
      } else {
        plugins.stop[fixedName] = config
      }
    } catch (error) {
      console.error(`[Plugin Error] ${fixedName}:`, error)
      plugins.error[fixedName] = error
    }
  })

  await Promise.all(promises)
  return plugins
}

async function loadPlugin(fixedName, config) {
  const { plugin: PluginClass } = utils.require("./plugin", fixedName)
  if (!PluginClass) {
    throw new Error(`Plugin not found: ${fixedName}`)
  }

  const instance = new PluginClass(fixedName, config, i18n.bind(fixedName))

  if (await instance.prepare() === utils.PLUGIN_LOAD_ABORT) return null

  await loadStyle(instance, instance.style())

  const html = instance.html()
  if (html) utils.insertElements(html)

  const hotkey = instance.hotkey()
  if (hotkey) utils.hotkeyHub.register(hotkey)

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

// Re-emit events (e.g., afterAddCodeBlock) that may have been missed due to async execution.
function reemit() {
  if (File.getMountFolder() == null) return
  setTimeout(() => {
    const queue = File.editor.fences.queue || {}
    Object.keys(queue).forEach(cid => File.editor.fences.addCodeBlock(cid))
    const path = utils.getFilePath()
    if (path) File.editor.library.openFile(path)
  }, 80)
}

function logging(plugins) {
  console.group("Typora-Plugin")
  Object.entries(plugins).forEach(([type, plugin]) => {
    const count = Object.keys(plugin).length
    console.debug(`[ \x1B[${PLUGIN_COLORS[type]}m${type}\x1b[0m ] [ ${count} ]:`, plugin)
  })
  console.groupEnd()
}

function toggleDark(dark) {
  document.body.classList.toggle("plugin-dark-mode", Boolean(dark))
}

module.exports = entry
