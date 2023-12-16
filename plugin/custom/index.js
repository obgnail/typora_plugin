class CustomPlugin extends BasePlugin {
    beforeProcess = async () => {
        this.custom = {};          // 启用的插件
        this.customSettings = {};  // 全部的插件配置
        await new loadPluginHelper(this).process();
    }

    hotkey = () => {
        const hotkeys = [];
        for (const [fixedName, plugin] of Object.entries(this.custom)) {
            if (!plugin) continue;
            try {
                const hotkey = plugin.hotkey();
                if (!hotkey) continue;

                const callback = () => {
                    const $anchorNode = this.utils.getAnchorNode();
                    const anchorNode = $anchorNode && $anchorNode[0];
                    const selector = plugin.selector();
                    const target = (selector && anchorNode) ? anchorNode.closest(selector) : anchorNode;
                    plugin.callback(target);
                }
                hotkeys.push({hotkey, callback});
            } catch (e) {
                console.error("register hotkey error:", fixedName, e);
            }
        }
        return hotkeys
    }

    dynamicCallArgsGenerator = (anchorNode, meta, notInContextMenu) => {
        const settings = Object.entries(this.customSettings);
        settings.sort(([, {order: o1 = 1}], [, {order: o2 = 1}]) => o1 - o2);

        meta.target = anchorNode;
        const dynamicCallArgs = [];
        for (const [fixedName, setting] of settings) {
            if (!notInContextMenu && setting.hide) continue;

            const plugin = this.custom[fixedName];
            if (!plugin) continue;

            const arg = {
                arg_name: plugin.showName,
                arg_value: plugin.fixedName,
                arg_disabled: true,
                arg_hint: "未知错误！请向开发者反馈",
            };
            try {
                const selector = plugin.selector();
                if (selector === this.utils.disableForeverSelector) {
                    arg.arg_hint = "此插件不可点击";
                } else {
                    arg.arg_disabled = selector && !anchorNode.closest(selector);
                    arg.arg_hint = arg.arg_disabled ? "光标于此位置不可用" : plugin.hint();
                }
            } catch (e) {
                console.error("plugin selector error:", fixedName, e);
            }
            dynamicCallArgs.push(arg);
        }
        return dynamicCallArgs;
    }

    call = (fixedName, meta) => {
        const plugin = this.custom[fixedName];
        if (!plugin) return;
        try {
            const selector = plugin.selector();
            const target = selector ? meta.target.closest(selector) : meta.target;
            plugin.callback(target);
        } catch (e) {
            console.error("plugin callback error", plugin.fixedName, e);
        }
    }
}

class loadPluginHelper {
    constructor(controller) {
        this.controller = controller;
        this.utils = controller.utils;
        this.config = controller.config;
    }

    insertStyle = (fixedName, style) => {
        if (style) {
            const {textID, text} = typeof style !== "string"
                ? style
                : {textID: `custom-plugin-${fixedName.replace(/_/g, "-")}-style`, text: style}
            this.utils.insertStyle(textID, text);
        }
    }

    loadCustomPlugin = async fixedName => {
        const customSetting = this.controller.customSettings[fixedName];
        if (!customSetting || !customSetting.enable || this.config.DISABLE_CUSTOM_PLUGINS.indexOf(fixedName) !== -1) {
            console.debug(`disable custom plugin: [ ${fixedName} ]`);
            return;
        }
        try {
            const {plugin} = this.utils.requireFilePath(`./plugin/custom/plugins`, fixedName);
            if (!plugin) return;

            const instance = new plugin(fixedName, customSetting, this.controller);
            if (!(instance instanceof BaseCustomPlugin)) {
                console.error("instance is not instanceof BaseCustomPlugin:", fixedName);
                return
            }
            const error = await instance.beforeProcess();
            if (error === this.utils.stopLoadPluginError) return
            instance.init();
            this.insertStyle(instance.fixedName, instance.style());
            const renderArgs = instance.styleTemplate();
            if (renderArgs) {
                await this.utils.registerStyleTemplate(instance.fixedName, {...renderArgs, this: instance});
            }
            this.utils.insertElement(instance.html());
            const elements = instance.htmlTemplate();
            if (elements) {
                this.utils.insertHtmlTemplate(elements);
            }
            instance.process();
            this.controller.custom[instance.fixedName] = instance;
            console.debug(`custom plugin had been injected: [ ${instance.fixedName} ]`);
        } catch (e) {
            console.error("load custom plugin error:", e);
        }
    }

    // 检测用户错误的配置
    errorSettingDetector = customSettings => {
        const allSettings = this.utils.getAllPluginSettings();
        const errorPluginSetting = Object.keys(customSettings).filter(fixedName => allSettings.hasOwnProperty(fixedName));
        if (errorPluginSetting && errorPluginSetting.length) {
            const msg = "以下插件错误地配置到 custom_plugin.user.toml，正确配置文件为 settings.user.toml：";
            const components = [msg, ...errorPluginSetting].map(label => ({label, type: "p"}));
            const openSettingFile = () => this.utils.showInFinder(this.utils.joinPath("./plugin/global/settings/settings.user.toml"));
            this.utils.modal({title: "配置错误", components}, openSettingFile, openSettingFile);
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

    process = async () => {
        const settings = await this.utils.readSetting("custom_plugin.default.toml", "custom_plugin.user.toml");
        this.mergeSettings(settings);
        this.errorSettingDetector(settings);
        this.controller.customSettings = settings;
        await Promise.all(Object.keys(settings).map(this.loadCustomPlugin));
        this.utils.publishEvent(this.utils.eventType.allCustomPluginsHadInjected);
    }
}

module.exports = {
    plugin: CustomPlugin
};