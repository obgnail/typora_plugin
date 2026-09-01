class TestPlugin extends BasePlugin {
  style = () => ``

  process = () => {
    if (this.config.SINGLETON) {
      this.utils.decorator.afterCall(() => File?.editor?.library, "openFileInNewWindow", () => setTimeout(() => ClientCommand.close(), 500))
    }
    if (this.config.AUTO_OPEN_DEVTOOLS) {
      this.utils.eventHub.on(this.utils.eventHub.eventType.allPluginsHadInjected, () => JSBridge.invoke("window.toggleDevTools"))
    }
    if (this.config.EXPOSE_CJS_VARIABLES) {
      global.__require__ = require
      global.__module__ = module
    }
    if (this.config.EXPOSE_PLUGIN_VARIABLES) {
      global.__plugin_utils__ = this.utils
      global.__plugin_i18n__ = this.utils.i18n
      global.__plugin_container__ = this.utils.container
    }
    if (this.config.RUN_CUSTOM_SCRIPT) {
      this.utils.eventHub.on(this.utils.eventHub.eventType.allPluginsHadInjected, this.test)
    }
  }

  test = async () => {
    // this.traceEvents()
    // await this.traceCall(() => File?.editor?.library, "openFile")
  }

  traceCall = (target, property, opts = {}) => {
    const { logArgs = true, logResult = true, logTiming = true, logStack = false } = opts
    const label = `[Trace] ${String(property)}`
    const timers = new WeakMap()
    return this.utils.decorator.decorate(target, property, {
      priority: -Infinity,
      before: (...args) => {
        const start = performance.now()
        console.groupCollapsed(label)
        if (logArgs) console.log("args:", args)
        if (logStack) console.log("stack:", new Error().stack)
        console.time(label)
        timers.set(args, start)
      },
      after: (result, ...args) => {
        if (logTiming) console.timeEnd(label)
        if (logResult) console.log("result:", result)
        console.groupEnd()
        return result
      },
    })
  }

  traceEvents = (types = Object.values(this.utils.eventHub.eventType), order = 9999) => {
    for (const type of types) {
      this.utils.eventHub.on(
        type,
        (...payload) => {
          console.groupCollapsed(`[Event] ${type} @ ${new Date().toLocaleTimeString()}`)
          console.log("payload:", payload)
          console.trace()
          console.groupEnd()
        },
        order,
      )
    }
  }
}

module.exports = {
  plugin: TestPlugin,
}
