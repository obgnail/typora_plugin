const getHook = utils => {
    const { i18n } = require("../i18n")
    const MIXIN = require("./mixin")
    const mixin = Object.fromEntries(Object.entries(MIXIN).map(([name, cls]) => [[name], new cls(utils, i18n)]))

    const {
        hotkeyHub, eventHub, stateRecorder, exportHelper, contextMenu,
        notification, progressBar, dialog, diagramParser, thirdPartyDiagramParser,
        extra, polyfill,
    } = mixin

    // monkey patch
    // we should use composition to layer various functions, but utils is outdated and has become legacy code. My apologies
    Object.assign(utils, mixin, {
        /** @deprecated new API: utils.hotkeyHub.register */
        registerHotkey: hotkeyHub.register,
        /** @deprecated new API: utils.hotkeyHub.registerSingle */
        registerSingleHotkey: hotkeyHub.registerSingle,

        /** @deprecated new API: utils.eventHub.eventType */
        eventType: eventHub.eventType,
        /** @deprecated new API: utils.eventHub.addEventListener */
        addEventListener: eventHub.addEventListener,

        /** @deprecated new API: utils.dialog.modal */
        modal: dialog.modal
    })

    const registerMixin = (...ele) => Promise.all(ele.map(h => h.process && h.process()))
    const optimizeMixin = () => Promise.all(Object.values(mixin).map(h => h.afterProcess && h.afterProcess()))

    const registerPreMixin = async () => {
        await registerMixin(polyfill)
        await registerMixin(extra)
        await registerMixin(contextMenu, notification, progressBar, dialog, stateRecorder, hotkeyHub, exportHelper)
    }

    const registerPostMixin = async () => {
        await registerMixin(eventHub)
        await registerMixin(diagramParser, thirdPartyDiagramParser)
        eventHub.publishEvent(eventHub.eventType.allPluginsHadInjected)
    }

    // Due to the use of async, some events may have been missed (such as afterAddCodeBlock), reload it
    const postLoadPlugin = () => {
        if (File.getMountFolder() != null) {
            setTimeout(utils.reload, 50)
        }
    }

    return async pluginLoader => {
        await registerPreMixin()
        await pluginLoader()
        await registerPostMixin()
        await optimizeMixin()
        postLoadPlugin()
    }
}

module.exports = {
    getHook
}
