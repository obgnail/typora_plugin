const generalRulesMap = require("./general-rules.json")
const rulesDefaultValues = require("./rules-default-values.json")
const { i18n } = require("../../../global/core/i18n.js")

const OPTIONS = {
    "MD003.style": ["consistent", "atx", "atx_closed", "setext", "setext_with_atx", "setext_with_atx_closed"],
    "MD004.style": ["consistent", "asterisk", "plus", "dash", "sublist"],
    "MD029.style": ["one", "ordered", "one_or_ordered", "zero"],
    "MD046.style": ["consistent", "fenced", "indented"],
    "MD048.style": ["consistent", "backtick", "tilde"],
    "MD049.style": ["consistent", "asterisk", "underscore"],
    "MD050.style": ["consistent", "asterisk", "underscore"],
    "MD055.style": ["consistent", "leading_only", "trailing_only", "leading_and_trailing", "no_leading_or_trailing"],
}

const buildGeneralRuleDependencies = () => {
    const dep = {}
    for (const [generalRuleName, rules] of Object.entries(generalRulesMap)) {
        for (const specificRuleName of rules) {
            if (!dep.hasOwnProperty(specificRuleName)) {
                dep[specificRuleName] = {}
            }
            dep[specificRuleName][generalRuleName] = true
        }
    }
    return dep
}

const generalRuleDependencies = buildGeneralRuleDependencies()

const _t = (key) => i18n.t("markdownLint", key)
const RuleName = (name) => `${name} - ${_t(name)}`
const Label = (key) => _t(`label.${key}`)

const Switch = (key, { ...args } = {}) => ({ key, type: "switch", label: Label(key), ...args })
const Number = (key, { min, max, ...args } = {}) => ({ key, type: "number", label: Label(key), min, max, ...args })
const Text = (key, { ...args } = {}) => ({ key, type: "text", label: Label(key), ...args })
const Select = (key, { ...args } = {}) => {
    const options = Object.fromEntries(OPTIONS[key].map(op => [op, _t(`option.${key}.${op}`)]))
    return { key, type: "select", label: Label(key), options, ...args }
}
const Action = (key, label) => ({ key, type: "action", label })
const Array_Inline = (key, { ...args } = {}) => ({ key, type: "array", isBlockLayout: false, label: Label(key), ...args })

const UntitledBox = (...fields) => ({ title: undefined, fields })
const TitledBox = (title, ...fields) => ({ title, fields })

const SimpleRule = (name) => ({
    key: name,
    type: "switch",
    label: RuleName(name),
    dependencies: generalRuleDependencies[name],
})
const ConfigurableRule = (name, ...subFiled) => ({
    key: name,
    type: "composite",
    label: RuleName(name),
    defaultValues: rulesDefaultValues[name],
    dependencies: generalRuleDependencies[name],
    subSchema: [UntitledBox(...subFiled)],
})

