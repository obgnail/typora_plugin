const { utils } = require("./utils");

class IPlugin {
    constructor(fixedName, setting) {
        this.fixedName = fixedName;
        this.config = setting;
        this.utils = utils;
    }

    // 最先执行的函数，在这里准备插件需要的数据。若返回utils.stopLoadPluginError，则停止加载插件
    async beforeProcess() {
    }

    // 以字符串形式导入样式
    style() {
    }

    // 以文件形式导入样式
    styleTemplate() {
    }

    // 原生插入html标签
    html() {
    }

    // 使用htmlTemplater插入html标签，详见htmlTemplater
    htmlTemplate() {
    }

    // 注册快捷键
    hotkey() {
    }

    // 初始化数据
    init() {
    }

    // 主要的处理流程
    process() {
    }

    // 收尾，一般用于回收内存，用的比较少
    afterProcess() {
    }
}

// 一级插件
class BasePlugin extends IPlugin {
    call(type, meta) {
    }
}

// 二级插件
class BaseCustomPlugin extends IPlugin {
    constructor(fixedName, setting) {
        super(fixedName, setting.config);
        this.info = setting;
        this.showName = setting.name;
    }

    selector(isClick) {
    }

    hint(isDisable) {
    }

    callback(anchorNode) {
    }
}

const loadPlugin = async (fixedName, setting, isCustom) => {
    const path = isCustom ? "./plugin/custom/plugins" : "./plugin";
    const superPlugin = isCustom ? BaseCustomPlugin : BasePlugin;

    const { plugin } = utils.requireFilePath(path, fixedName);
    if (!plugin) {
        return new Error(`there is not ${fixedName} in ${path}`);
    }

    const instance = new plugin(fixedName, setting);
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
    const elements = instance.htmlTemplate();
    if (elements) {
        utils.htmlTemplater.insert(elements);
    }
    if (!isCustom) {
        utils.hotkeyHub.register(instance.hotkey());
    }
    instance.init();
    instance.process();
    instance.afterProcess();
    return instance;
}

const LoadPlugins = async (settings, isCustom) => {
    const plugins = { enable: {}, disable: {}, stop: {}, error: {}, nosetting: {} };
    await Promise.all(Object.entries(settings).map(async ([fixedName, setting]) => {
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
    }))

    // log
    const color = { enable: "32", disable: "33", stop: "34", error: "31", nosetting: "35" };
    for (const [t, p] of Object.entries(plugins)) {
        console.debug(`[ ${isCustom ? "custom" : "base"} ] [ \x1B[${color[t]}m${t}\x1b[0m ] [ ${Object.keys(p).length} ]:`, p);
    }

    return plugins;
}

module.exports = {
    BasePlugin,
    BaseCustomPlugin,
    LoadPlugins,
};