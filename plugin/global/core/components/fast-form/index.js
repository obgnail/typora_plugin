const { FastForm } = require("./core")
const { Layout_Default, Layout_Grid } = require("./layouts")
const { Feature_Watchers } = require("./watchers")
const {
  Feature_DSLEngine,
  Feature_StandardDSL,
  Feature_EventDelegation,
  Feature_DefaultKeybindings,
  Feature_CollapsibleBox,
  Feature_InteractiveTooltip,
  Feature_Highlight,
  Feature_Reveal,
  Feature_Parsing,
  Feature_Validation,
  Feature_FieldDependencies,
  Feature_BoxDependencies,
  Feature_Cascades,
  Feature_History,
  Feature_LiveCommit,
  Feature_TableRowRules,
  Condition_CompareFields,
  Condition_Length,
  Comparison_Regex,
  Effect_Map,
  Validator_Url,
  Validator_Regex,
  Validator_Path,
} = require("./features")
const {
  Control_Switch, Control_Text, Control_Password, Control_Color,
  Control_Number, Control_Unit, Control_Icon, Control_Range,
  Control_Action, Control_Static, Control_Custom, Control_Hint,
  Control_Divider, Control_Hotkey, Control_Textarea, Control_CodeEditor,
  Control_Object, Control_Array, Control_Select, Control_Segment,
  Control_ModifierKey, Control_Radio, Control_Checkbox, Control_ToggleSort,
  Control_Transfer, Control_Dict, Control_Palette, Control_Table,
  Control_Composite, Control_Tabs,
} = require("./controls")

// --- Layouts ---
FastForm.registerLayout("default", Layout_Default)
FastForm.registerLayout("grid", Layout_Grid)

// --- Features ---
FastForm.registerFeature("eventDelegation", Feature_EventDelegation)
FastForm.registerFeature("defaultKeybindings", Feature_DefaultKeybindings)
FastForm.registerFeature("collapsibleBox", Feature_CollapsibleBox)
FastForm.registerFeature("interactiveTooltip", Feature_InteractiveTooltip)
FastForm.registerFeature("highlight", Feature_Highlight)
FastForm.registerFeature("reveal", Feature_Reveal)
FastForm.registerFeature("watchers", Feature_Watchers)
FastForm.registerFeature("parsing", Feature_Parsing)
FastForm.registerFeature("validation", Feature_Validation)
FastForm.registerFeature("fieldDependencies", Feature_FieldDependencies)
FastForm.registerFeature("boxDependencies", Feature_BoxDependencies)
FastForm.registerFeature("cascades", Feature_Cascades)
FastForm.registerFeature("dslEngine", Feature_DSLEngine)
FastForm.registerFeature("standardDSL", Feature_StandardDSL)
FastForm.registerFeature("history", Feature_History)
FastForm.registerFeature("liveCommit", Feature_LiveCommit)
FastForm.registerFeature("tableRowRules", Feature_TableRowRules)

// --- Built-in vocabulary of watcher ---
FastForm.registerConditionEvaluator("$compareFields", Condition_CompareFields)
FastForm.registerConditionEvaluator("$length", Condition_Length)
FastForm.registerComparisonEvaluator("$regex", Comparison_Regex)
FastForm.registerEffectHandler("$map", Effect_Map)

// --- Built-in vocabulary of validator ---
FastForm.validator.register("url", Validator_Url)
FastForm.validator.register("regex", Validator_Regex)
FastForm.validator.register("path", Validator_Path)

// --- Controls ---
FastForm.registerControl("switch", Control_Switch)
FastForm.registerControl("text", Control_Text)
FastForm.registerControl("password", Control_Password)
FastForm.registerControl("color", Control_Color)
FastForm.registerControl("number", Control_Number)
FastForm.registerControl("unit", Control_Unit)
FastForm.registerControl("icon", Control_Icon)
FastForm.registerControl("range", Control_Range)
FastForm.registerControl("action", Control_Action)
FastForm.registerControl("static", Control_Static)
FastForm.registerControl("custom", Control_Custom)
FastForm.registerControl("hint", Control_Hint)
FastForm.registerControl("divider", Control_Divider)
FastForm.registerControl("hotkey", Control_Hotkey)
FastForm.registerControl("textarea", Control_Textarea)
FastForm.registerControl("code", Control_CodeEditor)
FastForm.registerControl("object", Control_Object)
FastForm.registerControl("array", Control_Array)
FastForm.registerControl("select", Control_Select)
FastForm.registerControl("segment", Control_Segment)
FastForm.registerControl("modifierKey", Control_ModifierKey)
FastForm.registerControl("radio", Control_Radio)
FastForm.registerControl("checkbox", Control_Checkbox)
FastForm.registerControl("transfer", Control_Transfer)
FastForm.registerControl("togglesort", Control_ToggleSort)
FastForm.registerControl("dict", Control_Dict)
FastForm.registerControl("palette", Control_Palette)
FastForm.registerControl("table", Control_Table)
FastForm.registerControl("composite", Control_Composite)
FastForm.registerControl("tabs", Control_Tabs)

customElements.define("fast-form", FastForm)

module.exports = { FastForm, Feature_DSLEngine, Feature_StandardDSL }
