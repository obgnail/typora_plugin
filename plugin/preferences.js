class preferencesPlugin extends BasePlugin {
    hotkey = () => [{ hotkey: this.config.HOTKEY, callback: this.call }]

    getSettings = async () => {
        const settings = await this.utils.readSetting("settings.default.toml", "settings.user.toml");
        const customSettings = await this.utils.readSetting("custom_plugin.default.toml", "custom_plugin.user.toml");
        delete settings.global;
        return [settings, customSettings]
    }

    togglePlugin = async (enablePlugins, enableCustomPlugins, showModal = false) => {
        const [settings, customSettings] = await this.getSettings();

        const pluginState = {};
        const customPluginState = {};
        Object.keys(settings).forEach(fixedName => (pluginState[fixedName] = { ENABLE: enablePlugins.includes(fixedName) }))
        Object.keys(customSettings).forEach(fixedName => (customPluginState[fixedName] = { enable: enableCustomPlugins.includes(fixedName) }))

        // check need update file
        const settingsHasUpdate = Object.entries(settings).some(([name, plugin]) => plugin.ENABLE !== pluginState[name].ENABLE);
        const customSettingsHasUpdate = Object.entries(customSettings).some(([name, plugin]) => plugin.enable !== customPluginState[name].enable);
        if (!settingsHasUpdate && !customSettingsHasUpdate) return;

        const files = [
            { file: "settings.user.toml", mergeObj: pluginState },
            { file: "custom_plugin.user.toml", mergeObj: customPluginState },
        ]
        for (const { file, mergeObj } of files) {
            const settingPath = await this.utils.getActualSettingPath(file);
            const settingObj = await this.utils.readToml(settingPath);
            const newSetting = this.utils.merge(settingObj, mergeObj);
            const newContent = this.utils.stringifyToml(newSetting);
            const ok = await this.utils.writeFile(settingPath, newContent);
            if (!ok) return;
        }

        if (showModal) {
            const option = { type: "info", buttons: ["确定", "取消"], title: "preferences", detail: "配置将于重启 Typora 后生效，确认重启？", message: "设置成功" }
            const { response } = await this.utils.showMessageBox(option);
            if (response === 0) {
                this.utils.restartTypora();
            }
        }
    }

    openSettingFile = async () => this.utils.showInFinder(await this.utils.getActualSettingPath("settings.user.toml"));

    call = async () => {
        const infoMap = {
            blur: "此插件不兼容 Beta 版本的 Typora",
            export_enhance: "此插件不兼容 Beta 版本的 Typora",
            auto_number: "此插件可能与用户使用的主题冲突，导致小范围的样式异常",
            preferences: "「启停插件」自身也是一个插件，停用则无法弹出此窗口",
            right_click_menu: "此插件是普通用户调用其他插件的入口",
            custom: "所有的二级插件都挂载在此插件上，停用会导致所有的二级插件失效",
            json_rpc: "此插件面向开发者，普通用户无需启用",
            ripgrep: "此插件需要您了解 ripgrep 工具",
            test: "插件开发者专用，仅建议在开发插件期间启用",
            reopenClosedFiles: "此插件依赖「标签页管理」插件",
            openInTotalCommander: "此插件需要手动修改配置后方可运行",
            redirectLocalRootUrl: "此插件需要手动修改配置后方可运行",
            autoTrailingWhiteSpace: "此插件面向特殊人群（如网站站长），不建议普通用户启用",
            article_uploader: "此插件面向特殊人群（如网站站长），且需要手动修改配置后方可运行",
        }
        const displayFunc = ([fixedName, plugin]) => ({
            label: `${plugin.NAME || plugin.name}（${fixedName}）`,
            info: infoMap[fixedName],
            value: fixedName,
            checked: plugin.ENABLE || plugin.enable,
            disabled: this.config.IGNORE_PLUGINS.includes(fixedName),
        })
        const onclick = ev => ev.target.closest("a") && this.openSettingFile();
        const [settings, customSettings] = await this.getSettings();
        const plugins = Object.entries(settings).map(displayFunc);
        const customPlugins = Object.entries(customSettings).map(displayFunc);
        const components = [
            { label: "为保护用户，此处禁止启停部分插件，如需请 <a>修改配置文件</a>", type: "p", onclick },
            { label: "", legend: "一级插件", type: "checkbox", list: plugins },
            { label: "", legend: "二级插件", type: "checkbox", list: customPlugins },
        ];
        const { response, submit: [_, p1, p2] } = await this.utils.dialog.modalAsync({ title: "启停插件", width: "450px", components });
        if (response === 1) {
            await this.togglePlugin(p1, p2, true);
        }
    }
}

module.exports = {
    plugin: preferencesPlugin
};
