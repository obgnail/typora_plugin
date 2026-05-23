/**
 * This file defines the UI configurations for plugin preference panels using a fluent, declarative DSL.
 *
 * Dual-State DSL:
 * Controls in this DSL are strictly context-aware. You use the exact same syntax (e.g., `Textarea("CMD")`)
 * everywhere, and the engine automatically adapts its structure based on where you place it:
 *   1. **As an Independent Box**: When placed directly at the root of a schema or inside structural
 * arrays (like `NestedBoxes`), the control renders as a standalone block with its own title and layout.
 *   2. **As an Inline Field**: When wrapped inside a `Group(...)`, the control automatically sheds its
 * outer wrapper and seamlessly degrades into an inline input field, sitting alongside its siblings.
 */

const OPTION_SCOPE = Symbol("Schema:OptionScope")
const I18N_DICT = Symbol("Schema:I18nDict")

let Group, When
let Switch, Text, Password, Color, Integer, Float, Icon, Range, Action, Static,
  Hint, Divider, Hotkey, Textarea, Code, Select, Segment, Radio, Checkbox, Transfer,
  ToggleSort, Dict, Palette, Table, Object_, Array_

let DEPS, FRAG

let initialized = false

const initDSL = (dsl) => {
  if (initialized) return
  initialized = true

  ;({ Group, When } = dsl)

  const withDefaults = {
    Hint: (builder) => (...args) => builder(...args).Unsafe(false),
    Array: (builder) => (...args) => builder(...args).AllowDuplicates(false),
    Palette: (builder) => (...args) => builder(...args).Dimensions(1).AllowJagged(true).DefaultColor("#FFFFFF"),
    Table: (builder) => (...args) => builder(...args).SubFormOptions("boxDependencyUnmetAction", "readonly").SubFormOptions("collapsibleBox", false),
  }
  const withI18n = (builder) => (key, ...args) => {
    const control = builder(key, ...args)
    if (key !== undefined) {
      control.Label(key)
      control[I18N_DICT] = "label"
    }
    return control
  }

  const enhancedControls = Object.fromEntries(
    Object.entries(dsl.Controls).map(([name, builder]) => [
      name,
      withI18n(withDefaults[name]?.(builder) ?? builder),
    ]))

  ;({
    Switch, Text, Password, Color, Integer, Float, Icon, Range, Action, Static,
    Hint, Divider, Hotkey, Textarea, Code, Select, Segment, Radio, Checkbox, Transfer,
    ToggleSort, Dict, Palette, Table, Object: Object_, Array: Array_,
  } = enhancedControls)

  const { preset, presetFor } = dsl.Extend
  preset("ActionTooltip", (control, action, icon = "fa fa-link", text = undefined) => control.Tooltip({ action, icon, text }))
  presetFor(["integer", "float", "range"], "Percent", control => control.Min(1).Max(100).Step(1).Unit(UNITS.percent))
  presetFor(["integer", "float", "range"], "AllowMinusOne", control => control.Min(-1).Tooltip("minusOneMeansUnlimited"))
  presetFor(["switch", "text", "password"], "Protect", control => control.ActionTooltip("openSettingsFolder", "fa fa-gear", "protected").Disabled(true))
  presetFor(["select", "segment", "radio", "checkbox", "transfer", "togglesort"], "OptionScope", (control, scope) => control.fields[0][OPTION_SCOPE] = scope)
  presetFor(["table"], "Headers", (control, headers) => control.ThMap(Object.fromEntries(headers.map(th => [th, `${control.fields[0].key}.${th}`]))))

  DEPS = {
    markmapToc: When.true("ENABLE_TOC_MARKMAP"),
    markmapFence: When.true("ENABLE_FENCE_MARKMAP"),
    fenceEnhanceButton: When.true("ENABLE_BUTTON"),
    fenceEnhanceHotkey: When.true("ENABLE_HOTKEY"),
    countFile: When.true("ENABLE_FILE_COUNT"),
    gesturesDisplay: (btn) => When.and(When.or(When.true("ENABLE_VISUALIZER"), When.true("ENABLE_HUD")), When.contains("TRIGGER_BUTTONS", btn)),
  }

  FRAG = {
    Base: (hasHotkey = false) => Group(
      Switch("ENABLE"),
      Text("NAME").Placeholder("defaultIfEmpty"),
      hasHotkey ? Hotkey("HOTKEY") : null,
    ),
    SettingHandler: () => Group(
      Action("inspectRuntimeSettings").ActionTooltip("inspectDefaultSettings", "fa fa-cogs"),
      Action("restoreSettings"),
    ),
    LangMode: () => Group("languageMode",
      Text("LANGUAGE").Protect(),
      Switch("INTERACTIVE_MODE"),
    ),
    ChartStyle: () => Group("diagramStyle",
      Text("DEFAULT_FENCE_HEIGHT"),
      Text("DEFAULT_FENCE_BACKGROUND_COLOR"),
    ),
    Template: () => Code("TEMPLATE"),
  }
}

const UNITS = {
  byte: "byte", centimeter: "centimeter", degree: "degree", em: "em", inch: "inch", item: "item",
  line: "line", millisecond: "millisecond", percent: "percent", pixel: "pixel", second: "second",
}

const OPTS = {
  textStylizeTools: ["weight", "italic", "underline", "throughline", "overline", "superScript", "subScript", "emphasis", "blur", "title", "increaseSize", "decreaseSize", "increaseLetterSpacing", "decreaseLetterSpacing", "family", "foregroundColor", "backgroundColor", "borderColor", "erase", "blank", "setBrush", "useBrush"],
  imageViewerTools: ["close", "download", "scroll", "play", "location", "nextImage", "previousImage", "firstImage", "lastImage", "thumbnailNav", "waterfall", "zoomIn", "zoomOut", "rotateLeft", "rotateRight", "hFlip", "vFlip", "translateLeft", "translateRight", "translateUp", "translateDown", "incHSkew", "decHSkew", "incVSkew", "decVSkew", "originSize", "fitScreen", "autoSize", "restore", "info", "dummy"],
  markdownlintTools: ["settings", "detailAll", "fixAll", "toggleSourceMode", "refresh", "close"],
}

const schema_global = () => [
  Group(
    Switch("ENABLE").Protect(),
    Select("LOCALE").Options(["auto", "en", "zh-CN", "zh-TW"]).ActionTooltip("openLocaleFolder", "fa fa-language"),
    Switch("DARK_MODE"),
  ),
  Group(
    Switch("BATCH_RENDER_CHARTS"),
    Select("EXIT_CHART_INTERACTION").Options(["click_exit_button", "ctrl_click_fence"]).MinItems(1),
  ),
  Group(
    Action("inspectRuntimeSettings").ActionTooltip("inspectDefaultSettings", "fa fa-cogs").ActionTooltip("inspectAllDefaultSettings", "fa fa-cogs"),
    Action("restoreSettings"),
    Action("restoreAllSettings"),
    Action("exportSettings").ActionTooltip("openSettingsDefaultTomlExternally", "fa fa-external-link-square").ActionTooltip("openSettingsUserTomlExternally", "fa fa-external-link-square"),
    Action("importSettings"),
  ),
  Group(
    Action("visitRepo").ActionTooltip("openPluginFolder", "fa fa-folder"),
    Action("viewDeepWiki").ActionTooltip("neverGonnaTellALie", "fa fa-book"),
    Action("developPlugins"),
    Action("editStyles"),
    Action("viewGithubImageBed"),
  ),
  Group(
    Action("updatePlugin"),
    Action("uninstallPlugin"),
    Action("sendEmail").ActionTooltip("toggleDevTools", "fa fa-wrench"),
    Action("donate"),
    Static("pluginVersion"),
  ),
]

const schema_window_tab = () => [
  FRAG.Base(),
  Group("appearance",
    Switch("SHOW_TAB_CLOSE_BUTTON"),
    Switch("TRIM_FILE_EXT"),
    Switch("SHOW_DIR_ON_DUPLICATE"),
    Switch("HIDE_WINDOW_TITLE_BAR"),
    Text("TAB_MIN_WIDTH"),
    Text("TAB_MAX_WIDTH"),
    Integer("MAX_TAB_NUM").AllowMinusOne(),
  ),
  Group("behavior",
    Switch("REOPEN_TABS_ON_STARTUP"),
    Select("NEW_TAB_POSITION").Options(["start", "end", "left", "right"]),
    Select("TAB_SWITCH_ON_CLOSE").Options(["left", "right", "latest"]),
    Select("LAST_TAB_CLOSE_ACTION").Options(["blankPage", "reconfirm", "exit"]),
  ),
  Group("mouseInteraction",
    Switch("CTRL_CLICK_TO_NEW_WINDOW"),
    Switch("MIDDLE_CLICK_TO_CLOSE"),
    Switch("CTRL_WHEEL_TO_SWITCH"),
    Switch("WHEEL_TO_SCROLL_TAB_BAR"),
    Switch("SHOW_FULL_PATH_ON_HOVER"),
  ),
  Group("drag",
    Select("DRAG_STYLE").Options(["JetBrains", "VSCode"]),
    Select("TAB_DETACHMENT").Options(["free", "resistant", "lockVertical"]).ShowIf(When.eq("DRAG_STYLE", "JetBrains")),
    Float("DETACHMENT_THRESHOLD").Min(0.1).Step(0.1).Tooltip("detachThreshold").ShowIf(When.and(When.eq("DRAG_STYLE", "JetBrains"), When.eq("TAB_DETACHMENT", "resistant"))),
    Float("DRAG_NEW_WINDOW_THRESHOLD").Min(-1).Step(0.5).Tooltip("newWindow").ShowIf(When.ne("TAB_DETACHMENT", "lockVertical")),
  ),
  ToggleSort("CONTEXT_MENU").Options(["closeTab", "closeOtherTabs", "closeLeftTabs", "closeRightTabs", "copyPath", "showInFinder", "openInNewWindow", "sortTabs"]),
  Group("hotkey",
    Array_("CLOSE_HOTKEY"),
    Array_("SWITCH_PREVIOUS_TAB_HOTKEY"),
    Array_("SWITCH_NEXT_TAB_HOTKEY"),
    Array_("SWITCH_LAST_ACTIVE_TAB_HOTKEY"),
    Array_("SORT_TABS_HOTKEY"),
    Array_("COPY_PATH_HOTKEY"),
    Array_("TOGGLE_TAB_BAR_HOTKEY"),
  ),
  FRAG.SettingHandler(),
]

