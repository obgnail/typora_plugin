class TestPlugin extends BasePlugin {
    process = () => {
        this.singleInstance()
        this.autoOpenDevTools()
        this.updateRequire()
        this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.allPluginsHadInjected, this.test)
    }

    singleInstance = () => {
        this.utils.decorate(
            () => File?.editor?.library,
            "openFileInNewWindow",
            null,
            () => setTimeout(() => ClientCommand.close(), 500)
        )
    }

    autoOpenDevTools = () => {
        this.utils.eventHub.addEventListener(
            this.utils.eventHub.eventType.allPluginsHadInjected,
            () => JSBridge.invoke("window.toggleDevTools")
        )
    }

    updateRequire = () => {
        global.__require__ = require
        global.__module__ = module
        // const Module = require("module")
        // Module.globalPaths.push(this.utils.joinPath("plugin"))
    }

    test = async () => {

    }
}

module.exports = {
    plugin: TestPlugin
}
