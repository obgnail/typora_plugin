const { describe, it, before } = require("node:test")
const assert = require("node:assert")
const proxyquire = require("proxyquire")

const { RULES, ALIAS_MAP, GROUPS, GROUP_NAMES, RULE_SCHEMA, DEFAULT_VALUES } = require("../../plugin/markdownlint/rule-definitions.js")

const RULE_PATTERN = /^MD\d+$/
const ruleEntries = Object.entries(RULES)

describe("rule-definitions.js - RULES data invariants", () => {
  it("every rule key matches MD\\d+", () => {
    for (const name of Object.keys(RULES)) {
      assert.match(name, RULE_PATTERN, `Rule key "${name}" does not match MD\\d+`)
    }
  })

  it("every rule declares at least one alias", () => {
    for (const [name, { aliases }] of ruleEntries) {
      assert.ok(Array.isArray(aliases) && aliases.length > 0, `Rule "${name}" has no alias`)
    }
  })

  it("alias keys must not use the MD\\d+ format (aliases must use kebab-case names)", () => {
    for (const [name, { aliases }] of ruleEntries) {
      for (const alias of aliases) {
        assert.doesNotMatch(
          alias,
          RULE_PATTERN,
          `Alias "${alias}" of rule "${name}" looks like a rule name (MD\\d+ format); aliases should use kebab-case names`,
        )
      }
    }
  })

  it("aliases are globally unique across all rules", () => {
    const seen = new Map()
    for (const [name, { aliases }] of ruleEntries) {
      for (const alias of aliases) {
        assert.ok(!seen.has(alias), `Alias "${alias}" is declared by both "${seen.get(alias)}" and "${name}"`)
        seen.set(alias, name)
      }
    }
  })

  it("alias keys must not collide with group names (both can appear as RULE_CONFIG top-level keys)", () => {
    const groupNames = new Set(GROUP_NAMES)
    for (const [name, { aliases }] of ruleEntries) {
      for (const alias of aliases) {
        assert.ok(!groupNames.has(alias), `Alias "${alias}" of rule "${name}" collides with group name "${alias}"`)
      }
    }
  })

  it("group names must not look like rule keys (MD\\d+) and must not collide with reserved keys", () => {
    const reserved = new Set(["default", "extends"])
    for (const group of GROUP_NAMES) {
      assert.doesNotMatch(group, RULE_PATTERN, `Group name "${group}" looks like a rule key`)
      assert.ok(!reserved.has(group), `Group name "${group}" collides with reserved key "${group}"`)
    }
  })

  it("every rule's default value is boolean true (unconfigurable) or a non-empty plain object (configurable), consistent with its `fields`", () => {
    for (const [name, { fields, default: def }] of ruleEntries) {
      if (fields === null) {
        assert.strictEqual(def, true, `Rule "${name}" has fields:null but default is not boolean true`)
      } else {
        assert.ok(
          def !== null && typeof def === "object" && !Array.isArray(def) && Object.keys(def).length > 0,
          `Rule "${name}" has fields defined but default is not a non-empty plain object (got: ${JSON.stringify(def)})`,
        )
      }
    }
  })

  it("every configurable rule's field keys exactly match its default value keys (set equality)", () => {
    for (const [name, { fields, default: def }] of ruleEntries) {
      if (fields === null) continue
      const fieldKeys = fields.map(fn => fn(name).key.slice(`${name}.`.length)).sort()
      const defaultKeys = Object.keys(def).sort()
      assert.deepStrictEqual(fieldKeys, defaultKeys, `Rule "${name}": field keys [${fieldKeys}] diverge from default value keys [${defaultKeys}]`)
    }
  })
})

