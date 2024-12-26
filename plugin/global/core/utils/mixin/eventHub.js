/**
 * 动态注册、动态注销、动态发布生命周期事件
 * 为什么要自己写事件监听发布机制，而不用node自带的EventEmitter？
 * 答：为了立刻回调。此项目并不是官方的，我希望系统的设计能尽量减少BUG隐患。生命周期事件是通过hook对应的函数实现的，而emitter.emit却是异步的，这意味着回调函数执行时机是不确定的，显然立刻回调更加安全。
 */
class eventHub {
    constructor(utils) {
        this.utils = utils;
        this.filepath = "";
        this.observer = null;
        this.eventMap = Object.create(null);  // { eventType: {order: [listener]} }
        this.eventType = Object.freeze({
            allCustomPluginsHadInjected: "allCustomPluginsHadInjected", // 自定义插件加载完毕
            allPluginsHadInjected: "allPluginsHadInjected",             // 所有插件加载完毕
            firstFileInit: "firstFileInit",                             // 打开Typora后文件被加载
            beforeFileOpen: "beforeFileOpen",                           // 打开文件之前
            fileOpened: "fileOpened",                                   // 打开文件之后
            otherFileOpened: "otherFileOpened",                         // 和fileOpened的区别：重新打开当前标签不会触发otherFileOpened，但是fileOpened会
            fileContentLoaded: "fileContentLoaded",                     // 文件内容加载完毕之后
            fileEdited: "fileEdited",                                   // 文件编辑后
            beforeUnload: "beforeUnload",                               // 退出Typora之前
            beforeToggleSourceMode: "beforeToggleSourceMode",           // 进入源码模式之前
            afterToggleSidebar: "afterToggleSidebar",                   // 切换侧边栏状态之后
            afterSetSidebarWidth: "afterSetSidebarWidth",               // 调整侧边栏宽度之后
            beforeAddCodeBlock: "beforeAddCodeBlock",                   // 添加代码块之前
            afterAddCodeBlock: "afterAddCodeBlock",                     // 添加代码块之后
            afterUpdateCodeBlockLang: "afterUpdateCodeBlockLang",       // 修改代码块语言之后
            outlineUpdated: "outlineUpdated",                           // 大纲更新之时
            toggleSettingPage: "toggleSettingPage",                     // 切换到/回配置页面
        })
    }

    addEventListener = (type, listener, order = 0) => {
        this._checkType(type);
        this._checkListener(listener);
        if (!this.eventMap[type]) {
            this.eventMap[type] = { [order]: [listener] };
        } else if (!this.eventMap[type][order]) {
            this.eventMap[type][order] = [listener];
        } else {
            this.eventMap[type][order].push(listener);
        }
    }

    removeEventListener = (type, listener) => {
        this._checkType(type);
        this._checkListener(listener);
        for (const [order, funcList] of Object.entries(this.eventMap[type])) {
            this.eventMap[type][order] = funcList.filter(lis => lis !== listener);
        }
    }

    publishEvent = (type, payload) => {
        this._checkType(type);
        if (!this.eventMap[type]) return;
        for (const funcList of Object.values(this.eventMap[type])) {
            for (const listener of funcList) {
                listener.call(this, payload);
            }
        }
    }

    _checkType = type => {
        if (!this.eventType.hasOwnProperty(type)) {
            throw new Error(`do not support event type: ${type}`);
        }
    }

    _checkListener = listener => {
        if (typeof listener !== "function") {
            throw new Error(`listener is not function: ${listener}`);
        }
    }