const MD001 = SimpleRule("MD001")
const MD003 = ConfigurableRule(
    "MD003",
    Select("MD003.style"),
)
const MD004 = ConfigurableRule(
    "MD004",
    Select("MD004.style"),
)
const MD005 = SimpleRule("MD005")
const MD007 = ConfigurableRule(
    "MD007",
    Number("MD007.indent", { min: 1 }),
    Switch("MD007.start_indented"),
    Number("MD007.start_indent", { min: 1, dependencies: { "MD007.start_indented": true } }),
)
const MD009 = ConfigurableRule(
    "MD009",
    Number("MD009.br_spaces", { min: 0 }),
    Switch("MD009.list_item_empty_lines"),
    Switch("MD009.strict"),
)
const MD010 = ConfigurableRule(
    "MD010",
    Number("MD010.spaces_per_tab", { min: 0 }),
    Switch("MD010.code_blocks"),
    Array_Inline("MD010.ignore_code_languages", { dependencies: { "MD010.code_blocks": true } }),
)
const MD011 = SimpleRule("MD011")
const MD012 = ConfigurableRule(
    "MD012",
    Number("MD012.maximum", { min: 1 }),
)
const MD013 = ConfigurableRule(
    "MD013",
    Number("MD013.line_length", { min: 1 }),
    Switch("MD013.tables"),
    Switch("MD013.strict"),
    Switch("MD013.stern"),
    Switch("MD013.code_blocks"),
    Number("MD013.code_block_line_length", { min: 1, dependencies: { "MD013.code_blocks": true } }),
    Switch("MD013.headings"),
    Number("MD013.heading_line_length", { min: 1, dependencies: { "MD013.headings": true } }),
)
const MD014 = SimpleRule("MD014")
const MD018 = SimpleRule("MD018")
const MD019 = SimpleRule("MD019")
const MD020 = SimpleRule("MD020")
const MD021 = SimpleRule("MD021")
const MD022 = ConfigurableRule(
    "MD022",
    Text("MD022.lines_above", { tooltip: _t("tooltip.numberOrArray") }),
    Text("MD022.lines_below", { tooltip: _t("tooltip.numberOrArray") }),
)
const MD023 = SimpleRule("MD023")
const MD024 = ConfigurableRule(
    "MD024",
    Switch("MD024.siblings_only"),
)
const MD025 = ConfigurableRule(
    "MD025",
    Text("MD025.front_matter_title"),
    Number("MD025.level", { min: 1, max: 6 }),
)
const MD026 = ConfigurableRule(
    "MD026",
    Text("MD026.punctuation"),
)
const MD027 = ConfigurableRule(
    "MD027",
    Switch("MD027.list_items"),
)
const MD028 = SimpleRule("MD028")
const MD029 = ConfigurableRule(
    "MD029",
    Select("MD029.style"),
)
const MD030 = ConfigurableRule(
    "MD030",
    Number("MD030.ul_single", { min: 1 }),
    Number("MD030.ol_single", { min: 1 }),
    Number("MD030.ul_multi", { min: 1 }),
    Number("MD030.ol_multi", { min: 1 }),
)
const MD031 = ConfigurableRule(
    "MD031",
    Switch("MD031.list_items"),
)
const MD032 = SimpleRule("MD032")
const MD033 = ConfigurableRule(
    "MD033",
    Array_Inline("MD033.allowed_elements"),
)
const MD034 = SimpleRule("MD034")
const MD035 = ConfigurableRule(
    "MD035",
    Text("MD035.style"),
)
const MD036 = ConfigurableRule(
    "MD036",
    Text("MD036.punctuation"),
)
const MD037 = SimpleRule("MD037")
const MD038 = SimpleRule("MD038")
const MD039 = SimpleRule("MD039")
const MD040 = ConfigurableRule(
    "MD040",
    Switch("MD040.language_only"),
    Array_Inline("MD040.allowed_languages"),
)
const MD041 = ConfigurableRule(
    "MD041",
    Switch("MD041.allow_preamble"),
    Text("MD041.front_matter_title"),
    Number("MD041.level", { min: 1, max: 6 }),
)
const MD042 = SimpleRule("MD042")
const MD043 = ConfigurableRule(
    "MD043",
    Switch("MD043.match_case"),
    Array_Inline("MD043.headings"),
)
const MD044 = ConfigurableRule(
    "MD044",
    Switch("MD044.code_blocks"),
    Switch("MD044.html_elements"),
    Array_Inline("MD044.names"),
)
const MD045 = SimpleRule("MD045")
const MD046 = ConfigurableRule(
    "MD046",
    Select("MD046.style"),
)
const MD047 = SimpleRule("MD047")
const MD048 = ConfigurableRule(
    "MD048",
    Select("MD048.style"),
)
const MD049 = ConfigurableRule(
    "MD049",
    Select("MD049.style"),
)
const MD050 = ConfigurableRule(
    "MD050",
    Select("MD050.style"),
)
const MD051 = ConfigurableRule(
    "MD051",
    Switch("MD051.ignore_case"),
    Text("MD051.ignored_pattern"),
)
const MD052 = ConfigurableRule(
    "MD052",
    Switch("MD052.shortcut_syntax"),
    Array_Inline("MD052.ignored_labels"),
)
const MD053 = ConfigurableRule(
    "MD053",
    Array_Inline("MD053.ignored_definitions"),
)
const MD054 = ConfigurableRule(
    "MD054",
    Switch("MD054.autolink"),
    Switch("MD054.inline"),
    Switch("MD054.full"),
    Switch("MD054.collapsed"),
    Switch("MD054.shortcut"),
    Switch("MD054.url_inline"),
)
const MD055 = ConfigurableRule(
    "MD055",
    Select("MD055.style"),
)
const MD056 = SimpleRule("MD056")
const MD058 = SimpleRule("MD058")
const MD059 = ConfigurableRule(
    "MD059",
    Array_Inline("MD059.prohibited_texts"),
)
const MD101 = ConfigurableRule(
    "MD101",
    Switch("MD101.list_items"),
)
const MD102 = SimpleRule("MD102")

const globalConfigs = [
    Switch("default", { disabled: true }),
    Text("extends"),
]

const specificRules = [
    MD001, MD003, MD004, MD005, MD007, MD009, MD010, MD011, MD012, MD013,
    MD014, MD018, MD019, MD020, MD021, MD022, MD023, MD024, MD025, MD026,
    MD027, MD028, MD029, MD030, MD031, MD032, MD033, MD034, MD035, MD036,
    MD037, MD038, MD039, MD040, MD041, MD042, MD043, MD044, MD045, MD046,
    MD047, MD048, MD049, MD050, MD051, MD052, MD053, MD054, MD055, MD056,
    MD058, MD059, MD101, MD102,
]

const generalRules = Object.entries(generalRulesMap).map(([name, rules]) => Switch(name, { tooltip: rules.join(", ") }))

const actions = [
    Action("viewRules", _t("$label.viewMarkdownlintRules")),
    Action("restoreRules", i18n.t("settings", "$label.restoreSettings")),
]

module.exports = [
    UntitledBox(...globalConfigs),
    TitledBox(_t("title.specificRules"), ...specificRules),
    TitledBox(_t("title.generalRules"), ...generalRules),
    UntitledBox(...actions),
]
