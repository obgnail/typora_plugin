class hotkeyHub extends BaseCustomPlugin {
    process = () => {
        this.utils.addEventListener(this.utils.eventType.allPluginsHadInjected, () => {
            const settings = this.getSettings();
            if (!settings) return;
            this.hotkeyHelper = new global._hotkeyHelper();
            const hotkeys = Object.keys(settings).map(name => this.registerHotkey(settings[name])).filter(Boolean);
            if (hotkeys) {
                this.hotkeyHelper.register(hotkeys);
                this.hotkeyHelper.listen();
            }
        })
    }

    callback = anchorNode => {
        const filepath = this.utils.joinPath("./plugin/global/settings/hotkey.default.toml");
        JSBridge.showInFinder(filepath);
    }

    getSettings() {
        const defaultToml = "./plugin/global/settings/hotkey.default.toml";
        const userToml = "./plugin/global/settings/hotkey.user.toml";

        let settings = null;
        if (this.utils.existInPluginPath(defaultToml)) {
            settings = this.utils.readToml(defaultToml);
        }
        if (this.utils.existInPluginPath(userToml)) {
            const userSettings = this.utils.readToml(userToml);
            settings = this.utils.merge(settings, userSettings);
        }
        return settings
    }

    registerHotkey = hotkey => {
        const hk = hotkey["hotkey"];
        const enable = hotkey["enable"];
        const evilFunc = hotkey["evil"];
        const pluginFixedName = hotkey["plugin"];
        const func = hotkey["function"];
        const selector = hotkey["closestSelector"];

        if (!hk || !enable) return;

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
        if (hk !== "-") {
            return {hotkey: hk, callback: callback}
        }
    }
}

module.exports = {
    plugin: hotkeyHub,
};