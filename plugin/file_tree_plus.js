class FileTreePlusPlugin extends BasePlugin {
    process = () => {
        if (this.config.SHOW_ANY_EXT_FILE && File.SupportedFiles) {
            this.showOtherExtFile()
        }
        if (this.config.KEEP_FOLD_STATE && File.option.canCollapseOutlinePanel) {
            this.recordFoldTreeState()
        }
    }

    showOtherExtFile = () => {
        File.SupportedFiles.push(...this.config.SUPPORTED_FILE_EXT)
        const supportedExt = new Set(this.config.SUPPORTED_FILE_EXT.map(e => `.${e}`))
        // Delay decoration to ensure this beforeFn runs first, this beforeFn may return a stopCallError
        this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.allPluginsHadInjected, () => {
            this.utils.decorate(() => File?.editor?.library, "openFile", (toOpenFile) => {
                const ext = this.utils.Package.Path.extname(toOpenFile)
                if (supportedExt.has(ext)) {
                    this.utils.openPath(toOpenFile)
                    return this.utils.stopCallError
                }
            })
        })
    }

    /**
     * Preserves the fold/expand state of sidebar outline nodes across file switches.
     *
     * Since the outline DOM renders asynchronously, this method utilizes a `MutationObserver` to monitor the sidebar.
     * It intercepts the restoration task via a `delayWrapper` and defers execution until DOM mutations stabilize,
     * ensuring target elements exist before re-applying the state.
     */
    recordFoldTreeState = () => {
        let todo

        const outlineEl = document.getElementById("outline-content")
        const options = { childList: true, subtree: true }
        const callback = this.utils.debounce(() => {
            if (typeof todo === "function") {
                todo()
                todo = null
            }
        }, 100)
        new MutationObserver(callback).observe(outlineEl, options)

        const hasOpenClass = "outline-item-open"
        const recordSelector = "#outline-content .outline-item-wrapper:not(.outline-item-signle)"  // `signle` is Typora's typo
        const stateGetter = el => el.classList.contains(hasOpenClass)
        const stateRestorer = (el, isOpen) => isOpen && el.classList.add(hasOpenClass)
        const delayWrapper = (task) => todo = task
        this.utils.stateRecorder.register(this.fixedName, recordSelector, stateGetter, stateRestorer, null, delayWrapper)
    }
}

module.exports = {
    plugin: FileTreePlusPlugin
}