const schema_search_multi = () => [
  FRAG.Base(true),
  Group("search",
    Switch("CASE_SENSITIVE"),
    Switch("OPTIMIZE_SEARCH").Tooltip("breakOrder"),
    Switch("STOP_SEARCHING_ON_HIDING"),
    Switch("BACKSPACE_TO_HIDE"),
    Select("EXPLAIN_TRIGGER").Options(["focus", "hover"]),
  ),
  Group("searchResult",
    Switch("RELATIVE_PATH"),
    Switch("SHOW_EXT"),
    Switch("SHOW_MTIME"),
    Switch("HIDE_BUTTON_HINT"),
    Integer("MAX_HIGHLIGHTS").Min(1).Max(5000),
    Palette("HIGHLIGHT_COLORS"),
  ),
  Array_("ALLOW_EXT"),
  Array_("IGNORE_FOLDERS"),
  Group("advanced",
    Switch("FOLLOW_SYMBOLIC_LINKS"),
    Segment("TRAVERSE_STRATEGY").Options(["bfs", "dfs"]),
    Integer("TIMEOUT").AllowMinusOne().Unit(UNITS.millisecond),
    Integer("MAX_SIZE").Unit(UNITS.byte).Min(1).Max(2000000).Tooltip("maxBytes"),
    Integer("MAX_ENTITIES").AllowMinusOne(),
    Integer("MAX_DEPTH").AllowMinusOne(),
    Integer("CONCURRENCY_LIMIT").Min(1),
  ),
  FRAG.SettingHandler(),
]

const schema_commander = () => [
  FRAG.Base(true),
  Switch("BACKSPACE_TO_HIDE"),
  Group("cmdDisplay",
    Select("QUICK_RUN_DISPLAY").Options(["echo", "always", "error", "silent"]),
    Select("COMMIT_RUN_DISPLAY").Options(["echo", "always"]),
  ),
  Table("BUILTIN")
    .Headers(["name", "shell", "cmd"])
    .NestedBoxes([
      Group(
        Switch("disable"),
        Select("shell").Options(["cmd/bash", "powershell", "gitbash", "wsl"]).OptionScope("BUILTIN.shell"),
        Text("name"),
      ),
      Textarea("cmd").Rows(5).Placeholder("envInfo"),
    ])
    .DefaultValues({
      name: "",
      disable: false,
      shell: "cmd/bash",
      cmd: "",
    }),
  Code("POST_SCRIPT").Tooltip("expertsOnly"),
  FRAG.SettingHandler(),
]

const schema_md_padding = () => [
  FRAG.Base(true),
  Array_("IGNORE_WORDS"),
  Array_("IGNORE_PATTERNS"),
  FRAG.SettingHandler(),
]

const schema_read_only = () => [
  FRAG.Base(true),
  Group(
    Switch("READ_ONLY_DEFAULT"),
    Switch("CLICK_HYPERLINK_TO_OPEN_WHEN_READ_ONLY"),
    Switch("DISABLE_EXPAND_WHEN_READ_ONLY"),
    Switch("AUTO_COLLAPSE_WHEN_READ_ONLY").ShowIf(When.false("DISABLE_EXPAND_WHEN_READ_ONLY")),
  ),
  Group("advanced",
    Switch("DISABLE_CONTEXT_MENU_WHEN_READ_ONLY"),
    Select("REMAIN_AVAILABLE_MENU_KEY").ShowIf(When.true("DISABLE_CONTEXT_MENU_WHEN_READ_ONLY")),
    Text("SHOW_TEXT"),
  ),
  FRAG.SettingHandler(),
]

const schema_blur = () => [
  FRAG.Base(true),
  Group(
    Switch("BLUR_DEFAULT"),
    Switch("RESTORE_ON_HOVER"),
    Segment("BLUR_TYPE").Options(["blur", "hide"]),
    Integer("BLUR_LEVEL").Unit(UNITS.pixel).Min(1).ShowIf(When.eq("BLUR_TYPE", "blur")),
  ),
  FRAG.SettingHandler(),
]

const schema_dark = () => [
  FRAG.Base(true),
  Switch("DARK_DEFAULT"),
  FRAG.SettingHandler(),
]

const schema_no_image = () => [
  FRAG.Base(true),
  Group(
    Switch("NO_IMAGE_DEFAULT"),
    Switch("SHOW_ON_HOVER"),
    Integer("TRANSITION_DURATION").Unit(UNITS.millisecond).Min(0),
    Integer("TRANSITION_DELAY").Unit(UNITS.millisecond).Min(0),
  ),
  FRAG.SettingHandler(),
]

const schema_myopic_defocus = () => [
  FRAG.Base(true),
  Action("myopicDefocusEffectDemo").Explain("enableMyopicDefocus"),
  Group(
    Switch("DEFOCUS_DEFAULT"),
    Range("EFFECT_STRENGTH").Unit(UNITS.percent).Min(1).Max(35),
    Float("SCREEN_SIZE").Unit(UNITS.inch).Min(1),
    Integer("SCREEN_RESOLUTION_X").Unit(UNITS.pixel).Min(1),
    Integer("SCREEN_RESOLUTION_Y").Unit(UNITS.pixel).Min(1),
    Float("SCREEN_DISTANCE").Unit(UNITS.centimeter).Min(1),
  ),
  FRAG.SettingHandler(),
]

const schema_command_palette = () => [
  FRAG.Base(true),
  Group(
    Switch("BACKSPACE_TO_HIDE"),
    Integer("DEBOUNCE_INTERVAL").Unit(UNITS.millisecond).Min(10),
  ),
  FRAG.SettingHandler(),
]

const schema_resize_image = () => [
  FRAG.Base(),
  Group("image",
    Switch("RECORD_RESIZE"),
    Switch("ALLOW_EXCEED_LIMIT"),
    Segment("IMAGE_ALIGN").Options(["left", "center", "right"]),
  ),
  Group("modifierKeys",
    Hotkey("MODIFIER_KEY.TEMPORARY").Tooltip("modifyKeyExample"),
    Hotkey("MODIFIER_KEY.PERSISTENT"),
  ),
  FRAG.SettingHandler(),
]

const schema_resize_table = () => [
  FRAG.Base(),
  Group(
    Switch("RECORD_RESIZE"),
    Switch("REMOVE_MIN_CELL_WIDTH"),
    Integer("DRAG_THRESHOLD").Unit(UNITS.pixel).Min(1),
  ),
  FRAG.SettingHandler(),
]

const schema_datatables = () => [
  FRAG.Base(),
  Group(
    Switch("ORDERING"),
    Switch("DEFAULT_ORDER"),
    Switch("SEARCHING"),
    Switch("REGEX"),
    Switch("CASE_INSENSITIVE"),
    Switch("SCROLL_COLLAPSE"),
    Switch("PAGING"),
    Integer("PAGE_LENGTH").Unit(UNITS.item).Min(1),
  ),
  FRAG.SettingHandler(),
]

