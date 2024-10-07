class runtime {
    constructor(utils) {
        this.utils = utils;
        this.PATH = utils.Package.Path;
        this.TOML = utils.Package.Toml;
    }

    getOriginSettingPath = settingFile => this.utils.joinPath("./plugin/global/settings", settingFile)
    getHomeSettingPath = settingFile => this.PATH.join(this.utils.getHomeDir(), ".config", "typora_plugin", settingFile)
    getActualSettingPath = async settingFile => {
        const homeSetting = this.getHomeSettingPath(settingFile);
        const exist = await this.utils.existPath(homeSetting);
        return exist ? homeSetting : this.getOriginSettingPath(settingFile);
    }

    saveConfig = async (fixedName, updateObj) => {
        let isCustom = false;
        let plugin = this.utils.getPlugin(fixedName);
        if (!plugin) {
            plugin = this.utils.getCustomPlugin(fixedName);
            isCustom = true;
        }
        if (!plugin) return;

        const file = isCustom ? "custom_plugin.user.toml" : "settings.user.toml";
        const settingPath = await this.getActualSettingPath(file);
        const tomlObj = await this.utils.readToml(settingPath);
        const newSetting = this.utils.merge(tomlObj, { [fixedName]: updateObj });
        const newContent = this.utils.stringifyToml(newSetting);
        return this.utils.writeFile(settingPath, newContent);
    }

    autoSaveConfig = plugin => {
        const { saveConfig } = this;
        plugin.config = new Proxy(plugin.config, {
            set(target, property, value, receiver) {
                saveConfig(plugin.fixedName, { [property]: value });
                return Reflect.set(...arguments)
            }
        });
    }

    _getSettingObjects = async (defaultSetting, userSetting) => {
        const default_ = this.getOriginSettingPath(defaultSetting);
        const user_ = this.getOriginSettingPath(userSetting);
        const home_ = this.getHomeSettingPath(userSetting);
        const contentList = await this.utils.readFiles([default_, user_, home_]);
        try {
            return contentList.map(c => c ? this.TOML.parse(c) : {});
        } catch (e) {
            const message = "配置文件格式错误";
            const detail = `您修改过配置文件且写入的内容有问题，导致无法正确读取配置文件。\n\n请点击「确定」前往校验网站手动修复（如果您有 GPT 也可以让它帮您修复）\n\n报错信息：${e.toString()}`;
            const op = { type: "error", title: "Typora Plugin", buttons: ["确定", "取消"], message, detail };
            const { response } = await this.utils.showMessageBox(op);
            if (response === 0) {
                this.utils.openUrl("https://www.bejson.com/validators/toml_editor/");
            }
            return {}
        }
    }

    _readSetting = async (defaultSetting, userSetting) => {
        const objs = await this._getSettingObjects(defaultSetting, userSetting);
        return objs.reduce(this.utils.merge)
    }

    readHotkeySetting = async () => this._readSetting("hotkey.default.toml", "hotkey.user.toml");
    readBasePluginSetting = async () => this._readSetting("settings.default.toml", "settings.user.toml");
    readCustomPluginSetting = async () => {
        const settings = await this._readSetting("custom_plugin.default.toml", "custom_plugin.user.toml");
        return this.fixCustomPluginSetting(settings);
    }
    // 兼容历史遗留问题
    fixCustomPluginSetting = async settings => {
        Object.values(settings).map(plugin => {
            if (plugin.config) {
                Object.assign(plugin, plugin.config);
                delete plugin.config;
            }
        })
        return settings
    }

    openSettingFolder = async (file = "settings.user.toml") => this.utils.showInFinder(await this.getActualSettingPath(file))

    backupSettingFile = async (showInFinder = true) => {
        const { FsExtra, Path } = this.utils.Package;
        const backupDir = Path.join(this.utils.tempFolder, "typora_plugin_config");
        await FsExtra.emptyDir(backupDir);
        const settingFiles = ["settings.user.toml", "custom_plugin.user.toml", "hotkey.user.toml"];
        for (const file of settingFiles) {
            const source = await this.getActualSettingPath(file);
            const target = Path.join(backupDir, file);
            try {
                await FsExtra.copy(source, target);
            } catch (e) {
                console.error(e);
            }
        }
        showInFinder && this.utils.showInFinder(backupDir);
    }
}

module.exports = {
    runtime
}