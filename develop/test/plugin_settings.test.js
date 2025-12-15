const test = require("node:test")
const assert = require("node:assert")
const path = require("node:path")
const fs = require("node:fs/promises")

let basePluginSettings
let customPluginSettings

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

test.before(async () => {
    const toml = require("../../plugin/global/core/lib/smol-toml.js")
    const loadSettings = async (files) => {
        const tomlFiles = await Promise.all(files.map(f => path.join("../plugin/global/settings", f)).map(f => fs.readFile(f, "utf-8")))
        return merge(...tomlFiles.map(f => toml.parse(f)))
    }
    basePluginSettings = await loadSettings(["settings.default.toml", "settings.user.toml"])
    customPluginSettings = await loadSettings(["custom_plugin.default.toml", "custom_plugin.user.toml"])
})

test("all plugin settings should has required attributes", async t => {
    await t.test("all base plugin settings should has attributes 'ENABLE' and 'NAME'", () => {
        Object.entries(basePluginSettings).forEach(([fixedName, s]) => {
            assert.ok(
                typeof s.ENABLE === "boolean" && (typeof s.NAME === "string" || fixedName === "global"),
                `[Error Base Plugin Settings] Found ${fixedName} missing attributes`
            )
        })
    })

    await t.test("all custom plugin settings should has attributes 'enable', 'name', 'hide' and 'order'", () => {
        Object.entries(customPluginSettings).forEach(([fixedName, s]) => {
            assert.ok(
                typeof s.enable === "boolean" && typeof s.name === "string" && typeof s.hide === "boolean" && typeof s.order === "number",
                `[Error Custom Plugin Settings] Found ${fixedName} missing attributes`
            )
        })
    })
})
