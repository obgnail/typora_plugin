(() => {
    const readSettingFile = () => {
        const filepath = global._pluginUtils.joinPath("./plugin/global/settings/settings.toml");
        const {parse} = global._pluginUtils.requireFile("./plugin/global/toml/index.js");
        const settingFile = global._pluginUtils.Package.Fs.readFileSync(filepath, 'utf8');
        return parse(settingFile)
    }

    module.exports = {
        pluginSettings: readSettingFile()
    };
})()