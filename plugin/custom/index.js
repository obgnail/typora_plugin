class CustomPlugin extends global._basePlugin {
    beforeProcess = () => {
        this.custom = {};
        this.hotkeyHelper = new hotkeyHelper(this.custom);
        this.dynamicCallHelper = new dynamicCallHelper(this.custom);
        this.loadPluginHelper = new loadPluginHelper(this);
        this.loadPluginHelper.load();
    }
    hotkey = () => this.hotkeyHelper.hotkey()
    dynamicCallArgsGenerator = anchorNode => this.dynamicCallHelper.dynamicCallArgsGenerator(anchorNode)
    call = name => this.dynamicCallHelper.call(name)
}

class loadPluginHelper {
    constructor(controller) {
        this.controller = controller;
        this.utils = this.controller.utils;
    }

    updateUserSetting = allPlugins => {
        const toml = "./plugin/global/settings/custom_plugin.user.toml";
        if (this.utils.existInPluginPath(toml)) {
            const userSettings = this.utils.readToml(toml);
            allPlugins = this.utils.merge(allPlugins, userSettings);
        }
        return allPlugins
    }

    insertStyle = (fixed_name, style) => {
        if (!style) return;

        let textID = style["textID"];
        let text = style["text"];
        if (typeof style === "string") {
            textID = `custom-plugin-${fixed_name.replace(/_/g, "-")}-style`;
            text = style;
        }
        this.utils.insertStyle(textID, text);
    }

    load() {
        let allPlugins = this.utils.readToml("./plugin/global/settings/custom_plugin.default.toml");
        allPlugins = this.updateUserSetting(allPlugins);
        for (const fixed_name of Object.keys(allPlugins)) {
            const custom = allPlugins[fixed_name];
            custom.plugin = fixed_name;

            if (!custom.enable) continue

            try {
                const {plugin} = this.utils.requireFilePath(`./plugin/custom/plugins/${custom.plugin}`);
                if (!plugin) continue;

                const instance = new plugin(custom, this.controller);
                if (this.check(instance)) {
                    instance.init();
                    this.insertStyle(fixed_name, instance.style());
                    instance.html();
                    instance.process();
                    this.controller.custom[instance.name] = instance;
                    console.log(`custom plugin had been injected: [ ${plugin.name} ] `);
                } else {
                    console.error("instance is not BaseCustomPlugin", plugin.name);
                }
            } catch (e) {
                console.error("load custom plugin error:", e);
            }
        }

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
    constructor(custom) {
        this.custom = custom;
        this.dynamicUtil = {target: null};
    }

    dynamicCallArgsGenerator = anchorNode => {
        this.dynamicUtil.target = anchorNode;

        const dynamicCallArgs = [];
        for (const name of Object.keys(this.custom)) {
            const plugin = this.custom[name];
            if (!plugin) continue;

            try {
                const selector = plugin.selector();
                const arg_disabled = selector && !anchorNode.closest(selector);
                dynamicCallArgs.push({
                    arg_name: plugin.showName,
                    arg_value: plugin.name,
                    arg_disabled: arg_disabled,
                    arg_hint: (arg_disabled) ? "光标于此位置不可用" : plugin.hint(),
                })
            } catch (e) {
                dynamicCallArgs.push({
                    arg_name: plugin.showName,
                    arg_value: plugin.name,
                    arg_disabled: true,
                    arg_hint: "未知错误！请向开发者反馈"
                })
                console.error("plugin selector error:", name, e);
            }
        }
        return dynamicCallArgs;
    }

    call = name => {
        const plugin = this.custom[name];
        if (plugin) {
            try {
                const selector = plugin.selector();
                const target = (selector) ? this.dynamicUtil.target.closest(selector) : this.dynamicUtil.target;
                plugin.callback(target);
            } catch (e) {
                console.error("plugin callback error", plugin.name, e);
            }
        }
    }
}

class hotkeyHelper {
    constructor(custom) {
        this.custom = custom;
    }

    hotkey = () => {
        const hotkeys = [];
        for (const name of Object.keys(this.custom)) {
            const plugin = this.custom[name];
            if (!plugin) continue;

            try {
                const hotkey = plugin.hotkey();
                if (!hotkey) continue;

                hotkeys.push({
                    hotkey,
                    callback: function () {
                        const $anchorNode = File.editor.getJQueryElem(window.getSelection().anchorNode);
                        const anchorNode = $anchorNode && $anchorNode[0];
                        const selector = plugin.selector();
                        const target = (selector && anchorNode) ? anchorNode.closest(selector) : anchorNode;
                        plugin.callback(target);
                    }
                })
            } catch (e) {
                console.error("register hotkey error:", name, e);
            }
        }
        return hotkeys
    }
}

class BaseCustomPlugin {
    constructor(info, controller) {
        this.info = info;
        this.showName = info.name;
        this.name = info.plugin;
        this.fixedName = info.plugin;
        this.config = info.config;
        this.utils = controller.utils;
        this.controller = controller;
    }

    modal = (pluginModal, callback, cancelCallback) => this.utils.modal(pluginModal, callback, cancelCallback);

    init = () => {
    }
    selector = () => {
    }
    hint = () => {
    }
    style = () => {
    }
    html = () => {
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