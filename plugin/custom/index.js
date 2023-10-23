class CustomPlugin extends global._basePlugin {
    beforeProcess = async () => {
        this.custom = {};     // 启用的插件
        this.allCustom = {};  // 全部的插件
        this.hotkeyHelper = new hotkeyHelper(this);
        this.dynamicCallHelper = new dynamicCallHelper(this);
        this.loadPluginHelper = new loadPluginHelper(this);
        await this.loadPluginHelper.load();
    }
    hotkey = () => this.hotkeyHelper.hotkey()
    dynamicCallArgsGenerator = (anchorNode, meta) => this.dynamicCallHelper.dynamicCallArgsGenerator(anchorNode, meta)
    call = (fixedName, meta) => this.dynamicCallHelper.call(fixedName, meta)
}

class loadPluginHelper {
    constructor(controller) {
        this.controller = controller;
        this.utils = this.controller.utils;
    }

    insertStyle = (fixedName, style) => {
        if (!style) return;

        let textID = style["textID"];
        let text = style["text"];
        if (typeof style === "string") {
            textID = `custom-plugin-${fixedName.replace(/_/g, "-")}-style`;
            text = style;
        }
        this.utils.insertStyle(textID, text);
    }

    loadCustomPlugin = async (fixedName, customSetting) => {
        try {
            const {plugin} = this.utils.requireFilePath(`./plugin/custom/plugins/${fixedName}`);
            if (!plugin) return;

            const instance = new plugin(fixedName, customSetting, this.controller);
            if (!this.check(instance)) {
                console.error("instance is not BaseCustomPlugin", instance.fixedName);
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
            instance.html();
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

    // 兼容用户错误操作
    mergeSettings = settings => {
        if (this.controller.config.ALLOW_SET_CONFIG_IN_SETTINGS_TOML) {
            for (const plugin of Object.keys(global._all_plugins)) {
                if (plugin in settings) {
                    settings[plugin] = this.controller.utils.merge(settings[plugin], global._all_plugins[plugin]);
                }
            }
        }
        return settings
    }

    load = async () => {
        let settings = await this.utils.readSetting(
            "./plugin/global/settings/custom_plugin.default.toml",
            "./plugin/global/settings/custom_plugin.user.toml",
        )
        settings = this.mergeSettings(settings);
        this.controller.allCustom = settings;

        await Promise.all(
            Array.from(Object.keys(settings)).map(fixedName => {
                const customSetting = settings[fixedName];
                if (customSetting.enable) {
                    return this.loadCustomPlugin(fixedName, customSetting)
                } else {
                    console.debug(`disable custom plugin: [ ${fixedName} ]`)
                }
            })
        )

        this.utils.publishEvent(this.utils.eventType.allCustomPluginsHadInjected);
    }

    // 简易的判断是否为customBasePlugin的子类实例
    check = instance => {
        return !!instance
            & instance.init instanceof Function
            & instance.selector instanceof Function
            & instance.hint instanceof Function
            & instance.style instanceof Function
            & instance.html instanceof Function
            & instance.hotkey instanceof Function
            & instance.process instanceof Function
            & instance.callback instanceof Function
    }
}

class dynamicCallHelper {
    constructor(controller) {
        this.controller = controller;
        this.custom = controller.custom;
        this.utils = controller.utils;
    }

    dynamicCallArgsGenerator = (anchorNode, meta) => {
        meta.target = anchorNode;
        const dynamicCallArgs = [];

        for (const fixedName of Object.keys(this.controller.allCustom)) {
            const plugin = this.custom[fixedName];
            if (!plugin) continue;

            const callArg = {
                arg_name: plugin.showName,
                arg_value: plugin.fixedName,
                arg_disabled: true,
                arg_hint: "未知错误！请向开发者反馈",
            };
            try {
                const selector = plugin.selector();
                if (selector === this.utils.disableForeverSelector) {
                    callArg.arg_hint = "此插件不可点击";
                } else {
                    callArg.arg_disabled = selector && !anchorNode.closest(selector);
                    callArg.arg_hint = (callArg.arg_disabled) ? "光标于此位置不可用" : plugin.hint();
                }
            } catch (e) {
                console.error("plugin selector error:", fixedName, e);
            }
            dynamicCallArgs.push(callArg);
        }
        return dynamicCallArgs;
    }

    call = (fixedName, meta) => {
        const plugin = this.custom[fixedName];
        if (plugin) {
            try {
                const selector = plugin.selector();
                const target = (selector) ? meta.target.closest(selector) : meta.target;
                plugin.callback(target);
            } catch (e) {
                console.error("plugin callback error", plugin.fixedName, e);
            }
        }
    }
}

class hotkeyHelper {
    constructor(controller) {
        this.custom = controller.custom;
        this.utils = controller.utils;
    }

    hotkey = () => {
        const hotkeys = [];
        for (const fixedName of Object.keys(this.custom)) {
            const plugin = this.custom[fixedName];
            if (!plugin) continue;

            try {
                const hotkey = plugin.hotkey();
                if (!hotkey) continue;

                hotkeys.push({
                    hotkey,
                    callback: () => {
                        const $anchorNode = this.utils.getAnchorNode();
                        const anchorNode = $anchorNode && $anchorNode[0];
                        const selector = plugin.selector();
                        const target = (selector && anchorNode) ? anchorNode.closest(selector) : anchorNode;
                        plugin.callback(target);
                    }
                })
            } catch (e) {
                console.error("register hotkey error:", fixedName, e);
            }
        }
        return hotkeys
    }
}

class BaseCustomPlugin {
    constructor(fixedName, setting, controller) {
        this.fixedName = fixedName;
        this.info = setting;
        this.showName = setting.name;
        this.config = setting.config;
        this.utils = controller.utils;
        this.controller = controller;
    }

    modal = (pluginModal, callback, cancelCallback) => this.utils.modal(pluginModal, callback, cancelCallback);

    beforeProcess = async () => {
    }
    init = () => {
    }
    selector = () => {
    }
    hint = () => {
    }
    style = () => {
    }
    styleTemplate = () => {
    }
    html = () => {
    }
    htmlTemplate = () => {
    }
    hotkey = () => {
    }
    process = () => {
    }
    callback = anchorNode => {
    }
}

global.BaseCustomPlugin = BaseCustomPlugin;

module.exports = {
    plugin: CustomPlugin
};