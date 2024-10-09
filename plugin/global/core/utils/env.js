const getHook = utils => {
    const MIXIN = require("./mixin");
    const mixin = Object.fromEntries(
        Object.entries(MIXIN).map(([name, cls]) => [[name], new cls(utils)])
    );

    const {
        hotkeyHub, eventHub, stateRecorder, exportHelper, styleTemplater, htmlTemplater,
        contextMenu, notification, progressBar, dialog, diagramParser, thirdPartyDiagramParser, extra
    } = mixin;

    // monkey patch
    // we should use composition to layer various functions, but utils is outdated and has become legacy code. My apologies
    Object.assign(utils, mixin, {
        /** @deprecated new API: utils.hotkeyHub.register */
        registerHotkey: hotkeyHub.register,
        /** @deprecated new API: utils.hotkeyHub.registerSingle */
        registerSingleHotkey: hotkeyHub.registerSingle,
        /** @deprecated new API: utils.hotkeyHub.unregister */
        unregisterHotkey: hotkeyHub.unregister,

        /** @deprecated new API: utils.eventHub.eventType */
        eventType: eventHub.eventType,
        /** @deprecated new API: utils.eventHub.addEventListener */
        addEventListener: eventHub.addEventListener,
        /** @deprecated new API: utils.eventHub.removeEventListener */
        removeEventListener: eventHub.removeEventListener,
        /** @deprecated new API: utils.eventHub.publishEvent */
        publishEvent: eventHub.publishEvent,

        /** @deprecated new API: utils.styleTemplater.register */
        registerStyleTemplate: styleTemplater.register,
        /** @deprecated new API: utils.styleTemplater.unregister */
        unregisterStyleTemplate: styleTemplater.unregister,

        /** @deprecated new API: utils.htmlTemplater.insert */
        insertHtmlTemplate: htmlTemplater.insert,
        /** @deprecated new API: utils.htmlTemplater.create */
        createElement: htmlTemplater.create,
        /** @deprecated new API: utils.htmlTemplater.createList */
        createElements: htmlTemplater.createList,
        /** @deprecated new API: utils.htmlTemplater.appendElements */
        appendElements: htmlTemplater.appendElements,

        /** @deprecated new API: utils.dialog.modal */
        modal: dialog.modal
    });

    const registerMixin = (...ele) => Promise.all(ele.map(h => h.process && h.process()));
    const optimizeMixin = () => Promise.all(Object.values(mixin).map(h => h.afterProcess && h.afterProcess()));

    // Before loading plugins
    const registerMixinBefore = async () => {
        await registerMixin(extra);
        await registerMixin(contextMenu, notification, progressBar, dialog, stateRecorder, hotkeyHub, exportHelper);
    }

    // After loading plugins
    const registerMixinAfter = async () => {
        await registerMixin(eventHub);
        await registerMixin(diagramParser, thirdPartyDiagramParser);
        eventHub.publishEvent(eventHub.eventType.allPluginsHadInjected);
    }

    return async pluginLoader => {
        await registerMixinBefore();
        await pluginLoader();
        await registerMixinAfter();
        await optimizeMixin();
        // Due to the use of async, some events may have been missed (such as afterAddCodeBlock), reload it
        File.getMountFolder() != null && setTimeout(utils.reload, 50);
    }
}

module.exports = {
    getHook
}