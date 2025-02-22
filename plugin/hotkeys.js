class hotkeysPlugin extends BasePlugin {
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

    call = (action, meta) => {
        const thText = this.i18n.t("registeredHotkey")
        const hintText = this.i18n.t("editConfigFile") + " " + '<a class="fa fa-external-link"></a>'

        const trs = [...this.utils.hotkeyHub.map.keys()].sort().map(hk => {
            const hotkey = hk.toUpperCase().split("+").map(h => `<kbd>${h}</kbd>`).join("+")
            return [hotkey]
        })
        const table = this.utils.buildTable([[thText], ...trs])
        const onclick = ev => ev.target.closest("a") && this.utils.runtime.openSettingFolder("settings.user.toml")
        const components = [
            { label: hintText, type: "p", onclick },
            { label: table, type: "p" },
        ]
        this.utils.dialog.modal({ title: this.pluginName, components })
    }
}

module.exports = {
    plugin: hotkeysPlugin,
}
