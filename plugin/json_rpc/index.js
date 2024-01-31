class jsonRPC extends BasePlugin {
    process = () => {
        try {
            const {Server} = this.utils.requireFilePath("./plugin/json_rpc/node-json-rpc.js");
            if (!Server) return;

            const server = new Server(this.config.SERVER_OPTIONS);
            this.registerRPCFunction(server);
            server.start(err => {
                if (err) {
                    console.error("RPC Server Error:", err);
                } else {
                    console.debug("RPC Server running");
                }
            });
        } catch (e) {
            console.warn(e);
        }
    }

    registerRPCFunction = server => {
        server.addMethod("ping", (para, callback) => callback(null, "pong from typora-plugin"));

        server.addMethod("callPluginFunction", (para, callback) => {
            let error, result;

            const [plugin, func, ...arg] = para;
            if (!plugin || !func) {
                error = {code: 404, message: "has not plugin or function"};
            }

            result = this.utils.callPluginFunction(plugin, func, ...arg);
            callback(error, result);
        });

        server.addMethod("eval", (para, callback) => {
            let error, result;

            try {
                const code = para[0];
                result = eval(code);
            } catch (e) {
                error = {code: 500, message: e.toString()};
            }

            callback(error, result);
        })
    }
}

module.exports = {
    plugin: jsonRPC,
};
