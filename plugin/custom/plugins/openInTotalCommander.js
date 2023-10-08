class openInTotalCommander extends BaseCustomPlugin {
    selector = () => {
        if (!this.utils.getFilePath()) {
            return this.utils.nonExistSelector
        }
    }

    hotkey = () => [this.config.hotkey]

    callback = anchorNode => {
        const commander = this.utils.getPlugin("commander");
        if (commander) {
            const cmd = this.config.tc_path + " " + this.config.tc_args;
            commander.silentExec(cmd, "cmd/bash");
        }
    }
}

module.exports = {
    plugin: openInTotalCommander,
};