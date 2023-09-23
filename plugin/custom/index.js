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
    call = fixedName => this.dynamicCallHelper.call(fixedName)
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

    load() {
        const allPlugins = this.utils.readSetting(
            "./plugin/global/settings/custom_plugin.default.toml",
            "./plugin/global/settings/custom_plugin.user.toml",
        )

        for (const fixedName of Object.keys(allPlugins)) {
            const customSetting = allPlugins[fixedName];

            if (!customSetting.enable) continue

            try {
                const {plugin} = this.utils.requireFilePath(`./plugin/custom/plugins/${fixedName}`);
                if (!plugin) continue;

                const instance = new plugin(fixedName, customSetting, this.controller);
                if (this.check(instance)) {
                    instance.init();
                    this.insertStyle(instance.fixedName, instance.style());
                    instance.html();
                    instance.process();
                    this.controller.custom[instance.fixedName] = instance;
                    console.log(`custom plugin had been injected: [ ${instance.fixedName} ] `);
                } else {
                    console.error("instance is not BaseCustomPlugin", instance.fixedName);
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
        for (const fixedName of Object.keys(this.custom)) {
            const plugin = this.custom[fixedName];
            if (!plugin) continue;

            try {
                const selector = plugin.selector();
                const arg_disabled = selector && !anchorNode.closest(selector);
                dynamicCallArgs.push({
                    arg_name: plugin.showName,
                    arg_value: plugin.fixedName,
                    arg_disabled: arg_disabled,
                    arg_hint: (arg_disabled) ? "光标于此位置不可用" : plugin.hint(),
                })
            } catch (e) {
                dynamicCallArgs.push({
                    arg_name: plugin.showName,
                    arg_value: plugin.fixedName,
                    arg_disabled: true,
                    arg_hint: "未知错误！请向开发者反馈"
                })
                console.error("plugin selector error:", fixedName, e);
            }
        }
        return dynamicCallArgs;
    }

    call = fixedName => {
        const plugin = this.custom[fixedName];
        if (plugin) {
            try {
                const selector = plugin.selector();
                const target = (selector) ? this.dynamicUtil.target.closest(selector) : this.dynamicUtil.target;
                plugin.callback(target);
            } catch (e) {
                console.error("plugin callback error", plugin.fixedName, e);
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
        for (const fixedName of Object.keys(this.custom)) {
            const plugin = this.custom[fixedName];
            if (!plugin) continue;

            try {
                const hotkey = plugin.hotkey();
                if (!hotkey) continue;

                hotkeys.push({
                    hotkey,
                    callback: function () {
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