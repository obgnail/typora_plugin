class helpPlugin extends BasePlugin {
    beforeProcess = () => {
        this.callArgs = [
            {arg_name: "打开配置文件", arg_value: "open_setting_folder"},
            {arg_name: "提出需求/报告缺陷", arg_value: "new_issue"},
            {arg_name: "关于", arg_value: "about"},
        ]
        this.utils.addEventListener(this.utils.eventType.allPluginsHadInjected, () => {
            this.updater = this.utils.getCustomPlugin("pluginUpdater");
            this.updater && this.callArgs.unshift({arg_name: "检查更新", arg_value: "update_plugin"});
        })
    }

    call = type => {
        const map = {
            about: () => this.utils.openUrl("https://github.com/obgnail/typora_plugin"),
            new_issue: () => this.utils.openUrl("https://github.com/obgnail/typora_plugin/issues/new"),
            open_setting_folder: () => this.utils.showInFinder(this.utils.joinPath("./plugin/global/settings/settings.user.toml")),
            update_plugin: () => this.updater.callback(),
        }
        const func = map[type];
        func && func();
    }
}

module.exports = {
    plugin: helpPlugin,
};