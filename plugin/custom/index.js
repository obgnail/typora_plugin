class CustomPlugin extends BasePlugin {
    beforeProcess = async () => {
        this.plugins = {};          // 启用的插件
        this.pluginsSettings = {};  // 全部的插件配置
        await new customPluginLoader(this).process();
    }

    hotkey = () => {
        const isString = s => typeof s === "string"
        const hotkeys = [];
        for (const [fixedName, plugin] of Object.entries(this.plugins)) {
            if (!plugin || !plugin.hasOwnProperty("hotkey")) continue;
            try {
                const hotkey = plugin.hotkey();
                if (isString(hotkey) || (Array.isArray(hotkey) && hotkey.every(isString))) {
                    hotkeys.push({ hotkey, callback: plugin.callback });
                } else if (Array.isArray(hotkey) && hotkey.every(this.utils.isObject)) {
                    hotkeys.push(...hotkey);
                }
            } catch (e) {
                console.error("register hotkey error:", fixedName, e);
            }
        }
        return hotkeys
    }

    getDynamicActions = (anchorNode, meta, notInContextMenu) => {
        const settings = Object.entries(this.pluginsSettings)
            .sort(([, { order: o1 = 1 }], [, { order: o2 = 1 }]) => o1 - o2)

        meta.target = anchorNode
        const dynamicActions = []
        for (const [fixedName, setting] of settings) {
            if (!notInContextMenu && setting.hide) continue

            const plugin = this.plugins[fixedName]
            if (!plugin) continue

            const act = {
                act_name: plugin.config.name,
                act_value: plugin.fixedName,
                act_disabled: true,
                act_hidden: false,
                act_hint: "未知错误！请向开发者反馈",
                act_hotkey: plugin.config.hotkey,
            }
            try {
                const selector = plugin.selector(false)
                if (selector === this.utils.disableForeverSelector) {
                    act.act_hint = "此插件不可点击"
                } else {
                    act.act_disabled = selector && !anchorNode.closest(selector)
                    act.act_hint = plugin.hint(act.act_disabled)
                    if (act.act_disabled) {
                        act.act_hint = act.act_hint || "光标于此位置不可用"
                    }
                }
            } catch (e) {
                console.error("plugin selector error:", fixedName, e)
            }

            if (this.config.HIDE_DISABLE_PLUGINS && act.act_disabled) continue

            dynamicActions.push(act)
        }
        return dynamicActions
    }

    call = (fixedName, meta) => {
        const plugin = this.plugins[fixedName];
        if (!plugin) return;
        try {
            const selector = plugin.selector(true);
            const target = selector ? meta.target.closest(selector) : meta.target;
            plugin.callback(target);
        } catch (e) {
            console.error("plugin callback error", plugin.fixedName, e);
        }
    }
}

class customPluginLoader {
    constructor(plugin) {
        this.controller = plugin
        this.utils = plugin.utils
        this.config = plugin.config
    }

    loadCustomPlugins = async settings => {
        const { enable, disable, stop, error, nosetting } = await global.LoadPlugins(settings, true)
        this.controller.plugins = enable
    }

    checkErrorSetting = customSettings => {
        const allSettings = this.utils.getAllPluginSettings()
        const errorPluginSetting = Object.keys(customSettings).filter(fixedName => allSettings.hasOwnProperty(fixedName))
        if (errorPluginSetting && errorPluginSetting.length) {
            const label = "以下插件的配置写错文件了。一级插件应该写在 settings.user.toml 中，二级插件应该写在 custom_plugin.user.toml 中"
            const rows = Math.max(errorPluginSetting.length, 3)
            const components = [{ label, rows, type: "textarea", content: errorPluginSetting.join("\n") }]
            this.utils.dialog.modal({ title: "配置错误", components }, () => this.utils.runtime.openSettingFolder())
        }
    }

    fixCallback = async () => {
        for (const plugin of Object.values(this.controller.plugins)) {
            if (!plugin || !plugin.hasOwnProperty("callback") || !plugin.hasOwnProperty("selector")) continue
            const originCallback = plugin.callback
            plugin.callback = anchorNode => {
                if (!anchorNode) {
                    const $anchor = this.utils.getAnchorNode()
                    const anchor = $anchor && $anchor[0]
                    const selector = plugin.selector(true)
                    anchorNode = (selector && anchor) ? anchor.closest(selector) : anchor
                }
                originCallback(anchorNode)
            }
        }
    }

    process = async () => {
        const settings = await this.utils.runtime.readCustomPluginSetting()
        this.checkErrorSetting(settings)
        this.controller.pluginsSettings = settings
        await this.loadCustomPlugins(settings)
        await this.fixCallback()
        this.utils.eventHub.publishEvent(this.utils.eventHub.eventType.allCustomPluginsHadInjected)
    }
}

module.exports = {
    plugin: CustomPlugin
}