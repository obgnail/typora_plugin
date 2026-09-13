const i18n = require("../global/core/i18n.js")

const RULE_GROUPS = require("./rule-groups.json")
const RULE_DEFAULT_VALUES = require("./rule-default-values.json")
const RULE_DEPENDENCIES = Object.fromEntries(
  Object.entries(
    Object.groupBy(
      Object.entries(RULE_GROUPS).flatMap(([group, rules]) => rules.map(rule => [rule, group])),
      ([rule]) => rule,
    ),
  ).map(([rule, pairs]) => {
    const deps = Object.fromEntries(pairs.map(([_, group]) => [group, true]))
    return [rule, deps]
  }),
)

const _t = (key) => i18n.t("markdownlint", key)
const RuleName = (name) => `${name} - ${_t(name)}`
const Label = (key) => _t(`label.${key}`)

const Switch = (key, { ...args } = {}) => ({ key, type: "switch", label: Label(key), ...args })
const Integer = (key, { min, max, ...args } = {}) => ({ key, type: "number", isInteger: true, label: Label(key), min, max, ...args })
const Text = (key, { ...args } = {}) => ({ key, type: "text", label: Label(key), ...args })
const Select = (key, { options, ...args } = {}) => {
  const opts = Object.fromEntries(options.map(op => [op, _t(`option.${key}.${op}`)]))
  return { key, type: "select", label: Label(key), options: opts, ...args }
}
const Action = (key, label) => ({ key, type: "action", label })
const Array_Inline = (key, { ...args } = {}) => ({ key, type: "array", isBlockLayout: false, label: Label(key), ...args })

const UntitledBox = (...fields) => ({ title: undefined, fields })
const TitledBox = (title, ...fields) => ({ title, fields })

const scoped = (builder) => (sub, opts = {}) => (name) => {
  const { dependsOn, ...rest } = opts
  const dependencies = dependsOn
    ? Object.fromEntries(Object.entries(dependsOn).map(([k, v]) => [`${name}.${k}`, v]))
    : undefined
  return builder(`${name}.${sub}`, { ...rest, ...(dependencies ? { dependencies } : {}) })
}

const Switch_ = scoped(Switch)
const Integer_ = scoped(Integer)
const Text_ = scoped(Text)
const Select_ = scoped(Select)
const Array_ = scoped(Array_Inline)

const UnconfigurableRule = (name) => ({
  key: name,
  type: "switch",
  label: RuleName(name),
  dependencies: RULE_DEPENDENCIES[name],
})
const ConfigurableRule = (name, fieldFns) => ({
  key: name,
  type: "composite",
  label: RuleName(name),
  defaultValues: RULE_DEFAULT_VALUES[name],
  dependencies: RULE_DEPENDENCIES[name],
  subSchema: [UntitledBox(...fieldFns.map(fn => fn(name)))],
})

