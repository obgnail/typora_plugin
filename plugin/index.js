/*
  本项目默认开启自动升级功能，您如果想修改代码，请按如下步骤关闭自动升级功能（自动升级会替换plugin目录，会把您的修改全部撤销掉）
    1. 打开文件./plugin/global/settings/custom_plugin.user.toml
    2. 添加如下内容，并保存:
         [pluginUpdater]
         [pluginUpdater.config]
         auto_update = false

  note: 尽量不要使用ES2015(ES6)以后的特性，因为低版本Typora不兼容
*/
window.addEventListener("load", () => {
    const dir = global.dirname || global.__dirname;
    const core = reqnode("path").join(dir, "./plugin/global/core/plugin.js");
    const {process} = reqnode(core);
    new process().run();
});