const schema_markmap = () => [
  FRAG.Base(),
  Group(
    Switch("ENABLE_TOC_MARKMAP"),
    Switch("ENABLE_FENCE_MARKMAP"),
  ),
  Group("mindmapDiagram",
    Hotkey("TOC_HOTKEY"),
    Switch("FIX_SKIPPED_LEVEL_HEADERS"),
    Switch("REMOVE_HEADER_STYLES"),
    Switch("AUTO_FIT_ON_UPDATE"),
    Switch("AUTO_FIT_WHEN_FOLD"),
    Switch("RETAIN_FOLD_STATE_ON_UPDATE"),
    Switch("USE_CONTEXT_MENU"),
    Switch("CLICK_TO_POSITION"),
    Switch("AUTO_COLLAPSE_PARAGRAPH_ON_FOLD").Tooltip("experimental"),
    Range("POSITIONING_VIEWPORT_HEIGHT").Min(0.1).Max(0.95).Step(0.01).Tooltip("positioningViewPort"),
    Range("WIDTH_PERCENT_WHEN_INIT").Min(20).Max(95).Step(1).Unit(UNITS.percent),
    Range("HEIGHT_PERCENT_WHEN_INIT").Min(20).Max(95).Step(1).Unit(UNITS.percent),
    Range("HEIGHT_PERCENT_WHEN_PIN_TOP").Min(20).Max(95).Step(1).Unit(UNITS.percent),
    Range("WIDTH_PERCENT_WHEN_PIN_RIGHT").Min(20).Max(95).Step(1).Unit(UNITS.percent),
  ).ShowIf(DEPS.markmapToc),
  ToggleSort("TITLE_BAR_BUTTONS").Options(["download", "settings", "fit", "pinRight", "pinTop", "unfold", "expand", "close"]).MinItems(1).ShowIf(DEPS.markmapToc),
  Group("mindmapDiagramDefaultOptions",
    Switch("DEFAULT_TOC_OPTIONS.zoom"),
    Switch("DEFAULT_TOC_OPTIONS.pan"),
    Switch("DEFAULT_TOC_OPTIONS.toggleRecursively"),
    Range("DEFAULT_TOC_OPTIONS.initialExpandLevel").Min(1).Max(7).Step(1),
    Range("DEFAULT_TOC_OPTIONS.colorFreezeLevel").Min(1).Max(7).Step(1),
    Range("DEFAULT_TOC_OPTIONS.fitRatio").Min(0.5).Max(1).Step(0.01),
    Range("DEFAULT_TOC_OPTIONS.maxInitialScale").Min(0.5).Max(5).Step(0.25),
    Integer("DEFAULT_TOC_OPTIONS.maxWidth").Unit(UNITS.pixel).Min(0).Max(100).Step(5).Tooltip("zero"),
    Integer("DEFAULT_TOC_OPTIONS.nodeMinHeight").Unit(UNITS.pixel).Min(5).Max(50).Step(1),
    Integer("DEFAULT_TOC_OPTIONS.spacingHorizontal").Unit(UNITS.pixel).Min(0).Max(100).Step(5),
    Integer("DEFAULT_TOC_OPTIONS.spacingVertical").Unit(UNITS.pixel).Min(0).Max(100).Step(5),
    Integer("DEFAULT_TOC_OPTIONS.paddingX").Unit(UNITS.pixel).Min(0).Max(100).Step(5),
    Integer("DEFAULT_TOC_OPTIONS.duration").Unit(UNITS.millisecond).Min(0).Max(1000).Step(10),
    Palette("DEFAULT_TOC_OPTIONS.color"),
  ).ShowIf(DEPS.markmapToc),
  Palette("CANDIDATE_COLOR_SCHEMES").Dimensions(2).ShowIf(DEPS.markmapToc),
  Group("mindmapDiagramExport",
    Switch("DOWNLOAD_OPTIONS.KEEP_ALPHA_CHANNEL"),
    Switch("DOWNLOAD_OPTIONS.REMOVE_USELESS_CLASSES"),
    Switch("DOWNLOAD_OPTIONS.REMOVE_FOREIGN_OBJECT").Tooltip("removeForeignObj"),
    Switch("DOWNLOAD_OPTIONS.SHOW_PATH_INQUIRY_DIALOG"),
    Switch("DOWNLOAD_OPTIONS.SHOW_IN_FINDER"),
    Range("DOWNLOAD_OPTIONS.IMAGE_QUALITY").Min(0.01).Max(1).Step(0.01).Tooltip("pixelImagesOnly"),
    Integer("DOWNLOAD_OPTIONS.PADDING_HORIZONTAL").Unit(UNITS.pixel).Min(1).Step(1),
    Integer("DOWNLOAD_OPTIONS.PADDING_VERTICAL").Unit(UNITS.pixel).Min(1).Step(1),
    Float("DOWNLOAD_OPTIONS.IMAGE_SCALE").Min(0.1).Step(0.1),
    Text("DOWNLOAD_OPTIONS.FILENAME"),
    Text("DOWNLOAD_OPTIONS.FOLDER").Tooltip("tempDir"),
    Color("DOWNLOAD_OPTIONS.BACKGROUND_COLOR").Tooltip("jpgFormatOnly"),
    Color("DOWNLOAD_OPTIONS.TEXT_COLOR"),
    Color("DOWNLOAD_OPTIONS.OPEN_CIRCLE_COLOR"),
  ).ShowIf(DEPS.markmapToc),
  Group("fence",
    Switch("INTERACTIVE_MODE"),
    Hotkey("FENCE_HOTKEY"),
    Text("FENCE_LANGUAGE").Protect(),
    Text("DEFAULT_FENCE_HEIGHT"),
    Color("DEFAULT_FENCE_BACKGROUND_COLOR"),
  ).ShowIf(DEPS.markmapFence),
  Group("fenceDiagramDefaultOptions",
    Switch("DEFAULT_FENCE_OPTIONS.zoom"),
    Switch("DEFAULT_FENCE_OPTIONS.pan"),
    Switch("DEFAULT_FENCE_OPTIONS.toggleRecursively"),
    Range("DEFAULT_FENCE_OPTIONS.initialExpandLevel").Min(1).Max(7).Step(1),
    Range("DEFAULT_FENCE_OPTIONS.colorFreezeLevel").Min(1).Max(7).Step(1),
    Range("DEFAULT_FENCE_OPTIONS.fitRatio").Min(0.5).Max(1).Step(0.01),
    Range("DEFAULT_FENCE_OPTIONS.maxInitialScale").Min(0.5).Max(5).Step(0.25),
    Integer("DEFAULT_FENCE_OPTIONS.maxWidth").Unit(UNITS.pixel).Min(0).Max(1000).Step(10).Tooltip("zero"),
    Integer("DEFAULT_FENCE_OPTIONS.nodeMinHeight").Unit(UNITS.pixel).Min(5).Max(50).Step(1),
    Integer("DEFAULT_FENCE_OPTIONS.spacingHorizontal").Unit(UNITS.pixel).Min(0).Max(200).Step(1),
    Integer("DEFAULT_FENCE_OPTIONS.spacingVertical").Unit(UNITS.pixel).Min(0).Max(200).Step(1),
    Integer("DEFAULT_FENCE_OPTIONS.paddingX").Unit(UNITS.pixel).Min(0).Max(100).Step(1),
    Integer("DEFAULT_FENCE_OPTIONS.duration").Unit(UNITS.millisecond).Min(0).Max(1000).Step(10),
    Text("DEFAULT_FENCE_OPTIONS.height"),
    Color("DEFAULT_FENCE_OPTIONS.backgroundColor"),
    Palette("DEFAULT_FENCE_OPTIONS.color"),
  ).ShowIf(DEPS.markmapFence),
  Code("FENCE_TEMPLATE").ShowIf(DEPS.markmapFence),
  FRAG.SettingHandler(),
]

const schema_auto_number = () => [
  FRAG.Base(),
  Group("autoNumbering",
    Switch("ENABLE_OUTLINE"),
    Switch("ENABLE_CONTENT"),
    Switch("ENABLE_TOC"),
    Switch("ENABLE_IMAGE"),
    Switch("ENABLE_TABLE"),
    Switch("ENABLE_FENCE"),
  ),
  Group("style",
    Text("FONT_FAMILY"),
    Switch("SHOW_IMAGE_NAME").ShowIf(When.true("ENABLE_IMAGE")),
    Segment("POSITION_TABLE").Options(["before", "after"]).ShowIf(When.true("ENABLE_TABLE")),
    Segment("ALIGN").Options(["left", "center", "right"]).ShowIf(When.or(When.true("ENABLE_IMAGE"), When.true("ENABLE_TABLE"), When.true("ENABLE_FENCE"))),
  ),
  Table("LAYOUTS")
    .Headers(["name"])
    .NestedBoxes([
      Group(
        Hint().HintHeader("layoutSyntax").HintDetail("layoutSyntax"),
        Hint().HintHeader("counterNames").HintDetail("counterNames"),
        Hint().HintHeader("counterStyles").HintDetail("counterStyles"),
      ),
      Group(
        Switch("selected"),
        Text("name"),
        Text("layout.content-h1"),
        Text("layout.content-h2"),
        Text("layout.content-h3"),
        Text("layout.content-h4"),
        Text("layout.content-h5"),
        Text("layout.content-h6"),
        Text("layout.outline-h1"),
        Text("layout.outline-h2"),
        Text("layout.outline-h3"),
        Text("layout.outline-h4"),
        Text("layout.outline-h5"),
        Text("layout.outline-h6"),
        Text("layout.toc-h1"),
        Text("layout.toc-h2"),
        Text("layout.toc-h3"),
        Text("layout.toc-h4"),
        Text("layout.toc-h5"),
        Text("layout.toc-h6"),
        Text("layout.table"),
        Text("layout.image"),
        Text("layout.fence"),
      ),
    ])
    .DefaultValues({
      name: "",
      selected: true,
      layout: {
        "content-h1": "", "content-h2": "", "content-h3": "", "content-h4": "", "content-h5": "", "content-h6": "",
        "outline-h1": "", "outline-h2": "", "outline-h3": "", "outline-h4": "", "outline-h5": "", "outline-h6": "",
        "toc-h1": "", "toc-h2": "", "toc-h3": "", "toc-h4": "", "toc-h5": "", "toc-h6": "",
        "table": "", "image": "", "fence": "",
      },
    }),
  Switch("ENABLE_WHEN_EXPORT"),
  Code("APPLY_EXPORT_HEADER_NUMBERING").Tooltip("expertsOnly").ShowIf(When.true("ENABLE_WHEN_EXPORT")),
  FRAG.SettingHandler(),
]

