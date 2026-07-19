const { describe, it, before } = require("node:test")
const assert = require("node:assert")
const proxyquire = require("proxyquire")

const RULE_DEFAULT_VALUES = require("../../plugin/markdownlint/rule-default-values.json")

const RULE_PATTERN = /^MD\d+$/
const defaultRuleEntries = Object.entries(RULE_DEFAULT_VALUES).filter(([key]) => RULE_PATTERN.test(key))
const defaultRuleKeys = new Set(defaultRuleEntries.map(([key]) => key))
let schemaRules

before(() => {
  const configSchema = proxyquire("../../plugin/markdownlint/config-schema.js", {
    "../global/core/i18n.js": { t: (_ns, key) => key ?? _ns },
  })
  schemaRules = configSchema[1].fields
})

describe("Rule set consistency between config-schema.js and rule-default-values.json", () => {
  it("every rule in config-schema.js specificRules must exist in rule-default-values.json", () => {
    for (const rule of schemaRules) {
      assert.ok(
        defaultRuleKeys.has(rule.key),
        `Rule "${rule.key}" is in config-schema.js specificRules but MISSING from rule-default-values.json`,
      )
    }
  })

  it("every MD rule in rule-default-values.json must exist in config-schema.js specificRules", () => {
    const schemaRuleKeys = new Set(schemaRules.map(r => r.key))
    for (const key of defaultRuleKeys) {
      assert.ok(
        schemaRuleKeys.has(key),
        `Rule "${key}" is in rule-default-values.json but MISSING from config-schema.js specificRules`,
      )
    }
  })

  it("the total number of MD rules must be equal in both files", () => {
    assert.strictEqual(
      schemaRules.length,
      defaultRuleKeys.size,
      `Rule count mismatch: config-schema.js has ${schemaRules.length} rules, rule-default-values.json has ${defaultRuleKeys.size} rules`,
    )
  })
})

