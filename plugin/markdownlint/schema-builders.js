const i18n = require("../global/core/i18n.js")

const _t = (key) => i18n.t("markdownlint", key)
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

module.exports = { _t, Switch, Integer, Text, Select, Action, Array_Inline, UntitledBox, TitledBox, Switch_, Integer_, Text_, Select_, Array_ }
