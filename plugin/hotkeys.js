class HotkeysPlugin extends BasePlugin {
    hotkey = () => [this.config.HOTKEY]

    process = () => {
        const toHotkey = setting => {
            const { hotkey, enable, closestSelector, evil, plugin: fixedName, function: func } = setting;
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
                return { hotkey, callback }
            }
        }

        const { CUSTOM_HOTKEYS } = this.config
        if (CUSTOM_HOTKEYS.length) {
            this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.allPluginsHadInjected, () => {
                const hotkeys = CUSTOM_HOTKEYS.map(toHotkey).filter(Boolean)
                this.utils.hotkeyHub.register(hotkeys)
            })
        }
    }

    call = async (action, meta) => {
        const hotkeys = [...this.utils.hotkeyHub.map.keys()].sort()
        const op = {
            title: this.i18n.t("registeredHotkey"),
            schema: [{ fields: [{ type: "textarea", key: "hotkeys", rows: 14 }] }],
            data: { hotkeys: JSON.stringify(hotkeys, null, "\t") },
        }
        await this.utils.formDialog.modal(op)
    }
}

module.exports = {
    plugin: HotkeysPlugin
}
