class testPlugin extends global._basePlugin {
    process() {
        this.utils.decorate(
            () => (File && File.editor && File.editor.library && File.editor.library.openFileInNewWindow),
            "File.editor.library.openFileInNewWindow",
            null,
            () => (!global._DO_NOT_CLOSE) && setTimeout(() => ClientCommand.close(), 3000)
        )

        JSBridge.invoke("window.toggleDevTools");
    }
}

module.exports = {
    plugin: testPlugin
};
