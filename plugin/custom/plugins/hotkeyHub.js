class hotkeyHub extends BaseCustomPlugin {
    beforeProcess = async () => {
        this.settings = await this.utils.readSetting(
            "./plugin/global/settings/hotkey.default.toml",
            "./plugin/global/settings/hotkey.user.toml",
        )
    }

    process = () => {
        this.utils.addEventListener(this.utils.eventType.allPluginsHadInjected, () => {
            if (this.settings) {
                const hotkeys = Object.values(this.settings).map(this.toHotkey).filter(Boolean);
                hotkeys.length && this.utils.registerHotkey(hotkeys);
            }
        })
    }

    callback = anchorNode => {
        const filepath = this.utils.joinPath("./plugin/global/settings/hotkey.default.toml");
        JSBridge.showInFinder(filepath);
    }

    toHotkey = setting => {
        const {hotkey, enable, closestSelector, evil, plugin: fixedName, function: func} = setting;
        if (!hotkey || !enable) return;

        let callback = null;
        if (evil) {
            callback = eval(evil);
        } else {
            if (!fixedName || !func) return;

            const plugin = this.utils.getPlugin(fixedName) || this.utils.getCustomPlugin(fixedName);
            if (!plugin) return;

            callback = plugin[func];
            if (!callback || !(callback instanceof Function)) return;

            if (closestSelector) {
                callback = this.utils.withAnchorNode(closestSelector, callback);
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