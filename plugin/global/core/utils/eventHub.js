// 为什么要自己写事件监听发布机制，而不用node自带的EventEmitter？
// 答：为了立刻回调。此项目并不是官方的，我希望系统的设计能尽量减少BUG隐患。生命周期事件是通过hook对应的函数实现的，而emitter.emit却是异步的，这意味着回调函数执行时机是不确定的，显然立刻回调更加安全。
class eventHub {
    constructor(utils) {
        this.utils = utils;
        this.filepath = ""
        this.observer = null
        this.eventMap = {}  // { eventType: [listenerFunc] }
        this.eventType = Object.freeze({
            allCustomPluginsHadInjected: "allCustomPluginsHadInjected", // 自定义插件加载完毕
            allPluginsHadInjected: "allPluginsHadInjected",             // 所有插件加载完毕
            everythingReady: "everythingReady",                         // 一切准备就绪
            firstFileInit: "firstFileInit",                             // 打开Typora后文件被加载
            beforeFileOpen: "beforeFileOpen",                           // 打开文件之前
            fileOpened: "fileOpened",                                   // 打开文件之后
            otherFileOpened: "otherFileOpened",                         // 和fileOpened的区别：重新打开当前标签不会触发otherFileOpened，但是fileOpened会
            fileContentLoaded: "fileContentLoaded",                     // 文件内容加载完毕之后(依赖于window_tab)
            fileEdited: "fileEdited",                                   // 文件编辑后
            beforeUnload: "beforeUnload",                               // 退出Typora之前
            beforeToggleSourceMode: "beforeToggleSourceMode",           // 进入源码模式之前
            afterToggleSidebar: "afterToggleSidebar",                   // 切换侧边栏状态之后
            afterSetSidebarWidth: "afterSetSidebarWidth",               // 调整侧边栏宽度之后
            beforeAddCodeBlock: "beforeAddCodeBlock",                   // 添加代码块之前
            afterAddCodeBlock: "afterAddCodeBlock",                     // 添加代码块之后
            outlineUpdated: "outlineUpdated",                           // 大纲更新之时
            toggleSettingPage: "toggleSettingPage",                     // 切换到/回配置页面
        })
    }

    addEventListener = (type, listener) => {
        if (!this.eventMap[type]) {
            this.eventMap[type] = [];
        }
        this.eventMap[type].push(listener);
    }
    removeEventListener = (type, listener) => {
        if (this.eventMap[type]) {
            this.eventMap[type] = this.eventMap[type].filter(lis => lis !== listener);
        }
    }
    publishEvent = (type, payload) => {
        if (this.eventMap[type]) {
            for (const listener of this.eventMap[type]) {
                listener.call(this, payload);
            }
        }
    }

    process = () => {
        this.utils.decorate(() => File && File.editor && File.editor.library, "openFile",
            () => {
                this.filepath = this.utils.getFilePath();
                this.publishEvent(this.utils.eventType.beforeFileOpen);
            },
            (result, ...args) => {
                const filePath = args[0];
                filePath && this.publishEvent(this.utils.eventType.fileOpened, filePath);
                this.filepath !== filePath && this.publishEvent(this.utils.eventType.otherFileOpened, filePath);
            }
        )

        this.utils.loopDetector(() => File && this.utils.getFilePath(), () => {
            const filePath = this.utils.getFilePath();
            filePath && this.utils.publishEvent(this.utils.eventType.firstFileInit, filePath);
        });

        this.utils.decorate(() => File && File.editor && File.editor.fences, "addCodeBlock",
            (...args) => {
                const cid = args[0];
                cid && this.publishEvent(this.utils.eventType.beforeAddCodeBlock, cid)
            },
            (result, ...args) => {
                const cid = args[0];
                cid && this.publishEvent(this.utils.eventType.afterAddCodeBlock, cid)
            },
        )

        this.utils.decorate(() => File, "toggleSourceMode", () => this.publishEvent(this.utils.eventType.beforeToggleSourceMode))

        this.utils.decorate(
            () => File && File.editor && File.editor.library && File.editor.library.outline, "updateOutlineHtml",
            null, () => this.publishEvent(this.utils.eventType.outlineUpdated)
        )

        const _afterToggleSidebar = () => {
            const sidebar = document.querySelector("#typora-sidebar");
            sidebar && this.publishEvent(this.utils.eventType.afterToggleSidebar, sidebar.classList.contains("open"));
        }
        const content = document.querySelector("content");
        const hasTransition = window.getComputedStyle(content).transition !== "all 0s ease 0s";
        const afterToggleSidebar = hasTransition
            ? () => content.addEventListener("transitionend", _afterToggleSidebar, {once: true})
            : this.utils.debounce(_afterToggleSidebar, 400);
        this.utils.decorate(() => File && File.editor && File.editor.library, "toggleSidebar", null, afterToggleSidebar);

        const afterSetSidebarWidth = this.utils.debounce(() => this.publishEvent(this.utils.eventType.afterSetSidebarWidth), 400);
        this.utils.decorate(() => File && File.editor && File.editor.library, "setSidebarWidth", null, afterSetSidebarWidth);

        this.utils.decorate(() => window, "onbeforeunload", () => this.utils.publishEvent(this.utils.eventType.beforeUnload))

        new MutationObserver(mutationList => {
            for (const mutation of mutationList) {
                if (mutation.type === 'attributes' && mutation.attributeName === "class") {
                    const value = document.body.getAttribute(mutation.attributeName);
                    const openPage = value.indexOf("megamenu-opened") !== -1 || value.indexOf("show-preference-panel") !== -1;
                    this.utils.publishEvent(this.utils.eventType.toggleSettingPage, openPage);
                }
            }
        }).observe(document.body, {attributes: true});

        const debouncePublish = this.utils.debounce(() => this.utils.publishEvent(this.utils.eventType.fileEdited), 400);
        this.observer = new MutationObserver(mutationList => {
            if (mutationList.some(m => m.type === "characterData")
                || mutationList.length && mutationList.some(m => m.addedNodes.length) && mutationList.some(m => m.removedNodes.length)) {
                debouncePublish();
            }
        });
        this.observer.observe(document.querySelector("#write"), {characterData: true, childList: true, subtree: true})
    }

    afterProcess = () => {
        delete this.eventMap[this.utils.eventType.allCustomPluginsHadInjected];
        delete this.eventMap[this.utils.eventType.allPluginsHadInjected];
        delete this.eventMap[this.utils.eventType.everythingReady];
        setTimeout(() => delete this.eventMap[this.utils.eventType.firstFileInit], 1000);

        const funcList = this.eventMap[this.utils.eventType.fileEdited];
        if (!funcList || funcList.length === 0) {
            delete this.eventMap[this.utils.eventType.fileEdited];
            this.observer.disconnect();
            this.observer = null;
        }
    }
}

module.exports = {
    eventHub
}