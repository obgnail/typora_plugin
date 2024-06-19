const {utils} = require("./utils");

class IPlugin {
    constructor(fixedName, setting) {
        this.fixedName = fixedName;
        this.config = setting;
        this.utils = utils;
    }

    // 最先执行的函数，唯一的asyncFunction，在这里初始化插件需要的数据。若返回stopLoadPluginError，则停止加载插件
    beforeProcess = async () => undefined
    // 以字符串形式导入样式
    style = () => undefined
    // 以文件形式导入样式
    styleTemplate = () => undefined
    // 原生插入html标签
    html = () => undefined
    // 使用htmlTemplater插入html标签，详见htmlTemplater
    htmlTemplate = () => undefined
    // 注册快捷键
    hotkey = () => undefined
    // 初始化数据
    init = () => undefined
    // 主要的处理流程
    process = () => undefined
    // 收尾，一般用于回收内存，用的比较少
    afterProcess = () => undefined
}

// 一级插件
class basePlugin extends IPlugin {
    call = (type, meta) => undefined
}

// 二级插件
class baseCustomPlugin extends IPlugin {
    constructor(fixedName, setting) {
        super(fixedName, setting.config);
        this.info = setting;
        this.showName = setting.name;
    }

    hint = isDisable => undefined
    selector = () => undefined
    callback = anchorNode => undefined
}

const loadPlugin = async (fixedName, setting, isCustom) => {
    const path = isCustom ? "./plugin/custom/plugins" : "./plugin";
    const superPlugin = isCustom ? baseCustomPlugin : basePlugin;

    const {plugin} = utils.requireFilePath(path, fixedName);
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
        await utils.registerStyleTemplate(instance.fixedName, {...renderArgs, this: instance});
    }
    utils.insertElement(instance.html());
    const elements = instance.htmlTemplate();
    elements && utils.insertHtmlTemplate(elements);
    !isCustom && utils.registerHotkey(instance.hotkey());
    instance.init();
    instance.process();
    instance.afterProcess();
    return instance;
}

module.exports = {
    basePlugin,
    baseCustomPlugin,
    loadPlugin,
};