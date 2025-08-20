const test = require("node:test")
const assert = require("node:assert")
const fs = require("node:fs/promises")

let schemas, settings

test.before(async () => {
    const toml = require("../../plugin/global/core/lib/smol-toml.js")
    const base = await fs.readFile("../plugin/global/settings/settings.default.toml", "utf-8")
    const custom = await fs.readFile("../plugin/global/settings/custom_plugin.default.toml", "utf-8")
    settings = { ...toml.parse(base), ...toml.parse(custom) }
})

test.before(() => {
    schemas = require("../../plugin/preferences/schemas.js")
    Object.values(schemas).forEach(boxes => {
        boxes.forEach(box => {
            box.fields = box.fields.filter(ctl => ctl.key && ctl.type !== "static" && ctl.type !== "action")
        })
    })
})

test("schemas should have no extra keys", t => {
    Object.entries(schemas).forEach(([fixedName, boxes]) => {
        const setting = settings[fixedName]
        boxes.forEach(box => {
            box.fields.forEach(ctl => {
                assert.ok(hasNestedProperty(setting, ctl.key), `settings ${fixedName} has no such Key: ${ctl.key}`)
            })
        })
    })
})

test("schemas should have no messing keys", t => {
    const isIgnored = (fixedName, key) => (
        fixedName === "abc" && key.startsWith("VISUAL_OPTIONS")
        || (fixedName === "markdownLint") && key.startsWith("rule_config")
    )
    const flattenKeys = (obj, prefix = [], result = new Set()) => {
        for (const [key, val] of Object.entries(obj)) {
            if (Array.isArray(val)) {
                val.forEach(k => flattenKeys(val, [...prefix, key], result))
            } else if (typeof val === "object") {
                flattenKeys(val, [...prefix, key], result)
            } else {
                const pre = prefix.length === 0 ? "" : prefix.join(".") + "."
                const r = (pre + key).replace(/\.\d+/g, "")
                result.add(r)
            }
        }
        return result
    }
    for (const [fixedName, setting] of Object.entries(settings)) {
        const boxes = schemas[fixedName]
        assert.ok(boxes, `schemas has no such schema: ${fixedName}`)

        const keysInBoxes = boxes.flatMap(box => {
            return box.fields.flatMap(field => {
                return field.type !== "table"
                    ? field.key
                    : field.nestedBoxes.flatMap(b => b.fields.flatMap(f => `${field.key}.${f.key}`))
            })
        })
        const keysObject = Object.fromEntries(keysInBoxes.map(e => [e.replace(/\.\d+/g, ""), undefined]))
        const newKeys = flattenKeys(setting)
        for (const key of newKeys) {
            const exist = hasNestedProperty(keysObject, key)
            assert.ok(exist || isIgnored(fixedName, key), `schemas ${fixedName} has no such Key: ${key}`)
        }
    }
})

function hasNestedProperty(obj, key) {
    if (key == null) {
        return false
    }
    if (obj.hasOwnProperty(key)) {
        return true
    }
    return key.split(".").every(k => {
        if (obj && typeof obj === "object" && obj.hasOwnProperty(k)) {
            obj = obj[k]
            return true
        }
        return false
    })
}