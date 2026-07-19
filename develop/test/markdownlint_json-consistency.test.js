const { describe, it } = require("node:test")
const assert = require("node:assert")

const RULE_DEFAULT_VALUES = require("../../plugin/markdownlint/rule-default-values.json")
const RULE_ALIASES = require("../../plugin/markdownlint/rule-aliases.json")
const RULE_GROUPS = require("../../plugin/markdownlint/rule-groups.json")

const RULE_PATTERN = /^MD\d+$/

const allDefaultKeys = Object.keys(RULE_DEFAULT_VALUES)
const mdRuleKeys = new Set(allDefaultKeys.filter(k => RULE_PATTERN.test(k)))
const groupAliasKeys = new Set(allDefaultKeys.filter(k => !RULE_PATTERN.test(k) && k !== "default" && k !== "extends"))

describe("rule-default-values.json - internal consistency", () => {
  it("'default' must be boolean true", () => {
    assert.strictEqual(RULE_DEFAULT_VALUES.default, true)
  })

  it("'extends' must be null", () => {
    assert.strictEqual(RULE_DEFAULT_VALUES.extends, null)
  })

  it("every MD rule value must be boolean true or a non-null plain object", () => {
    for (const key of mdRuleKeys) {
      const val = RULE_DEFAULT_VALUES[key]
      const isValid = val === true || (val !== null && typeof val === "object" && !Array.isArray(val))
      assert.ok(
        isValid,
        `Rule "${key}" has invalid default value: ${JSON.stringify(val)} (must be true or a plain object)`,
      )
    }
  })

  it("configurable rule default objects must be non-empty", () => {
    for (const key of mdRuleKeys) {
      const val = RULE_DEFAULT_VALUES[key]
      if (val === true) continue
      assert.ok(
        Object.keys(val).length > 0,
        `Rule "${key}" has an empty object as its default value`,
      )
    }
  })

  it("every group alias value must be boolean true", () => {
    for (const key of groupAliasKeys) {
      assert.strictEqual(
        RULE_DEFAULT_VALUES[key],
        true,
        `Group alias "${key}" must have value true, got: ${JSON.stringify(RULE_DEFAULT_VALUES[key])}`,
      )
    }
  })

  it("no key should appear in both MD rules and group aliases", () => {
    for (const key of mdRuleKeys) {
      assert.ok(
        !groupAliasKeys.has(key),
        `Key "${key}" appears as both an MD rule and a group alias`,
      )
    }
  })

  it("the only non-MD, non-group keys must be 'default' and 'extends'", () => {
    const reservedKeys = new Set(["default", "extends"])
    for (const key of allDefaultKeys) {
      if (RULE_PATTERN.test(key)) continue
      if (groupAliasKeys.has(key)) continue
      assert.ok(
        reservedKeys.has(key),
        `Unexpected top-level key "${key}" in rule-default-values.json (not an MD rule, group alias, 'default', or 'extends')`,
      )
    }
  })
})

describe("rule-aliases.json - consistency with rule-default-values.json", () => {
  it("every alias value must match the MD\\d+ pattern", () => {
    for (const [alias, ruleName] of Object.entries(RULE_ALIASES)) {
      assert.match(
        ruleName,
        RULE_PATTERN,
        `Alias "${alias}" maps to "${ruleName}" which does not match the MD\\d+ pattern`,
      )
    }
  })

  it("every alias value (rule name) must exist in rule-default-values.json", () => {
    for (const [alias, ruleName] of Object.entries(RULE_ALIASES)) {
      assert.ok(
        mdRuleKeys.has(ruleName),
        `Alias "${alias}" maps to "${ruleName}" which is NOT defined in rule-default-values.json`,
      )
    }
  })

  it("alias keys must not use the MD\\d+ format (aliases must use kebab-case names)", () => {
    for (const alias of Object.keys(RULE_ALIASES)) {
      assert.doesNotMatch(
        alias,
        RULE_PATTERN,
        `Alias key "${alias}" looks like a rule name (MD\\d+ format); aliases should use kebab-case names`,
      )
    }
  })

  it("alias keys must not collide with group alias keys in rule-default-values.json", () => {
    for (const alias of Object.keys(RULE_ALIASES)) {
      assert.ok(
        !groupAliasKeys.has(alias),
        `Alias key "${alias}" in rule-aliases.json collides with a group alias key in rule-default-values.json`,
      )
    }
  })

  it("alias keys must not collide with MD rule keys in rule-default-values.json", () => {
    for (const alias of Object.keys(RULE_ALIASES)) {
      assert.ok(
        !mdRuleKeys.has(alias),
        `Alias key "${alias}" in rule-aliases.json collides with an MD rule key in rule-default-values.json`,
      )
    }
  })

  it("every MD rule in rule-default-values.json must have at least one alias", () => {
    const aliasedRules = new Set(Object.values(RULE_ALIASES))
    for (const ruleName of mdRuleKeys) {
      assert.ok(
        aliasedRules.has(ruleName),
        `Rule "${ruleName}" in rule-default-values.json has no alias in rule-aliases.json`,
      )
    }
  })

  it("alias values must only reference rules that exist (no dangling references)", () => {
    const aliasedRules = new Set(Object.values(RULE_ALIASES))
    for (const ruleName of aliasedRules) {
      assert.ok(
        mdRuleKeys.has(ruleName),
        `rule-aliases.json references rule "${ruleName}" which does not exist in rule-default-values.json`,
      )
    }
  })
})