describe("Rule type consistency (switch ↔ true, composite ↔ object)", () => {
  it("UnconfigurableRule (switch) in schema must have boolean true in default values", () => {
    for (const rule of schemaRules) {
      if (rule.type !== "switch") continue
      assert.strictEqual(
        RULE_DEFAULT_VALUES[rule.key],
        true,
        `Rule "${rule.key}" is UnconfigurableRule (switch) in schema but its default value is not boolean true`,
      )
    }
  })

  it("ConfigurableRule (composite) in schema must have a plain object in default values", () => {
    for (const rule of schemaRules) {
      if (rule.type !== "composite") continue
      const val = RULE_DEFAULT_VALUES[rule.key]
      assert.ok(
        val !== null && typeof val === "object" && !Array.isArray(val),
        `Rule "${rule.key}" is ConfigurableRule (composite) in schema but its default value is not a plain object (got: ${JSON.stringify(val)})`,
      )
    }
  })

  it("boolean true in default values must correspond to UnconfigurableRule (switch) in schema", () => {
    const schemaRuleMap = Object.fromEntries(schemaRules.map(r => [r.key, r]))
    for (const [key, val] of defaultRuleEntries) {
      if (val !== true) continue
      assert.strictEqual(
        schemaRuleMap[key]?.type,
        "switch",
        `Rule "${key}" has boolean true in default values but is NOT UnconfigurableRule (switch) in schema (got type: "${schemaRuleMap[key]?.type}")`,
      )
    }
  })

  it("object default values must correspond to ConfigurableRule (composite) in schema", () => {
    const schemaRuleMap = Object.fromEntries(schemaRules.map(r => [r.key, r]))
    for (const [key, val] of defaultRuleEntries) {
      if (val === null || typeof val !== "object" || Array.isArray(val)) continue
      assert.strictEqual(
        schemaRuleMap[key]?.type,
        "composite",
        `Rule "${key}" has object default values but is NOT ConfigurableRule (composite) in schema (got type: "${schemaRuleMap[key]?.type}")`,
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
        assert.ok(
          f.key.startsWith(prefix),
          `Subfield key "${f.key}" in rule "${rule.key}" does not start with expected prefix "${prefix}"`,
        )
        return f.key.slice(prefix.length)
      })
  }

  it("schema subfields must all exist in default values (schema → defaults)", () => {
    for (const rule of schemaRules) {
      if (rule.type !== "composite") continue
      const defaultKeys = new Set(Object.keys(RULE_DEFAULT_VALUES[rule.key]))
      for (const name of getSubfieldNames(rule)) {
        assert.ok(
          defaultKeys.has(name),
          `Rule "${rule.key}": schema subfield "${rule.key}.${name}" is NOT present in rule-default-values.json`,
        )
      }
    }
  })

  it("default value keys must all exist as schema subfields (defaults → schema)", () => {
    for (const rule of schemaRules) {
      if (rule.type !== "composite") continue
      const subfieldNames = new Set(getSubfieldNames(rule))
      for (const name of Object.keys(RULE_DEFAULT_VALUES[rule.key])) {
        assert.ok(
          subfieldNames.has(name),
          `Rule "${rule.key}": default value key "${name}" is NOT defined as a subfield in config-schema.js`,
        )
      }
    }
  })

  it("schema subfield count must equal default value key count for each configurable rule", () => {
    for (const rule of schemaRules) {
      if (rule.type !== "composite") continue
      const subfieldNames = getSubfieldNames(rule)
      const defaultKeys = Object.keys(RULE_DEFAULT_VALUES[rule.key])
      assert.strictEqual(
        subfieldNames.length,
        defaultKeys.length,
        `Rule "${rule.key}": schema has ${subfieldNames.length} subfield(s) [${subfieldNames.join(", ")}] but default values has ${defaultKeys.length} key(s) [${defaultKeys.join(", ")}]`,
      )
    }
  })

  it("schema subfield names must exactly match default value keys (set equality)", () => {
    for (const rule of schemaRules) {
      if (rule.type !== "composite") continue
      const subfieldSet = new Set(getSubfieldNames(rule))
      const defaultSet = new Set(Object.keys(RULE_DEFAULT_VALUES[rule.key]))
      const onlyInSchema = [...subfieldSet].filter(k => !defaultSet.has(k))
      const onlyInDefaults = [...defaultSet].filter(k => !subfieldSet.has(k))

      assert.deepStrictEqual(
        onlyInSchema,
        [],
        `Rule "${rule.key}": subfield(s) [${onlyInSchema.join(", ")}] exist in schema but NOT in default values`,
      )
      assert.deepStrictEqual(
        onlyInDefaults,
        [],
        `Rule "${rule.key}": key(s) [${onlyInDefaults.join(", ")}] exist in default values but NOT in schema`,
      )
    }
  })
})

describe("Subfield key format validation", () => {
  it("every subfield key must follow the 'MDxxx.fieldname' format", () => {
    const SUBFIELD_PATTERN = /^MD\d+\.\w+$/
    for (const rule of schemaRules) {
      if (rule.type !== "composite") continue
      const subFields = (rule.subSchema ?? []).flatMap(box => box.fields ?? [])
      for (const field of subFields) {
        assert.match(
          field.key,
          SUBFIELD_PATTERN,
          `Rule "${rule.key}": subfield key "${field.key}" does not match expected format "MDxxx.fieldname"`,
        )
      }
    }
  })

  it("every subfield key must be prefixed with its parent rule name", () => {
    for (const rule of schemaRules) {
      if (rule.type !== "composite") continue
      const subFields = (rule.subSchema ?? []).flatMap(box => box.fields ?? [])
      for (const field of subFields) {
        assert.ok(
          field.key.startsWith(`${rule.key}.`),
          `Rule "${rule.key}": subfield key "${field.key}" must start with "${rule.key}."`,
        )
      }
    }
  })
})
