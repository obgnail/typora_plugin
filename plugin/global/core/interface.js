class IPlugin {
    constructor(fixedName, setting, utils) {
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

class basePlugin extends IPlugin {
    call = (type, meta) => undefined
}

class baseCustomPlugin extends IPlugin {
    constructor(fixedName, setting, controller, utils) {
        super(fixedName, setting.config, utils);
        this.controller = controller;
        this.info = setting;
        this.showName = setting.name;
    }

    hint = isDisable => undefined
    selector = () => undefined
    callback = anchorNode => undefined
}

module.exports = {
    basePlugin,
    baseCustomPlugin,
};