describe("rule-definitions.js - derived views stay faithful to RULES", () => {
  it("ALIAS_MAP covers exactly the declared aliases, each mapping to its owning rule", () => {
    for (const [name, { aliases }] of ruleEntries) {
      for (const alias of aliases) assert.strictEqual(ALIAS_MAP[alias], name)
    }
    assert.strictEqual(Object.keys(ALIAS_MAP).length, ruleEntries.reduce((n, [, r]) => n + r.aliases.length, 0))
  })

  it("GROUPS maps every group to exactly the rules that declared it, with no duplicates", () => {
    for (const group of GROUP_NAMES) {
      const expected = ruleEntries.filter(([, r]) => r.groups.includes(group)).map(([name]) => name)
      assert.deepStrictEqual(GROUPS[group], expected, `Group "${group}" derivation mismatch`)
      assert.strictEqual(new Set(GROUPS[group]).size, GROUPS[group].length, `Group "${group}" has duplicate rules`)
    }
  })

  it("RULE_SCHEMA exposes exactly the declared fields per rule", () => {
    for (const [name, { fields }] of ruleEntries) {
      assert.strictEqual(RULE_SCHEMA[name], fields)
    }
  })

  it("DEFAULT_VALUES exposes default:true, extends:null, each rule's default, and true for each group", () => {
    assert.strictEqual(DEFAULT_VALUES.default, true)
    assert.strictEqual(DEFAULT_VALUES.extends, null)
    for (const [name, { default: def }] of ruleEntries) assert.deepStrictEqual(DEFAULT_VALUES[name], def)
    for (const group of GROUP_NAMES) assert.strictEqual(DEFAULT_VALUES[group], true)
  })

  it("DEFAULT_VALUES has no stray top-level keys beyond rules, groups, 'default' and 'extends'", () => {
    const allowed = new Set(["default", "extends", ...Object.keys(RULES), ...GROUP_NAMES])
    for (const key of Object.keys(DEFAULT_VALUES)) {
      assert.ok(allowed.has(key), `Unexpected key "${key}" in DEFAULT_VALUES`)
    }
  })
})

let schemaRules

before(() => {
  const configSchema = proxyquire("../../plugin/markdownlint/config-schema.js", {
    "../global/core/i18n.js": { t: (_ns, key) => key ?? _ns, "@global": true },
  })
  schemaRules = configSchema[1].fields
})

describe("Rule set consistency between config-schema.js and rule-definitions.js", () => {
  it("every rule in config-schema.js specificRules must exist in RULES", () => {
    for (const rule of schemaRules) {
      assert.ok(RULES[rule.key], `Rule "${rule.key}" is in config-schema.js specificRules but MISSING from RULES`)
    }
  })

  it("every rule in RULES must exist in config-schema.js specificRules", () => {
    const schemaRuleKeys = new Set(schemaRules.map(r => r.key))
    for (const key of Object.keys(RULES)) {
      assert.ok(schemaRuleKeys.has(key), `Rule "${key}" is in RULES but MISSING from config-schema.js specificRules`)
    }
  })

  it("the total number of rules must be equal in both", () => {
    assert.strictEqual(
      schemaRules.length,
      Object.keys(RULES).length,
      `Rule count mismatch: config-schema.js has ${schemaRules.length} rules, RULES has ${Object.keys(RULES).length} rules`,
    )
  })
})

describe("Rule type consistency (switch ↔ true, composite ↔ object)", () => {
  it("UnconfigurableRule (switch) in rendered schema must have boolean true in DEFAULT_VALUES", () => {
    for (const rule of schemaRules) {
      if (rule.type !== "switch") continue
      assert.strictEqual(
        DEFAULT_VALUES[rule.key],
        true,
        `Rule "${rule.key}" renders as switch but its default value is not boolean true`,
      )
    }
  })

  it("ConfigurableRule (composite) in rendered schema must have a plain object in DEFAULT_VALUES", () => {
    for (const rule of schemaRules) {
      if (rule.type !== "composite") continue
      const val = DEFAULT_VALUES[rule.key]
      assert.ok(
        val !== null && typeof val === "object" && !Array.isArray(val),
        `Rule "${rule.key}" renders as composite but its default value is not a plain object (got: ${JSON.stringify(val)})`,
      )
    }
  })

  it("boolean true in DEFAULT_VALUES must correspond to a switch in the rendered schema", () => {
    const schemaRuleMap = Object.fromEntries(schemaRules.map(r => [r.key, r]))
    for (const [name, { default: def }] of ruleEntries) {
      if (def !== true) continue
      assert.strictEqual(
        schemaRuleMap[name]?.type,
        "switch",
        `Rule "${name}" has default true but does NOT render as switch (got type: "${schemaRuleMap[name]?.type}")`,
      )
    }
  })

  it("object default values must correspond to a composite in the rendered schema", () => {
    const schemaRuleMap = Object.fromEntries(schemaRules.map(r => [r.key, r]))
    for (const [name, { default: def }] of ruleEntries) {
      if (def === null || typeof def !== "object" || Array.isArray(def)) continue
      assert.strictEqual(
        schemaRuleMap[name]?.type,
        "composite",
        `Rule "${name}" has an object default but does NOT render as composite (got type: "${schemaRuleMap[name]?.type}")`,
      )
    }
  })
})