const schema_fence_enhance = () => [
  FRAG.Base(),
  Group("buttonGeneral",
    Switch("ENABLE_BUTTON"),
    Switch("AUTO_HIDE").ShowIf(DEPS.fenceEnhanceButton),
    Switch("HIDE_BUTTON_HINT").ShowIf(DEPS.fenceEnhanceButton),
    Range("BUTTON_OPACITY").Min(0).Max(1).Step(0.05).ShowIf(DEPS.fenceEnhanceButton),
    Range("BUTTON_OPACITY_HOVER").Min(0).Max(1).Step(0.05).ShowIf(DEPS.fenceEnhanceButton),
    Text("BUTTON_SIZE").ShowIf(DEPS.fenceEnhanceButton),
    Text("BUTTON_COLOR").ShowIf(DEPS.fenceEnhanceButton),
    Text("BUTTON_PADDING").ShowIf(DEPS.fenceEnhanceButton),
    Text("BUTTON_TOP").ShowIf(DEPS.fenceEnhanceButton),
    Text("BUTTON_RIGHT").ShowIf(DEPS.fenceEnhanceButton),
    Integer("HINT_DURATION").Unit(UNITS.millisecond).Min(500).Step(100).ShowIf(DEPS.fenceEnhanceButton),
  ),
  Group("functionButtons",
    Switch("ENABLE_COPY").ShowIf(DEPS.fenceEnhanceButton),
    Switch("TRIM_WHITESPACE_ON_COPY").ShowIf(When.and(When.true("ENABLE_BUTTON"), When.true("ENABLE_COPY"))),
    Switch("COPY_AS_MARKDOWN").ShowIf(When.follow("TRIM_WHITESPACE_ON_COPY")),
    Select("LINE_BREAKS_ON_COPY").Options(["lf", "crlf", "preserve"]).ShowIf(When.follow("TRIM_WHITESPACE_ON_COPY")),
    Divider(),
    Switch("ENABLE_INDENT").ShowIf(DEPS.fenceEnhanceButton),
    Array_("EXCLUDE_LANGUAGE_ON_INDENT").ShowIf(When.and(When.true("ENABLE_BUTTON"), When.true("ENABLE_INDENT"))),
    Divider(),
    Switch("ENABLE_FOLD").ShowIf(DEPS.fenceEnhanceButton),
    Segment("FOLD_OVERFLOW").Options(["hidden", "scroll"]).ShowIf(When.and(When.true("ENABLE_BUTTON"), When.true("ENABLE_FOLD"))),
    Integer("MANUAL_FOLD_LINES").Unit(UNITS.line).Min(1).Step(1).ShowIf(When.follow("FOLD_OVERFLOW")),
    Switch("DEFAULT_FOLD").ShowIf(When.follow("FOLD_OVERFLOW")),
    Switch("EXPAND_ON_FOCUS").ShowIf(When.follow("DEFAULT_FOLD_THRESHOLD")),
    Switch("FOLD_ON_BLUR").ShowIf(When.follow("DEFAULT_FOLD_THRESHOLD")),
    Integer("DEFAULT_FOLD_THRESHOLD").Unit(UNITS.line).Min(0).Step(1).ShowIf(When.and(When.follow("FOLD_OVERFLOW"), When.true("DEFAULT_FOLD"))),
    Integer("AUTO_FOLD_LINES").Unit(UNITS.line).Min(1).Step(1).ShowIf(When.follow("DEFAULT_FOLD_THRESHOLD")),
  ),
  Table("CUSTOM_BUTTONS")
    .Headers(["HINT", "ICON"])
    .NestedBoxes([
      Group(
        Switch("DISABLE"),
        Icon("ICON"),
        Text("HINT"),
      ),
      Code("ON_INIT"),
      Code("ON_RENDER"),
      Code("ON_CLICK"),
    ])
    .DefaultValues({
      DISABLE: false,
      ICON: "fa fa-bomb",
      HINT: "",
      ON_INIT: "plugin => console.log('Initialized')",
      ON_RENDER: "({ btn, fence, cid, enhance }) => console.log('Rendered')",
      ON_CLICK: "({ ev, btn, cont, fence, cm, cid, plu }) => console.log('Clicked')",
    })
    .ShowIf(DEPS.fenceEnhanceButton),
  Group("buttonHotkeys",
    Switch("ENABLE_HOTKEY").ActionTooltip("viewCodeMirrorKeymapsManual"),
    Text("SWAP_PREVIOUS_LINE").ShowIf(DEPS.fenceEnhanceHotkey),
    Text("SWAP_NEXT_LINE").ShowIf(DEPS.fenceEnhanceHotkey),
    Text("COPY_PREVIOUS_LINE").ShowIf(DEPS.fenceEnhanceHotkey),
    Text("COPY_NEXT_LINE").ShowIf(DEPS.fenceEnhanceHotkey),
    Text("INSERT_LINE_PREVIOUS").ShowIf(DEPS.fenceEnhanceHotkey),
    Text("INSERT_LINE_NEXT").ShowIf(DEPS.fenceEnhanceHotkey),
  ),
  Table("CUSTOM_HOTKEYS")
    .Headers(["HOTKEY", "CALLBACK"])
    .NestedBoxes([
      Group(
        Switch("DISABLE"),
        Text("HOTKEY"),
      ),
      Code("CALLBACK"),
    ])
    .DefaultValues({
      DISABLE: false,
      HOTKEY: "",
      CALLBACK: "({ pre, cid, cm, cursor, lineNum, lastNum, separator }) => console.log('Callback')",
    })
    .ShowIf(DEPS.fenceEnhanceHotkey),
  Group("lineHighlighting",
    Switch("HIGHLIGHT_BY_LANGUAGE").ActionTooltip("viewVitePressLineHighlighting"),
    Segment("NUMBERING_BASE").Options(["0-based", "1-based"]).ShowIf(When.true("HIGHLIGHT_BY_LANGUAGE")),
    Text("HIGHLIGHT_PATTERN").ShowIf(When.follow("NUMBERING_BASE")),
    Text("HIGHLIGHT_LINE_COLOR_BY_LANGUAGE").ShowIf(When.follow("NUMBERING_BASE")),
    Divider(),
    Switch("HIGHLIGHT_ON_FOCUS").ActionTooltip("viewFocusLineHighlightingEffect"),
    Text("HIGHLIGHT_LINE_COLOR_ON_FOCUS").ShowIf(When.true("HIGHLIGHT_ON_FOCUS")),
    Divider(),
    Switch("HIGHLIGHT_ON_HOVER"),
    Text("HIGHLIGHT_LINE_COLOR_ON_HOVER").ShowIf(When.true("HIGHLIGHT_ON_HOVER")),
  ),
  Group("codeTitle",
    Switch("ENABLE_CODE_TITLE").ActionTooltip("viewVuePressCodeTitle"),
    Text("CODE_TITLE_PATTERN").ShowIf(When.true("ENABLE_CODE_TITLE")),
  ),
  Group("advanced",
    Switch("SIDE_BY_SIDE_VIEW").ActionTooltip("viewSideBySideEffect").Tooltip("stylisticConfusion"),
    Switch("VISIBLE_TABS").ActionTooltip("viewVisibleTabsEffect"),
    Switch("ENABLE_LANGUAGE_FOLD").ActionTooltip("viewCodeFoldingEffect"),
    Switch("INDENTED_WRAPPED_LINE").ActionTooltip("viewIndentedWrappedLineEffect"),
    Switch("PRELOAD_ALL_FENCES").Tooltip("dangerous"),
  ),
  FRAG.SettingHandler(),
]

const schema_collapse_paragraph = () => [
  Group(
    Switch("ENABLE").Tooltip("ConflictWithOptionExpandSimpleBlock"),
    Text("NAME").Placeholder("defaultIfEmpty"),
  ),
  Group("mode",
    Switch("RECORD_COLLAPSE"),
    Switch("STRICT_MODE"),
    Switch("STRICT_MODE_IN_CONTEXT_MENU"),
  ),
  Group("modifierKey",
    Hotkey("MODIFIER_KEY.COLLAPSE_SINGLE").Tooltip("modifierKeyExample"),
    Hotkey("MODIFIER_KEY.COLLAPSE_SIBLINGS"),
    Hotkey("MODIFIER_KEY.COLLAPSE_ALL_SIBLINGS"),
    Hotkey("MODIFIER_KEY.COLLAPSE_RECURSIVE"),
  ),
  FRAG.SettingHandler(),
]

const schema_collapse_list = () => [
  FRAG.Base(),
  Group(
    Switch("RECORD_COLLAPSE"),
    Text("TRIANGLE_COLOR"),
  ),
  FRAG.SettingHandler(),
]

const schema_collapse_table = () => [
  FRAG.Base(),
  Switch("RECORD_COLLAPSE"),
  FRAG.SettingHandler(),
]

const schema_truncate_text = () => [
  FRAG.Base(),
  Group("hotkey",
    Hotkey("HIDE_FRONT_HOTKEY"),
    Hotkey("HIDE_BASE_VIEW_HOTKEY"),
    Hotkey("SHOW_ALL_HOTKEY"),
    Integer("RETAIN_LENGTH").Min(1).ShowIf(When.or(When.bool("HIDE_FRONT_HOTKEY", true), When.bool("HIDE_BASE_VIEW_HOTKEY", true))),
  ),
  FRAG.SettingHandler(),
]

const schema_export_enhance = () => [
  FRAG.Base(),
  Group(
    Switch("EMBED_NETWORK_IMAGES"),
    Integer("DOWNLOAD_THREADS").Min(1).ShowIf(When.true("EMBED_NETWORK_IMAGES")),
  ),
  FRAG.SettingHandler(),
]

const schema_text_stylize = () => [
  FRAG.Base(true),
  Transfer("TOOLS").Options(OPTS.textStylizeTools).MinItems(1),
  Table("ACTION_HOTKEYS")
    .Headers(["hotkey", "action"])
    .NestedBoxes([
      Group(
        Select("action").Options(OPTS.textStylizeTools).OptionScope("TOOLS"),
        Hotkey("hotkey"),
      ),
    ])
    .DefaultValues({ hotkey: "", action: "weight" }),
  Group("buttonDefaultOptions",
    Color("DEFAULT_COLORS.FOREGROUND"),
    Color("DEFAULT_COLORS.BACKGROUND"),
    Color("DEFAULT_COLORS.BORDER"),
    Text("DEFAULT_FORMAT_BRUSH").Tooltip("brushExample"),
  ),
  Palette("COLOR_TABLE").Dimensions(2).AllowJagged(false),
  FRAG.SettingHandler(),
]

const schema_cipher = () => [
  FRAG.Base(),
  Group(
    Switch("SHOW_HINT_DIALOG"),
    Password("SECRET_KEY").Protect(),
  ),
  Group("hotkey",
    Hotkey("ENCRYPT_HOTKEY"),
    Hotkey("DECRYPT_HOTKEY"),
  ),
  FRAG.SettingHandler(),
]

const schema_resource_manager = () => [
  FRAG.Base(true),
  Group("windowPosition",
    Range("PANEL_LEFT_PERCENT").Percent(),
    Range("PANEL_WIDTH_PERCENT").Percent(),
    Range("PANEL_HEIGHT_PERCENT").Percent(),
  ),
  Array_("RESOURCE_EXT"),
  Array_("MARKDOWN_EXT"),
  Array_("IGNORE_FOLDERS"),
  Group("advanced",
    Select("RESOURCE_GRAMMARS").Options(["markdown", "html"]).MinItems(1),
    Segment("TRAVERSE_STRATEGY").Options(["bfs", "dfs"]),
    Switch("FOLLOW_SYMBOLIC_LINKS"),
    Integer("TIMEOUT").Unit(UNITS.millisecond).Min(1),
    Integer("MAX_ENTITIES").AllowMinusOne(),
    Integer("MAX_DEPTH").AllowMinusOne(),
    Integer("CONCURRENCY_LIMIT").Min(1),
  ),
  FRAG.SettingHandler(),
]

