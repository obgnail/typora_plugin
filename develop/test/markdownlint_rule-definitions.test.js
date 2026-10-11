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
