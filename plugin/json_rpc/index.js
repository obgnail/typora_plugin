class JsonRPCPlugin extends BasePlugin {
    process = () => {
        try {
            const rpc = require("./node-json-rpc")
            const server = new rpc.Server(this.config.SERVER_OPTIONS)
            this.registerRPCFunction(server)
            server.start(err => {
                if (err) {
                    console.error("RPC Server Error:", err)
                } else {
                    console.debug("RPC Server running with options", this.config.SERVER_OPTIONS)
                }
            })
        } catch (err) {
            console.warn(err)
        }
    }

    registerRPCFunction = server => {
        server.addMethod("ping", (params, callback) => {
            callback(null, "pong from typora-plugin")
        })

        server.addMethod("invokePlugin", (params, callback) => {
            let error, result

            const [plugin, func, ...args] = params
            if (!plugin || !func) {
                callback({ code: 400, message: "params has not plugin or function" })
                return
            }

            const _plugin = this.utils.tryGetPlugin(plugin)
            const _func = _plugin?.[func]
            if (!_func) {
                callback({ code: 404, message: "has not the plugin function" })
                return
            }

            try {
                result = _func.apply(_plugin, args)
            } catch (err) {
                error = { code: 500, message: err.toString() }
            }
            callback(error, result)
        })

        server.addMethod("eval", (params, callback) => {
            let error, result

            try {
                result = eval(params[0])
            } catch (err) {
                error = { code: 500, message: err.toString() }
            }
            callback(error, result)
        })
    }
}

module.exports = {
    plugin: JsonRPCPlugin
}
