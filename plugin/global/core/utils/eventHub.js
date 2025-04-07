/**
 * Dynamically register, unregister, and publish lifecycle events.
 *
 * Why implement a custom event listener and publisher instead of using Node's built-in EventEmitter?
 * Answer: For immediate callbacks. This project is not official, and I want the system design to minimize potential bugs.
 *         Lifecycle events are implemented by hooking corresponding functions.
 *         However, emitter.emit is asynchronous, meaning the timing of callback execution is uncertain. Immediate callbacks are inherently safer.
 */
class eventHub {
    constructor(utils) {
        this.utils = utils
        this.filepath = ""
        this.observer = null
        this.eventMap = Object.create(null)  // { eventType: {order: [listener]} }
        this.eventType = Object.freeze({
            allCustomPluginsHadInjected: "allCustomPluginsHadInjected", // Custom plugins loaded
            allPluginsHadInjected: "allPluginsHadInjected",             // All plugins loaded
            firstFileInit: "firstFileInit",                             // File loaded after opening Typora
            beforeFileOpen: "beforeFileOpen",                           // Before opening a file
            fileOpened: "fileOpened",                                   // After opening a file
            otherFileOpened: "otherFileOpened",                         // Different from fileOpened: reopening the current tab won't trigger otherFileOpened, but fileOpened will
            fileContentLoaded: "fileContentLoaded",                     // After file content is loaded
            fileEdited: "fileEdited",                                   // After file is edited
            beforeUnload: "beforeUnload",                               // Before exiting Typora
            beforeToggleSourceMode: "beforeToggleSourceMode",           // Before entering source code mode
            afterToggleSidebar: "afterToggleSidebar",                   // After toggling the sidebar state
            afterSetSidebarWidth: "afterSetSidebarWidth",               // After adjusting the sidebar width
            beforeAddCodeBlock: "beforeAddCodeBlock",                   // Before adding a code block
            afterAddCodeBlock: "afterAddCodeBlock",                     // After adding a code block
            afterUpdateCodeBlockLang: "afterUpdateCodeBlockLang",       // After modifying the code block language
            outlineUpdated: "outlineUpdated",                           // When the outline is updated
            toggleSettingPage: "toggleSettingPage",                     // When toggling to/from the settings page
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

    publishEvent = (type, ...payload) => {
        this._checkType(type);
        if (!this.eventMap[type]) return;
        for (const funcList of Object.values(this.eventMap[type])) {
            for (const listener of funcList) {
                listener.apply(this, payload)
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
                const cid = args[0]
                cid && this.publishEvent(this.eventType.beforeAddCodeBlock, cid)
            },
            (fence, ...args) => {
                const cid = args[0]
                cid && this.publishEvent(this.eventType.afterAddCodeBlock, cid, fence)
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
