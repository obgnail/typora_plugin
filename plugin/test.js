class testPlugin extends BasePlugin {
    exportVar = () => {
        global.__require__ = require;
        global.__module__ = module;
    }

    openDevTools = () => {
        const objGetter = () => File && File.editor && File.editor.library;
        const callback = () => setTimeout(() => ClientCommand.close(), 500);
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
