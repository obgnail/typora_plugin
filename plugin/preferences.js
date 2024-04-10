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
            this.utils.modal({title: "设置成功", components: [{label: "配置于重启 Typora 后生效", type: "p"}]}, console.debug);
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
            {label: "🛡️ 为保护用户，此处不允许启停部分插件，如需请前往配置文件", type: "p"},
            {label: "", legend: "一级插件", type: "checkbox", list: plugins},
            {label: "❌ 若停用一级插件「自定义插件」，所有二级插件都将停用", type: "p"},
            {label: "", legend: "二级插件", type: "checkbox", list: customPlugins},
        ];
        const modal = {title: "启停插件", components};
        this.utils.modal(modal, async ([_1, {submit: enablePlugins}, _2, {submit: enableCustomPlugins}]) => {
            await this.togglePlugin(enablePlugins, enableCustomPlugins, true);
        });
    }
}


module.exports = {
    plugin: preferencesPlugin
};
