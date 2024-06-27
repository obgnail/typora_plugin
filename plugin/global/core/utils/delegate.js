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
         * @deprecated 请使用新的方法 this.utils.hotkeyHub[register,registerSingle,unregister] 代替
         */
        registerHotkey: _hotkeyHub.register,
        registerSingleHotkey: _hotkeyHub.registerSingle,
        unregisterHotkey: _hotkeyHub.unregister,
        getHotkeyHub: () => _hotkeyHub,

        /**
         * 动态注册、动态注销、动态发布生命周期事件
         * @deprecated 请使用新的方法 this.utils.eventHub[eventType,addEventListener,removeEventListener,publishEvent] 代替
         */
        eventType: _eventHub.eventType,
        addEventListener: _eventHub.addEventListener,
        removeEventListener: _eventHub.removeEventListener,
        publishEvent: _eventHub.publishEvent,

        /**
         * 动态注册、动态注销元素状态记录器（仅当window_tab插件启用时有效）
         * 功能：在用户切换标签页前记录元素的状态，等用户切换回来时恢复元素的状态
         * 比如：【章节折叠】功能：需要在用户切换标签页前记录有哪些章节被折叠了，等用户切换回来后需要把章节自动折叠回去，保持前后一致。
         * @deprecated 请使用新的方法 this.utils.stateRecorder[register,unregister,collect,getState,deleteState,setState] 代替
         */
        registerStateRecorder: _stateRecorder.register,
        unregisterStateRecorder: _stateRecorder.unregister,
        collectState: _stateRecorder.collect,
        getState: _stateRecorder.getState,
        deleteState: _stateRecorder.deleteState,
        setState: _stateRecorder.setState,

        /**
         * 动态注册、动态注销新的代码块图表语法
         * @deprecated 请使用新的方法 this.utils.diagramParser[register,unregister,throwParseError] 代替
         */
        registerDiagramParser: _diagramParser.register,
        unregisterDiagramParser: _diagramParser.unregister,
        throwParseError: _diagramParser.throwParseError,

        /**
         * 动态注册、动态注销第三方代码块图表语法(派生自DiagramParser)
         * @deprecated 请使用新的方法 this.utils.thirdPartyDiagramParser[register,unregister] 代替
         */
        registerThirdPartyDiagramParser: _thirdPartyDiagramParser.register,
        unregisterThirdPartyDiagramParser: _thirdPartyDiagramParser.unregister,

        /**
         * 动态注册导出时的额外操作
         * @deprecated 请使用新的方法 this.utils.exportHelper[register,unregister] 代替
         */
        registerExportHelper: _exportHelper.register,
        unregisterExportHelper: _exportHelper.unregister,

        /**
         * 动态注册css模板文件
         * @deprecated 请使用新的方法 this.utils.styleTemplater[register,unregister,getStyleContent] 代替
         */
        registerStyleTemplate: _styleTemplater.register,
        unregisterStyleTemplate: _styleTemplater.unregister,
        getStyleContent: _styleTemplater.getStyleContent,

        /**
         * 插入html
         * @deprecated 请使用新的方法 this.utils.htmlTemplater[insert,create,createList,appendElements] 代替
         */
        insertHtmlTemplate: _htmlTemplater.insert,
        createElement: _htmlTemplater.create,
        createElements: _htmlTemplater.createList,
        appendElements: _htmlTemplater.appendElements,

        /**
         * 解析markdown语法
         * @deprecated 请使用新的方法 this.utils.markdownParser[parse,getNodeKindByNode,getNodeKindByNum] 代替
         */
        parseMarkdown: _markdownParser.parse,
        getNodeKindByNode: _markdownParser.getNodeKindByNode,
        getNodeKindByNum: _markdownParser.getNodeKindByNum,

        /**
         * 动态注册右键菜单
         * @deprecated 请使用新的方法 this.utils.contextMenu[register,unregister] 代替
         */
        registerMenu: _contextMenu.register,
        unregisterMenu: _contextMenu.unregister,

        /**
         * 弹出notification
         * @deprecated 请使用新的方法 this.utils.notification.show 代替
         */
        showNotification: _notification.show,

        /**
         * 动态弹出自定义模态框（即刻弹出，因此无需注册）
         * @deprecated 请使用新的方法 this.utils.dialog.modal 代替
         */
        modal: _dialog.modal,

        /**
         * 常用Element对象
         * @deprecated 请使用新的方法 this.utils.entities[querySelectorAllInWrite,querySelectorInWrite] 代替
         */
        entities: _entities,
        querySelectorAllInWrite: _entities.querySelectorAllInWrite,
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