class reopenClosedFilesPlugin extends BaseCustomPlugin {
    init = () => {
        this.windowTabBarPlugin = null;
        this.saveFile = this.utils.joinPath("./plugin/custom/plugins/reopenClosedFiles/remain.json");
    }

    hotkey = () => [this.config.hotkey]

    process = () => {
        this.utils.addEventListener(this.utils.eventType.allPluginsHadInjected, async () => {
            this.windowTabBarPlugin = this.utils.getPlugin("window_tab");
            if (!this.windowTabBarPlugin) return;
            await this.ensureFile();
            if (this.config.auto_reopen_when_init) {
                this.utils.loopDetector(this.utils.isDiscardableUntitled, this.callback, 40, 2000, false);
            }
        })
        this.utils.addEventListener(this.utils.eventType.beforeUnload, () => this.windowTabBarPlugin && this.windowTabBarPlugin.saveTabs(this.saveFile));
    }

    ensureFile = async () => await this.utils.Package.FsExtra.ensureFile(this.saveFile);

    callback = () => this.windowTabBarPlugin && this.windowTabBarPlugin.openSaveTabs(this.saveFile);
}

module.exports = {
    plugin: reopenClosedFilesPlugin,
};