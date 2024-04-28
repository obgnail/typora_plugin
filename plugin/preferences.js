class preferencesPlugin extends BasePlugin {
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
        Object.keys(settings).forEach(fixedName => (pluginState[fixedName] = {ENABLE: enablePlugins.includes(fixedName)}))
        Object.keys(customSettings).forEach(fixedName => (customPluginState[fixedName] = {enable: enableCustomPlugins.includes(fixedName)}))

        // check need update file
        const settingsHasUpdate = Object.entries(settings).some(([name, plugin]) => plugin.ENABLE !== pluginState[name].ENABLE);
        const customSettingsHasUpdate = Object.entries(customSettings).some(([name, plugin]) => plugin.enable !== customPluginState[name].enable);
        if (!settingsHasUpdate && !customSettingsHasUpdate) return;

        for (const file of ["settings.user.toml", "custom_plugin.user.toml"]) {
            const settingPath = await this.utils.getActualSettingPath(file);
            const tomlObj = await this.utils.readToml(settingPath);
            const mergeObj = file === "settings.user.toml" ? pluginState : customPluginState;
            const newSetting = this.utils.merge(tomlObj, mergeObj);
            const newContent = this.utils.stringifyToml(newSetting);
            await this.utils.Package.Fs.promises.writeFile(settingPath, newContent);
        }

        if (showModal) {
            const {response} = await this.utils.showMessageBox({
                type: "info",
                buttons: ["确定", "取消"],
                title: "preferences",
                detail: "配置将于重启 Typora 后生效，确认重启？",
                message: "设置成功",
            });
            if (response === 0) {
                this.utils.restartTypora();
            }
        }
    }

    call = async () => {
        const displayFunc = ([fixedName, plugin]) => ({
            label: `${plugin.NAME || plugin.name}（${fixedName}）`,
            value: fixedName,
            checked: plugin.ENABLE || plugin.enable,
            disabled: this.config.IGNORE_PLUGINS.includes(fixedName),
        })
        const [settings, customSettings] = await this.getSettings();
        const plugins = Object.entries(settings).map(displayFunc);
        const customPlugins = Object.entries(customSettings).map(displayFunc);
        const components = [
            {label: "🛡️ 为保护用户，部分插件无法在此处启停，如需请修改配置文件", type: "p"},
            {label: "", legend: "一级插件", type: "checkbox", list: plugins},
            {label: "", legend: "二级插件", type: "checkbox", list: customPlugins},
        ];
        const modal = {title: "启停插件", components};
        this.utils.modal(modal, async ([_, {submit: enablePlugins}, {submit: enableCustomPlugins}]) => {
            await this.togglePlugin(enablePlugins, enableCustomPlugins, true);
        });
    }
}


module.exports = {
    plugin: preferencesPlugin
};
