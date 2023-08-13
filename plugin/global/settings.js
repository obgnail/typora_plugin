(() => {
    const getSettings = () => {
        const filepath = global._pluginUtils.joinPath("./plugin/global/settings.toml");
        const {parse} = global._pluginUtils.requireFile("./plugin/global/toml/index.js");
        const conf = global._pluginUtils.Package.Fs.readFileSync(filepath, 'utf8');
        return parse(conf);
    }

    const toHotkeyFunc = hotkeyString => {
        const keyList = hotkeyString.toLowerCase().split("+").map(k => k.trim());
        const ctrl = ("ctrl" in keyList);
        const shift = ("shift" in keyList);
        const alt = ("alt" in keyList);
        const key = keyList.filter(key => !(key in ["ctrl", "shift", "alt"]))[0];

        return ev => metaKeyPressed() === ctrl
            && shiftKeyPressed() === shift
            && altKeyPressed === alt
            && ev.key.toLowerCase() === key
    }

    const registerHotKey = settings => {
        Object.keys(settings).forEach(plugin => {
            Object.keys(settings[plugin]).forEach(setting => {
                if (setting.indexOf("HOTKEY") !== -1) {
                    const value = settings[plugin][setting];
                    console.log(value, Array.isArray(value))
                }
            })
        })
    }

    const metaKeyPressed = global._pluginUtils.metaKeyPressed;
    const shiftKeyPressed = global._pluginUtils.shiftKeyPressed;
    const altKeyPressed = global._pluginUtils.altKeyPressed;

    const run = () => {
        const pluginSettings = getSettings();
        console.log("------------", pluginSettings)
        registerHotKey(pluginSettings)
    }

    run()
})()