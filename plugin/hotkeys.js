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
        const trs = Array.from(this.utils.hotkeyHub.map.keys()).sort().map(hk => {
            const hotkey = hk.toUpperCase().split("+").map(h => `<kbd>${h}</kbd>`).join("+");
            return `<tr><td>${hotkey}</td></tr>`
        })
        const th = `<tr><th>已注册快捷键</th></tr>`;
        const table = `<table>${th}${trs.join("")}</table>`;
        const onclick = ev => ev.target.closest("a") && this.utils.runtime.openSettingFolder("settings.user.toml");
        const components = [
            { label: "如需自定义快捷键，请 <a>修改配置文件</a>", type: "p", onclick },
            { label: table, type: "p" },
        ];
        this.utils.dialog.modal({ title: "快捷键中心", components });
    }
}

module.exports = {
    plugin: hotkeysPlugin,
}
