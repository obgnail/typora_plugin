const { utils } = require("../index");
const { hotkeyHub } = require("./hotkeyHub")
const { eventHub } = require("./eventHub")
const { stateRecorder } = require("./stateRecorder")
const { exportHelper } = require("./exportHelper")
const { styleTemplater } = require("./styleTemplater")
const { htmlTemplater } = require("./htmlTemplater")
const { contextMenu } = require("./contextMenu")
const { notification } = require("./notification")
const { progressBar } = require("./progressBar")
const { dialog } = require("./dialog")
const { diagramParser } = require("./diagramParser")
const { thirdPartyDiagramParser } = require("./thirdPartyDiagramParser")
const { entities } = require("./entities")

const mixin = {
    hotkeyHub: new hotkeyHub(utils),
    eventHub: new eventHub(utils),
    stateRecorder: new stateRecorder(utils),
    exportHelper: new exportHelper(utils),
    styleTemplater: new styleTemplater(utils),
    htmlTemplater: new htmlTemplater(utils),
    contextMenu: new contextMenu(utils),
    notification: new notification(utils),
    progressBar: new progressBar(utils),
    dialog: new dialog(utils),
    diagramParser: new diagramParser(utils),
    thirdPartyDiagramParser: new thirdPartyDiagramParser(utils),
    entities: new entities(utils),
}

// combination should be used to layer various functions, but utils is too old and has become a legacy. i am so sorry
const delegate = {
    /** @deprecated new API: utils.hotkeyHub.register */
    registerHotkey: mixin.hotkeyHub.register,
    /** @deprecated new API: utils.hotkeyHub.registerSingle */
    registerSingleHotkey: mixin.hotkeyHub.registerSingle,
    /** @deprecated new API: utils.hotkeyHub.unregister */
    unregisterHotkey: mixin.hotkeyHub.unregister,
    /** @deprecated new API: utils.hotkeyHub */
    getHotkeyHub: () => mixin.hotkeyHub,

    /** @deprecated new API: utils.eventHub.eventType */
    eventType: mixin.eventHub.eventType,
    /** @deprecated new API: utils.eventHub.addEventListener */
    addEventListener: mixin.eventHub.addEventListener,
    /** @deprecated new API: utils.eventHub.removeEventListener */
    removeEventListener: mixin.eventHub.removeEventListener,
    /** @deprecated new API: utils.eventHub.publishEvent */
    publishEvent: mixin.eventHub.publishEvent,

    /** @deprecated new API: utils.stateRecorder.register */
    registerStateRecorder: mixin.stateRecorder.register,
    /** @deprecated new API: utils.stateRecorder.unregister */
    unregisterStateRecorder: mixin.stateRecorder.unregister,
    /** @deprecated new API: utils.stateRecorder.collect */
    collectState: mixin.stateRecorder.collect,
    /** @deprecated new API: utils.stateRecorder.getState */
    getState: mixin.stateRecorder.getState,
    /** @deprecated new API: utils.stateRecorder.deleteState */
    deleteState: mixin.stateRecorder.deleteState,
    /** @deprecated new API: utils.stateRecorder.setState */
    setState: mixin.stateRecorder.setState,

    /** @deprecated new API: utils.diagramParser.register */
    registerDiagramParser: mixin.diagramParser.register,
    /** @deprecated new API: utils.diagramParser.unregister */
    unregisterDiagramParser: mixin.diagramParser.unregister,
    /** @deprecated new API: utils.diagramParser.throwParseError */
    throwParseError: mixin.diagramParser.throwParseError,

    /** @deprecated new API: utils.thirdPartyDiagramParser.register */
    registerThirdPartyDiagramParser: mixin.thirdPartyDiagramParser.register,
    /** @deprecated new API: utils.thirdPartyDiagramParser.unregister */
    unregisterThirdPartyDiagramParser: mixin.thirdPartyDiagramParser.unregister,

    /** @deprecated new API: utils.exportHelper.register */
    registerExportHelper: mixin.exportHelper.register,
    /** @deprecated new API: utils.exportHelper.unregister */
    unregisterExportHelper: mixin.exportHelper.unregister,

    /** @deprecated new API: utils.styleTemplater.register */
    registerStyleTemplate: mixin.styleTemplater.register,
    /** @deprecated new API: utils.styleTemplater.unregister */
    unregisterStyleTemplate: mixin.styleTemplater.unregister,
    /** @deprecated new API: utils.styleTemplater.getStyleContent */
    getStyleContent: mixin.styleTemplater.getStyleContent,

    /** @deprecated new API: utils.htmlTemplater.insert */
    insertHtmlTemplate: mixin.htmlTemplater.insert,
    /** @deprecated new API: utils.htmlTemplater.create */
    createElement: mixin.htmlTemplater.create,
    /** @deprecated new API: utils.htmlTemplater.createList */
    createElements: mixin.htmlTemplater.createList,
    /** @deprecated new API: utils.htmlTemplater.appendElements */
    appendElements: mixin.htmlTemplater.appendElements,

    /** @deprecated new API: utils.contextMenu.register */
    registerMenu: mixin.contextMenu.register,
    /** @deprecated new API: utils.contextMenu.unregister */
    unregisterMenu: mixin.contextMenu.unregister,

    /** @deprecated new API: utils.dialog.modal */
    modal: mixin.dialog.modal,
}

Object.assign(utils, mixin, delegate);

module.exports = {
    mixin
}