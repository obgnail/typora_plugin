class hotkeyHub extends BaseCustomPlugin {
    beforeProcess = async () => {
        this.settings = await this.utils.readSetting("hotkey.default.toml", "hotkey.user.toml");
    }

    process = () => {
        const toHotkey = setting => {
            const {hotkey, enable, closestSelector, evil, plugin: fixedName, function: func} = setting;
            if (!hotkey || !enable) return;

            let callback = null;
            if (evil) {
                callback = eval(evil);
            } else {
                if (!fixedName || !func) return;

                callback = this.utils.getPluginFunction(fixedName, func);
                if (!callback || !(callback instanceof Function)) return;

                if (closestSelector) {
                    callback = this.utils.withAnchorNode(closestSelector, callback);
                }
            }
            if (hotkey !== "-") {
                return {hotkey, callback}
            }
        }

        if (this.settings) {
            this.utils.addEventListener(this.utils.eventType.allPluginsHadInjected, () => {
                const hotkeys = Object.values(this.settings).map(toHotkey).filter(Boolean);
                hotkeys.length && this.utils.registerHotkey(hotkeys);
            })
        }
    }

    callback = async anchorNode => this.utils.showInFinder(await this.utils.getActualSettingPath("hotkey.user.toml"));
}

module.exports = {
    plugin: hotkeyHub,
};