const RULE_SCHEMA = {
  MD001: [Text_("front_matter_title")],
  MD003: [Select_("style", { options: ["consistent", "atx", "atx_closed", "setext", "setext_with_atx", "setext_with_atx_closed"] })],
  MD004: [Select_("style", { options: ["consistent", "asterisk", "plus", "dash", "sublist"] })],
  MD005: null,
  MD007: [
    Integer_("indent", { min: 1 }),
    Switch_("start_indented"),
    Integer_("start_indent", { min: 1, dependsOn: { start_indented: true } }),
  ],
  MD009: [
    Integer_("br_spaces", { min: 0 }),
    Switch_("code_blocks"),
    Switch_("list_item_empty_lines"),
    Switch_("strict"),
  ],
  MD010: [
    Integer_("spaces_per_tab", { min: 1 }),
    Switch_("code_blocks"),
    Array_("ignore_code_languages", { dependsOn: { code_blocks: true } }),
  ],
  MD011: null,
  MD012: [Integer_("maximum", { min: 1 })],
  MD013: [
    Integer_("line_length", { min: 1 }),
    Switch_("tables"),
    Switch_("strict"),
    Switch_("stern"),
    Switch_("code_blocks"),
    Integer_("code_block_line_length", { min: 1, dependsOn: { code_blocks: true } }),
    Switch_("headings"),
    Integer_("heading_line_length", { min: 1, dependsOn: { headings: true } }),
  ],
  MD014: null,
  MD018: null,
  MD019: null,
  MD020: null,
  MD021: null,
  MD022: [
    Switch_("include_front_matter"),
    Text_("lines_above", { tooltip: _t("tooltip.numberOrArray") }),
    Text_("lines_below", { tooltip: _t("tooltip.numberOrArray") }),
  ],
  MD023: null,
  MD024: [Switch_("siblings_only")],
  MD025: [
    Text_("front_matter_title"),
    Integer_("level", { min: 1, max: 6 }),
  ],
  MD026: [Text_("punctuation")],
  MD027: [Switch_("list_items")],
  MD028: null,
  MD029: [Select_("style", { options: ["one", "ordered", "one_or_ordered", "zero"] })],
  MD030: [
    Integer_("ul_single", { min: 1 }),
    Integer_("ol_single", { min: 1 }),
    Integer_("ul_multi", { min: 1 }),
    Integer_("ol_multi", { min: 1 }),
  ],
  MD031: [Switch_("list_items")],
  MD032: null,
  MD033: [
    Array_("allowed_elements"),
    Array_("table_allowed_elements"),
  ],
  MD034: null,
  MD035: [Text_("style")],
  MD036: [Text_("punctuation")],
  MD037: null,
  MD038: null,
  MD039: null,
  MD040: [
    Switch_("language_only"),
    Array_("allowed_languages"),
  ],
  MD041: [
    Switch_("allow_preamble"),
    Text_("front_matter_title"),
    Integer_("level", { min: 1, max: 6 }),
  ],
  MD042: null,
  MD043: [
    Switch_("match_case"),
    Array_("headings"),
  ],
  MD044: [
    Switch_("code_blocks"),
    Switch_("html_elements"),
    Array_("names"),
  ],
  MD045: null,
  MD046: [Select_("style", { options: ["consistent", "fenced", "indented"] })],
  MD047: null,
  MD048: [Select_("style", { options: ["consistent", "backtick", "tilde"] })],
  MD049: [Select_("style", { options: ["consistent", "asterisk", "underscore"] })],
  MD050: [Select_("style", { options: ["consistent", "asterisk", "underscore"] })],
  MD051: [
    Switch_("ignore_case"),
    Text_("ignored_pattern"),
  ],
  MD052: [
    Switch_("shortcut_syntax"),
    Array_("ignored_labels"),
  ],
  MD053: [Array_("ignored_definitions")],
  MD054: [
    Switch_("autolink"),
    Switch_("inline"),
    Switch_("full"),
    Switch_("collapsed"),
    Switch_("shortcut"),
    Switch_("url_inline"),
  ],
  MD055: [Select_("style", { options: ["consistent", "leading_only", "trailing_only", "leading_and_trailing", "no_leading_or_trailing"] })],
  MD056: null,
  MD058: null,
  MD059: [Array_("prohibited_texts")],
  MD060: [
    Switch_("aligned_delimiter"),
    Select_("style", { options: ["any", "aligned", "compact", "tight"] }),
  ],
  MD101: [Switch_("list_items")],
  MD102: null,
  MD103: [Select_("style", { options: ["consistent", "single", "double"] })],
}

const globalConfigs = [
  Switch("default", { disabled: true }),
  Text("extends"),
]

const specificRules = Object.entries(RULE_SCHEMA).map(([name, fields]) => fields === null ? UnconfigurableRule(name) : ConfigurableRule(name, fields))

const ruleGroups = Object.entries(RULE_GROUPS).map(([group, rules]) => Switch(group, { explain: rules.join("、") }))

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