describe("rule-groups.json - internal consistency", () => {
  it("each group must be a non-empty array", () => {
    for (const [groupName, rules] of Object.entries(RULE_GROUPS)) {
      assert.ok(Array.isArray(rules), `Group "${groupName}" must be an array, got: ${typeof rules}`)
      assert.ok(rules.length > 0, `Group "${groupName}" must not be empty`)
    }
  })

  it("each group must not contain duplicate rules", () => {
    for (const [groupName, rules] of Object.entries(RULE_GROUPS)) {
      const seen = new Set()
      for (const ruleName of rules) {
        assert.ok(
          !seen.has(ruleName),
          `Group "${groupName}" contains duplicate rule "${ruleName}"`,
        )
        seen.add(ruleName)
      }
    }
  })

  it("every rule in each group must match the MD\\d+ pattern", () => {
    for (const [groupName, rules] of Object.entries(RULE_GROUPS)) {
      for (const ruleName of rules) {
        assert.match(
          ruleName,
          RULE_PATTERN,
          `Group "${groupName}" contains "${ruleName}" which does not match the MD\\d+ pattern`,
        )
      }
    }
  })
})

describe("rule-groups.json - consistency with rule-default-values.json", () => {
  it("every group key must exist as a group alias in rule-default-values.json", () => {
    for (const groupName of Object.keys(RULE_GROUPS)) {
      assert.ok(
        groupAliasKeys.has(groupName),
        `Group "${groupName}" in rule-groups.json is NOT defined as a group alias in rule-default-values.json`,
      )
    }
  })

  it("every group alias in rule-default-values.json must have a corresponding group in rule-groups.json", () => {
    const groupKeys = new Set(Object.keys(RULE_GROUPS))
    for (const alias of groupAliasKeys) {
      assert.ok(
        groupKeys.has(alias),
        `Group alias "${alias}" in rule-default-values.json has no corresponding group in rule-groups.json`,
      )
    }
  })

  it("group key set must exactly match group alias set (no extra, no missing)", () => {
    const groupKeys = new Set(Object.keys(RULE_GROUPS))
    const onlyInGroups = [...groupKeys].filter(k => !groupAliasKeys.has(k))
    const onlyInDefaults = [...groupAliasKeys].filter(k => !groupKeys.has(k))
    assert.deepStrictEqual(
      onlyInGroups,
      [],
      `Groups in rule-groups.json not in rule-default-values.json: [${onlyInGroups.join(", ")}]`,
    )
    assert.deepStrictEqual(
      onlyInDefaults,
      [],
      `Group aliases in rule-default-values.json not in rule-groups.json: [${onlyInDefaults.join(", ")}]`,
    )
  })

  it("every rule in each group must exist in rule-default-values.json", () => {
    for (const [groupName, rules] of Object.entries(RULE_GROUPS)) {
      for (const ruleName of rules) {
        assert.ok(
          mdRuleKeys.has(ruleName),
          `Group "${groupName}" contains rule "${ruleName}" which is NOT defined in rule-default-values.json`,
        )
      }
    }
  })
})

describe("Cross-file consistency (aliases + groups + default values)", () => {
  it("rules referenced in rule-groups.json must also have an alias in rule-aliases.json", () => {
    const aliasedRules = new Set(Object.values(RULE_ALIASES))
    for (const [groupName, rules] of Object.entries(RULE_GROUPS)) {
      for (const ruleName of rules) {
        assert.ok(
          aliasedRules.has(ruleName),
          `Group "${groupName}" references rule "${ruleName}" which has no alias in rule-aliases.json`,
        )
      }
    }
  })

  it("rules in rule-aliases.json must all exist in rule-default-values.json (no dangling aliases)", () => {
    for (const [alias, ruleName] of Object.entries(RULE_ALIASES)) {
      assert.ok(
        mdRuleKeys.has(ruleName),
        `rule-aliases.json: alias "${alias}" → "${ruleName}" not found in rule-default-values.json`,
      )
    }
  })

  it("rules in rule-groups.json must all exist in rule-default-values.json (no dangling group members)", () => {
    const groupedRules = Object.values(RULE_GROUPS).flat()
    for (const ruleName of groupedRules) {
      assert.ok(
        mdRuleKeys.has(ruleName),
        `rule-groups.json references rule "${ruleName}" not found in rule-default-values.json`,
      )
    }
  })

  it("the set of aliased rules must equal the set of MD rules in rule-default-values.json", () => {
    const aliasedRules = new Set(Object.values(RULE_ALIASES))
    const inDefaultsNotAliased = [...mdRuleKeys].filter(r => !aliasedRules.has(r))
    const inAliasesNotDefaults = [...aliasedRules].filter(r => !mdRuleKeys.has(r))
    assert.deepStrictEqual(
      inDefaultsNotAliased,
      [],
      `Rules in rule-default-values.json with no alias in rule-aliases.json: [${inDefaultsNotAliased.join(", ")}]`,
    )
    assert.deepStrictEqual(
      inAliasesNotDefaults,
      [],
      `Rules in rule-aliases.json not found in rule-default-values.json: [${inAliasesNotDefaults.join(", ")}]`,
    )
  })

  it("the set of rules appearing in any group must be a subset of MD rules in rule-default-values.json", () => {
    const groupedRules = new Set(Object.values(RULE_GROUPS).flat())
    const inGroupsNotDefaults = [...groupedRules].filter(r => !mdRuleKeys.has(r))
    assert.deepStrictEqual(
      inGroupsNotDefaults,
      [],
      `Rules in rule-groups.json not found in rule-default-values.json: [${inGroupsNotDefaults.join(", ")}]`,
    )
  })
})
