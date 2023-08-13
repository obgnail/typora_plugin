(() => {
    const readSettingFile = () => {
        const filepath = global._pluginUtils.joinPath("./plugin/global/settings/settings.toml");
        const {parse} = global._pluginUtils.requireFile("./plugin/global/toml/index.js");
        const settingFile = global._pluginUtils.Package.Fs.readFileSync(filepath, 'utf8');
        const settings = parse(settingFile);
        registerHotKey(settings);
        return settings
    }

    const registerHotKey = settings => {
        Object.keys(settings).forEach(plugin => {
            Object.keys(settings[plugin]).forEach(setting => {
                if (setting.indexOf("HOTKEY") !== -1) {
                    const hotkey = settings[plugin][setting];
                    if (Array.isArray(hotkey)) {
                        settings[plugin][setting] = hotkey.map(ele => toHotkeyFunc(ele));
                    } else {
                        settings[plugin][setting] = toHotkeyFunc(hotkey);
                    }
                }
            })
        })
    }

    const toHotkeyFunc = hotkeyString => {
        const keyList = hotkeyString.toLowerCase().split("+").map(k => k.trim());
        const ctrl = keyList.indexOf("ctrl") !== -1;
        const shift = keyList.indexOf("shift") !== -1;
        const alt = keyList.indexOf("alt") !== -1;
        const key = keyList.filter(key => key !== "ctrl" && key !== "shift" && key !== "alt")[0];

        return ev => {
            return global._pluginUtils.metaKeyPressed(ev) === ctrl
                && global._pluginUtils.shiftKeyPressed(ev) === shift
                && global._pluginUtils.altKeyPressed(ev) === alt
                && ev.key.toLowerCase() === key
        }
    }

    module.exports = {
        pluginSettings: readSettingFile()
    };
})()