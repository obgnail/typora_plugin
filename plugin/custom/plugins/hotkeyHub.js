class hotkeyHubPlugin extends BaseCustomPlugin {
    hotkey = () => [this.config.hotkey]

    beforeProcess = async () => {
        this.settings = await this.utils.runtime.readHotkeySetting();
    }

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

        if (this.settings) {
            this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.allPluginsHadInjected, () => {
                const hotkeys = Object.values(this.settings).map(toHotkey).filter(Boolean);
                hotkeys.length && this.utils.hotkeyHub.register(hotkeys);
            })
        }
    }

    callback = anchorNode => {
        const trs = Array.from(this.utils.hotkeyHub.map.keys()).sort().map(hk => {
            const hotkey = hk.toUpperCase().split("+").map(h => `<kbd>${h}</kbd>`).join("+");
            return `<tr><td>${hotkey}</td></tr>`
        })
        const th = `<tr><th>已注册快捷键</th></tr>`;
        const table = `<table>${th}${trs.join("")}</table>`;
        const onclick = ev => ev.target.closest("a") && this.utils.runtime.openSettingFolder("hotkey.user.toml");
        const components = [
            { label: "如需自定义快捷键，请 <a>修改配置文件</a>", type: "p", onclick },
            { label: table, type: "p" },
        ];
        this.utils.dialog.modal({ title: "快捷键中心", components });
    }
}

module.exports = {
    plugin: hotkeyHubPlugin,
};