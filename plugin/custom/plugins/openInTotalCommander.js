class openInTotalCommanderPlugin extends BaseCustomPlugin {
    selector = () => {
        if (!this.utils.getFilePath()) {
            return this.utils.nonExistSelector
        }
    }

    hint = isDisable => isDisable && "空白页不可使用此插件"

    hotkey = () => [this.config.hotkey]

    callback = anchorNode => {
        const cmd = this.config.tc_path + " " + this.config.tc_args;
        const shell = "cmd/bash";
        this.utils.callPluginFunction("commander", "silentExec", cmd, shell);
    }
}

module.exports = {
    plugin: openInTotalCommanderPlugin,
};