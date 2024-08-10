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
    /**
     * 动态注册、动态注销hotkey
     */
    /** @deprecated new API: utils.hotkeyHub.register */
    registerHotkey: mixin.hotkeyHub.register,
    /** @deprecated new API: utils.hotkeyHub.registerSingle */
    registerSingleHotkey: mixin.hotkeyHub.registerSingle,
    /** @deprecated new API: utils.hotkeyHub.unregister */
    unregisterHotkey: mixin.hotkeyHub.unregister,
    /** @deprecated new API: utils.hotkeyHub */
    getHotkeyHub: () => mixin.hotkeyHub,

    /**
     * 动态注册、动态注销、动态发布生命周期事件
     */
    /** @deprecated new API: utils.eventHub.eventType */
    eventType: mixin.eventHub.eventType,
    /** @deprecated new API: utils.eventHub.addEventListener */
    addEventListener: mixin.eventHub.addEventListener,
    /** @deprecated new API: utils.eventHub.removeEventListener */
    removeEventListener: mixin.eventHub.removeEventListener,
    /** @deprecated new API: utils.eventHub.publishEvent */
    publishEvent: mixin.eventHub.publishEvent,

    /**
     * 动态注册、动态注销元素状态记录器（仅当window_tab插件启用时有效）
     * 功能：在用户切换标签页前记录元素的状态，等用户切换回来时恢复元素的状态
     * 比如：【章节折叠】功能：需要在用户切换标签页前记录有哪些章节被折叠了，等用户切换回来后需要把章节自动折叠回去，保持前后一致。
     */
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

    /**
     * 动态注册、动态注销新的代码块图表语法
     */
    /** @deprecated new API: utils.diagramParser.register */
    registerDiagramParser: mixin.diagramParser.register,
    /** @deprecated new API: utils.diagramParser.unregister */
    unregisterDiagramParser: mixin.diagramParser.unregister,
    /** @deprecated new API: utils.diagramParser.throwParseError */
    throwParseError: mixin.diagramParser.throwParseError,

    /**
     * 动态注册、动态注销第三方代码块图表语法(派生自DiagramParser)
     */
    /** @deprecated new API: utils.thirdPartyDiagramParser.register */
    registerThirdPartyDiagramParser: mixin.thirdPartyDiagramParser.register,
    /** @deprecated new API: utils.thirdPartyDiagramParser.unregister */
    unregisterThirdPartyDiagramParser: mixin.thirdPartyDiagramParser.unregister,

    /**
     * 动态注册导出时的额外操作
     */
    /** @deprecated new API: utils.exportHelper.register */
    registerExportHelper: mixin.exportHelper.register,
    /** @deprecated new API: utils.exportHelper.unregister */
    unregisterExportHelper: mixin.exportHelper.unregister,

    /**
     * 动态注册css模板文件
     */
    /** @deprecated new API: utils.styleTemplater.register */
    registerStyleTemplate: mixin.styleTemplater.register,
    /** @deprecated new API: utils.styleTemplater.unregister */
    unregisterStyleTemplate: mixin.styleTemplater.unregister,
    /** @deprecated new API: utils.styleTemplater.getStyleContent */
    getStyleContent: mixin.styleTemplater.getStyleContent,

    /**
     * 插入html
     */
    /** @deprecated new API: utils.htmlTemplater.insert */
    insertHtmlTemplate: mixin.htmlTemplater.insert,
    /** @deprecated new API: utils.htmlTemplater.create */
    createElement: mixin.htmlTemplater.create,
    /** @deprecated new API: utils.htmlTemplater.createList */
    createElements: mixin.htmlTemplater.createList,
    /** @deprecated new API: utils.htmlTemplater.appendElements */
    appendElements: mixin.htmlTemplater.appendElements,

    /**
     * 动态注册右键菜单
     */
    /** @deprecated new API: utils.contextMenu.register */
    registerMenu: mixin.contextMenu.register,
    /** @deprecated new API: utils.contextMenu.unregister */
    unregisterMenu: mixin.contextMenu.unregister,

    /**
     * 弹出notification
     */
    /** @deprecated new API: utils.notification.show */
    showNotification: mixin.notification.show,

    /**
     * 动态弹出自定义模态框（即刻弹出，因此无需注册）
     */
    /** @deprecated new API: utils.dialog.modal */
    modal: mixin.dialog.modal,
}

Object.assign(utils, mixin, delegate);

module.exports = {
    mixin
}