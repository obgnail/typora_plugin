class TestPlugin extends BasePlugin {
    process = () => {
        // Single instance
        this.utils.decorator.afterCall(() => File?.editor?.library, "openFileInNewWindow", () => setTimeout(() => ClientCommand.close(), 500))

        // Open DevTools
        this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.allPluginsHadInjected, () => JSBridge.invoke("window.toggleDevTools"))

        // Expose require
        global.__require__ = require
        global.__module__ = module

        this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.allPluginsHadInjected, this.test)
    }

    test = async () => {

    }
}

module.exports = {
    plugin: TestPlugin
}