describe("Configurable rule subfield consistency (no extra, no missing)", () => {
  function getSubfieldNames(rule) {
    const prefix = `${rule.key}.`
    return (rule.subSchema ?? [])
      .flatMap(box => box.fields ?? [])
      .map(f => {
        assert.ok(f.key.startsWith(prefix), `Subfield key "${f.key}" in rule "${rule.key}" does not start with expected prefix "${prefix}"`)
        return f.key.slice(prefix.length)
      })
  }

  it("rendered subfields must all exist in DEFAULT_VALUES (schema → defaults)", () => {
    for (const rule of schemaRules) {
      if (rule.type !== "composite") continue
      const defaultKeys = new Set(Object.keys(DEFAULT_VALUES[rule.key]))
      for (const name of getSubfieldNames(rule)) {
        assert.ok(defaultKeys.has(name), `Rule "${rule.key}": rendered subfield "${rule.key}.${name}" is NOT present in DEFAULT_VALUES`)
      }
    }
  })

  it("DEFAULT_VALUES keys must all exist as rendered subfields (defaults → schema)", () => {
    for (const rule of schemaRules) {
      if (rule.type !== "composite") continue
      const subfieldNames = new Set(getSubfieldNames(rule))
      for (const name of Object.keys(DEFAULT_VALUES[rule.key])) {
        assert.ok(subfieldNames.has(name), `Rule "${rule.key}": default value key "${name}" is NOT rendered as a subfield`)
      }
    }
  })

  it("rendered subfield names must exactly match DEFAULT_VALUES keys (set equality)", () => {
    for (const rule of schemaRules) {
      if (rule.type !== "composite") continue
      const subfieldSet = new Set(getSubfieldNames(rule))
      const defaultSet = new Set(Object.keys(DEFAULT_VALUES[rule.key]))
      const onlyInSchema = [...subfieldSet].filter(k => !defaultSet.has(k))
      const onlyInDefaults = [...defaultSet].filter(k => !subfieldSet.has(k))
      assert.deepStrictEqual(onlyInSchema, [], `Rule "${rule.key}": subfield(s) [${onlyInSchema}] rendered but NOT in DEFAULT_VALUES`)
      assert.deepStrictEqual(onlyInDefaults, [], `Rule "${rule.key}": key(s) [${onlyInDefaults}] in DEFAULT_VALUES but NOT rendered`)
    }
  })
})

describe("Subfield key format validation", () => {
  it("every rendered subfield key must follow the 'MDxxx.fieldname' format, prefixed with its parent rule name", () => {
    const SUBFIELD_PATTERN = /^MD\d+\.\w+$/
    for (const rule of schemaRules) {
      if (rule.type !== "composite") continue
      const subFields = (rule.subSchema ?? []).flatMap(box => box.fields ?? [])
      for (const field of subFields) {
        assert.match(field.key, SUBFIELD_PATTERN, `Rule "${rule.key}": subfield key "${field.key}" does not match "MDxxx.fieldname"`)
        assert.ok(field.key.startsWith(`${rule.key}.`), `Rule "${rule.key}": subfield key "${field.key}" must start with "${rule.key}."`)
      }
    }
  })
})

