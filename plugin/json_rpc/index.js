class JsonRPCPlugin extends BasePlugin {
  process = () => {
    return Promise.resolve()
      .then(() => {
        const rpc = require("./node-json-rpc")
        const server = new rpc.Server(this.config.SERVER_OPTIONS)
        this.registerMethods(server)
        return new Promise((resolve, reject) => server.start(err => err ? reject(err) : resolve()))
      })
      .then(() => console.debug("RPC Server running"))
      .catch(console.error)
  }

  registerMethods = server => {
    const run = (send, fn) => {
      return Promise.try(fn)
        .then(result => send(null, result))
        .catch(error => send({ code: 500, message: error.toString() }), null)
    }

    server.addMethod("ping", (_, send) => send(null, "pong from typora-plugin"))
    server.addMethod("eval", (params, send) => run(send, () => eval(params[0])))
    server.addMethod("invokePlugin", (params, send) => {
      const [pluginName, fnName, ...args] = params
      if (!pluginName || !fnName) {
        send({ code: 400, message: "Parameters do NOT contain 'plugin' or 'function'" })
        return
      }
      const plugin = this.utils.tryGetPlugin(pluginName)
      const fn = plugin?.[fnName]
      if (!fn) {
        send({ code: 404, message: `No such method '${fnName}' in plugin '${pluginName}'` })
        return
      }
      run(send, () => fn.apply(plugin, args))
    })
  }
}

module.exports = {
  plugin: JsonRPCPlugin,
}
