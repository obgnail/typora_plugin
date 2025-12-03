require("./polyfill")
require("./components")
const i18n = require("./i18n")
const utils = require("./utils")
const serviceContainer = require("./serviceContainer")
const { BasePlugin, BaseCustomPlugin, LoadPlugins } = require("./plugin")

async function entry() {
    const incompatible = utils.compareVersion(utils.typoraVersion, "0.9.98") < 0
    if (incompatible) return

    const settings = await utils.settings.readBasePluginSettings()
    if (!settings?.global?.ENABLE) {
        console.warn("Typora-Plugin disabled")
        return
    }

    setupGlobalVars()
    serviceContainer.setSettings(settings)
    serviceContainer.setUtils(utils)

    await i18n.init(settings.global.LOCALE)
    await loadPlugins(serviceContainer, settings)
}

function setupGlobalVars() {
    global.BasePlugin = BasePlugin
    global.BaseCustomPlugin = BaseCustomPlugin

    // Convenient for debugging
    global.__plugin_i18n__ = i18n
    global.__plugin_utils__ = utils
    global.__plugin_service_container__ = serviceContainer
}

async function loadPlugins(container, settings) {
    const _processMixins = async (...mixins) => Promise.all(mixins.map(m => m.process?.()))
    const _postprocessMixins = async (...mixins) => Promise.all(mixins.map(m => m.afterProcess?.()))

    const {
        styleTemplater, contextMenu, notification, progressBar, formDialog, stateRecorder, hotkeyHub, exportHelper,
        eventHub, diagramParser, thirdPartyDiagramParser,
    } = utils.mixins

    await _processMixins(styleTemplater)
    await _processMixins(contextMenu, notification, progressBar, formDialog, stateRecorder, hotkeyHub, exportHelper)

    const { enable } = await LoadPlugins(settings)
    container.setPlugins(enable)

    await _processMixins(eventHub)
    await _processMixins(diagramParser, thirdPartyDiagramParser)

    eventHub.publishEvent(eventHub.eventType.allPluginsHadInjected)
    await _postprocessMixins(...Object.values(utils.mixins))

    // Re-emit events (e.g., afterAddCodeBlock) that may have been missed due to async execution.
    if (File.getMountFolder() != null) {
        setTimeout(() => {
            const filePath = utils.getFilePath()
            Object.keys(File.editor.fences.queue).forEach(cid => File.editor.fences.addCodeBlock(cid))
            if (filePath) File.editor.library.openFile(filePath)
        }, 50)
    }
}

module.exports = entry
