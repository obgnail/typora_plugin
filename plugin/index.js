window.onload = () => {
    const pluginFile = reqnode('path').join(global.dirname || global.__dirname, "./plugin/global/core/plugin.js");
    const {process} = reqnode(pluginFile);
    new process().run();
}
