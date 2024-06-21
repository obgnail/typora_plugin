const {hotkeyHub} = require("./hotkey")
const {eventHub} = require("./eventHub")
const {stateRecorder} = require("./stateRecorder")
const {exportHelper} = require("./exportHelper")
const {styleTemplater} = require("./styleTemplater")
const {htmlTemplater} = require("./htmlTemplater")
const {markdownParser} = require("./markdownParser")
const {contextMenu} = require("./contextMenu")
const {notification} = require("./notification")
const {dialog} = require("./dialog")
const {diagramParser} = require("./diagramParser")
const {thirdPartyDiagramParser} = require("./thirdPartyDiagramParser")

const getDelegate = utils => {
    const helper = {
        eventHub: new eventHub(utils),
        contextMenu: new contextMenu(utils),
        notification: new notification(utils),
        diagramParser: new diagramParser(utils),
        thirdPartyDiagramParser: new thirdPartyDiagramParser(utils),
        stateRecorder: new stateRecorder(utils),
        dialog: new dialog(utils),
        hotkeyHub: new hotkeyHub(utils),
        styleTemplater: new styleTemplater(utils),
        htmlTemplater: new htmlTemplater(utils),
        exportHelper: new exportHelper(utils),
        markdownParser: new markdownParser(utils),
    }

    const delegate = {
        // 动态注册、动态注销hotkey
        registerHotkey: helper.hotkeyHub.register,
        registerSingleHotkey: helper.hotkeyHub.registerSingle,
        unregisterHotkey: helper.hotkeyHub.unregister,
        getHotkeyHub: helper.hotkeyHub,

        // 动态注册、动态注销、动态发布生命周期事件
        eventType: helper.eventHub.eventType,
        addEventListener: helper.eventHub.addEventListener,
        removeEventListener: helper.eventHub.removeEventListener,
        publishEvent: helper.eventHub.publishEvent,

        // 动态注册、动态注销元素状态记录器（仅当window_tab插件启用时有效）
        // 功能：在用户切换标签页前记录元素的状态，等用户切换回来时恢复元素的状态
        // 比如：【章节折叠】功能：需要在用户切换标签页前记录有哪些章节被折叠了，等用户切换回来后需要把章节自动折叠回去，保持前后一致。
        registerStateRecorder: helper.stateRecorder.register,
        unregisterStateRecorder: helper.stateRecorder.unregister,
        collectState: helper.stateRecorder.collect,
        getState: helper.stateRecorder.getState,
        deleteState: helper.stateRecorder.deleteState,
        setState: helper.stateRecorder.setState,

        // 动态注册、动态注销新的代码块图表语法
        registerDiagramParser: helper.diagramParser.register,
        unregisterDiagramParser: helper.diagramParser.unregister,
        throwParseError: helper.diagramParser.throwParseError,

        // 动态注册、动态注销第三方代码块图表语法(派生自DiagramParser)
        registerThirdPartyDiagramParser: helper.thirdPartyDiagramParser.register,
        unregisterThirdPartyDiagramParser: helper.thirdPartyDiagramParser.unregister,

        // 动态注册导出时的额外操作
        registerExportHelper: helper.exportHelper.register,
        unregisterExportHelper: helper.exportHelper.unregister,

        // 动态注册css模板文件
        registerStyleTemplate: helper.styleTemplater.register,
        unregisterStyleTemplate: helper.styleTemplater.unregister,
        getStyleContent: helper.styleTemplater.getStyleContent,

        // 插入html
        insertHtmlTemplate: helper.htmlTemplater.insert,
        createElement: helper.htmlTemplater.create,
        createElements: helper.htmlTemplater.createList,
        appendElements: helper.htmlTemplater.appendElements,

        // 解析markdown语法
        parseMarkdown: helper.markdownParser.parse,
        getNodeKindByNode: helper.markdownParser.getNodeKindByNode,
        getNodeKindByNum: helper.markdownParser.getNodeKindByNum,

        // 动态注册右键菜单
        registerMenu: helper.contextMenu.registerMenu,
        unregisterMenu: helper.contextMenu.unregisterMenu,

        // 弹出notification
        showNotification: helper.notification.show,

        // 动态弹出自定义模态框（即刻弹出，因此无需注册）
        modal: helper.dialog.modal,
    }

    return {helper, delegate}
}

module.exports = {
    getDelegate
}