const { describe, it, before } = require("node:test")
const assert = require("node:assert")
const { nestedPropertyHelpers } = require("./mocks/utils.mock.js")

let SETTINGS
let SCHEMAS

let RULES, ACTIONS, PREPROCESSORS, WATCHERS

const ALLOWED_UNUSED_KEYS = {
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
  hotkeys: ["$label.CUSTOM_HOTKEYS.evil"],
  action_buttons: ["$label.buttons.evil"],
  slash_commands: ["$label.COMMANDS.callback"],
  sidebar_enhance: ["$tooltip.canCollapseOutlinePanel"],
  markdownlint: ["$label.invokeMarkdownlintSettings"],
}

const isIgnored = (fixedName, key) => (
  (fixedName === "abc" && key.startsWith("RENDER_OPTIONS"))
  || (fixedName === "marp" && key.startsWith("MARP_CORE_OPTIONS"))
  || (fixedName === "markdownlint" && key.startsWith("RULE_CONFIG"))
  || (fixedName === "remote_control" && key.startsWith("ALLOWED_METHODS"))
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

const traverseTree = (boxes, onBox = null, onField = null, prefix = "") => {
  boxes?.forEach(box => {
    onBox?.(box, prefix)
    box.fields?.forEach(field => {
      onField?.(field, prefix)
      const nextPrefix = field.key ? (prefix ? `${prefix}.${field.key}` : field.key) : prefix
      if (field.nestedBoxes) traverseTree(field.nestedBoxes, onBox, onField, nextPrefix)
      if (field.subSchema) traverseTree(field.subSchema, onBox, onField, nextPrefix)
      field.tabs?.forEach(tab => traverseTree(tab.schema, onBox, onField, nextPrefix))
    })
  })
}

const extractI18nKeys = (boxes, onKeyFound) => {
  const handleKey = (key, context) => {
    if (key == null) return
    if (Array.isArray(key)) {
      key.forEach(k => handleKey(k, context))
      return
    }
    if (typeof key === "object" && typeof key.text === "string") {
      onKeyFound(key.text, context)
      return
    }
    if (typeof key === "string") {
      onKeyFound(key, context)
    }
  }

  traverseTree(boxes,
    box => {
      handleKey(box.title, { property: "title" })
      handleKey(box.tooltip, { property: "tooltip" })
    },
    field => {
      const ctx = (prop, extra = {}) => ({ property: prop, fieldKey: field.key, ...extra })

      handleKey(field.label, ctx("label"))
      handleKey(field.explain, ctx("explain"))
      handleKey(field.placeholder, ctx("placeholder"))
      handleKey(field.hintHeader, ctx("hintHeader"))
      handleKey(field.hintDetail, ctx("hintDetail"))
      handleKey(field.divider, ctx("divider"))
      handleKey(field.unit, ctx("unit"))
      handleKey(field.tooltip, ctx("tooltip"))

      if (field.options && typeof field.options === "object") {
        Object.entries(field.options).forEach(([k, v]) => handleKey(v, ctx("options", { optionKey: k })))
      }
      if (field.thMap && typeof field.thMap === "object") {
        Object.entries(field.thMap).forEach(([k, v]) => handleKey(v, ctx("thMap", { optionKey: k })))
      }
      if (field.tabs) {
        field.tabs.forEach(tab => handleKey(tab.label, ctx("tab.label")))
      }
    },
  )
}

before(async () => {
  SETTINGS = await require("./fixtures/settings.js").load()
  SCHEMAS = require("./fixtures/schemas.js").get(undefined)

  const mockPlugin = require("./mocks/plugin.mock.js")
  RULES = require("../../plugin/preferences/rules.js")
  ACTIONS = require("../../plugin/preferences/actions.js")(mockPlugin)
  PREPROCESSORS = require("../../plugin/preferences/preprocessors.js")(mockPlugin)
  WATCHERS = require("../../plugin/preferences/watchers.js")(mockPlugin)
})

describe("Schema and Settings Key Synchronization", () => {
  it("Schema keys should exist in Settings (Schema -> Settings)", () => {
    Object.entries(SCHEMAS).forEach(([fixedName, boxes]) => {
      const setting = SETTINGS[fixedName]
      assert.ok(
        setting,
        `[Sync Check] Schema "${fixedName}" (from schemas.js) is missing its corresponding top-level key in the settings TOML files.`,
      )

      boxes.forEach(box => {
        (box.fields || []).forEach(field => {
          if (field.key && !["static", "action"].includes(field.type)) {
            assert.ok(
              nestedPropertyHelpers.has(setting, field.key),
              `[Schema -> Settings] Schema key "${fixedName}.${field.key}" (from schemas.js) was NOT found in the corresponding settings object.`,
            )
          }
        })
      })
    })
  })

  it("Settings keys should exist in Schema (Settings -> Schema)", () => {
    for (const [fixedName, setting] of Object.entries(SETTINGS)) {
      const boxes = SCHEMAS[fixedName]
      assert.ok(
        boxes,
        `[Sync Check] Setting key "${fixedName}" (from settings TOML) is missing its corresponding entry in schemas.js.`,
      )

      const settingsKeySet = flattenKeys(setting)
      const schemaKeySet = new Set()

      traverseTree(boxes, null, (field, prefix) => {
        if (field.key && !["static", "action"].includes(field.type)) {
          const path = (prefix ? `${prefix}.${field.key}` : field.key).replace(/\.\d+/g, "")
          schemaKeySet.add(path)
        }
      })

      for (const key of settingsKeySet) {
        assert.ok(
          schemaKeySet.has(key) || isIgnored(fixedName, key),
          `[Settings -> Schema] Setting key "${fixedName}.${key}" (from settings TOML) is NOT defined in schemas.js (and is not explicitly ignored).`,
        )
      }
    }
  })
})

describe("Schemas Translate", async () => {
  it("all schemas keys should be translated", async () => {
    const i18n = await require("./fixtures/i18n.js").get("zh-CN")

    Object.entries(SCHEMAS).forEach(([fixedName, boxes]) => {
      extractI18nKeys(boxes, (key, context = {}) => {
        const ok = i18n.data[fixedName]?.[key] || i18n.data.settings?.[key]
        const contextMsg = [`schema: "${fixedName}"`, `key: "${key}"`]
        if (context.property) contextMsg.push(`property: "${context.property}"`)
        if (context.fieldKey) contextMsg.push(`field: "${context.fieldKey}"`)
        if (context.optionKey) contextMsg.push(`optionKey: "${context.optionKey}"`)
        assert.ok(
          ok,
          `[Translation] Missing translation for [${contextMsg.join(", ")}]`,
        )
      })
    })
  })
})

describe("all i18n keys starting with $ should be used in schemas", async () => {
  const i18n = await require("./fixtures/i18n.js").get("zh-CN")

  const getAllI18NKeys = async () => {
    return Object.fromEntries(
      Object.entries(i18n.data).map(([fixedName, data]) => {
        const keys = new Set(Object.keys(data).filter(key => key.startsWith("$")))
        return [fixedName, keys]
      }),
    )
  }

  const filterUsedKeys = (allI18NKeys, schemas) => {
    for (const [fixedName, boxes] of Object.entries(schemas)) {
      extractI18nKeys(boxes, key => {
        if (allI18NKeys[fixedName].has(key)) {
          allI18NKeys[fixedName].delete(key)
        } else if (allI18NKeys.settings.has(key)) {
          allI18NKeys.settings.delete(key)
        }
      })
    }
  }

  const filterAllowedUnusedKeys = (allI18NKeys) => {
    Object.entries(ALLOWED_UNUSED_KEYS).forEach(([fixedName, keys]) => {
      keys.forEach(key => allI18NKeys[fixedName].delete(key))
    })
  }

  it("should not have unused i18n keys", async () => {
    const allI18NKeys = await getAllI18NKeys()
    filterUsedKeys(allI18NKeys, SCHEMAS)
    filterAllowedUnusedKeys(allI18NKeys)

    Object.entries(allI18NKeys).forEach(([fixedName, keys]) => {
      if (fixedName === "settings") return
      assert.ok(
        keys.size === 0,
        `[Unused i18n Keys] Found ${fixedName} unused i18n key(s):\n  - ${[...keys].join("\n  - ")}\n`,
      )
    })
  })
})

describe("Action Consistency Check: Defined vs Used", () => {
  it("should have consistent actions between definitions and usage", () => {
    const definedActions = new Set(Object.keys(ACTIONS))
    const ignoredActions = new Set(["invokeMarkdownlintSettings", "togglePreferencePanel"])
    const usedActions = new Set()

    const collectFromTooltip = (tooltip) => {
      if (!tooltip) return
      if (Array.isArray(tooltip)) {
        tooltip.forEach(collectFromTooltip)
      } else if (typeof tooltip === "object" && tooltip.action) {
        usedActions.add(tooltip.action)
      }
    }

    Object.values(SCHEMAS).forEach(boxes => {
      traverseTree(boxes,
        box => collectFromTooltip(box.tooltip),
        field => {
          collectFromTooltip(field.tooltip)
          if (field.type === "action") {
            usedActions.add(field.key)
          }
        },
      )
    })

    const undefinedUsage = [...usedActions].filter(key => !ignoredActions.has(key) && !definedActions.has(key))
    const unusedDefinitions = [...definedActions].filter(key => !ignoredActions.has(key) && !usedActions.has(key))
    assert.deepStrictEqual(
      undefinedUsage,
      [],
      `[Action Error] Found actions used in 'schemas.js' but NOT defined in 'actions.js':`,
    )
    assert.deepStrictEqual(
      unusedDefinitions,
      [],
      `[Action Error] Found actions defined in 'actions.js' but NEVER used in 'schemas.js' (Dead code):`,
    )
  })
})

describe("Schema rules and Settings Key Synchronization", () => {
  it("should have synchronized schema rules with settings", () => {
    Object.entries(RULES).forEach(([fixedName, rules]) => {
      assert.ok(
        Object.hasOwn(SETTINGS, fixedName),
        `[Schema rules -> Settings] Schema rules key "${fixedName}" was NOT found in the corresponding settings object.`,
      )
      Object.keys(rules).forEach(key => {
        assert.ok(
          nestedPropertyHelpers.has(SETTINGS, `${fixedName}.${key}`),
          `[Schema rules -> Settings] Schema rules key "${fixedName}.${key}" was NOT found in the corresponding settings object.`,
        )
      })
    })
  })
})

describe("Schema preprocessors and Settings Key Synchronization", () => {
  it("should have synchronized schema preprocessors with settings", () => {
    delete PREPROCESSORS?.global?.pluginVersion
    Object.entries(PREPROCESSORS).forEach(([fixedName, preprocessors]) => {
      assert.ok(
        Object.hasOwn(SETTINGS, fixedName),
        `[Schema preprocessors -> Settings] Schema preprocessors key "${fixedName}" was NOT found in the corresponding settings object.`,
      )

      Object.keys(preprocessors).forEach(key => {
        assert.ok(
          nestedPropertyHelpers.has(SETTINGS, `${fixedName}.${key}`),
          `[Schema preprocessors -> Settings] Schema preprocessors key "${fixedName}.${key}" was NOT found in the corresponding settings object.`,
        )
      })
    })
  })
})

describe("Schema watchers and Settings Key Synchronization", () => {
  it("should have synchronized schema watchers with settings", () => {
    Object.keys(WATCHERS).forEach((fixedName) => {
      assert.ok(
        Object.hasOwn(SETTINGS, fixedName),
        `[Schema watchers -> Settings] Schema watchers key "${fixedName}" was NOT found in the corresponding settings object.`,
      )
    })
  })
})
