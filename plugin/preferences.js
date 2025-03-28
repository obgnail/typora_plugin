class preferencesPlugin extends BasePlugin {
    hotkey = () => [{ hotkey: this.config.HOTKEY, callback: this.call }]

    getSettings = async () => {
        const [base, custom] = await Promise.all([this.utils.runtime.readBasePluginSetting(), this.utils.runtime.readCustomPluginSetting()])
        delete base.global
        return [base, custom]
    }

    togglePlugin = async (enableBasePlugins, enableCustomPlugins) => {
        const updateSetting = async (file, setting, enablePlugins, enableKey) => {
            const newState = Object.keys(setting).reduce((acc, fixedName) => {
                acc[fixedName] = { [enableKey]: enablePlugins.includes(fixedName) }
                return acc
            }, {})
            const needUpdate = Object.entries(setting).some(([name, plugin]) => plugin[enableKey] !== newState[name][enableKey])
            if (needUpdate) {
                const settingPath = await this.utils.runtime.getActualSettingPath(file)
                const settingObj = await this.utils.readTomlFile(settingPath)
                const mergedSetting = this.utils.merge(settingObj, newState)
                const newContent = this.utils.stringifyToml(mergedSetting)
                return this.utils.writeFile(settingPath, newContent)
            }
        }

        const [base, custom] = await this.getSettings()
        const baseUpdated = await updateSetting("settings.user.toml", base, enableBasePlugins, "ENABLE")
        const customUpdated = await updateSetting("custom_plugin.user.toml", custom, enableCustomPlugins, "enable")
        if (baseUpdated || customUpdated) {
            await this.utils.showRestartMessageBox({ title: this.pluginName })
        }
    }

    call = async () => {
        const p = ["blur", "export_enhance", "preferences", "right_click_menu", "custom", "json_rpc", "reopenClosedFiles", "redirectLocalRootUrl", "article_uploader"]
        const INFO = this.i18n.entries(p, "info.")
        const labelEditConfig = this.i18n.t("editConfigFile") + " " + '<a class="fa fa-external-link"></a>'
        const legendBasePlugin = this.i18n.t("basePlugin")
        const legendCustomPlugin = this.i18n.t("customPlugin")

        const display = ([fixedName, plugin]) => ({
            label: `${plugin.NAME || plugin.name || this.i18n._t(fixedName, "pluginName")}（${fixedName}）`,
            info: INFO[fixedName],
            value: fixedName,
            checked: plugin.ENABLE || plugin.enable,
            disabled: this.config.IGNORE_PLUGINS.includes(fixedName),
        })
        const [base, custom] = await this.getSettings()
        const basePlugins = Object.entries(base).map(display)
        const customPlugins = Object.entries(custom).map(display)
        const onclick = ev => ev.target.closest("a") && this.utils.runtime.openSettingFolder()
        const components = [
            { label: labelEditConfig, type: "p", onclick },
            { label: "", legend: legendBasePlugin, type: "checkbox", list: basePlugins },
            { label: "", legend: legendCustomPlugin, type: "checkbox", list: customPlugins },
        ]
        const modal = { title: this.pluginName, width: "450px", components }
        const { response, submit: [_, _base, _custom] } = await this.utils.dialog.modalAsync(modal)
        if (response === 1) {
            await this.togglePlugin(_base, _custom)
        }
    }
}

module.exports = {
    plugin: preferencesPlugin
}
