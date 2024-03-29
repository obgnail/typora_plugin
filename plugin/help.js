class helpPlugin extends BasePlugin {
    beforeProcess = async () => {
        const filepath = this.utils.joinPath("./plugin/updater/version.json");
        try {
            const versionMsg = await this.utils.Package.FsExtra.readJson(filepath);
            this.version = versionMsg.tag_name;
        } catch (err) {
        }
    }

    process = () => {
        const arg_hint = "此功能仅对开发者开放";
        this.callArgs = [
            {arg_name: "修改配置", arg_value: "open_setting_folder"},
            {arg_name: "备份配置文件", arg_value: "backup_setting_file"},
            {arg_name: "修改插件样式", arg_value: "set_user_styles", arg_hint},
            {arg_name: "我要写插件", arg_value: "new_custom_plugin", arg_hint},
            {arg_name: "Typora自动化", arg_value: "json_rpc", arg_hint},
            {arg_name: "Github图床", arg_value: "github_picture_bed"},
            {arg_name: "反馈 - Github", arg_value: "new_issue"},
            {arg_name: "反馈 - Email", arg_value: "send_email"},
            {arg_name: "关于", arg_value: "about", arg_hint: "Designed with ♥ by obgnail"},
        ]

        this.utils.addEventListener(this.utils.eventType.allPluginsHadInjected, () => {
            this.updater = this.utils.getCustomPlugin("pluginUpdater");
            if (!this.updater) return;
            const arg_name = "升级插件" + (this.version ? `（当前版本：${this.version}）` : "");
            this.callArgs.unshift({arg_name: arg_name, arg_value: "update_plugin"});
        })
    }

    call = type => {
        const map = {
            open_setting_folder: () => this.utils.openSettingFolder(),
            backup_setting_file: () => this.utils.backupSettingFile(),
            set_user_styles: () => this.utils.openFile(this.utils.joinPath("./plugin/global/user_styles/请读我.md")),
            new_custom_plugin: () => this.utils.openFile(this.utils.joinPath("./plugin/custom/请读我.md")),
            json_rpc: () => this.utils.openFile(this.utils.joinPath("./plugin/json_rpc/请读我.md")),
            github_picture_bed: () => this.utils.openUrl("https://github.com/obgnail/typora_image_uploader"),
            new_issue: () => this.utils.openUrl("https://github.com/obgnail/typora_plugin/issues/new"),
            send_email: () => this.utils.sendEmail("he1251698542@gmail.com", "插件反馈"),
            update_plugin: () => this.updater && this.updater.callback(),
            about: () => this.utils.openUrl("https://github.com/obgnail/typora_plugin"),
        }
        const func = map[type];
        func && func();
    }
}

module.exports = {
    plugin: helpPlugin,
};