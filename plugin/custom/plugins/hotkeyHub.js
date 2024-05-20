class hotkeyHub extends BaseCustomPlugin {
    hotkey = () => [this.config.hotkey]

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

    openSettingFile = async () => this.utils.showInFinder(await this.utils.getActualSettingPath("hotkey.user.toml"));

    callback = anchorNode => {
        const {map} = this.utils.getHotkeyHub();
        const th = `<tr><th>插件系统已注册快捷键</th>`;
        const trs = Array.from(map.keys(), hotkey => `<tr><td>${hotkey.toUpperCase().split("+").map(ele => `<kbd>${ele}</kbd>`).join("+")}</td></tr>`);
        trs.sort();
        const table = `<table>${th}${trs.join("")}</table>`;
        const onclick = ev => ev.target.closest("a") && this.openSettingFile();
        const components = [
            {label: "如需自定义快捷键，请 <a>修改配置文件</a>", type: "p", onclick},
            {label: table, type: "p"},
        ];
        this.utils.modal({title: "hotkeyHub", components});
    }
}

module.exports = {
    plugin: hotkeyHub,
};