describe("dependsOn -> dependencies reference integrity", () => {
  it("every dependency key references a real sibling switch field within the same rule", () => {
    for (const [name, { fields }] of ruleEntries) {
      if (fields === null) continue
      const rendered = fields.map(fn => fn(name))
      const siblings = Object.fromEntries(rendered.map(f => [f.key, f]))
      for (const field of rendered) {
        if (!field.dependencies) continue
        for (const [depKey, depVal] of Object.entries(field.dependencies)) {
          assert.ok(depKey.startsWith(`${name}.`), `Rule "${name}": dependency "${depKey}" of "${field.key}" is not scoped to its own rule`)
          assert.ok(siblings[depKey], `Rule "${name}": field "${field.key}" depends on "${depKey}" which is NOT a declared field of "${name}"`)
          assert.strictEqual(
            siblings[depKey].type,
            "switch",
            `Rule "${name}": dependency "${depKey}" has type "${siblings[depKey].type}"; dependencies only make sense on boolean switches`,
          )
          assert.strictEqual(typeof depVal, "boolean", `Rule "${name}": dependency value for "${depKey}" must be boolean (got: ${JSON.stringify(depVal)})`)
        }
      }
    }
  })

  it("no field depends on itself", () => {
    for (const [name, { fields }] of ruleEntries) {
      if (fields === null) continue
      for (const fn of fields) {
        const field = fn(name)
        assert.ok(!field.dependencies?.[field.key], `Rule "${name}": field "${field.key}" depends on itself`)
      }
    }
  })
})

describe("field default value type matches rendered control type", () => {
  const validators = {
    switch: (v) => typeof v === "boolean",
    number: (v) => typeof v === "number" && Number.isInteger(v),
    text: (v) => typeof v === "string",
    select: (v) => typeof v === "string",
    array: (v) => Array.isArray(v),
  }

  it("every subfield's default value matches its control type (and integer bounds)", () => {
    const ignored = {
      MD022: ["lines_above", "lines_below"],
    }
    for (const [name, { fields, default: def }] of ruleEntries) {
      if (fields === null) continue
      for (const fn of fields) {
        const field = fn(name)
        const subKey = field.key.slice(`${name}.`.length)
        const val = def[subKey]
        const validate = validators[field.type]
        assert.ok(validate, `Rule "${name}": unknown field type "${field.type}" for "${field.key}" -- update validators map`)
        if (ignored[name] && !ignored[name].includes(subKey)) {
          assert.ok(
            validate(val),
            `Rule "${name}": default of "${subKey}" is ${JSON.stringify(val)} but control type "${field.type}" requires a different type`,
          )
        }
        if (field.type === "number") {
          if (field.min !== undefined) assert.ok(val >= field.min, `Rule "${name}": default "${subKey}"=${val} < min=${field.min}`)
          if (field.max !== undefined) assert.ok(val <= field.max, `Rule "${name}": default "${subKey}"=${val} > max=${field.max}`)
        }
      }
    }
  })

  it("integer fields with min/max must satisfy min <= max", () => {
    for (const [name, { fields }] of ruleEntries) {
      if (fields === null) continue
      for (const fn of fields) {
        const field = fn(name)
        if (field.type === "number" && field.min !== undefined && field.max !== undefined) {
          assert.ok(field.min <= field.max, `Rule "${name}": field "${field.key}" has min=${field.min} > max=${field.max}`)
        }
      }
    }
  })
})

describe("Select_ default value membership", () => {
  it("every select field's default value must be one of its declared options", () => {
    for (const [name, { fields, default: def }] of ruleEntries) {
      if (fields === null) continue
      for (const fn of fields) {
        const field = fn(name)
        if (field.type !== "select") continue
        const subKey = field.key.slice(`${name}.`.length)
        const val = def[subKey]
        const options = Object.keys(field.options)
        assert.ok(options.length > 0, `Rule "${name}": select field "${field.key}" has no options`)
        assert.ok(
          options.includes(val),
          `Rule "${name}": default "${subKey}"=${JSON.stringify(val)} is not one of select options [${options.join(", ")}]`,
        )
      }
    }
  })
})

