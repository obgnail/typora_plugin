class preferencesPlugin extends BasePlugin {
    getSettings = async () => {
        const settings = await this.utils.readSetting("settings.default.toml", "settings.user.toml");
        const customSettings = await this.utils.readSetting("custom_plugin.default.toml", "custom_plugin.user.toml");
        delete settings.global;
        return [settings, customSettings]
    }

    togglePlugin = async (enablePlugins, enableCustomPlugins) => {
        const [settings, customSettings] = await this.getSettings();

        const pluginState = {};
        const customPluginState = {};
        Object.keys(settings).forEach(fixedName => (pluginState[fixedName] = {ENABLE: enablePlugins.includes(fixedName)}))
        Object.keys(customSettings).forEach(fixedName => (customPluginState[fixedName] = {enable: enableCustomPlugins.includes(fixedName)}))

        for (const file of ["settings.user.toml", "custom_plugin.user.toml"]) {
            const settingPath = await this.utils.getActualSettingPath(file);
            const tomlObj = await this.utils.readToml(settingPath);
            const mergeObj = file === "settings.user.toml" ? pluginState : customPluginState;
            const newSetting = this.utils.merge(tomlObj, mergeObj);
            const newContent = this.utils.stringifyToml(newSetting);
            await this.utils.Package.Fs.promises.writeFile(settingPath, newContent);
        }
    }

    call = () => {
        const displayFunc = ([fixedName, plugin]) => ({
            label: `${plugin.NAME || plugin.name}（${fixedName}）`,
            value: fixedName,
            checked: plugin.ENABLE || plugin.enable,
            disabled: this.config.IGNORE_PLUGINS.includes(fixedName),
        })
        const plugins = Object.entries(this.utils.getAllPluginSettings()).map(displayFunc);
        const customPlugins = Object.entries(this.utils.getAllCustomPluginSettings()).map(displayFunc);
        const components = [
            {label: "", legend: "一级插件", type: "checkbox", list: plugins},
            {label: "", legend: "自定义插件", type: "checkbox", list: customPlugins},
        ];
        const modal = {title: "启停插件", components};
        this.utils.modal(modal, async ([{submit: enablePlugins}, {submit: enableCustomPlugins}]) => {
            await this.togglePlugin(enablePlugins, enableCustomPlugins);
            this.utils.modal({title: "设置成功", components: [{label: "请重启 Typora", type: "p"}]}, console.debug);
        });
    }
}


module.exports = {
    plugin: preferencesPlugin
};
