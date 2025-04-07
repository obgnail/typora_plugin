const { utils } = require("./utils");
const { i18n } = require("./i18n");

class IPlugin {
    constructor(fixedName, setting, i18n) {
        this.fixedName = fixedName;
        this.pluginName = setting.NAME || setting.name || i18n.t("pluginName");
        this.config = setting;
        this.utils = utils;
        this.i18n = i18n;
    }

    /** The first function executed, prepares data. If utils.stopLoadPluginError is returned, plugin loading is stopped. */
    async beforeProcess() {}
    /** Import styles as a string. */
    style() {}
    /** Import styles as a file. */
    styleTemplate() {}
    /** Insert HTML tag. */
    html() {}
    /** Register hotkeys. */
    hotkey() {}
    /** Initialize data. */
    init() {}
    /** Main processing function. */
    process() {}
    /** Cleanup, generally used for memory reclamation, used infrequently. */
    afterProcess() {}
}

class BasePlugin extends IPlugin {
    call(action, meta) {}
}

class BaseCustomPlugin extends IPlugin {
    selector(isClick) {}
    hint(isDisable) {}
    callback(anchorNode) {}
}

const loadPlugin = async (fixedName, setting, isCustom) => {
    const path = isCustom ? "./plugin/custom/plugins" : "./plugin";
    const superPlugin = isCustom ? BaseCustomPlugin : BasePlugin;

    const { plugin } = utils.requireFilePath(path, fixedName);
    if (!plugin) {
        return new Error(`there is not ${fixedName} in ${path}`);
    }

    const instance = new plugin(fixedName, setting, i18n.bind(fixedName));
    if (!(instance instanceof superPlugin)) {
        return new Error(`instance is not instanceof ${superPlugin.name}: ${fixedName}`);
    }

    const error = await instance.beforeProcess();
    if (error === utils.stopLoadPluginError) {
        return;
    }
    utils.registerStyle(instance.fixedName, instance.style());
    const renderArgs = instance.styleTemplate();
    if (renderArgs) {
        await utils.styleTemplater.register(instance.fixedName, { ...renderArgs, this: instance });
    }
    utils.insertElement(instance.html());
    if (!isCustom) {
        utils.hotkeyHub.register(instance.hotkey());
    }
    instance.init();
    instance.process();
    instance.afterProcess();
    return instance;
}

const LoadPlugins = async (settings, isCustom) => {
    const plugins = { enable: {}, disable: {}, stop: {}, error: {}, nosetting: {} }
    const promises = Object.entries(settings).map(async ([fixedName, setting]) => {
        if (!setting) {
            plugins.nosetting[fixedName] = fixedName;
        } else if (!setting.ENABLE && !setting.enable) {
            plugins.disable[fixedName] = setting;
        } else {
            try {
                const instance = await loadPlugin(fixedName, setting, isCustom);
                if (instance) {
                    plugins.enable[fixedName] = instance;
                } else {
                    plugins.stop[fixedName] = setting;
                }
            } catch (error) {
                console.error(error);
                plugins.error[fixedName] = error;
            }
        }
    })
    await Promise.all(promises)

    // log
    const COLORS = { enable: "32", disable: "33", stop: "34", error: "31", nosetting: "35" };
    console.group(`${isCustom ? "Custom" : "Base"} Plugin`);
    Object.entries(plugins).forEach(([t, p]) => console.debug(`[ \x1B[${COLORS[t]}m${t}\x1b[0m ] [ ${Object.keys(p).length} ]:`, p));
    console.groupEnd();

    return plugins;
}

module.exports = {
    BasePlugin,
    BaseCustomPlugin,
    LoadPlugins,
}
