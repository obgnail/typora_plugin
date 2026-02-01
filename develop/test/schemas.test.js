const test = require("node:test")
const assert = require("node:assert")

let settings
let rawSchemas, filteredRawSchemas
let i18n
let actionsMap

const hasNestedProperty = (obj, key) => {
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
    const { base, custom } = await require("./fixtures/settings.js").getDefaults()
    settings = { ...base, ...custom }
})

test.before(async () => {
    i18n = await require("./fixtures/i18n.js").get("zh-CN")
})


test.before(() => {
    rawSchemas = require("./fixtures/schemas.js").get(undefined)
    filteredRawSchemas = Object.fromEntries(
        Object.entries(rawSchemas).map(([fixedName, boxes]) => {
            const newBoxes = boxes.map(box => ({
                ...box,
                fields: box.fields.filter(f => f.key && !["static", "action"].includes(f.type)),
            }))
            return [fixedName, newBoxes]
        })
    )
})

test.before(() => {
    const mockPlugin = {
        utils: require("./mocks/utils.mock.js"),
        i18n,
    }
    actionsMap = require("../../plugin/preferences/actions.js")(mockPlugin)
})

test("Schema and Settings Key Synchronization", async t => {
    await t.test("Schema keys should exist in Settings (Schema -> Settings)", () => {
        Object.entries(filteredRawSchemas).forEach(([fixedName, boxes]) => {
            const setting = settings[fixedName]
            assert.ok(
                setting,
                `[Sync Check] Schema "${fixedName}" (from schemas.js) is missing its corresponding top-level key in the settings TOML files.`
            )

            boxes.forEach(box => {
                box.fields.forEach(field => {
                    assert.ok(
                        hasNestedProperty(setting, field.key),
                        `[Schema -> Settings] Schema key "${fixedName}.${field.key}" (from schemas.js) was NOT found in the corresponding settings object.`
                    )
                })
            })
        })
    })

    await t.test("Settings keys should exist in Schema (Settings -> Schema)", () => {
        for (const [fixedName, setting] of Object.entries(settings)) {
            const boxes = filteredRawSchemas[fixedName]
            assert.ok(
                boxes,
                `[Sync Check] Setting key "${fixedName}" (from settings TOML) is missing its corresponding entry in schemas.js.`
            )

            const settingsKeySet = flattenKeys(setting)
            const schemaKeySet = new Set(
                boxes
                    .flatMap(box => {
                        return box.fields.flatMap(field => {
                            const nested = field.nestedBoxes ?? field.subSchema
                            return nested?.flatMap(b => b.fields.map(f => `${field.key}.${f.key}`)) ?? field.key
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
    const boxProps = ["title", "tooltip"]
    const baseProps = ["label", "explain", "tooltip", "placeholder", "hintHeader", "hintDetail", "divider", "unit"]
    const specialProps = ["options", "thMap"]
    const nestedFieldProps = ["nestedBoxes", "subSchema"]
    const checkTranslated = (newBox, isTranslated) => {
        boxProps.forEach(prop => {
            if (newBox[prop]) {
                isTranslated(newBox[prop], { property: prop, value: newBox[prop] })
            }
        })
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
            nestedFieldProps.forEach(prop => {
                newField[prop]?.forEach(box => checkTranslated(box, isTranslated))
            })
        })
    }

    Object.entries(rawSchemas).forEach(([fixedName, boxes]) => {
        const isTranslated = (key, context) => {
            if (Array.isArray(key)) {
                key.forEach(k => isTranslated(k, context))
                return
            }
            if (typeof key === "object" && key.text != null) {
                key = key.text
            }

            const ok = i18n.data[fixedName]?.[key] || i18n.data.settings?.[key]
            if (ok) return

            const contextMsg = [`schema: "${fixedName}"`, `key: "${key}"`]
            if (context.property) contextMsg.push(`property: "${context.property}"`)
            if (context.value) contextMsg.push(`value: "${JSON.stringify(context.value)}"`)
            if (context.fieldKey) contextMsg.push(`field: "${context.fieldKey}"`)
            if (context.optionKey) contextMsg.push(`optionKey: "${context.optionKey}"`)
            assert.ok(
                ok,
                `[Translation] Missing translation for [${contextMsg.join(", ")}]`
            )
        }
        boxes.forEach(box => checkTranslated(box, isTranslated))
    })
})

test("all i18n keys starting with $ should be used in schemas", async t => {
    const getAllI18NKeys = async () => {
        return Object.fromEntries(
            Object.entries(i18n.data).map(([fixedName, data]) => {
                const keys = new Set(
                    [...Object.keys(data)].filter(key => key.startsWith("$"))
                )
                return [fixedName, keys]
            })
        )
    }

    const filterUsedKeys = (allI18NKeys, schemas) => {
        const boxProps = ["title", "tooltip"]
        const baseFieldProps = ["label", "explain", "tooltip", "placeholder", "hintHeader", "hintDetail", "divider", "unit"]
        const specialFieldProps = ["options", "thMap"]
        const nestedFieldProps = ["nestedBoxes", "subSchema"]
        const _filterUsedKeys = (fixedName, key) => {
            if (key == null) return
            if (Array.isArray(key)) {
                key.forEach(k => _filterUsedKeys(fixedName, k))
                return
            }
            if (typeof key === "object" && typeof key.text === "string") {
                key = key.text
            }
            if (allI18NKeys[fixedName].has(key)) {
                allI18NKeys[fixedName].delete(key)
            } else if (allI18NKeys.settings.has(key)) {
                allI18NKeys.settings.delete(key)
            }
        }
        for (const [fixedName, boxes] of Object.entries(schemas)) {
            for (const box of boxes) {
                for (const prop of boxProps) {
                    _filterUsedKeys(fixedName, box[prop])
                }
                for (const field of box.fields || []) {
                    for (const prop of baseFieldProps) {
                        _filterUsedKeys(fixedName, field[prop])
                    }
                    for (const prop of specialFieldProps) {
                        const propVal = field[prop]
                        if (propVal && typeof propVal === "object") {
                            for (const v of Object.values(propVal)) {
                                _filterUsedKeys(fixedName, v)
                            }
                        }
                    }
                    for (const prop of nestedFieldProps) {
                        if (field[prop]) {
                            filterUsedKeys(allI18NKeys, { [fixedName]: field[prop] })
                        }
                    }
                }
            }
        }
    }

    const filterAllowedUnusedKeys = (allI18NKeys) => {
        const allowedUnusedKeys = {
            settings: ["$tooltip.lowVersion"],
            markmap: [
                "$option.TITLE_BAR_BUTTONS.shrink",
                "$option.TITLE_BAR_BUTTONS.pinRecover",
                "$option.TITLE_BAR_BUTTONS.hideToolbar",
                "$option.TITLE_BAR_BUTTONS.showToolbar",
            ],
            fence_enhance: [
                "$label.CUSTOM_BUTTONS.ON_INIT",
                "$label.CUSTOM_BUTTONS.ON_RENDER",
                "$label.CUSTOM_BUTTONS.ON_CLICK",
                "$title.CUSTOM_HOTKEYS.DISABLE",
                "$title.CUSTOM_HOTKEYS.HOTKEY",
            ],
            sidebar_enhance: ["$tooltip.canCollapseOutlinePanel"],
            slash_commands: ["$label.COMMANDS.callback"],
            hotkeys: ["$label.CUSTOM_HOTKEYS.evil"],
            markdownLint: ["$label.invokeMarkdownLintSettings"],
            chineseSymbolAutoPairer: ["$tooltip.enablePairing"],
            quickButton: ["$label.buttons.evil"],
        }
        Object.entries(allowedUnusedKeys).forEach(([fixedName, keys]) => {
            keys.forEach(key => allI18NKeys[fixedName].delete(key))
        })
    }

    const allI18NKeys = await getAllI18NKeys()
    filterUsedKeys(allI18NKeys, rawSchemas)
    filterAllowedUnusedKeys(allI18NKeys)

    Object.entries(allI18NKeys).forEach(([fixedName, keys]) => {
        assert.ok(
            keys.size === 0,
            `[Unused i18n Keys] Found ${fixedName} unused i18n key(s):\n  - ${[...keys].join("\n  - ")}\n`
        )
    })
})

test("Action Consistency Check: Defined vs Used", t => {
    const definedActions = new Set(Object.keys(actionsMap))
    const ignoredActions = new Set(["invokeMarkdownLintSettings", "togglePreferencePanel"])
    const usedActions = new Set()

    const collectFromTooltip = (tooltip) => {
        if (!tooltip) return
        if (Array.isArray(tooltip)) {
            tooltip.forEach(collectFromTooltip)
        } else if (typeof tooltip === "object" && tooltip.action) {
            usedActions.add(tooltip.action)
        }
    }

    Object.values(rawSchemas).forEach(boxes => {
        boxes.forEach(box => {
            collectFromTooltip(box.tooltip)
            box.fields.forEach(field => {
                const { type, key, tooltip } = field
                collectFromTooltip(tooltip)
                if (type === "action") {
                    usedActions.add(key)
                }
            })
        })
    })

    const undefinedUsage = [...usedActions].filter(key => !ignoredActions.has(key) && !definedActions.has(key))
    const unusedDefinitions = [...definedActions].filter(key => !ignoredActions.has(key) && !usedActions.has(key))
    assert.deepStrictEqual(
        undefinedUsage,
        [],
        `[Action Error] Found actions used in 'schemas.js' but NOT defined in 'actions.js':`
    )
    assert.deepStrictEqual(
        unusedDefinitions,
        [],
        `[Action Error] Found actions defined in 'actions.js' but NEVER used in 'schemas.js' (Dead code):`
    )
})
