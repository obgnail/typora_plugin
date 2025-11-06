const test = require("node:test")
const assert = require("node:assert")
const fs = require("node:fs/promises")

let settings, schemas, processedSchemas

function hasNestedProperty(obj, key) {
    if (key == null || typeof obj !== 'object' || obj === null) {
        return false
    }
    if (obj.hasOwnProperty(key)) {
        return true
    }

    let current = obj
    for (const k of key.split(".")) {
        if (current === null || typeof current !== "object" || !current.hasOwnProperty(k)) {
            return false
        }
        current = current[k]
    }
    return true
}

const isIgnored = (fixedName, key) => (
    (fixedName === "abc" && key.startsWith("VISUAL_OPTIONS"))
    || (fixedName === "markdownLint" && key.startsWith("rule_config"))
    || (fixedName === "marp" && key.startsWith("MARP_CORE_OPTIONS"))
)

const flattenKeys = (obj, prefix = [], result = new Set()) => {
    if (obj === null || typeof obj !== "object") {
        if (prefix.length > 0) {
            const genericKey = prefix.join(".").replace(/\.\d+/g, "")
            result.add(genericKey)
        }
        return result
    }
    for (const [key, val] of Object.entries(obj)) {
        if (val === null || typeof val !== "object") {
            const genericKey = [...prefix, key].join(".").replace(/\.\d+/g, "")
            result.add(genericKey)
        } else {
            flattenKeys(val, [...prefix, key], result)
        }
    }
    return result
}

test.before(async () => {
    const toml = require("../../plugin/global/core/lib/smol-toml.js")
    const [base, custom] = await Promise.all([
        fs.readFile("../plugin/global/settings/settings.default.toml", "utf-8"),
        fs.readFile("../plugin/global/settings/custom_plugin.default.toml", "utf-8")
    ])
    settings = { ...toml.parse(base), ...toml.parse(custom) }

    schemas = require("../../plugin/preferences/schemas.js")
    processedSchemas = {}
    Object.entries(schemas).forEach(([fixedName, boxes]) => {
        processedSchemas[fixedName] = boxes.map(box => ({
            ...box,
            fields: box.fields.filter(ctl => ctl.key && ctl.type !== "static" && ctl.type !== "action")
        }))
    })
})

test("Schema and Settings Key Synchronization", async t => {
    await t.test("Schema keys should exist in Settings (Schema -> Settings)", () => {
        Object.entries(processedSchemas).forEach(([fixedName, boxes]) => {
            const setting = settings[fixedName]
            assert.ok(
                setting,
                `[Sync Check] Schema "${fixedName}" (from schemas.js) is missing its corresponding top-level key in the settings TOML files.`
            )

            boxes.forEach(box => {
                box.fields.forEach(ctl => {
                    assert.ok(
                        hasNestedProperty(setting, ctl.key),
                        `[Schema -> Settings] Schema key "${fixedName}.${ctl.key}" (from schemas.js) was NOT found in the corresponding settings object.`
                    )
                })
            })
        })
    })

    await t.test("Settings keys should exist in Schema (Settings -> Schema)", () => {
        for (const [fixedName, setting] of Object.entries(settings)) {
            const boxes = processedSchemas[fixedName]
            assert.ok(
                boxes,
                `[Sync Check] Setting key "${fixedName}" (from settings TOML) is missing its corresponding entry in schemas.js.`
            )

            const settingsKeySet = flattenKeys(setting)
            const schemaKeySet = new Set(
                boxes
                    .flatMap(box => {
                        return box.fields.flatMap(field => {
                            return field.type === "table"
                                ? field.nestedBoxes.flatMap(b => b.fields.map(f => `${field.key}.${f.key}`))
                                : field.key
                        })
                    })
                    .map(e => e.replace(/\.\d+/g, ""))
            )
            for (const key of settingsKeySet) {
                assert.ok(
                    schemaKeySet.has(key) || isIgnored(fixedName, key),
                    `[Settings -> Schema] Setting key "${fixedName}.${key}" (from settings TOML) is NOT defined in schemas.js (and is not explicitly ignored).`
                )
            }
        }
    })
})

test("all schemas keys should be translated", async t => {
    const { i18n } = require("../../plugin/global/core/i18n.js")
    await i18n.init("zh-CN")

    const baseProps = ["label", "tooltip", "placeholder", "hintHeader", "hintDetail", "unit"]
    const specialProps = ["options", "thMap"]
    const checkTranslated = (newBox, isTranslated) => {
        if (newBox.title) {
            isTranslated(newBox.title, { property: "title", boxTitle: newBox.title })
        }
        newBox.fields.forEach(newField => {
            baseProps.forEach(prop => {
                if (newField[prop] != null) {
                    isTranslated(newField[prop], { property: prop, fieldKey: newField.key })
                }
            })
            specialProps.forEach(prop => {
                const propVal = newField[prop]
                if (propVal != null && typeof propVal === "object" && !Array.isArray(propVal)) {
                    Object.entries(propVal).forEach(([k, v]) => {
                        isTranslated(v, { property: prop, optionKey: k, fieldKey: newField.key })
                    })
                }
            })
            if (newField.nestedBoxes != null) {
                newField.nestedBoxes.forEach(box => checkTranslated(box, isTranslated))
            }
        })
    }

    Object.entries(schemas).forEach(([fixedName, boxes]) => {
        const isTranslated = (key, context) => {
            const ok = i18n.data[fixedName]?.[key] || i18n.data.settings?.[key]
            if (ok) return

            const contextMsg = [`schema: "${fixedName}"`, `key: "${key}"`]
            if (context.property) contextMsg.push(`property: "${context.property}"`)
            if (context.fieldKey) contextMsg.push(`field: "${context.fieldKey}"`)
            if (context.optionKey) contextMsg.push(`optionKey: "${context.optionKey}"`)
            if (context.boxTitle && !context.fieldKey) contextMsg.push(`(location: box title)`)

            assert.ok(ok, `[Translation] Missing translation for [${contextMsg.join(", ")}]`)
        }
        boxes.forEach(box => checkTranslated(box, isTranslated))
    })
})