const schema_easy_modify = () => [
  FRAG.Base(),
  Group("hotkey",
    Hotkey("HOTKEY_COPY_FULL_PATH"),
    Hotkey("HOTKEY_INCREASE_HEADERS_LEVEL"),
    Hotkey("HOTKEY_DECREASE_HEADERS_LEVEL"),
    Hotkey("HOTKEY_UNWRAP_OUTERMOST_BLOCK"),
    Hotkey("HOTKEY_EXTRACT_RANGE_TO_NEW_FILE"),
    Hotkey("HOTKEY_INSERT_MERMAID_MINDMAP"),
    Hotkey("HOTKEY_INSERT_MERMAID_GRAPH"),
    Hotkey("HOTKEY_CONVERT_CRLF_TO_LF"),
    Hotkey("HOTKEY_CONVERT_LF_TO_CRLF"),
    Hotkey("HOTKEY_FILTER_INVISIBLE_CHARACTERS"),
    Hotkey("HOTKEY_TRAILING_WHITE_SPACE"),
    Hotkey("HOTKEY_CONVERT_IMAGE_TO_BASE64"),
    Hotkey("HOTKEY_CONVERT_ALL_IMAGES_TO_BASE64"),
  ),
  FRAG.SettingHandler(),
]

const schema_custom = () => [
  Group(
    Switch("ENABLE").Protect(),
    Text("NAME").Placeholder("defaultIfEmpty"),
  ),
  Switch("HIDE_DISABLE_PLUGINS"),
  FRAG.SettingHandler(),
]

const schema_mouse_gestures = () => [
  FRAG.Base(),
  Group(
    Select("POINTER_TYPES").Options(["mouse", "pen", "touch"]).MinItems(1),
    Select("TRIGGER_BUTTONS").Options(["middle", "right", "x1", "x2"]).MinItems(1),
    Select("SUPPRESSION_KEY").Options(["", "alt", "ctrl", "shift", "meta"]),
    Integer("START_TIMEOUT").Unit(UNITS.millisecond).Min(0).Tooltip("START_TIMEOUT"),
    Integer("IDLE_TIMEOUT").Unit(UNITS.millisecond).Min(0).Tooltip("IDLE_TIMEOUT"),
    Integer("COOLDOWN").Unit(UNITS.millisecond).Min(0).Tooltip("COOLDOWN"),
  ),
  Group(
    Switch("ENABLE_VISUALIZER"),
    Switch("ENABLE_HUD"),
    Switch("ENABLE_SENSORY"),
    Integer("TRAJECTORY_LINE_WIDTH").Unit(UNITS.pixel).Min(1).ShowIf(When.true("ENABLE_VISUALIZER")),
    Color("DEFAULT_COLOR.middle").ShowIf(DEPS.gesturesDisplay("middle")),
    Color("DEFAULT_COLOR.right").ShowIf(DEPS.gesturesDisplay("right")),
    Color("DEFAULT_COLOR.x1").ShowIf(DEPS.gesturesDisplay("x1")),
    Color("DEFAULT_COLOR.x2").ShowIf(DEPS.gesturesDisplay("x2")),
  ),
  Table("GESTURES")
    .Headers(["path", "button", "name"])
    .NestedBoxes([
      Group(
        Switch("enable"),
        Text("name"),
        Select("button").Options(["", "middle", "right", "x1", "x2"]).OptionScope("GESTURES.button"),
        Text("path"),
        Integer("cooldown").Unit(UNITS.millisecond).Min(0),
      ),
      Code("execute"),
    ])
    .DefaultValues({
      enable: true,
      name: "",
      button: "",
      path: "",
      cooldown: 0,
      execute: "() => console.log('triggered')",
    }),
  Group("advanced",
    Select("STRATEGY").Options(["fourWay", "eightWay", "adaptive"]).Tooltip("STRATEGY"),
    Integer("MACRO_RADIUS").Unit(UNITS.pixel).Min(1).Tooltip("MACRO_RADIUS"),
    Integer("TAIL_RADIUS").Unit(UNITS.pixel).Min(1).Tooltip("TAIL_RADIUS"),
    Integer("HYSTERESIS").Unit(UNITS.degree).Min(0).Max(45).Tooltip("HYSTERESIS"),
  ),
  FRAG.SettingHandler(),
]

const schema_slash_commands = () => [
  FRAG.Base(),
  Group("trigger",
    Text("TRIGGER_REGEXP"),
    Text("FUNC_PARAM_SEPARATOR").Protect(),
    Select("SUGGESTION_TIMING").Options(["on_input", "debounce"]),
    Select("MATCH_STRATEGY").Options(["prefix", "substr", "abbr"]),
    Select("ORDER_STRATEGY").Options(["predefined", "lexicographic", "length_based", "earliest_hit"]),
  ),
  Table("COMMANDS")
    .Headers(["keyword", "type"])
    .NestedBoxes([
      Group(
        Switch("enable"),
        Select("type").Options(["snippet", "gen-snp", "command"]).OptionScope("COMMANDS.type"),
        Select("scope").Options(["plain", "inline_math"]).OptionScope("COMMANDS.scope"),
        Text("keyword").Placeholder("LettersAndNumbersOnly"),
        Text("icon").Placeholder("emojiOnly"),
        Text("hint"),
        Integer("cursorOffset.0"),
        Integer("cursorOffset.1"),
      ),
      Code("callback").Placeholder("callbackType"),
    ])
    .DefaultValues({
      enable: true,
      type: "snippet",
      scope: "plain",
      keyword: "",
      icon: "🧰",
      hint: "",
      cursorOffset: [0, 0],
      callback: "",
    }),
  FRAG.SettingHandler(),
]

const schema_cjk_symbol_pairing = () => [
  FRAG.Base(),
  Group(
    Switch("AUTO_SKIP_PAIR"),
    Switch("AUTO_DELETE_PAIR"),
    Switch("AUTO_SURROUND_PAIR"),
    Switch("AUTO_CONVERT_FULL_TO_HALF"),
  ),
  Table("AUTO_PAIR_SYMBOLS")
    .Headers(["input", "output"])
    .NestedBoxes([
      Group(
        Switch("enable"),
        Text("input"),
        Text("output"),
      ),
    ])
    .DefaultValues({ enable: true, input: "", output: "" }),
  Table("AUTO_CONVERT_SYMBOLS")
    .Headers(["input", "output"])
    .NestedBoxes([
      Group(
        Switch("enable"),
        Text("input"),
        Text("output"),
      ),
    ])
    .DefaultValues({ enable: true, input: "", output: "" })
    .ShowIf(When.true("AUTO_CONVERT_FULL_TO_HALF")),
  FRAG.SettingHandler(),
]

const schema_right_outline = () => [
  FRAG.Base(true),
  Group(
    Switch("DEFAULT_SHOW_OUTLINE"),
    Switch("REMOVE_HEADER_STYLES"),
    Switch("SORTABLE"),
    Switch("RIGHT_CLICK_OUTLINE_BUTTON_TO_TOGGLE"),
    Range("DEFAULT_WIDTH_PERCENT").Percent(),
  ),
  ToggleSort("TITLE_BAR_BUTTONS").Options(["header", "image", "table", "fence", "link", "math"]),
  Group("displayHeader",
    Switch("INCLUDE_HEADINGS.image").ShowIf(When.contains("TITLE_BAR_BUTTONS", "image")),
    Switch("INCLUDE_HEADINGS.table").ShowIf(When.contains("TITLE_BAR_BUTTONS", "table")),
    Switch("INCLUDE_HEADINGS.fence").ShowIf(When.contains("TITLE_BAR_BUTTONS", "fence")),
    Switch("INCLUDE_HEADINGS.link").ShowIf(When.contains("TITLE_BAR_BUTTONS", "link")),
    Switch("INCLUDE_HEADINGS.math").ShowIf(When.contains("TITLE_BAR_BUTTONS", "math")),
  ),
  FRAG.SettingHandler(),
]

const schema_right_click_menu = () => [
  Group(
    Switch("ENABLE").Protect(),
    Text("NAME").Placeholder("defaultIfEmpty"),
  ),
  Group("style",
    Switch("SHOW_PLUGIN_HOTKEY"),
    Switch("SHOW_ACTION_OPTIONS_ICON"),
    Switch("DO_NOT_HIDE"),
    Switch("HIDE_OTHER_OPTIONS"),
    Text("MENU_MIN_WIDTH"),
  ),
  Table("MENUS")
    .Headers(["NAME", "LIST"])
    .NestedBoxes([
      Text("NAME"),
      Transfer("LIST"),
    ])
    .DefaultValues({
      NAME: "",
      LIST: [],
    }),
  Group("advanced",
    Switch("FIND_LOST_PLUGINS"),
  ),
  FRAG.SettingHandler(),
]

const schema_pie_menu = () => [
  FRAG.Base(true),
  Hotkey("MODIFIER_KEY").Tooltip("example"),
  Table("BUTTONS")
    .Headers(["CALLBACK", "ICON"])
    .NestedBoxes([
      Group(
        Icon("ICON"),
        Text("CALLBACK"),
      ),
    ])
    .DefaultValues({ ICON: "fa fa-bomb", CALLBACK: "" }),
  FRAG.SettingHandler(),
]

const schema_preferences = () => [
  Group(
    Switch("ENABLE").Protect(),
    Text("NAME").Placeholder("defaultIfEmpty"),
    Hotkey("HOTKEY"),
  ),
  Group(
    Switch("COLLAPSIBLE_BOX"),
    Segment("DEPENDENCIES_FAILURE_BEHAVIOR").Options(["readonly", "hide"]),
    Segment("OBJECT_SETTINGS_FORMAT").Options(["JSON", "TOML", "YAML"]),
    Select("DEFAULT_MENU"),
    Select("HIDE_MENUS"),
  ),
  Code("FORM_RENDERING_HOOK").Tooltip("expertsOnly"),
  FRAG.SettingHandler(),
]

const schema_hotkeys = () => [
  FRAG.Base(true),
  Table("CUSTOM_HOTKEYS")
    .Headers(["hotkey", "desc"])
    .NestedBoxes([
      Group(
        Switch("enable"),
        Hotkey("hotkey"),
        Text("desc"),
        Text("plugin"),
        Text("function"),
        Text("closestSelector"),
      ),
      Code("evil"),
    ])
    .DefaultValues({
      enable: true,
      hotkey: "",
      desc: "",
      plugin: "",
      function: "",
      closestSelector: "",
      evil: "(anchorNode) => console.log(`Invoke with anchor: ${anchorNode}`)",
    }),
  FRAG.SettingHandler(),
]

