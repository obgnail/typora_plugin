class hotkeyHub extends BaseCustomPlugin {
    process = () => {
        this.utils.addEventListener(this.utils.eventType.allPluginsHadInjected, () => {
            const settings = this.getSettings();
            if (!settings) return;
            const hotkeys = Object.keys(settings).map(name => this.toHotkey(settings[name])).filter(Boolean);
            if (hotkeys.length) {
                this.utils.registerHotkey(hotkeys);
            }
        })
    }

    callback = anchorNode => {
        const filepath = this.utils.joinPath("./plugin/global/settings/hotkey.default.toml");
        JSBridge.showInFinder(filepath);
    }

    getSettings = () => this.utils.readSetting(
        "./plugin/global/settings/hotkey.default.toml",
        "./plugin/global/settings/hotkey.user.toml",
    )

    toHotkey = setting => {
        const hotkey = setting["hotkey"];
        const enable = setting["enable"];
        const evilFunc = setting["evil"];
        const pluginFixedName = setting["plugin"];
        const func = setting["function"];
        const selector = setting["closestSelector"];

        if (!hotkey || !enable) return;

        let callback = null;
        if (evilFunc) {
            callback = eval(evilFunc);
        } else {
            if (!pluginFixedName || !func) return;
            const plugin = this.utils.getPlugin(pluginFixedName) || this.utils.getCustomPlugin(pluginFixedName);
            if (!plugin) return;

            callback = plugin[func];
            if (!callback || !callback instanceof Function) return;

            if (selector) {
                callback = this.utils.withAnchorNode(selector, callback);
            }
        }
        if (hotkey !== "-") {
            return {hotkey, callback}
        }
    }
}

module.exports = {
    plugin: hotkeyHub,
};