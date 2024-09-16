const getHook = utils => {
    const MIXIN = require("./mixin");
    const mixin = Object.fromEntries(
        Object.entries(MIXIN).map(
            ([name, cls]) => [[name], new cls(utils)]
        )
    );

    const {
        hotkeyHub, eventHub, stateRecorder, exportHelper, styleTemplater, htmlTemplater,
        contextMenu, notification, progressBar, dialog, diagramParser, thirdPartyDiagramParser, extra, entities
    } = mixin;

    // monkey patch
    // combination should be used to layer various functions, but utils is too old and has become a legacy. i am so sorry
    Object.assign(utils, mixin, {
        /** @deprecated new API: utils.hotkeyHub.register */
        registerHotkey: hotkeyHub.register,
        /** @deprecated new API: utils.hotkeyHub.registerSingle */
        registerSingleHotkey: hotkeyHub.registerSingle,
        /** @deprecated new API: utils.hotkeyHub.unregister */
        unregisterHotkey: hotkeyHub.unregister,
        /** @deprecated new API: utils.hotkeyHub */
        getHotkeyHub: () => hotkeyHub,

        /** @deprecated new API: utils.eventHub.eventType */
        eventType: eventHub.eventType,
        /** @deprecated new API: utils.eventHub.addEventListener */
        addEventListener: eventHub.addEventListener,
        /** @deprecated new API: utils.eventHub.removeEventListener */
        removeEventListener: eventHub.removeEventListener,
        /** @deprecated new API: utils.eventHub.publishEvent */
        publishEvent: eventHub.publishEvent,

        /** @deprecated new API: utils.stateRecorder.register */
        registerStateRecorder: stateRecorder.register,
        /** @deprecated new API: utils.stateRecorder.unregister */
        unregisterStateRecorder: stateRecorder.unregister,
        /** @deprecated new API: utils.stateRecorder.collect */
        collectState: stateRecorder.collect,
        /** @deprecated new API: utils.stateRecorder.getState */
        getState: stateRecorder.getState,
        /** @deprecated new API: utils.stateRecorder.deleteState */
        deleteState: stateRecorder.deleteState,
        /** @deprecated new API: utils.stateRecorder.setState */
        setState: stateRecorder.setState,

        /** @deprecated new API: utils.diagramParser.register */
        registerDiagramParser: diagramParser.register,
        /** @deprecated new API: utils.diagramParser.unregister */
        unregisterDiagramParser: diagramParser.unregister,
        /** @deprecated new API: utils.diagramParser.throwParseError */
        throwParseError: diagramParser.throwParseError,

        /** @deprecated new API: utils.thirdPartyDiagramParser.register */
        registerThirdPartyDiagramParser: thirdPartyDiagramParser.register,
        /** @deprecated new API: utils.thirdPartyDiagramParser.unregister */
        unregisterThirdPartyDiagramParser: thirdPartyDiagramParser.unregister,

        /** @deprecated new API: utils.exportHelper.register */
        registerExportHelper: exportHelper.register,
        /** @deprecated new API: utils.exportHelper.unregister */
        unregisterExportHelper: exportHelper.unregister,

        /** @deprecated new API: utils.styleTemplater.register */
        registerStyleTemplate: styleTemplater.register,
        /** @deprecated new API: utils.styleTemplater.unregister */
        unregisterStyleTemplate: styleTemplater.unregister,
        /** @deprecated new API: utils.styleTemplater.getStyleContent */
        getStyleContent: styleTemplater.getStyleContent,

        /** @deprecated new API: utils.htmlTemplater.insert */
        insertHtmlTemplate: htmlTemplater.insert,
        /** @deprecated new API: utils.htmlTemplater.create */
        createElement: htmlTemplater.create,
        /** @deprecated new API: utils.htmlTemplater.createList */
        createElements: htmlTemplater.createList,
        /** @deprecated new API: utils.htmlTemplater.appendElements */
        appendElements: htmlTemplater.appendElements,

        /** @deprecated new API: utils.contextMenu.register */
        registerMenu: contextMenu.register,
        /** @deprecated new API: utils.contextMenu.unregister */
        unregisterMenu: contextMenu.unregister,

        /** @deprecated new API: utils.dialog.modal */
        modal: dialog.modal
    });

    const registerMixin = (...ele) => Promise.all(ele.map(h => h.process && h.process()));
    const optimizeMixin = () => Promise.all(Object.values(mixin).map(h => h.afterProcess && h.afterProcess()));

    // Before loading plugins
    const registerMixinBefore = async () => {
        await registerMixin(styleTemplater, extra);
        await registerMixin(htmlTemplater, contextMenu, notification, progressBar, dialog, stateRecorder, hotkeyHub, exportHelper);
    }

    // After loading plugins
    const registerMixinAfter = async () => {
        await registerMixin(eventHub);
        await registerMixin(diagramParser, thirdPartyDiagramParser);
        eventHub.publishEvent(eventHub.eventType.allPluginsHadInjected);  // 发布[已完成]事件
    }

    return async pluginLoader => {
        await registerMixinBefore();
        await pluginLoader();
        await registerMixinAfter();
        await optimizeMixin();
        setTimeout(utils.reload, 50);  // 由于使用了async，有些页面事件可能已经错过了（比如afterAddCodeBlock），重新加载一遍页面
    }
}

module.exports = {
    getHook
}