const schema_asset_root_redirect = () => [
  FRAG.Base(),
  Text("ROOT_PATH"),
  Array_("IGNORE_GLOB_FILES").ActionTooltip("viewGlobPattern"),
  FRAG.SettingHandler(),
]

const schema_bookmark = () => [
  FRAG.Base(true),
  Group(
    Hotkey("MODIFIER_KEY").Tooltip("modifierKeyExample"),
    Switch("AUTO_POPUP_WINDOW"),
  ),
  FRAG.SettingHandler(),
]

const schema_templater = () => [
  FRAG.Base(true),
  Switch("AUTO_OPEN"),
  Table("TEMPLATE_VARIABLES")
    .Headers(["name", "callback"])
    .NestedBoxes([
      Group(
        Switch("enable"),
        Text("name"),
      ),
      Code("callback"),
    ])
    .DefaultValues({
      enable: true,
      name: "",
      callback: "(...args) => console.log(`Invoke with params: ${args}`)",
    }),
  Table("TEMPLATE")
    .Headers(["name", "text"])
    .NestedBoxes([
      Text("name"),
      Textarea("text").Rows(10),
    ])
    .DefaultValues({ name: "", text: "" }),
  Array_("TEMPLATE_FOLDERS"),
  FRAG.SettingHandler(),
]

const schema_editor_width_slider = () => [
  FRAG.Base(true),
  Integer("WIDTH_RATIO").Unit(UNITS.percent).Min(-1).Max(100).Step(1).Tooltip("minusOneMeansDisable"),
  FRAG.SettingHandler(),
]

const schema_article_uploader = () => [
  Group(
    Switch("ENABLE").ActionTooltip("viewArticleUploaderReadme", "fa fa-flask"),
    Text("NAME").Placeholder("defaultIfEmpty"),
  ),
  Switch("HIDE"),
  Group("upload",
    Switch("upload.reconfirm"),
    Switch("upload.selenium.headless"),
  ),
  Group("wordPress",
    Switch("upload.wordpress.enabled"),
    Text("upload.wordpress.hostname").ShowIf(When.true("upload.wordpress.enabled")),
    Text("upload.wordpress.loginUrl").ShowIf(When.true("upload.wordpress.enabled")),
    Text("upload.wordpress.username").ShowIf(When.true("upload.wordpress.enabled")),
    Password("upload.wordpress.password").ShowIf(When.true("upload.wordpress.enabled")),
  ),
  Group("cnblog",
    Switch("upload.cnblog.enabled"),
    Text("upload.cnblog.username").ShowIf(When.true("upload.cnblog.enabled")),
    Password("upload.cnblog.password").ShowIf(When.true("upload.cnblog.enabled")),
  ),
  Group("csdn",
    Switch("upload.csdn.enabled"),
    Text("upload.csdn.cookie").ShowIf(When.true("upload.csdn.enabled")),
  ),
  Group("hotkey",
    Hotkey("UPLOAD_ALL_HOTKEY").ShowIf(When.or(When.true("upload.cnblog.enabled"), When.true("upload.wordpress.enabled"), When.true("upload.csdn.enabled"))),
    Hotkey("UPLOAD_CNBLOG_HOTKEY").ShowIf(When.true("upload.cnblog.enabled")),
    Hotkey("UPLOAD_WORDPRESS_HOTKEY").ShowIf(When.true("upload.wordpress.enabled")),
    Hotkey("UPLOAD_CSDN_HOTKEY").ShowIf(When.true("upload.csdn.enabled")),
  ),
  FRAG.SettingHandler(),
]

const schema_ripgrep = () => [
  FRAG.Base(true),
  Switch("BACKSPACE_TO_HIDE"),
  FRAG.SettingHandler(),
]

const schema_static_markers = () => [
  FRAG.Base(true),
  Switch("STATIC_DEFAULT"),
  Checkbox("STATIC_MARKERS").Options(["strong", "em", "del", "underline", "superscript", "subscript", "code", "image", "link", "footnote", "highlight", "emoji", "inlineMath", "inlineHTML"]).Columns(4),
  FRAG.SettingHandler(),
]

const schema_sidebar_enhance = () => [
  FRAG.Base(),
  Group(
    Switch("CTRL_WHEEL_TO_SCROLL_SIDEBAR"),
    Switch("SORTABLE_OUTLINE"),
    Select("OUTLINE_FOLD_STATE").Options(["alwaysUnfold", "alwaysFold", "remember"]),
  ),
  Group(
    Switch("ENABLE_FILE_COUNT"),
    Text("FONT_WEIGHT").ShowIf(DEPS.countFile),
    Text("TEXT_COLOR").ShowIf(DEPS.countFile),
    Text("BACKGROUND_COLOR").ShowIf(DEPS.countFile),
    Divider(),
    Array_("COUNT_EXT").ShowIf(DEPS.countFile),
    Array_("IGNORE_FOLDERS").ShowIf(DEPS.countFile),
    Divider(),
    Switch("FOLLOW_SYMBOLIC_LINKS").ShowIf(DEPS.countFile),
    Integer("MIN_FILES_TO_DISPLAY").Min(0).ShowIf(DEPS.countFile).Tooltip("ignoreMinNum"),
    Integer("MAX_SIZE").Unit(UNITS.byte).Min(1).Max(2000000).Tooltip("maxBytes").ShowIf(DEPS.countFile),
    Integer("MAX_ENTITIES").Min(100).ShowIf(DEPS.countFile),
    Integer("CONCURRENCY_LIMIT").Min(1).ShowIf(DEPS.countFile),
  ),
  Group(
    Array_("HIDDEN_NODE_PATTERNS"),
    Divider(),
    Switch("DISPLAY_NON_MARKDOWN_FILES"),
    Array_("OPEN_BY_TYPORA_EXT").ShowIf(When.true("DISPLAY_NON_MARKDOWN_FILES")),
    Array_("OPEN_BY_SYSTEM_EXT").ShowIf(When.true("DISPLAY_NON_MARKDOWN_FILES")),
  ),
  Switch("CUSTOMIZE_SIDEBAR_ICONS").ShowIf(When.true("DISPLAY_NON_MARKDOWN_FILES")),
  Table("SIDEBAR_ICONS")
    .Headers(["extensions", "icon"])
    .NestedBoxes([
      Group(
        Switch("enable"),
        Text("icon"),
        Array_("extensions"),
      ),
    ])
    .DefaultValues({
      enable: true,
      icon: "fa fa-file-text-o",
      extensions: [],
    })
    .ShowIf(When.and(When.true("CUSTOMIZE_SIDEBAR_ICONS"), When.follow("CUSTOMIZE_SIDEBAR_ICONS"))),
  FRAG.SettingHandler(),
]

const schema_cursor_history = () => [
  FRAG.Base(),
  Group("hotkey",
    Hotkey("HOTKEY_GO_FORWARD"),
    Hotkey("HOTKEY_GO_BACK"),
  ),
  Integer("MAX_HISTORY_ENTRIES").Min(1).Step(1),
  FRAG.SettingHandler(),
]

const schema_json_rpc = () => [
  Group(
    Switch("ENABLE").ActionTooltip("viewJsonRPCReadme", "fa fa-flask"),
    Text("NAME").Placeholder("defaultIfEmpty"),
  ),
  Group("rpcServer",
    Switch("SERVER_OPTIONS.strict"),
    Text("SERVER_OPTIONS.host"),
    Integer("SERVER_OPTIONS.port").Min(0).Max(65535).Step(1),
    Text("SERVER_OPTIONS.path"),
  ),
  FRAG.SettingHandler(),
]

const schema_updater = () => [
  FRAG.Base(true),
  Group(
    Integer("NETWORK_REQUEST_TIMEOUT").Unit(UNITS.millisecond).Min(30000),
    Text("PROXY"),
  ),
  Group("autoUpdate",
    Switch("AUTO_UPDATE"),
    Integer("UPDATE_LOOP_INTERVAL").Unit(UNITS.millisecond).Min(-1).Tooltip("loopInterval").ShowIf(When.true("AUTO_UPDATE")),
    Integer("START_UPDATE_INTERVAL").Unit(UNITS.millisecond).Min(-1).Tooltip("waitInterval").ShowIf(When.true("AUTO_UPDATE")),
  ),
  FRAG.SettingHandler(),
]

const schema_test = () => [
  FRAG.Base(),
  FRAG.SettingHandler(),
]

const schema_kanban = () => [
  FRAG.Base(true),
  Group("fence",
    Text("LANGUAGE").Protect(),
    Switch("INTERACTIVE_MODE"),
    Switch("STRICT_MODE"),
  ),
  Group("kanbanStyle",
    Integer("KANBAN_WIDTH").Unit(UNITS.pixel).Min(1),
    Integer("KANBAN_MAX_HEIGHT").Unit(UNITS.pixel).Min(1),
    Float("KANBAN_TASK_DESC_MAX_HEIGHT").Unit(UNITS.em).Min(-1).Tooltip("minusOneMeansShowAll"),
    Switch("HIDE_DESC_WHEN_EMPTY"),
    Switch("WRAP"),
    Switch("ALLOW_MARKDOWN_INLINE_STYLE"),
    Palette("KANBAN_COLOR"),
    Palette("TASK_COLOR"),
  ),
  FRAG.Template(),
  FRAG.SettingHandler(),
]

const schema_chat = () => [
  FRAG.Base(true),
  Group("fence",
    Text("LANGUAGE").Protect(),
    Switch("INTERACTIVE_MODE"),
    Switch("DEFAULT_OPTIONS.useStrict"),
  ),
  Group("defaultOption",
    Switch("DEFAULT_OPTIONS.showNickname"),
    Switch("DEFAULT_OPTIONS.showAvatar"),
    Switch("DEFAULT_OPTIONS.notAllowShowTime"),
    Switch("DEFAULT_OPTIONS.allowMarkdown"),
    Text("DEFAULT_OPTIONS.senderNickname"),
    Text("DEFAULT_OPTIONS.timeNickname"),
  ),
  FRAG.Template(),
  FRAG.SettingHandler(),
]