describe("config-schema.js top-level Box structure", () => {
  it("configSchema has exactly 4 boxes: global configs, specific rules, rule groups, actions", () => {
    const configSchema = proxyquire("../../plugin/markdownlint/config-schema.js", {
      "../global/core/i18n.js": { t: (_ns, key) => key ?? _ns, "@global": true },
    })
    assert.strictEqual(configSchema.length, 4, `Expected 4 top-level boxes, got ${configSchema.length}`)
    assert.strictEqual(configSchema[0].title, undefined, "Box[0] (globalConfigs) must be an UntitledBox")
    assert.strictEqual(configSchema[3].title, undefined, "Box[3] (actions) must be an UntitledBox")
    assert.strictEqual(configSchema[1].title, "title.specificRules", "Box[1] title must be the 'title.specificRules' i18n key")
    assert.strictEqual(configSchema[2].title, "title.ruleGroups", "Box[2] title must be the 'title.ruleGroups' i18n key")
  })

  it("globalConfigs box contains exactly a disabled 'default' switch and an 'extends' text field", () => {
    const configSchema = proxyquire("../../plugin/markdownlint/config-schema.js", {
      "../global/core/i18n.js": { t: (_ns, key) => key ?? _ns, "@global": true },
    })
    const fields = configSchema[0].fields
    assert.deepStrictEqual(fields.map(f => f.key).sort(), ["default", "extends"])
    const byKey = Object.fromEntries(fields.map(f => [f.key, f]))
    assert.strictEqual(byKey.default.type, "switch", `"default" must render as a switch`)
    assert.strictEqual(byKey.default.disabled, true, `"default" switch must be disabled (it mirrors the markdownlint 'default' setting)`)
    assert.strictEqual(byKey.extends.type, "text", `"extends" must render as a text field`)
  })

  it("ruleGroups box contains exactly one switch per group, with explain listing member rules", () => {
    const configSchema = proxyquire("../../plugin/markdownlint/config-schema.js", {
      "../global/core/i18n.js": { t: (_ns, key) => key ?? _ns, "@global": true },
    })
    const fields = configSchema[2].fields
    assert.deepStrictEqual(
      fields.map(f => f.key).sort(),
      [...GROUP_NAMES].sort(),
      `Group switches diverge from GROUP_NAMES`,
    )
    for (const f of fields) {
      assert.strictEqual(f.type, "switch", `Group "${f.key}" must render as a switch`)
      assert.strictEqual(f.explain, GROUPS[f.key].join("、"), `Group "${f.key}": explain must list its member rules`)
    }
  })

  it("actions box contains exactly 'viewRules' and 'restoreRules', and no action leaks into rule/group boxes", () => {
    const configSchema = proxyquire("../../plugin/markdownlint/config-schema.js", {
      "../global/core/i18n.js": { t: (_ns, key) => key ?? _ns, "@global": true },
    })
    const actionKeys = configSchema[3].fields.filter(f => f.type === "action").map(f => f.key).sort()
    assert.deepStrictEqual(actionKeys, ["restoreRules", "viewRules"])
    for (const boxIdx of [0, 1, 2]) {
      const leaked = configSchema[boxIdx].fields.filter(f => f.type === "action").map(f => f.key)
      assert.deepStrictEqual(leaked, [], `Action(s) [${leaked}] leaked into configSchema[${boxIdx}]`)
    }
    const stray = schemaRules.filter(f => f.type === "action").map(f => f.key)
    assert.deepStrictEqual(stray, [], `Action(s) [${stray}] found among specificRules`)
  })
})

