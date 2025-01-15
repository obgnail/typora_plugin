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
            const option = { type: "info", buttons: ["确定", "取消"], title: "preferences", detail: "配置将于重启 Typora 后生效，确认重启？", message: "设置成功" }
            const { response } = await this.utils.showMessageBox(option)
            if (response === 0) {
                this.utils.restartTypora()
            }
        }
    }

    call = async () => {
        const INFO = {
            blur: "此插件不兼容 Beta 版本的 Typora",
            export_enhance: "此插件不兼容 Beta 版本的 Typora",
            auto_number: "此插件可能与用户使用的主题冲突，导致小范围的样式异常",
            preferences: "「启停插件」自身也是一个插件，停用则无法弹出此窗口",
            right_click_menu: "此插件是普通用户调用其他插件的入口",
            custom: "所有的二级插件都挂载在此插件上，停用会导致所有的二级插件失效",
            json_rpc: "此插件面向开发者",
            reopenClosedFiles: "此插件依赖「标签页管理」插件",
            redirectLocalRootUrl: "此插件手动修改配置后才可运行",
            article_uploader: "此插件面向特殊人群，手动修改配置后才可运行",
        }
        const display = ([fixedName, plugin]) => ({
            label: `${plugin.NAME || plugin.name}（${fixedName}）`,
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
            { label: "为了保护用户，此处禁止启停部分插件，如需请 <a>修改配置文件</a>", type: "p", onclick },
            { label: "", legend: "一级插件", type: "checkbox", list: basePlugins },
            { label: "", legend: "二级插件", type: "checkbox", list: customPlugins },
        ]
        const modal = { title: "启停插件", width: "450px", components }
        const { response, submit: [_, _base, _custom] } = await this.utils.dialog.modalAsync(modal)
        if (response === 1) {
            await this.togglePlugin(_base, _custom)
        }
    }
}

module.exports = {
    plugin: preferencesPlugin
}
