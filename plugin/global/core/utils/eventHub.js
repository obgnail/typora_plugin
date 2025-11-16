/**
 * Dynamically register, unregister, and publish lifecycle events.
 */
class EventHub {
    constructor(utils) {
        this.utils = utils
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
            beforeToggleSourceMode: "beforeToggleSourceMode",           // Before entering source code mode
            afterToggleSidebar: "afterToggleSidebar",                   // After toggling the sidebar state
            afterSetSidebarWidth: "afterSetSidebarWidth",               // After adjusting the sidebar width
            // contentElementResized: "contentElementResized",             // content element resized
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
        let _filepath = ""
        this.utils.decorate(() => File?.editor?.library, "openFile",
            () => {
                _filepath = this.utils.getFilePath()
                this.publishEvent(this.eventType.beforeFileOpen)
            },
            (result, ...args) => {
                const filepath = args[0]
                if (filepath) this.publishEvent(this.eventType.fileOpened, filepath)
                if (_filepath !== filepath) this.publishEvent(this.eventType.otherFileOpened, filepath)
            }
        )

        this.utils.pollUntil(() => File, () => {
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

        this.utils.pollUntil(() => File && this.utils.getFilePath(), () => {
            const filePath = this.utils.getFilePath();
            if (filePath) this.publishEvent(this.eventType.firstFileInit, filePath)
        });

        this.utils.decorate(() => File?.editor?.fences, "addCodeBlock",
            (...args) => {
                const cid = args[0]
                if (cid) this.publishEvent(this.eventType.beforeAddCodeBlock, cid)
            },
            (fence, ...args) => {
                const cid = args[0]
                if (cid) this.publishEvent(this.eventType.afterAddCodeBlock, cid, fence)
            },
        )

        this.utils.decorate(
            () => File?.editor?.fences, "tryAddLangUndo", null,
            (result, ...args) => this.publishEvent(this.eventType.afterUpdateCodeBlockLang, args)
        );

        this.utils.decorate(() => File, "toggleSourceMode", () => this.publishEvent(this.eventType.beforeToggleSourceMode))

        this.utils.decorate(
            () => File?.editor?.library?.outline, "updateOutlineHtml", null,
            () => this.publishEvent(this.eventType.outlineUpdated)
        )

        const _afterToggleSidebar = () => {
            const sidebar = document.querySelector("#typora-sidebar");
            if (sidebar) this.publishEvent(this.eventType.afterToggleSidebar, sidebar.classList.contains("open"))
        }
        const content = this.utils.entities.eContent;
        const hasTransition = window.getComputedStyle(content).transition !== "all 0s ease 0s";
        const afterToggleSidebar = hasTransition
            ? () => content.addEventListener("transitionend", _afterToggleSidebar, { once: true })
            : this.utils.debounce(_afterToggleSidebar, 400);
        this.utils.decorate(() => File?.editor?.library, "toggleSidebar", null, afterToggleSidebar)

        const afterSetSidebarWidth = this.utils.debounce(() => this.publishEvent(this.eventType.afterSetSidebarWidth), 400);
        this.utils.decorate(() => File?.editor?.library, "setSidebarWidth", null, afterSetSidebarWidth)

        // const resizeObserver = new ResizeObserver(entries => {
        //     for (const entry of entries) {
        //         if (entry.target === content) {
        //             this.publishEvent(this.eventType.contentElementResized, entry.contentRect)
        //         }
        //     }
        // })
        // resizeObserver.observe(content)

        this.utils.decorate(() => File?.megaMenu, "showPreferencePanel", () => this.publishEvent(this.eventType.toggleSettingPage, true))
        this.utils.decorate(() => File?.megaMenu, "closePreferencePanel", () => this.publishEvent(this.eventType.toggleSettingPage, false))
        this.utils.decorate(() => File?.megaMenu, "show", () => this.publishEvent(this.eventType.toggleSettingPage, true))
        this.utils.decorate(() => File?.megaMenu, "hide", () => this.publishEvent(this.eventType.toggleSettingPage, false))

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

module.exports = EventHub
