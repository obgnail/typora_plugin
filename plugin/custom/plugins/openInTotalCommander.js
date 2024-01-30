class openInTotalCommander extends BaseCustomPlugin {
    selector = () => {
        if (!this.utils.getFilePath()) {
            return this.utils.nonExistSelector
        }
    }

    hotkey = () => [this.config.hotkey]

    callback = anchorNode => {
        const cmd = this.config.tc_path + " " + this.config.tc_args;
        const shell = "cmd/bash";
        this.utils.callPluginFunction("commander", "silentExec", cmd, shell);
    }
}

module.exports = {
    plugin: openInTotalCommander,
};