const { utils } = require("./utils");

class IPlugin {
    constructor(fixedName, setting) {
        this.fixedName = fixedName;
        this.config = setting;
        this.utils = utils;
    }

    // 最先执行的函数，在这里准备插件需要的数据。若返回utils.stopLoadPluginError，则停止加载插件
    async beforeProcess() {}
    // 以字符串形式导入样式
    style() {}
    // 以文件形式导入样式
    styleTemplate() {}
    // 原生插入html标签
    html() {}
    // 使用htmlTemplater插入html标签，详见htmlTemplater
    htmlTemplate() {}
    // 注册快捷键
    hotkey() {}
    // 初始化数据
    init() {}
    // 主要的处理流程
    process() {}
    // 收尾，一般用于回收内存，用的比较少
    afterProcess() {}
}

// 一级插件
class BasePlugin extends IPlugin {
    call(type, meta) {}
}

// 二级插件
class BaseCustomPlugin extends IPlugin {
    constructor(fixedName, setting) {
        super(fixedName, setting.config);
        this.info = setting;
        this.showName = setting.name;
    }

    selector(isClick) {}
    hint(isDisable) {}
    callback(anchorNode) {}
}

const loadPlugin = async (fixedName, setting, isCustom) => {
    const path = isCustom ? "./plugin/custom/plugins" : "./plugin";
    const superPlugin = isCustom ? BaseCustomPlugin : BasePlugin;

    const { plugin } = utils.requireFilePath(path, fixedName);
    if (!plugin) return;

    const instance = new plugin(fixedName, setting);
    if (!(instance instanceof superPlugin)) {
        console.error(`instance is not instanceof ${superPlugin.name}:`, fixedName);
        return;
    }

    const error = await instance.beforeProcess();
    if (error === utils.stopLoadPluginError) return;
    utils.registerStyle(instance.fixedName, instance.style());
    const renderArgs = instance.styleTemplate();
    if (renderArgs) {
        await utils.styleTemplater.register(instance.fixedName, { ...renderArgs, this: instance });
    }
    utils.insertElement(instance.html());
    const elements = instance.htmlTemplate();
    elements && utils.htmlTemplater.insert(elements);
    !isCustom && utils.hotkeyHub.register(instance.hotkey());
    instance.init();
    instance.process();
    instance.afterProcess();
    return instance;
}

const LoadPlugins = async (settings, isCustom) => {
    const result = { enable: {}, disable: {}, error: {}, notfound: {} };
    for (const [fixedName, setting] of Object.entries(settings)) {
        if (!setting) {
            result.notfound[fixedName] = fixedName;
        } else if (!setting.ENABLE && !setting.enable) {
            result.disable[fixedName] = fixedName;
        } else {
            try {
                result.enable[fixedName] = await loadPlugin(fixedName, setting, isCustom);
            } catch (error) {
                console.error(error);
                result.error[fixedName] = error;
            }
        }
    }

    // report
    for (const [type, plugins] of Object.entries(result)) {
        const t = isCustom ? "custom" : "base";
        const p = Array.from(Object.keys(plugins)).join(", ");
        console.debug(`${type} ${t} plugin: [ ${p} ]`);
    }

    return result;
}

module.exports = {
    BasePlugin,
    BaseCustomPlugin,
    LoadPlugins,
};