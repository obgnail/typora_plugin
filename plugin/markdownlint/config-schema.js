const i18n = require("../global/core/i18n.js")
const { _t, Switch, Text, Action, UntitledBox, TitledBox } = require("./schema-builders.js")
const { RULES, GROUPS, GROUP_NAMES, RULE_SCHEMA, DEFAULT_VALUES } = require("./rule-definitions.js")

const RULE_DEPENDENCIES = Object.fromEntries(
  Object.entries(RULES).map(([name, { groups }]) => [name, Object.fromEntries(groups.map(g => [g, true]))]),
)

const ruleName = (name) => `${name} - ${_t(name)}`

const unconfigurableRule = (name) => ({
  key: name,
  type: "switch",
  label: ruleName(name),
  dependencies: RULE_DEPENDENCIES[name],
})
const configurableRule = (name, fieldFns) => ({
  key: name,
  type: "composite",
  label: ruleName(name),
  defaultValues: DEFAULT_VALUES[name],
  dependencies: RULE_DEPENDENCIES[name],
  subSchema: [UntitledBox(...fieldFns.map(fn => fn(name)))],
})

const globalConfigs = [
  Switch("default", { disabled: true }),
  Text("extends"),
]

const specificRules = Object.entries(RULE_SCHEMA).map(([name, fields]) => fields == null ? unconfigurableRule(name) : configurableRule(name, fields))

const ruleGroups = GROUP_NAMES.map(group => Switch(group, { explain: GROUPS[group].join("、") }))

const actions = [
  Action("viewRules", _t("$tooltip.viewMarkdownlintRules")),
  Action("restoreRules", i18n.t("settings", "$label.restoreSettings")),
]

module.exports = [
  UntitledBox(...globalConfigs),
  TitledBox(_t("title.specificRules"), ...specificRules),
  TitledBox(_t("title.ruleGroups"), ...ruleGroups),
  UntitledBox(...actions),
]
