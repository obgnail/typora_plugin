class testPlugin extends BasePlugin {
    exportVar = () => {
        global.__require__ = require
        global.__module__ = module
    }

    oneInstance = () => {
        const objGetter = () => File && File.editor && File.editor.library
        const callback = () => setTimeout(() => ClientCommand.close(), 500)
        this.utils.decorate(objGetter, "openFileInNewWindow", null, callback)
    }

    openDevTools = () => {
        const { eventHub } = this.utils
        eventHub.addEventListener(eventHub.eventType.allPluginsHadInjected, () => JSBridge.invoke("window.toggleDevTools"))
    }

    process = () => {
        this.exportVar()
        this.oneInstance()
        this.openDevTools()
    }
}

module.exports = {
    plugin: testPlugin
}