const schema_timeline = () => [
  FRAG.Base(true),
  FRAG.LangMode(),
  Group("diagramStyle",
    Text("BACKGROUND_COLOR"),
    Text("TITLE_COLOR"),
    Text("TITLE_FONT_SIZE"),
    Text("TITLE_FONT_WEIGHT"),
    Text("LINE_COLOR"),
    Text("LINE_WIDTH"),
    Text("CIRCLE_COLOR"),
    Text("CIRCLE_DIAMETER"),
    Text("TIME_COLOR"),
    Text("CIRCLE_TOP"),
  ),
  FRAG.Template(),
  FRAG.SettingHandler(),
]

const schema_echarts = () => [
  FRAG.Base(true),
  FRAG.LangMode(),
  FRAG.ChartStyle(),
  FRAG.Template(),
  Group("advanced",
    Segment("LOCALE").Options(["en", "zh"]),
    Segment("THEME").Options(["light", "dark"]),
    Segment("RENDERER").Options(["svg", "canvas"]).ActionTooltip("chooseEchartsRenderer"),
    Select("EXPORT_TYPE").Options(["svg", "png", "jpg"]),
  ),
  FRAG.SettingHandler(),
]

const schema_chart = () => [
  FRAG.Base(true),
  FRAG.LangMode(),
  Group("diagramStyle",
    Segment("CHART_ALIGN").Options(["left", "center", "right"]),
    Text("DEFAULT_FENCE_HEIGHT"),
    Text("DEFAULT_FENCE_BACKGROUND_COLOR"),
  ),
  FRAG.Template(),
  FRAG.SettingHandler(),
]

const schema_wavedrom = () => [
  FRAG.Base(true),
  Group("languageMode",
    Text("LANGUAGE").Protect(),
    Switch("INTERACTIVE_MODE"),
    Switch("SAFE_MODE"),
  ),
  Group("diagramStyle",
    Segment("CHART_ALIGN").Options(["left", "center", "right"]),
    Text("DEFAULT_FENCE_HEIGHT"),
    Text("DEFAULT_FENCE_BACKGROUND_COLOR"),
  ),
  FRAG.Template(),
  Array_("SKIN_FILES").ActionTooltip("downloadWaveDromSkins", "fa fa-download"),
  FRAG.SettingHandler(),
]

const schema_calendar = () => [
  FRAG.Base(true),
  FRAG.LangMode(),
  FRAG.ChartStyle(),
  FRAG.Template(),
  FRAG.SettingHandler(),
]

const schema_abc = () => [
  FRAG.Base(true),
  FRAG.LangMode(),
  FRAG.ChartStyle(),
  FRAG.Template(),
  Dict("VISUAL_OPTIONS").ActionTooltip("viewAbcVisualOptionsManual"),
  FRAG.SettingHandler(),
]

const schema_drawIO = () => [
  FRAG.Base(true),
  FRAG.LangMode(),
  FRAG.ChartStyle(),
  FRAG.Template(),
  Group("advanced",
    Text("RESOURCE_URI"),
    Text("PROXY"),
    Integer("SERVER_TIMEOUT").Unit(UNITS.millisecond).Min(1000),
    Integer("CACHED_URL_COUNT").Min(1),
  ),
  FRAG.SettingHandler(),
]

const schema_plantUML = () => [
  Group(
    Switch("ENABLE").ActionTooltip("installPlantUMLServer", "fa fa-flask"),
    Text("NAME").Placeholder("defaultIfEmpty"),
    Hotkey("HOTKEY"),
  ),
  Group(
    Text("SERVER_URL"),
    Integer("SERVER_TIMEOUT").Unit(UNITS.millisecond).Min(1000),
    Text("PROXY"),
    Integer("CACHED_URL_COUNT").Min(1),
    Segment("OUTPUT_FORMAT").Options(["svg", "png", "txt"]),
  ),
  FRAG.LangMode(),
  FRAG.ChartStyle(),
  FRAG.Template(),
  FRAG.SettingHandler(),
]

const schema_marp = () => [
  FRAG.Base(true),
  FRAG.LangMode(),
  Dict("MARP_CORE_OPTIONS").ActionTooltip("viewMarpOptions"),
  FRAG.Template(),
  FRAG.SettingHandler(),
]

const schema_callouts = () => [
  FRAG.Base(true),
  Group("style",
    Switch("SET_TITLE_COLOR"),
    Text("BOX_SHADOW"),
  ),
  Group("mouseHover",
    Switch("HOVER_TO_SHOW_FOLD_CALLOUT"),
  ),
  Group("fontFamily",
    Text("FONT_FAMILY"),
    Switch("USE_NETWORK_ICON_WHEN_EXPORTING").Tooltip("missingFont"),
    Text("NETWORK_ICON_URL").ShowIf(When.true("USE_NETWORK_ICON_WHEN_EXPORTING")),
  ),
  Group("defaultOptions",
    Color("DEFAULT_BACKGROUND_COLOR"),
    Color("DEFAULT_LEFT_LINE_COLOR"),
    Text("DEFAULT_ICON"),
  ),
  Table("CALLOUTS")
    .Headers(["type", "icon", "background_color"])
    .NestedBoxes([
      Group(
        Text("type"),
        Text("icon"),
        Color("background_color"),
        Color("left_line_color"),
      ),
    ])
    .DefaultValues({ type: "", icon: "", background_color: "", left_line_color: "" }),
  FRAG.Template(),
  FRAG.SettingHandler(),
]

const schema_image_viewer = () => [
  FRAG.Base(true),
  Group("style",
    Range("MASK_BACKGROUND_OPACITY").Min(0).Max(1).Step(0.05),
    Range("IMAGE_MAX_WIDTH").Percent(),
    Range("IMAGE_MAX_HEIGHT").Percent(),
    Text("THUMBNAIL_HEIGHT"),
    Integer("BLUR_LEVEL").Unit(UNITS.pixel).Min(1),
    Integer("PRELOAD_THUMBNAIL_COUNT").Min(0),
    Integer("WATERFALL_COLUMNS").Min(1),
  ),
  Group("component",
    Switch("SHOW_THUMBNAIL_NAV"),
    Segment("TOOL_POSITION").Options(["bottom", "top"]),
  ),
  ToggleSort("SHOW_MESSAGE").Options(["index", "title", "size"]),
  Transfer("TOOL_FUNCTION").Options(OPTS.imageViewerTools).OptionScope("operations").MinItems(1),
  Group("behavior",
    Switch("SKIP_BROKEN_IMAGES"),
    Select("FIRST_IMAGE_STRATEGIES").Options(["inViewBoxImage", "closestViewBoxImage", "firstImage"]).MinItems(1),
    Select("THUMBNAIL_OBJECT_FIT").Options(["fill", "contain", "cover", "scale-down"]),
    Integer("AUTO_PLAY_INTERVAL").Unit(UNITS.second).Min(1),
  ),
  Group("adjustScale",
    Float("ZOOM_SCALE").Min(0.01).Max(1).Step(0.01),
    Integer("ROTATE_SCALE").Unit(UNITS.degree).Min(1),
    Integer("SKEW_SCALE").Unit(UNITS.degree).Min(1),
    Integer("TRANSLATE_SCALE").Unit(UNITS.pixel).Min(1),
  ),
  Group("mouseEvent",
    Switch("CLICK_MASK_TO_EXIT"),
    Select("MOUSEDOWN_FUNCTION.0").Options(OPTS.imageViewerTools).OptionScope("operations"),
    Select("MOUSEDOWN_FUNCTION.1").Options(OPTS.imageViewerTools).OptionScope("operations"),
    Select("MOUSEDOWN_FUNCTION.2").Options(OPTS.imageViewerTools).OptionScope("operations"),
    Select("CTRL_MOUSEDOWN_FUNCTION.0").Options(OPTS.imageViewerTools).OptionScope("operations"),
    Select("CTRL_MOUSEDOWN_FUNCTION.1").Options(OPTS.imageViewerTools).OptionScope("operations"),
    Select("CTRL_MOUSEDOWN_FUNCTION.2").Options(OPTS.imageViewerTools).OptionScope("operations"),
    Select("SHIFT_MOUSEDOWN_FUNCTION.0").Options(OPTS.imageViewerTools).OptionScope("operations"),
    Select("SHIFT_MOUSEDOWN_FUNCTION.1").Options(OPTS.imageViewerTools).OptionScope("operations"),
    Select("SHIFT_MOUSEDOWN_FUNCTION.2").Options(OPTS.imageViewerTools).OptionScope("operations"),
    Select("ALT_MOUSEDOWN_FUNCTION.0").Options(OPTS.imageViewerTools).OptionScope("operations"),
    Select("ALT_MOUSEDOWN_FUNCTION.1").Options(OPTS.imageViewerTools).OptionScope("operations"),
    Select("ALT_MOUSEDOWN_FUNCTION.2").Options(OPTS.imageViewerTools).OptionScope("operations"),
    Select("WHEEL_FUNCTION.0").Options(OPTS.imageViewerTools).OptionScope("operations"),
    Select("WHEEL_FUNCTION.1").Options(OPTS.imageViewerTools).OptionScope("operations"),
    Select("CTRL_WHEEL_FUNCTION.0").Options(OPTS.imageViewerTools).OptionScope("operations"),
    Select("CTRL_WHEEL_FUNCTION.1").Options(OPTS.imageViewerTools).OptionScope("operations"),
    Select("SHIFT_WHEEL_FUNCTION.0").Options(OPTS.imageViewerTools).OptionScope("operations"),
    Select("SHIFT_WHEEL_FUNCTION.1").Options(OPTS.imageViewerTools).OptionScope("operations"),
    Select("ALT_WHEEL_FUNCTION.0").Options(OPTS.imageViewerTools).OptionScope("operations"),
    Select("ALT_WHEEL_FUNCTION.1").Options(OPTS.imageViewerTools).OptionScope("operations"),
  ),
  Table("HOTKEY_FUNCTION")
    .Headers(["hotkey", "fn"])
    .NestedBoxes([
      Group(
        Select("fn").Options(OPTS.imageViewerTools).OptionScope("operations"),
        Hotkey("hotkey"),
      ),
    ])
    .DefaultValues({ hotkey: "", fn: "nextImage" }),
  FRAG.SettingHandler(),
]

