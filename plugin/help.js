class helpPlugin extends BasePlugin {
    beforeProcess = () => {
        this.callArgs = [
            {arg_name: "打开配置文件", arg_value: "open_setting_folder"},
            {arg_name: "反馈 - github", arg_value: "new_issue"},
            {arg_name: "反馈 - email", arg_value: "send_email"},
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
            send_email: () => this.utils.sendEmail("he1251698542@gmail.com", "插件反馈"),
        }
        const func = map[type];
        func && func();
    }
}

module.exports = {
    plugin: helpPlugin,
};