class testPlugin extends BasePlugin {
    exportVar = () => {
        global.require = require;
        global.module = module;
    }

    openDevTools = () => {
        const objGetter = () => File && File.editor && File.editor.library;
        const callback = () => setTimeout(() => ClientCommand.close(), 1000);
        this.utils.decorate(objGetter, "openFileInNewWindow", null, callback);
        JSBridge.invoke("window.toggleDevTools");
    }

    process = () => {
        this.exportVar()
        this.openDevTools()
    }
}

module.exports = {
    plugin: testPlugin
};
