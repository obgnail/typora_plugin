const {hotkeyHub} = require("./mixin/hotkeyHub")
const {eventHub} = require("./mixin/eventHub")
const {stateRecorder} = require("./mixin/stateRecorder")
const {exportHelper} = require("./mixin/exportHelper")
const {styleTemplater} = require("./mixin/styleTemplater")
const {htmlTemplater} = require("./mixin/htmlTemplater")
const {markdownParser} = require("./mixin/markdownParser")
const {contextMenu} = require("./mixin/contextMenu")
const {notification} = require("./mixin/notification")
const {dialog} = require("./mixin/dialog")
const {diagramParser} = require("./mixin/diagramParser")
const {thirdPartyDiagramParser} = require("./mixin/thirdPartyDiagramParser")
const {entities} = require("./mixin/entities")

const getHelper = utils => {
    const _eventHub = new eventHub(utils);
    const _contextMenu = new contextMenu(utils);
    const _notification = new notification(utils);
    const _diagramParser = new diagramParser(utils);
    const _thirdPartyDiagramParser = new thirdPartyDiagramParser(utils);
    const _stateRecorder = new stateRecorder(utils);
    const _dialog = new dialog(utils);
    const _hotkeyHub = new hotkeyHub(utils);
    const _styleTemplater = new styleTemplater(utils);
    const _htmlTemplater = new htmlTemplater(utils);
    const _exportHelper = new exportHelper(utils);
    const _markdownParser = new markdownParser(utils);
    const _entities = new entities(utils);

    const helper = {
        eventHub: _eventHub,
        contextMenu: _contextMenu,
        notification: _notification,
        diagramParser: _diagramParser,
        thirdPartyDiagramParser: _thirdPartyDiagramParser,
        stateRecorder: _stateRecorder,
        dialog: _dialog,
        hotkeyHub: _hotkeyHub,
        styleTemplater: _styleTemplater,
        htmlTemplater: _htmlTemplater,
        exportHelper: _exportHelper,
        markdownParser: _markdownParser,
    }

    // combination should be used to layer various functions, but utils is too old and has become a legacy, so functions can only be mixin. i am so sorry
    const delegate = {
        /**
         * 动态注册、动态注销hotkey
         */
        /** @deprecated new API: utils.hotkeyHub.register */
        registerHotkey: _hotkeyHub.register,
        /** @deprecated new API: utils.hotkeyHub.registerSingle */
        registerSingleHotkey: _hotkeyHub.registerSingle,
        /** @deprecated new API: utils.hotkeyHub.unregister */
        unregisterHotkey: _hotkeyHub.unregister,
        /** @deprecated new API: utils.hotkeyHub */
        getHotkeyHub: () => _hotkeyHub,

        /**
         * 动态注册、动态注销、动态发布生命周期事件
         */
        /** @deprecated new API: utils.eventHub.eventType */
        eventType: _eventHub.eventType,
        /** @deprecated new API: utils.eventHub.addEventListener */
        addEventListener: _eventHub.addEventListener,
        /** @deprecated new API: utils.eventHub.removeEventListener */
        removeEventListener: _eventHub.removeEventListener,
        /** @deprecated new API: utils.eventHub.publishEvent */
        publishEvent: _eventHub.publishEvent,

        /**
         * 动态注册、动态注销元素状态记录器（仅当window_tab插件启用时有效）
         * 功能：在用户切换标签页前记录元素的状态，等用户切换回来时恢复元素的状态
         * 比如：【章节折叠】功能：需要在用户切换标签页前记录有哪些章节被折叠了，等用户切换回来后需要把章节自动折叠回去，保持前后一致。
         */
        /** @deprecated new API: utils.stateRecorder.register */
        registerStateRecorder: _stateRecorder.register,
        /** @deprecated new API: utils.stateRecorder.unregister */
        unregisterStateRecorder: _stateRecorder.unregister,
        /** @deprecated new API: utils.stateRecorder.collect */
        collectState: _stateRecorder.collect,
        /** @deprecated new API: utils.stateRecorder.getState */
        getState: _stateRecorder.getState,
        /** @deprecated new API: utils.stateRecorder.deleteState */
        deleteState: _stateRecorder.deleteState,
        /** @deprecated new API: utils.stateRecorder.setState */
        setState: _stateRecorder.setState,

        /**
         * 动态注册、动态注销新的代码块图表语法
         */
        /** @deprecated new API: utils.diagramParser.register */
        registerDiagramParser: _diagramParser.register,
        /** @deprecated new API: utils.diagramParser.unregister */
        unregisterDiagramParser: _diagramParser.unregister,
        /** @deprecated new API: utils.diagramParser.throwParseError */
        throwParseError: _diagramParser.throwParseError,

        /**
         * 动态注册、动态注销第三方代码块图表语法(派生自DiagramParser)
         */
        /** @deprecated new API: utils.thirdPartyDiagramParser.register */
        registerThirdPartyDiagramParser: _thirdPartyDiagramParser.register,
        /** @deprecated new API: utils.thirdPartyDiagramParser.unregister */
        unregisterThirdPartyDiagramParser: _thirdPartyDiagramParser.unregister,

        /**
         * 动态注册导出时的额外操作
         */
        /** @deprecated new API: utils.exportHelper.register */
        registerExportHelper: _exportHelper.register,
        /** @deprecated new API: utils.exportHelper.unregister */
        unregisterExportHelper: _exportHelper.unregister,

        /**
         * 动态注册css模板文件
         */
        /** @deprecated new API: utils.styleTemplater.register */
        registerStyleTemplate: _styleTemplater.register,
        /** @deprecated new API: utils.styleTemplater.unregister */
        unregisterStyleTemplate: _styleTemplater.unregister,
        /** @deprecated new API: utils.styleTemplater.getStyleContent */
        getStyleContent: _styleTemplater.getStyleContent,

        /**
         * 插入html
         */
        /** @deprecated new API: utils.htmlTemplater.insert */
        insertHtmlTemplate: _htmlTemplater.insert,
        /** @deprecated new API: utils.htmlTemplater.create */
        createElement: _htmlTemplater.create,
        /** @deprecated new API: utils.htmlTemplater.createList */
        createElements: _htmlTemplater.createList,
        /** @deprecated new API: utils.htmlTemplater.appendElements */
        appendElements: _htmlTemplater.appendElements,

        /**
         * 解析markdown语法
         */
        /** @deprecated new API: utils.markdownParser.parse */
        parseMarkdown: _markdownParser.parse,
        /** @deprecated new API: utils.markdownParser.getNodeKindByNode */
        getNodeKindByNode: _markdownParser.getNodeKindByNode,
        /** @deprecated new API: utils.markdownParser.getNodeKindByNum */
        getNodeKindByNum: _markdownParser.getNodeKindByNum,

        /**
         * 动态注册右键菜单
         */
        /** @deprecated new API: utils.contextMenu.register */
        registerMenu: _contextMenu.register,
        /** @deprecated new API: utils.contextMenu.unregister */
        unregisterMenu: _contextMenu.unregister,

        /**
         * 弹出notification
         */
        /** @deprecated new API: utils.notification.show */
        showNotification: _notification.show,

        /**
         * 动态弹出自定义模态框（即刻弹出，因此无需注册）
         */
        /** @deprecated new API: utils.dialog.modal */
        modal: _dialog.modal,

        /**
         * 常用Element对象
         */
        /** @deprecated new API: utils.entities */
        entities: _entities,
        /** @deprecated new API: utils.entities.querySelectorAllInWrite */
        querySelectorAllInWrite: _entities.querySelectorAllInWrite,
        /** @deprecated new API: utils.entities.querySelectorInWrite */
        querySelectorInWrite: _entities.querySelectorInWrite,
    }

    Object.assign(utils, helper, delegate);

    const _load = (...ele) => Promise.all(ele.map(h => h.process()));

    const loadHelpersBefore = async () => {
        await _load(_styleTemplater);
        await _load(_htmlTemplater, _contextMenu, _notification, _dialog, _stateRecorder, _hotkeyHub, _exportHelper);
    }

    const loadHelpersAfter = async () => {
        await _load(_eventHub);
        await _load(_diagramParser, _thirdPartyDiagramParser);
    };

    const optimizeHelpers = () => Promise.all(Object.values(helper).map(h => h.afterProcess && h.afterProcess()));

    return {helper, loadHelpersBefore, loadHelpersAfter, optimizeHelpers}
}

module.exports = {
    getHelper
}