class testPlugin extends BasePlugin {
    singleInstance = () => {
        const objGetter = () => File && File.editor && File.editor.library
        const callback = () => setTimeout(() => ClientCommand.close(), 500)
        this.utils.decorate(objGetter, "openFileInNewWindow", null, callback)
    }

    autoOpenDevTools = () => {
        const { eventHub } = this.utils
        eventHub.addEventListener(eventHub.eventType.allPluginsHadInjected, () => JSBridge.invoke("window.toggleDevTools"))
    }

    updateRequire = () => {
        global.__require__ = require
        global.__module__ = module
        // const Module = require("module")
        // Module.globalPaths.push(this.utils.joinPath("plugin"))
    }

    process = () => {
        this.singleInstance()
        this.autoOpenDevTools()
        this.updateRequire()
    }
}

module.exports = {
    plugin: testPlugin
}
