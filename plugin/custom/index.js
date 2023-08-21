class CustomPlugin extends global._basePlugin {
    beforeProcess = () => {
        this.custom = {};
        this.dynamicUtil = {target: null};

        this.config.PLUGINS.forEach(_plugin => {
            if (!_plugin.enable) return
            try {
                const {plugin} = this.utils.requireFilePath(`./plugin/custom/plugins/${_plugin.plugin}`);
                if (!plugin) return;

                const instance = new plugin(_plugin.name, _plugin.plugin, this.utils);
                if (this.check(instance)) {
                    instance.init();
                    const style = instance.style();
                    style && this.utils.insertStyle(style.id, style.text);
                    instance.html();
                    this.custom[instance.name] = instance;
                } else {
                    console.error("instance is not BaseCustomPlugin", plugin.name);
                }
            } catch (e) {
                console.error("load custom plugin error:", plugin.name, e);
            }
        })
    }

    hotkey = () => {
        const hotkeys = [];
        for (const name in this.custom) {
            const plugin = this.custom[name];
            try {
                const hotkey = plugin.hotkey();
                if (!hotkey) return;
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
                console.log("register hotkey error:", name, e);
            }
        }
        return hotkeys
    }

    dynamicCallArgsGenerator = anchorNode => {
        this.dynamicUtil.target = anchorNode;

        const dynamicCallArgs = [];
        for (const name in this.custom) {
            const plugin = this.custom[name];
            const selector = plugin.selector();
            const arg_disabled = selector && !anchorNode.closest(selector);
            dynamicCallArgs.push({
                arg_name: plugin.showName,
                arg_value: plugin.name,
                arg_disabled: arg_disabled,
                arg_hint: (arg_disabled) ? "光标于此位置不可用" : plugin.hint(),
            })
        }
        return dynamicCallArgs;
    }

    call = name => {
        const plugin = this.custom[name];
        if (plugin) {
            const selector = plugin.selector();
            const target = (selector) ? this.dynamicUtil.target.closest(selector) : this.dynamicUtil.target;
            try {
                plugin.callback(target);
            } catch (e) {
                console.error("plugin callback error", plugin.name, e);
            }
        }
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
            & instance.callback instanceof Function
    }
}

class BaseCustomPlugin {
    constructor(showName, name, utils) {
        this.showName = showName;
        this.name = name;
        this.utils = utils;
    }

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
    callback = anchorNode => {
    }
}

global.BaseCustomPlugin = BaseCustomPlugin;

module.exports = {
    plugin: CustomPlugin
};