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

    dynamicCallArgsGenerator = (anchorNode, meta, notInContextMenu) => {
        const settings = Object.entries(this.pluginsSettings);
        settings.sort(([, { order: o1 = 1 }], [, { order: o2 = 1 }]) => o1 - o2);

        meta.target = anchorNode;
        const dynamicCallArgs = [];
        for (const [fixedName, setting] of settings) {
            if (!notInContextMenu && setting.hide) continue;

            const plugin = this.plugins[fixedName];
            if (!plugin) continue;

            const arg = {
                arg_name: plugin.config.name,
                arg_value: plugin.fixedName,
                arg_disabled: true,
                arg_hint: "未知错误！请向开发者反馈",
                arg_hotkey: plugin.config.hotkey,
            };
            try {
                const selector = plugin.selector(false);
                if (selector === this.utils.disableForeverSelector) {
                    arg.arg_hint = "此插件不可点击";
                } else {
                    arg.arg_disabled = selector && !anchorNode.closest(selector);
                    arg.arg_hint = plugin.hint(arg.arg_disabled);
                    if (arg.arg_disabled) {
                        arg.arg_hint = arg.arg_hint || "光标于此位置不可用";
                    }
                }
            } catch (e) {
                console.error("plugin selector error:", fixedName, e);
            }

            if (this.config.HIDE_DISABLE_PLUGINS && arg.arg_disabled) continue;

            dynamicCallArgs.push(arg);
        }
        return dynamicCallArgs;
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
        this.controller = plugin;
        this.utils = plugin.utils;
        this.config = plugin.config;
    }

    loadCustomPlugins = async settings => {
        const { enable, disable, stop, error, nosetting } = await global.LoadPlugins(settings, true);
        this.controller.plugins = enable;
    }

    // 检测用户错误的配置
    errorSettingDetector = customSettings => {
        const allSettings = this.utils.getAllPluginSettings();
        const errorPluginSetting = Object.keys(customSettings).filter(fixedName => allSettings.hasOwnProperty(fixedName));
        if (errorPluginSetting && errorPluginSetting.length) {
            const msg = "以下插件的配置写错文件了，一级插件应该写在 settings.user.toml 中，二级插件应该写在 custom_plugin.user.toml 中";
            const components = [msg, ...errorPluginSetting].map(label => ({ label, type: "p" }));
            const openSettingFile = () => this.utils.showInFinder(this.utils.getOriginSettingPath("settings.user.toml"));
            this.utils.dialog.modal({ title: "配置错误", components }, openSettingFile, openSettingFile);
        }
    }

    // 兼容用户错误操作
    mergeSettings = customSettings => {
        if (!this.config.ALLOW_SET_CONFIG_IN_SETTINGS_TOML) return;

        const allSettings = this.utils.getAllPluginSettings();
        for (const [fixedName, settings_] of Object.entries(allSettings)) {
            if (customSettings.hasOwnProperty(fixedName)) {
                customSettings[fixedName] = this.utils.merge(customSettings[fixedName], settings_);
                delete allSettings[fixedName];
            }
        }
    }

    decorateCallback = async () => {
        for (const plugin of Object.values(this.controller.plugins)) {
            if (!plugin || !plugin.hasOwnProperty("callback") || !plugin.hasOwnProperty("selector")) continue;
            const { callback: originCallback } = plugin;
            plugin.callback = anchorNode => {
                if (!anchorNode) {
                    const $anchor = this.utils.getAnchorNode();
                    const anchor = $anchor && $anchor[0];
                    const selector = plugin.selector(true);
                    anchorNode = (selector && anchor) ? anchor.closest(selector) : anchor;
                }
                originCallback(anchorNode);
            }
        }
    }

    process = async () => {
        const settings = await this.utils.readCustomPluginSetting();
        this.mergeSettings(settings);
        this.errorSettingDetector(settings);
        this.controller.pluginsSettings = settings;
        await this.loadCustomPlugins(settings);
        await this.decorateCallback();
        this.utils.eventHub.publishEvent(this.utils.eventHub.eventType.allCustomPluginsHadInjected);
    }
}

module.exports = {
    plugin: CustomPlugin
};