const schema_markdownlint = () => [
  FRAG.Base(true),
  Group("style",
    Switch("TRANSLATE"),
    Select("TITLE_BAR_BUTTONS").Options(OPTS.markdownlintTools).OptionScope("actions"),
    Select("COLUMNS").Options(["idx", "line", "rule", "desc", "ops"]).MinItems(1),
    Select("TOOLS").Options(["info", "locate", "fix"]).MinItems(1).ShowIf(When.contains("COLUMNS", "ops")),
    Select("RESULT_ORDER_BY").Options(["index", "lineNumber", "ruleName", "ruleDesc"]),
  ),
  Group("indicator",
    Switch("USE_INDICATOR_BUTTON"),
    Text("BUTTON_WIDTH").ShowIf(When.true("USE_INDICATOR_BUTTON")),
    Text("BUTTON_HEIGHT").ShowIf(When.true("USE_INDICATOR_BUTTON")),
    Text("BUTTON_RIGHT").ShowIf(When.true("USE_INDICATOR_BUTTON")),
    Text("BUTTON_BORDER_RADIUS").ShowIf(When.true("USE_INDICATOR_BUTTON")),
    Range("BUTTON_OPACITY").Min(0).Max(1).Step(0.05).ShowIf(When.true("USE_INDICATOR_BUTTON")),
    Color("BUTTON_PASS_COLOR").ShowIf(When.true("USE_INDICATOR_BUTTON")),
    Color("BUTTON_ERROR_COLOR").ShowIf(When.true("USE_INDICATOR_BUTTON")),
  ),
  Group(
    "shortcuts",
    Select("RIGHT_CLICK_TABLE_ACTION").Options(OPTS.markdownlintTools).OptionScope("actions"),
    Select("RIGHT_CLICK_INDICATOR_ACTION").Options(OPTS.markdownlintTools).OptionScope("actions").ShowIf(When.true("USE_INDICATOR_BUTTON")),
    Hotkey("HOTKEY_FIX_LINT"),
  ),
  Array_("CUSTOM_RULE_FILES"),
  Dict("RULE_CONFIG").ActionTooltip("viewMarkdownlintRules"),
  FRAG.SettingHandler(),
]

const schema_action_buttons = () => [
  FRAG.Base(true),
  Group("buttonStyle",
    Text("BUTTON_SIZE"),
    Text("BUTTON_ICON_SIZE"),
    Text("BUTTON_BORDER_RADIUS"),
    Text("BUTTON_BOX_SHADOW"),
    Text("BUTTON_BOX_SHADOW_ON_HOVER"),
  ),
  Group("buttonLayout",
    Text("BUTTON_GAP"),
    Text("POSITION_RIGHT"),
    Text("POSITION_BOTTOM"),
  ),
  Table("BUTTONS")
    .Headers(["coordinate", "icon"])
    .NestedBoxes([
      Group(
        Switch("enable"),
        Integer("coordinate.0").Min(0).Tooltip("coord0"),
        Integer("coordinate.1").Min(0).Tooltip("coord1"),
        Icon("icon"),
        Text("size"),
        Text("color"),
        Text("bgColor"),
        Text("hint"),
      ),
      Code("callback").Tooltip("exclusive").ShowIf(When.bool("evil", false)),
      Code("evil").Placeholder("customCallback").ShowIf(When.bool("callback", false)),
    ])
    .DefaultValues({
      enable: true,
      coordinate: [0, 0],
      icon: "fa fa-bomb",
      size: "17px",
      color: "",
      bgColor: "",
      hint: "",
      callback: "",
      evil: "",
    }),
  Switch("SUPPORT_RIGHT_CLICK"),
  FRAG.SettingHandler(),
]

const RAW_SCHEMA_FNS = {
  global: schema_global,
  window_tab: schema_window_tab,
  search_multi: schema_search_multi,
  commander: schema_commander,
  md_padding: schema_md_padding,
  read_only: schema_read_only,
  blur: schema_blur,
  dark: schema_dark,
  no_image: schema_no_image,
  static_markers: schema_static_markers,
  myopic_defocus: schema_myopic_defocus,
  command_palette: schema_command_palette,
  resize_image: schema_resize_image,
  resize_table: schema_resize_table,
  datatables: schema_datatables,
  markmap: schema_markmap,
  auto_number: schema_auto_number,
  fence_enhance: schema_fence_enhance,
  collapse_paragraph: schema_collapse_paragraph,
  collapse_list: schema_collapse_list,
  collapse_table: schema_collapse_table,
  markdownlint: schema_markdownlint,
  image_viewer: schema_image_viewer,
  truncate_text: schema_truncate_text,
  export_enhance: schema_export_enhance,
  text_stylize: schema_text_stylize,
  cipher: schema_cipher,
  resource_manager: schema_resource_manager,
  easy_modify: schema_easy_modify,
  custom: schema_custom,
  action_buttons: schema_action_buttons,
  mouse_gestures: schema_mouse_gestures,
  slash_commands: schema_slash_commands,
  cjk_symbol_pairing: schema_cjk_symbol_pairing,
  right_outline: schema_right_outline,
  right_click_menu: schema_right_click_menu,
  pie_menu: schema_pie_menu,
  preferences: schema_preferences,
  hotkeys: schema_hotkeys,
  asset_root_redirect: schema_asset_root_redirect,
  bookmark: schema_bookmark,
  templater: schema_templater,
  editor_width_slider: schema_editor_width_slider,
  article_uploader: schema_article_uploader,
  ripgrep: schema_ripgrep,
  sidebar_enhance: schema_sidebar_enhance,
  cursor_history: schema_cursor_history,
  json_rpc: schema_json_rpc,
  updater: schema_updater,
  test: schema_test,
  kanban: schema_kanban,
  chat: schema_chat,
  timeline: schema_timeline,
  echarts: schema_echarts,
  chart: schema_chart,
  wavedrom: schema_wavedrom,
  calendar: schema_calendar,
  abc: schema_abc,
  drawIO: schema_drawIO,
  plantUML: schema_plantUML,
  marp: schema_marp,
  callouts: schema_callouts,
}

const mapTree = (schemas, visitBox = box => box, visitField = field => field, prefix = "") => schemas.map(box => {
  const newBox = visitBox(box, prefix)
  return (!Array.isArray(newBox.fields))
    ? newBox
    : {
      ...newBox,
      fields: newBox.fields.map(field => {
        const newField = visitField(field, prefix)
        const mapNested = (tree) => Array.isArray(tree) ? mapTree(tree, visitBox, visitField, prefix ? `${prefix}.${newField.key}` : newField.key) : tree
        return {
          ...newField,
          ...(newField.nestedBoxes && { nestedBoxes: mapNested(newField.nestedBoxes) }),
          ...(newField.subSchema && { subSchema: mapNested(newField.subSchema) }),
          ...(newField.tabs && { tabs: newField.tabs.map(tab => ({ ...tab, schema: mapNested(tab.schema || []) })) }),
        }
      }),
    }
})

const i18n = (boxes, t) => {
  const mapTooltip = (tooltip) =>
    (Array.isArray(tooltip) ? tooltip : [tooltip]).map(tip => {
      if (typeof tip === "string") return t(`$tooltip.${tip}`)
      const textKey = tip?.text ?? tip?.action
      return textKey ? { ...tip, text: t(`$tooltip.${textKey}`) } : tip
    })

  const mapValues = (data, prefix) => {
    if (!data || typeof data !== "object") return data
    const entries = Array.isArray(data) ? data.map(item => [item, item]) : Object.entries(data)
    return Object.fromEntries(entries.map(([k, v]) => [k, t(`${prefix}.${v}`)]))
  }

  return mapTree(
    boxes,
    ({ label, title, tooltip, [I18N_DICT]: dictType, ...box }, prefix) => {
      const titleKey = label || title
      return {
        ...box,
        ...(titleKey != null && { title: t(`$${dictType || "title"}.${prefix ? `${prefix}.${titleKey}` : titleKey}`) }),
        ...(tooltip != null && { tooltip: mapTooltip(tooltip) }),
      }
    },
    ({ label, tooltip, explain, placeholder, hintHeader, hintDetail, divider, unit, options, thMap, tabs, [OPTION_SCOPE]: optScope, ...field }, prefix) => ({
      ...field,
      ...(label != null && { label: t(`$label.${prefix ? `${prefix}.${label}` : label}`) }),
      ...(explain != null && { explain: t(`$explain.${explain}`) }),
      ...(placeholder != null && { placeholder: t(`$placeholder.${placeholder}`) }),
      ...(hintHeader != null && { hintHeader: t(`$hintHeader.${hintHeader}`) }),
      ...(hintDetail != null && { hintDetail: t(`$hintDetail.${hintDetail}`) }),
      ...(divider != null && { divider: t(`$divider.${divider}`) }),
      ...(unit != null && { unit: t(`$unit.${unit}`) }),
      ...(tooltip != null && { tooltip: mapTooltip(tooltip) }),
      ...(options != null && { options: mapValues(options, `$option.${optScope || field.key}`) }),
      ...(thMap != null && { thMap: mapValues(thMap, "$label") }),
      ...(tabs != null && { tabs: tabs.map(tab => ({ ...tab, label: t(`$tab.${tab.label}`) })) }),
    }),
  )
}

const compile = (dsl, i18nData = require("../global/locales/en.json")) => {
  initDSL(dsl)
  return Object.fromEntries(
    Object.entries(RAW_SCHEMA_FNS).map(([plugin, fn]) => {
      const raw = dsl.define(fn)
      const translated = i18n(raw, key => i18nData[plugin]?.[key] ?? i18nData.settings?.[key] ?? key)
      return [plugin, translated]
    }),
  )
}

module.exports = compile
