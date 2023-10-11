// 插件系统默认开启自动升级功能，若想修改代码，请先前往配置关闭自动升级功能
window.onload = () => {
    const pluginFile = reqnode('path').join(global.dirname || global.__dirname, "./plugin/global/core/plugin.js");
    const {process} = reqnode(pluginFile);
    new process().run();
}
