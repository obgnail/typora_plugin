class reopenClosedFilesPlugin extends BaseCustomPlugin {
    init = () => {
        this.saveKey = "autoSaved"
        this.windowTab = null
    }

    hotkey = () => [this.config.hotkey]

    process = () => {
        this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.allPluginsHadInjected, () => {
            this.windowTab = this.utils.getBasePlugin("window_tab")
            if (!this.windowTab) return

            if (this.config.auto_reopen_when_init) {
                // Redirection is disabled when opening specific files (isDiscardableUntitled === false).
                this.utils.loopDetector(this.utils.isDiscardableUntitled, this.callback, 50, 2000, false)
            }

            setTimeout(() => this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.fileContentLoaded, () => this.windowTab.saveTabs(this.saveKey)), 2000)
        })
    }

    callback = anchorNode => this.windowTab && this.windowTab.openSaveTabs(this.saveKey, true)
}

module.exports = {
    plugin: reopenClosedFilesPlugin,
}