    process = () => {
        this.utils.decorate(() => File && File.editor && File.editor.library, "openFile",
            () => {
                this.filepath = this.utils.getFilePath();
                this.publishEvent(this.eventType.beforeFileOpen);
            },
            (result, ...args) => {
                const filePath = args[0];
                filePath && this.publishEvent(this.eventType.fileOpened, filePath);
                this.filepath !== filePath && this.publishEvent(this.eventType.otherFileOpened, filePath);
            }
        )

        this.utils.loopDetector(() => File, () => {
            const attr = File.loadInitData ? "loadInitData" : "loadFile";
            const onContentLoaded = () => this.publishEvent(this.eventType.fileContentLoaded, this.utils.getFilePath());
            this.utils.decorate(() => File, attr, null, result => {
                if (attr === "loadFile") {
                    result.then(onContentLoaded);
                } else {
                    onContentLoaded();
                }
            })
        })

        this.utils.loopDetector(() => File && this.utils.getFilePath(), () => {
            const filePath = this.utils.getFilePath();
            filePath && this.publishEvent(this.eventType.firstFileInit, filePath);
        });

        this.utils.decorate(() => File && File.editor && File.editor.fences, "addCodeBlock",
            (...args) => {
                const cid = args[0];
                cid && this.publishEvent(this.eventType.beforeAddCodeBlock, cid)
            },
            (result, ...args) => {
                const cid = args[0];
                cid && this.publishEvent(this.eventType.afterAddCodeBlock, cid)
            },
        )

        this.utils.decorate(
            () => File && File.editor && File.editor.fences, "tryAddLangUndo",
            null, (result, ...args) => this.publishEvent(this.eventType.afterUpdateCodeBlockLang, args)
        );

        this.utils.decorate(() => File, "toggleSourceMode", () => this.publishEvent(this.eventType.beforeToggleSourceMode))

        this.utils.decorate(
            () => File && File.editor && File.editor.library && File.editor.library.outline, "updateOutlineHtml",
            null, () => this.publishEvent(this.eventType.outlineUpdated)
        )

        const _afterToggleSidebar = () => {
            const sidebar = document.querySelector("#typora-sidebar");
            sidebar && this.publishEvent(this.eventType.afterToggleSidebar, sidebar.classList.contains("open"));
        }
        const content = this.utils.entities.eContent;
        const hasTransition = window.getComputedStyle(content).transition !== "all 0s ease 0s";
        const afterToggleSidebar = hasTransition
            ? () => content.addEventListener("transitionend", _afterToggleSidebar, { once: true })
            : this.utils.debounce(_afterToggleSidebar, 400);
        this.utils.decorate(() => File && File.editor && File.editor.library, "toggleSidebar", null, afterToggleSidebar);

        const afterSetSidebarWidth = this.utils.debounce(() => this.publishEvent(this.eventType.afterSetSidebarWidth), 400);
        this.utils.decorate(() => File && File.editor && File.editor.library, "setSidebarWidth", null, afterSetSidebarWidth);

        this.utils.decorate(() => window, "onbeforeunload", () => this.publishEvent(this.eventType.beforeUnload))

        this.utils.decorate(() => File && File.megaMenu, "showPreferencePanel", () => this.publishEvent(this.eventType.toggleSettingPage, true))
        this.utils.decorate(() => File && File.megaMenu, "closePreferencePanel", () => this.publishEvent(this.eventType.toggleSettingPage, false))
        this.utils.decorate(() => File && File.megaMenu, "show", () => this.publishEvent(this.eventType.toggleSettingPage, true))
        this.utils.decorate(() => File && File.megaMenu, "hide", () => this.publishEvent(this.eventType.toggleSettingPage, false))

        const debouncePublish = this.utils.debounce(() => this.publishEvent(this.eventType.fileEdited), 400);
        this.observer = new MutationObserver(mutationList => {
            if (mutationList.some(m => m.type === "characterData")
                || mutationList.length && mutationList.some(m => m.addedNodes.length) && mutationList.some(m => m.removedNodes.length)) {
                debouncePublish();
            }
        });
        this.observer.observe(this.utils.entities.eWrite, { characterData: true, childList: true, subtree: true })
    }

    afterProcess = () => {
        delete this.eventMap[this.eventType.allCustomPluginsHadInjected];
        delete this.eventMap[this.eventType.allPluginsHadInjected];
        setTimeout(() => delete this.eventMap[this.eventType.firstFileInit], 1000);

        const funcList = this.eventMap[this.eventType.fileEdited];
        if (!funcList) {
            delete this.eventMap[this.eventType.fileEdited];
            this.observer.disconnect();
            this.observer = null;
        }
    }
}

module.exports = {
    eventHub
}