describe("rule i18n coverage in locale files", () => {
  const I18N_FILES = require("./fixtures/i18n_files.js")

  // Record every (namespace, key) pair that config-schema.js requests at render time.
  // "@global": true makes the stub apply to schema-builders.js as well (it also requires i18n.js).
  const i18nCalls = []
  before(() => {
    proxyquire("../../plugin/markdownlint/config-schema.js", {
      "../global/core/i18n.js": {
        t: (ns, key) => {
          i18nCalls.push([ns, key])
          return key ?? ns
        },
        "@global": true,
      },
    })
    assert.ok(i18nCalls.length > 0, "no i18n.t calls recorded -- stub may be stale")
  })

  const lookup = (obj, ns, key) => obj[ns]?.[key] ?? obj.global?.[key]

  it("every i18n key requested by config-schema.js exists in every locale file", () => {
    for (const file of Object.values(I18N_FILES)) {
      const missing = i18nCalls
        .filter(([ns, key]) => lookup(file.obj, ns, key) === undefined)
        .map(([ns, key]) => `${ns}:${key}`)
      assert.deepStrictEqual(missing, [], `[${file.name}] missing ${missing.length} markdownlint translation(s)`)
    }
  })

  it("all requested markdownlint translations are non-empty strings", () => {
    for (const file of Object.values(I18N_FILES)) {
      for (const [ns, key] of i18nCalls) {
        const val = lookup(file.obj, ns, key)
        if (val === undefined) continue // covered by the existence test above
        assert.ok(
          typeof val === "string" && val.trim().length > 0,
          `[${file.name}] "${ns}:${key}" must be a non-empty string (got: ${JSON.stringify(val)})`,
        )
      }
    }
  })

  it("en locale has no untranslated CJK residue in markdownlint keys", () => {
    const en = I18N_FILES["en"]
    assert.ok(en, "en.json not found in plugin/global/locales")
    const residue = i18nCalls
      .filter(([ns, key]) => /[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/.test(lookup(en.obj, ns, key) ?? ""))
      .map(([ns, key]) => `${ns}:${key}`)
    assert.deepStrictEqual(residue, [], `[en] untranslated CJK text in: ${residue.join(", ")}`)
  })

  it("every rule name (MDxxx) is translated in every locale", () => {
    for (const file of Object.values(I18N_FILES)) {
      for (const name of Object.keys(RULES)) {
        assert.ok(
          typeof file.obj.markdownlint?.[name] === "string" && file.obj.markdownlint[name].trim().length > 0,
          `[${file.name}] missing rule name translation: "markdownlint:${name}"`,
        )
      }
    }
  })

  it("every configurable rule subfield label (label.MDxxx.field) is translated in every locale", () => {
    for (const file of Object.values(I18N_FILES)) {
      for (const [name, { fields }] of ruleEntries) {
        if (fields === null) continue
        for (const fn of fields) {
          const key = `label.${fn(name).key}` // e.g. "label.MD001.front_matter_title"
          assert.ok(
            typeof file.obj.markdownlint?.[key] === "string" && file.obj.markdownlint[key].trim().length > 0,
            `[${file.name}] missing subfield label: "markdownlint:${key}"`,
          )
        }
      }
    }
  })

  it("every group name and static UI key is translated in every locale", () => {
    const staticKeys = [
      "label.default",
      "label.extends",
      "title.specificRules",
      "title.ruleGroups",
      "$tooltip.viewMarkdownlintRules",
    ]
    for (const file of Object.values(I18N_FILES)) {
      for (const key of staticKeys) {
        assert.ok(
          typeof file.obj.markdownlint?.[key] === "string" && file.obj.markdownlint[key].trim().length > 0,
          `[${file.name}] missing translation: "markdownlint:${key}"`,
        )
      }
    }
  })
})

describe("index.js hardcoded MDxxx.field keys stay in sync with RULE_SCHEMA", () => {
  it("every \"MDxxx.field\" string literal in index.js must resolve to a real field in RULE_SCHEMA", () => {
    const indexSrc = require("fs").readFileSync(require.resolve("../../plugin/markdownlint/index.js"), "utf8")
    const keys = [...indexSrc.matchAll(/"(MD\d+)\.(\w+)"/g)].map(m => ({ rule: m[1], field: m[2] }))
    assert.ok(keys.length > 0, "no \"MDxxx.field\" literals found in index.js -- regex may be stale, update it")
    for (const { rule, field } of keys) {
      const fields = RULE_SCHEMA[rule]
      assert.ok(fields, `index.js references "${rule}.${field}" but rule "${rule}" has no configurable fields (fields=null or unknown rule)`)
      const fieldNames = fields.map(fn => fn(rule).key.slice(`${rule}.`.length))
      assert.ok(
        fieldNames.includes(field),
        `index.js references "${rule}.${field}" but rule "${rule}"'s actual fields are [${fieldNames.join(", ")}]`,
      )
    }
  })
})
