const path = require("node:path")
const fs = require("node:fs/promises")
const TOML = require("../../../plugin/global/core/lib/smol-toml.js")

const getFiles = (files) => Promise.all(files.map(f => path.join("../plugin/global/settings", f)).map(f => fs.readFile(f, "utf-8")))

const merge = (source, other) => {
    const isObject = value => {
        const type = typeof value
        return value != null && (type === "object" || type === "function")
    }
    if (!isObject(source) || !isObject(other)) {
        return other === undefined ? source : other
    }
    return Object.keys({ ...source, ...other }).reduce((obj, key) => {
        const isArray = Array.isArray(source[key]) && Array.isArray(other[key])
        obj[key] = isArray ? other[key] : merge(source[key], other[key])
        return obj
    }, Array.isArray(source) ? [] : {})
}

const getDefaults = async () => {
    const [base, custom] = await getFiles(["settings.default.toml", "custom_plugin.default.toml"])
    return { base: TOML.parse(base), custom: TOML.parse(custom) }
}

const getMerged = async () => {
    const loadSettings = async (files) => {
        const tomlFiles = await getFiles(files)
        return merge(...tomlFiles.map(f => TOML.parse(f)))
    }
    const base = await loadSettings(["settings.default.toml", "settings.user.toml"])
    const custom = await loadSettings(["custom_plugin.default.toml", "custom_plugin.user.toml"])
    return { base, custom }
}

module.exports = {
    getDefaults,
    getMerged,
}
