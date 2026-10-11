const { _t, Switch_, Integer_, Text_, Select_, Array_ } = require("./schema-builders.js")

// `fields: null` => rendered as a plain on/off switch (no configurable options).
const RULES = {
  MD001: {
    aliases: ["heading-increment"],
    groups: ["headings"],
    default: { front_matter_title: "^\\s*title\\s*[:=]" },
    fields: [Text_("front_matter_title")],
  },
  MD003: {
    aliases: ["heading-style"],
    groups: ["headings"],
    default: { style: "consistent" },
    fields: [Select_("style", { options: ["consistent", "atx", "atx_closed", "setext", "setext_with_atx", "setext_with_atx_closed"] })],
  },
  MD004: {
    aliases: ["ul-style"],
    groups: ["bullet", "ul"],
    default: { style: "consistent" },
    fields: [Select_("style", { options: ["consistent", "asterisk", "plus", "dash", "sublist"] })],
  },
  MD005: {
    aliases: ["list-indent"],
    groups: ["bullet", "ul", "indentation"],
    default: true,
    fields: null,
  },
  MD007: {
    aliases: ["ul-indent"],
    groups: ["bullet", "ul", "indentation"],
    default: { indent: 2, start_indented: false, start_indent: 2 },
    fields: [
      Integer_("indent", { min: 1 }),
      Switch_("start_indented"),
      Integer_("start_indent", { min: 1, dependsOn: { start_indented: true } }),
    ],
  },
  MD009: {
    aliases: ["no-trailing-spaces"],
    groups: ["whitespace"],
    default: { br_spaces: 2, code_blocks: false, list_item_empty_lines: false, strict: false },
    fields: [
      Integer_("br_spaces", { min: 0 }),
      Switch_("code_blocks"),
      Switch_("list_item_empty_lines"),
      Switch_("strict"),
    ],
  },
  MD010: {
    aliases: ["no-hard-tabs"],
    groups: ["whitespace", "hard_tab"],
    default: { code_blocks: true, ignore_code_languages: [], spaces_per_tab: 1 },
    fields: [
      Integer_("spaces_per_tab", { min: 1 }),
      Switch_("code_blocks"),
      Array_("ignore_code_languages", { dependsOn: { code_blocks: true } }),
    ],
  },
  MD011: {
    aliases: ["no-reversed-links"],
    groups: ["links"],
    default: true,
    fields: null,
  },
  MD012: {
    aliases: ["no-multiple-blanks"],
    groups: ["whitespace", "blank_lines"],
    default: { maximum: 1 },
    fields: [Integer_("maximum", { min: 1 })],
  },
  MD013: {
    aliases: ["line-length"],
    groups: ["line_length"],
    default: {
      line_length: 80,
      heading_line_length: 80,
      code_block_line_length: 80,
      code_blocks: true,
      tables: true,
      headings: true,
      strict: false,
      stern: false,
    },
    fields: [
      Integer_("line_length", { min: 1 }),
      Switch_("tables"),
      Switch_("strict"),
      Switch_("stern"),
      Switch_("code_blocks"),
      Integer_("code_block_line_length", { min: 1, dependsOn: { code_blocks: true } }),
      Switch_("headings"),
      Integer_("heading_line_length", { min: 1, dependsOn: { headings: true } }),
    ],
  },
  MD014: {
    aliases: ["commands-show-output"],
    groups: ["code"],
    default: true,
    fields: null,
  },
  MD018: {
    aliases: ["no-missing-space-atx"],
    groups: ["headings", "atx", "spaces"],
    default: true,
    fields: null,
  },
  MD019: {
    aliases: ["no-multiple-space-atx"],
    groups: ["headings", "atx", "spaces"],
    default: true,
    fields: null,
  },
  MD020: {
    aliases: ["no-missing-space-closed-atx"],
    groups: ["headings", "spaces", "atx_closed"],
    default: true,
    fields: null,
  },
  MD021: {
    aliases: ["no-multiple-space-closed-atx"],
    groups: ["headings", "spaces", "atx_closed"],
    default: true,
    fields: null,
  },
  MD022: {
    aliases: ["blanks-around-headings"],
    groups: ["headings", "blank_lines"],
    default: { include_front_matter: false, lines_above: 1, lines_below: 1 },
    fields: [
      Switch_("include_front_matter"),
      Text_("lines_above", { tooltip: _t("tooltip.numberOrArray") }),
      Text_("lines_below", { tooltip: _t("tooltip.numberOrArray") }),
    ],
  },
  MD023: {
    aliases: ["heading-start-left"],
    groups: ["headings", "spaces"],
    default: true,
    fields: null,
  },
  MD024: {
    aliases: ["no-duplicate-heading"],
    groups: ["headings"],
    default: { siblings_only: false },
    fields: [Switch_("siblings_only")],
  },
  MD025: {
    aliases: ["single-title", "single-h1"],
    groups: ["headings"],
    default: { front_matter_title: "^\\s*title\\s*[:=]", level: 1 },
    fields: [
      Text_("front_matter_title"),
      Integer_("level", { min: 1, max: 6 }),
    ],
  },
  MD026: {
    aliases: ["no-trailing-punctuation"],
    groups: ["headings"],
    default: { punctuation: ".,;:!。，；：！" },
    fields: [Text_("punctuation")],
  },
  MD027: {
    aliases: ["no-multiple-space-blockquote"],
    groups: ["indentation", "whitespace", "blockquote"],
    default: { list_items: true },
    fields: [Switch_("list_items")],
  },
  MD028: {
    aliases: ["no-blanks-blockquote"],
    groups: ["whitespace", "blockquote"],
    default: true,
    fields: null,
  },
  MD029: {
    aliases: ["ol-prefix"],
    groups: ["ol"],
    default: { style: "one_or_ordered" },
    fields: [Select_("style", { options: ["one", "ordered", "one_or_ordered", "zero"] })],
  },
  MD030: {
    aliases: ["list-marker-space"],
    groups: ["ul", "whitespace", "ol"],
    default: { ul_single: 1, ol_single: 1, ul_multi: 1, ol_multi: 1 },
    fields: [
      Integer_("ul_single", { min: 1 }),
      Integer_("ol_single", { min: 1 }),
      Integer_("ul_multi", { min: 1 }),
      Integer_("ol_multi", { min: 1 }),
    ],
  },
  MD031: {
    aliases: ["blanks-around-fences"],
    groups: ["blank_lines", "code"],
    default: { list_items: true },
    fields: [Switch_("list_items")],
  },
  MD032: {
    aliases: ["blanks-around-lists"],
    groups: ["bullet", "ul", "blank_lines", "ol"],
    default: true,
    fields: null,
  },
  MD033: {
    aliases: ["no-inline-html"],
    groups: ["html"],
    default: { allowed_elements: [], table_allowed_elements: [] },
    fields: [
      Array_("allowed_elements"),
      Array_("table_allowed_elements"),
    ],
  },
  MD034: {
    aliases: ["no-bare-urls"],
    groups: ["links", "url"],
    default: true,
    fields: null,
  },
  MD035: {
    aliases: ["hr-style"],
    groups: ["hr"],
    default: { style: "consistent" },
    fields: [Text_("style")],
  },
  MD036: {
    aliases: ["no-emphasis-as-heading"],
    groups: ["headings", "emphasis"],
    default: { punctuation: ".,;:!?。，；：！？" },
    fields: [Text_("punctuation")],
  },
  MD037: {
    aliases: ["no-space-in-emphasis"],
    groups: ["whitespace", "emphasis"],
    default: true,
    fields: null,
  },
  MD038: {
    aliases: ["no-space-in-code"],
    groups: ["whitespace", "code"],
    default: true,
    fields: null,
  },
  MD039: {
    aliases: ["no-space-in-links"],
    groups: ["whitespace", "links"],
    default: true,
    fields: null,
  },
  MD040: {
    aliases: ["fenced-code-language"],
    groups: ["code", "language"],
    default: { allowed_languages: [], language_only: false },
    fields: [
      Switch_("language_only"),
      Array_("allowed_languages"),
    ],
  },
  MD041: {
    aliases: ["first-line-heading", "first-line-h1"],
    groups: ["headings"],
    default: { allow_preamble: false, front_matter_title: "^\\s*title\\s*[:=]", level: 1 },
    fields: [
      Switch_("allow_preamble"),
      Text_("front_matter_title"),
      Integer_("level", { min: 1, max: 6 }),
    ],
  },
  MD042: {
    aliases: ["no-empty-links"],
    groups: ["links"],
    default: true,
    fields: null,
  },
  MD043: {
    aliases: ["required-headings"],
    groups: ["headings"],
    default: { headings: [], match_case: false },
    fields: [
      Switch_("match_case"),
      Array_("headings"),
    ],
  },
  MD044: {
    aliases: ["proper-names"],
    groups: ["spelling"],
    default: { names: [], code_blocks: true, html_elements: true },
    fields: [
      Switch_("code_blocks"),
      Switch_("html_elements"),
      Array_("names"),
    ],
  },
  MD045: {
    aliases: ["no-alt-text"],
    groups: ["accessibility", "images"],
    default: true,
    fields: null,
  },
  MD046: {
    aliases: ["code-block-style"],
    groups: ["code"],
    default: { style: "consistent" },
    fields: [Select_("style", { options: ["consistent", "fenced", "indented"] })],
  },
  MD047: {
    aliases: ["single-trailing-newline"],
    groups: ["blank_lines"],
    default: true,
    fields: null,
  },
  MD048: {
    aliases: ["code-fence-style"],
    groups: ["code"],
    default: { style: "consistent" },
    fields: [Select_("style", { options: ["consistent", "backtick", "tilde"] })],
  },
  MD049: {
    aliases: ["emphasis-style"],
    groups: ["emphasis"],
    default: { style: "consistent" },
    fields: [Select_("style", { options: ["consistent", "asterisk", "underscore"] })],
  },
  MD050: {
    aliases: ["strong-style"],
    groups: ["emphasis"],
    default: { style: "consistent" },
    fields: [Select_("style", { options: ["consistent", "asterisk", "underscore"] })],
  },
  MD051: {
    aliases: ["link-fragments"],
    groups: ["links"],
    default: { ignore_case: false, ignored_pattern: "" },
    fields: [
      Switch_("ignore_case"),
      Text_("ignored_pattern"),
    ],
  },
  MD052: {
    aliases: ["reference-links-images"],
    groups: ["links", "images"],
    default: { ignored_labels: ["x"], shortcut_syntax: false },
    fields: [
      Switch_("shortcut_syntax"),
      Array_("ignored_labels"),
    ],
  },
  MD053: {
    aliases: ["link-image-reference-definitions"],
    groups: ["links", "images"],
    default: { ignored_definitions: ["//"] },
    fields: [Array_("ignored_definitions")],
  },
  MD054: {
    aliases: ["link-image-style"],
    groups: ["links", "images"],
    default: { autolink: true, inline: true, full: true, collapsed: true, shortcut: true, url_inline: true },
    fields: [
      Switch_("autolink"),
      Switch_("inline"),
      Switch_("full"),
      Switch_("collapsed"),
      Switch_("shortcut"),
      Switch_("url_inline"),
    ],
  },
  MD055: {
    aliases: ["table-pipe-style"],
    groups: ["table"],
    default: { style: "consistent" },
    fields: [Select_("style", { options: ["consistent", "leading_only", "trailing_only", "leading_and_trailing", "no_leading_or_trailing"] })],
  },
  MD056: {
    aliases: ["table-column-count"],
    groups: ["table"],
    default: true,
    fields: null,
  },
  MD058: {
    aliases: ["blanks-around-tables"],
    groups: ["table"],
    default: true,
    fields: null,
  },
  MD059: {
    aliases: ["descriptive-link-text"],
    groups: ["links", "accessibility"],
    default: { prohibited_texts: ["click here", "here", "link", "more"] },
    fields: [Array_("prohibited_texts")],
  },
  MD060: {
    aliases: ["table-column-style"],
    groups: ["table"],
    default: { style: "any", aligned_delimiter: false },
    fields: [
      Switch_("aligned_delimiter"),
      Select_("style", { options: ["any", "aligned", "compact", "tight"] }),
    ],
  },
  MD101: {
    aliases: ["math-surrounded-by-blank-lines"],
    groups: ["blank_lines"],
    default: { list_items: true },
    fields: [Switch_("list_items")],
  },
  MD102: {
    aliases: ["no-fully-emphasized-heading"],
    groups: ["headings", "emphasis"],
    default: true,
    fields: null,
  },
  MD103: {
    aliases: ["inline-math-delimiter"],
    groups: [],
    default: { style: "consistent" },
    fields: [Select_("style", { options: ["consistent", "single", "double"] })],
  },
}

const ruleEntries = Object.entries(RULES)

const ALIAS_MAP = Object.fromEntries(
  ruleEntries.flatMap(([name, { aliases }]) => aliases.map(alias => [alias, name])),
)

const GROUP_NAMES = [...new Set(Object.values(RULES).flatMap(r => r.groups))]

const GROUPS = Object.fromEntries(
  GROUP_NAMES.map(group => [group, ruleEntries.filter(([, r]) => r.groups.includes(group)).map(([name]) => name)]),
)

const RULE_SCHEMA = Object.fromEntries(ruleEntries.map(([name, { fields }]) => [name, fields]))

const DEFAULT_VALUES = {
  default: true,
  extends: null,
  ...Object.fromEntries(ruleEntries.map(([name, { default: def }]) => [name, def])),
  ...Object.fromEntries(GROUP_NAMES.map(group => [group, true])),
}

module.exports = { RULES, ALIAS_MAP, GROUP_NAMES, GROUPS, RULE_SCHEMA, DEFAULT_VALUES }
