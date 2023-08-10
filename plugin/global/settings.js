(() => {
    const getSettings = () => {
        const filepath = global._pluginUtils.joinPath("./plugin/global/settings.toml");
        const {parse} = global._pluginUtils.requireFile("./plugin/global/toml/index.js");
        const conf = global._pluginUtils.Package.Fs.readFileSync(filepath, 'utf8');
        return parse(conf);
    }

    const toHotkeyFuncList = hotkeyString => {
        const funcList = [];
        const keyList = hotkeyString.toLowerCase().split("+").map(k => k.trim());
        const ctrl = ("ctrl" in keyList) ? metaKeyPressed : () => !metaKeyPressed();
        const shift = ("shift" in keyList) ? shiftKeyPressed : () => !shiftKeyPressed();
        const alt = ("alt" in keyList) ? altKeyPressed : () => !altKeyPressed()



        return funcList
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