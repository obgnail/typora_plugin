const { utils, hook } = require("./utils");
const { BasePlugin, BaseCustomPlugin, LoadPlugins } = require("./plugin");

async function entry() {
    /** 读取配置 */
    const readSetting = () => utils.readSetting("settings.default.toml", "settings.user.toml");

    /**
     * 初始化全局变量
     * 整个插件系统一共暴露了7个全局变量，实际有用的只有3个：BasePlugin, BaseCustomPlugin, LoadPlugins
     * 其余4个全局变量皆由静态类utils暴露，永远不会被业务插件引用；而utils同时又是BasePlugin, BaseCustomPlugin的实例属性，所以utils自己也不需要暴露
     * 既然永远不会被业务插件引用，为何要将它们设置为全局变量？答：方便调试
     **/
    const initVariable = settings => {
        global.BasePlugin = BasePlugin;             // 插件的父类
        global.BaseCustomPlugin = BaseCustomPlugin; // 自定义插件的父类
        global.LoadPlugins = LoadPlugins;           // 加载插件

        global.__plugins__ = null;                     // 启用的插件
        global.__plugin_utils__ = utils;               // 通用工具
        global.__plugin_settings__ = settings;         // 插件配置
        global.__global_settings__ = settings.global;  // 通用配置

        delete settings.global;
    }

    /** 加载插件 */
    const loadPlugins = async () => {
        const { enable, disable, stop, error, nosetting } = await LoadPlugins(global.__plugin_settings__, false);
        global.__plugins__ = enable;
    }

    /** 低于0.9.98版本的Typora运行插件系统时，提出不兼容警告 */
    const showWarn = () => {
        const need = global.__global_settings__.SHOW_INCOMPATIBLE_WARNING;
        const incompatible = utils.compareVersion(utils.typoraVersion, "0.9.98") < 0;
        if (need && incompatible) {
            utils.notification.show("Typora 版本过低，部分插件可能失效。\n建议升级到 0.9.98 (最后一个免费版本)", "warning", 5000);
        }
    }

    const launch = async () => {
        const settings = await readSetting();
        const enable = settings && settings.global && settings.global.ENABLE;
        if (!enable) {
            console.warn("disable typora plugin");
            return;
        }

        initVariable(settings);
        await hook(loadPlugins);
        showWarn();
    }

    await launch();
}

console.debug(`
____________________________________________________________________
   ______                                      __            _     
  /_  __/_  ______  ____  _________ _   ____  / /_  ______ _(_)___ 
   / / / / / / __ \\/ __ \\/ ___/ __ \`/  / __ \\/ / / / / __ \`/ / __ \\
  / / / /_/ / /_/ / /_/ / /  / /_/ /  / /_/ / / /_/ / /_/ / / / / /
 /_/  \\__, / .___/\\____/_/   \\__,_/  / .___/_/\\__,_/\\__, /_/_/ /_/ 
     /____/_/                       /_/            /____/          

                        Designed by obgnail                        
              https://github.com/obgnail/typora_plugin             
____________________________________________________________________
`)

module.exports = {
    entry
};