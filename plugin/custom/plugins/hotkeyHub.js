class hotkeyHub extends BaseCustomPlugin {
    beforeProcess = async () => {
        this.settings = await this.utils.readSetting("hotkey.default.toml", "hotkey.user.toml");
    }

    process = () => {
        if (this.settings) {
            this.utils.addEventListener(this.utils.eventType.allPluginsHadInjected, () => {
                const hotkeys = Object.values(this.settings).map(this.toHotkey).filter(Boolean);
                hotkeys.length && this.utils.registerHotkey(hotkeys);
            })
        }
    }

    callback = anchorNode => {
        const filepath = this.utils.joinPath("./plugin/global/settings/hotkey.default.toml");
        this.utils.showInFinder(filepath);
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