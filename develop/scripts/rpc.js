const os = require("node:os")
const path = require("node:path")
const fs = require("node:fs/promises")
const child_process = require("node:child_process")
const toml = require("../../plugin/global/core/lib/soml-toml")
const rpc = require("../../plugin/json_rpc/node-json-rpc")

const typoraPath = process.env.TYPORA_PATH

const getSettings = async () => {
    const isObject = value => {
        const type = typeof value
        return value !== null && (type === "object" || type === "function")
    }
    const merge = (source, other) => {
        if (!isObject(source) || !isObject(other)) {
            return other === undefined ? source : other
        }
        return Object.keys({ ...source, ...other }).reduce((obj, key) => {
            const isArray = Array.isArray(source[key]) && Array.isArray(other[key])
            obj[key] = isArray ? other[key] : merge(source[key], other[key])
            return obj
        }, Array.isArray(source) ? [] : {})
    }
    const readTOML = async (p) => {
        try {
            const content = await fs.readFile(p, "utf-8")
            return toml.parse(content)
        } catch (e) {
        }
        return {}
    }

    const userTOML = "settings.user.toml"
    const defaultTOML = "settings.default.toml"
    const originSettingsPath = path.resolve("../plugin/global/settings/")
    const homeSettingsPath = path.join(os.homedir(), ".config", "typora_plugin")
    const paths = [
        path.join(originSettingsPath, defaultTOML),
        path.join(originSettingsPath, userTOML),
        path.join(homeSettingsPath, userTOML),
    ]
    const files = await Promise.all(paths.map(readTOML))
    return files.reduce(merge)
}

const initRPC = (options) => {
    const client = new rpc.Client(options)
    const cli = {
        self: client,
        call: async (method, params) => new Promise((resolve, reject) => {
            client.call({ method, params }, (err, resp) => {
                if (err) reject(err)
                else resolve(resp)
            })
        }),
        eval: async (x) => cli.call("eval", [x]),
        invoke: async (plugin, fn, ...args) => cli.call("invokePlugin", [plugin, fn, ...args]),
        startTypora: () => child_process.exec(typoraPath),
        closeTypora: () => cli.eval("JSBridge.invoke('window.close')"),
    }
    return cli
}

const run = async () => {
    const settings = await getSettings()
    const jsonRPC = settings.json_rpc
    if (!jsonRPC || jsonRPC.ENABLE !== true) {
        throw new Error("plugin 'json_rpc' must be enabled")
    }
    return initRPC(jsonRPC.SERVER_OPTIONS)
}

module.exports = run
