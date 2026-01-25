/**
 * @typedef {Object} TooltipConfig
 * @property {string} action
 * @property {string} [icon]
 * @property {string} [text]
 * @property {*} [data]
 */

/** @typedef {string | TooltipConfig | Array<string|TooltipConfig>} ITooltip */

/**
 * @typedef {Object} BaseProps
 * @property {string} [label]
 * @property {ITooltip} [tooltip]
 * @property {string} [explain]
 * @property {boolean} [hidden]
 * @property {boolean} [disabled]
 * @property {Object} [dependencies]
 * @property {"hide"|"readonly"} [dependencyUnmetAction="readonly"]
 * @property {string} [className]
 */

/** @typedef {BaseProps & { placeholder?: string, readonly?: boolean }} InputProps */
/** @typedef {InputProps & { min?: number, max?: number, step?: number, isInteger?: boolean }} NumberProps */
/** @typedef {BaseProps & { minItems?: number, maxItems?: number, disabledOptions?: string[] }} OptionsProps */

/** @typedef {{ key?: string } & BaseProps} IField */

/**
 * @param {string} key
 * @param {string} type
 * @param {IField} [props]
 */
const Field = (key, type, props = {}) => ({ type, key, label: key, ...props })

/**
 * @param {string} key
 * @param {BaseProps & { actionType?: "function"|"toggle"|"trigger", activeClass?: string }} [props]
 */
const Action = (key, props = {}) => Field(key, "action", props)

/**
 * @param {string} key
 * @param {BaseProps & { content?: string }} [props]
 */
const Static = (key, props = {}) => Field(key, "static", props)

/**
 * @param {string} key
 * @param {BaseProps & { readonly?: boolean }} [props]
 */
const Switch = (key, props = {}) => Field(key, "switch", props)

/**
 * @param {string} key
 * @param {InputProps} [props]
 */
const Text = (key, props = {}) => Field(key, "text", props)

/**
 * @param {string} key
 * @param {InputProps} [props]
 */
const Password = (key, props = {}) => Field(key, "password", props)

/**
 * @param {string} key
 * @param {InputProps} [props]
 */
const Color = (key, props = {}) => Field(key, "color", props)

/**
 * @param {string} key
 * @param {InputProps} [props]
 */
const Hotkey = (key, props = {}) => Field(key, "hotkey", props)

/**
 * @param {string} key
 * @param {NumberProps & { unit?: string }} [props]
 */
const Number_ = (key, props = {}) => Field(key, props.unit ? "unit" : "number", props)

/**
 * @param {string} key
 * @param {NumberProps} [props]
 */
const Integer = (key, props = {}) => Number_(key, { isInteger: true, ...props })

/**
 * @param {string} key
 * @param {NumberProps} [props]
 */
const Float = (key, props = {}) => Number_(key, { isInteger: false, ...props })

/**
 * @param {string} key
 * @param {InputProps} [props]
 */
const Icon = (key, props = {}) => Field(key, "icon", props)

/**
 * @param {string} key
 * @param {NumberProps} [props]
 */
const Range = (key, props = {}) => Field(key, "range", props)

/**
 * @param {string} key
 * @param {string[] | Record<string, string>} options
 * @param {OptionsProps & { labelJoiner?: string }} [props]
 */
const Select = (key, options, props = {}) => Field(key, "select", { options, ...props })

/**
 * @param {string} key
 * @param {Object[]} subSchema
 * @param {Object} defaultValues
 * @param {BaseProps & { readonly?: boolean }} [props]
 */
const Composite = (key, subSchema, defaultValues, props = {}) => Field(key, "composite", { subSchema, defaultValues, ...props })

/**
 * @param {Object[]} tabs
 * @param {string} tabs.label
 * @param {string} tabs.icon
 * @param {string} tabs.value
 * @param {Object[]} tabs.schema
 * @param {BaseProps & { tabStyle?: "line"|"card"|"segment", tabPosition?: "top"|"left", defaultSelectedTab?: string }} [props]
 */
const Tabs = (tabs, props = {}) => Field(String(Date.now()), "tabs", { tabs, ...props })

/**
 * @param {string} key
 * @param {BaseProps & { rows?: number, noResize?: boolean, format?: "JSON"|"TOML"|"YAML" }} [props]
 */
const Object_ = (key, props = {}) => Field(key, "object", { isBlockLayout: false, rows: 10, ...props })

/**
 * @param {string} key
 * @param {BaseProps & { rows?: number, cols?: number, noResize?: boolean, placeholder?: string }} [props]
 */
const Textarea = (key, props = {}) => Field(key, "textarea", { isBlockLayout: false, rows: 10, ...props })

/**
 * @param {string} key
 * @param {BaseProps & { tabSize?: number, lineNumbers?: boolean, placeholder?: string }} [props]
 */
const Code = (key, props = {}) => Field(key, "code", { isBlockLayout: false, ...props })

/**
 * @param {string} key
 * @param {string[] | Record<string, string>} options
 * @param {BaseProps & { columns?: number, disabledOptions?: string[] }} [props]
 */
const Radio = (key, options, props = {}) => Field(key, "radio", { isBlockLayout: false, options, columns: 1, ...props })

/**
 * @param {string} key
 * @param {string[] | Record<string, string>} options
 * @param {OptionsProps & { columns?: number }} [props]
 */
const Checkbox = (key, options, props = {}) => Field(key, "checkbox", { isBlockLayout: false, options, columns: 1, ...props })

/**
 * @param {string} key
 * @param {BaseProps & { allowDuplicates?: boolean, dataType?: "string"|"number" }} [props]
 */
const Array_ = (key, props = {}) => Field(key, "array", { isBlockLayout: false, allowDuplicates: false, ...props })

/**
 * @param {string} key
 * @param {string[] | Record<string, string>} options
 * @param {OptionsProps & { titles?: [string, string], defaultHeight?: string }} [props]
 */
const Transfer = (key, options, props = {}) => Field(key, "transfer", { isBlockLayout: false, options, ...props })

/**
 * @param {string} key
 * @param {BaseProps & { dimensions?: 1|2, allowJagged?: boolean, defaultColor?: string }} [props]
 */
const Palette = (key, props = {}) => Field(key, "palette", { isBlockLayout: false, dimensions: 1, allowJagged: true, defaultColor: "#FFFFFF", ...props })

/**
 * @param {string} key
 * @param {Object} options
 * @param {BaseProps & { keyPlaceholder?: string, valuePlaceholder?: string, allowAddItem?: boolean }} [props]
 */
const Dict = (key, options, props = {}) => Field(key, "dict", { isBlockLayout: false, options, ...props })

/**
 * @param {string} key
 * @param {string[]} headers
 * @param {Object[]} nestedBoxes
 * @param {Object} defaultValues
 * @param {BaseProps} [props]
 */
const Table = (key, headers, nestedBoxes, defaultValues, props = {}) => {
    const thMap = Object.fromEntries(headers.map(th => [th, `${key}.${th}`]))
    return Field(key, "table", { isBlockLayout: false, nestedBoxes, defaultValues, thMap, ...props })
}

/**
 * @param {string} hintHeader
 * @param {string} hintDetail
 * @param {BaseProps & { hintHeader?: string, hintDetail?: string, unsafe?: boolean }} [props]
 */
const Hint = (hintHeader, hintDetail, props = {}) => ({ type: "hint", hintHeader, hintDetail, unsafe: false, ...props })

/**
 * @param {string} divider
 * @param {BaseProps & { position?: "center"|"left"|"right", dashed?: boolean }} [props]
 */
const Divider = (divider, props = {}) => ({ type: "divider", divider, ...props })

/**
 * @param {string} content
 * @param {BaseProps & { content?: string, unsafe?: boolean }} [props]
 */
const Custom = (content, props = {}) => ({ type: "custom", content, unsafe: false, ...props })

/**
 * @typedef {Object} BoxProps
 * @property {string} [label]
 * @property {ITooltip} [tooltip]
 * @property {Object} [dependencies]
 * @property {"hide"|"readonly"} [dependencyUnmetAction="hide"]
 */

/**
 * @param {string} key
 * @param {string} type
 * @param {BoxProps} [props]
 * @returns {Object}
 */
const SingleFieldBox = (key, type, props = {}) => {
    const { tooltip, dependencies, ...fieldProps } = props
    const base = { label: key, fields: [{ type, key, ...fieldProps }] }
    return Object.assign(base, tooltip && { tooltip }, dependencies && { dependencies })
}

/**
 * @param {string} key
 * @param {BoxProps & { rows?: number, noResize?: boolean, format?: string }} [props]
 */
const ObjectBox = (key, props = {}) => SingleFieldBox(key, "object", { rows: 10, ...props })

/**
 * @param {string} key
 * @param {BoxProps & { rows?: number, cols?: number, placeholder?: string }} [props]
 */
const TextareaBox = (key, props = {}) => SingleFieldBox(key, "textarea", { rows: 10, ...props })

/**
 * @param {string} key
 * @param {BaseProps & { tabSize?: number, lineNumbers?: boolean, placeholder?: string }} [props]
 */
const CodeBox = (key, props = {}) => SingleFieldBox(key, "code", { ...props })

/**
 * @param {string} key
 * @param {Object} options
 * @param {BoxProps & { columns?: number, disabledOptions?: string[] }} [props]
 */
const RadioBox = (key, options, props = {}) => SingleFieldBox(key, "radio", { options, columns: 1, ...props })

/**
 * @param {string} key
 * @param {Object} options
 * @param {BoxProps & OptionsProps & { columns?: number }} [props]
 */
const CheckboxBox = (key, options, props = {}) => SingleFieldBox(key, "checkbox", { options, columns: 1, ...props })

/**
 * @param {string} key
 * @param {BoxProps & { allowDuplicates?: boolean, dataType?: "string"|"number" }} [props]
 */
const ArrayBox = (key, props = {}) => SingleFieldBox(key, "array", { allowDuplicates: false, ...props })

/**
 * @param {string} key
 * @param {Object} options
 * @param {BoxProps & OptionsProps} [props]
 */
const TransferBox = (key, options, props = {}) => SingleFieldBox(key, "transfer", { options, ...props })

/**
 * @param {string} key
 * @param {BoxProps & { dimensions?: 1|2, allowJagged?: boolean, defaultColor?: string }} [props]
 */
const PaletteBox = (key, props = {}) => SingleFieldBox(key, "palette", { dimensions: 1, allowJagged: true, defaultColor: "#FFFFFF", ...props })

/**
 * @param {string} key
 * @param {Object} options
 * @param {BoxProps & { keyPlaceholder?: string, valuePlaceholder?: string }} [props]
 */
const DictBox = (key, options, props = {}) => SingleFieldBox(key, "dict", { options, ...props })

/**
 * @param {string} key
 * @param {string[]} headers
 * @param {Object[]} nestedBoxes
 * @param {Object} defaultValues
 * @param {BoxProps} [props]
 */
const TableBox = (key, headers, nestedBoxes, defaultValues, props = {}) => {
    const thMap = Object.fromEntries(headers.map(th => [th, `${key}.${th}`]))
    return SingleFieldBox(key, "table", { nestedBoxes, defaultValues, thMap, boxDependencyUnmetAction: "readonly", ...props })
}

/**
 * @param {...IField} fields
 */
const UntitledBox = (...fields) => ({ fields })

/**
 * @param {string} title
 * @param {...IField} fields
 */
const TitledBox = (title, ...fields) => ({ title, fields })

/**
 * @param {string} title
 * @param {ITooltip} tooltip
 * @param {...IField} fields
 */
const TitledTipBox = (title, tooltip, ...fields) => ({ title, tooltip, fields })

/******** Dependency Helper ********/
// MORE: See `comparisonEvaluators` in `Feature_Watchers` in fast-form.js
const Dep = {
    true: (key) => ({ [key]: true }),
    false: (key) => ({ [key]: false }),
    follow: (key) => ({ $follow: key }),
    eq: (key, expected) => ({ [key]: expected }),
    ne: (key, expected) => ({ [key]: { $ne: expected } }),
    gt: (key, expected) => ({ [key]: { $gt: expected } }),
    lt: (key, expected) => ({ [key]: { $lt: expected } }),
    bool: (key, expected) => ({ [key]: { $bool: expected } }),
    contains: (key, expected) => ({ [key]: { $contains: expected } }),
    or: (...conditions) => ({ $or: conditions }),
    and: (...conditions) => ({ $and: conditions }),
}

/******** Tooltip Helper ********/
// MORE: See `Feature_InteractiveTooltip` in fast-form.js
const Tip = {
    info: (text) => text,
    action: (action, icon, text) => ({ action, icon, text })
}

/******** Common Props ********/
const prop_percent = { min: 0, max: 100, step: 1 }
const prop_protected = { tooltip: Tip.action("openSettingsFolder", "fa fa-gear", "protected"), disabled: true }
const prop_minusOne = { tooltip: "minusOneMeansUnlimited", min: -1 }

const dep_markmapToc = { dependencies: Dep.true("ENABLE_TOC_MARKMAP") }
const dep_markmapFence = { dependencies: Dep.true("ENABLE_FENCE_MARKMAP") }
const dep_fenceEnhanceButton = { dependencies: Dep.true("ENABLE_BUTTON") }
const dep_fenceEnhanceHotkey = { dependencies: Dep.true("ENABLE_HOTKEY") }
const dep_countFile = { dependencies: Dep.true("ENABLE_FILE_COUNT") }

/******** Common Fields ********/
const field_ENABLE = Switch("ENABLE")
const field_NAME = Text("NAME", { placeholder: "defaultIfEmpty" })
const field_HOTKEY = Hotkey("HOTKEY")
const field_enable = Switch("enable")
const field_hide = Switch("hide")
const field_name = Text("name", { placeholder: "defaultIfEmpty" })
const field_order = Integer("order")
const field_hotkey = Hotkey("hotkey")

/******** Common Boxes ********/
const box_basePluginLite = UntitledBox(field_ENABLE, field_NAME)
const box_basePluginFull = UntitledBox(field_ENABLE, field_NAME, field_HOTKEY)
const box_customPluginLite = UntitledBox(field_enable, field_hide, field_name, field_order)
const box_customPluginFull = UntitledBox(field_enable, field_hide, field_name, field_order, field_hotkey)
const box_settingHandler = UntitledBox(Action("runtimeSettings"), Action("restoreSettings"))
const box_langMode = TitledBox("fenceLanguageMode", Text("LANGUAGE", prop_protected), Switch("INTERACTIVE_MODE"))
const box_chartStyle = TitledBox("diagramStyle", Text("DEFAULT_FENCE_HEIGHT"), Text("DEFAULT_FENCE_BACKGROUND_COLOR"))

/******** Prop Unit (for Number_/Integer/Float only) ********/
const UNITS = {
    byte: "byte",
    pixel: "pixel",
    millisecond: "millisecond",
    second: "second",
    inch: "inch",
    centimeter: "centimeter",
    item: "item",
    line: "line",
    percent: "percent",
    degree: "degree",
    em: "em",
}

/******** Prop Options (for Select/Transfer/Checkbox only) ********/
const createOptions = (definitions) => {
    return Object.freeze(Object.fromEntries(
        Object.entries(definitions).map(([name, fields]) => {
            const ret = Object.freeze(Object.fromEntries(
                Object.entries(fields).map(([key, options]) => {
                    const opts = Object.freeze(Object.fromEntries(
                        options.map(opt => [opt, `${key}.${opt}`]))
                    )
                    return [key, opts]
                })
            ))
            return [name, ret]
        })
    ))
}

const OPTIONS = createOptions({
    global: {
        LOCALE: ["auto", "en", "zh-CN", "zh-TW"],
        EXIT_INTERACTIVE_MODE: ["click_exit_button", "ctrl_click_fence"],
    },
    window_tab: {
        CONTEXT_MENU: ["closeTab", "closeOtherTabs", "closeLeftTabs", "closeRightTabs", "copyPath", "showInFinder", "openInNewWindow", "sortTabs"],
        NEW_TAB_POSITION: ["start", "end", "left", "right"],
        TAB_SWITCH_ON_CLOSE: ["left", "right", "latest"],
        LAST_TAB_CLOSE_ACTION: ["blankPage", "reconfirm", "exit"],
        DRAG_STYLE: ["JetBrains", "VSCode"],
        TAB_DETACHMENT: ["free", "resistant", "lockVertical"],
    },
    search_multi: {
        TRAVERSE_STRATEGY: ["bfs", "dfs"],
    },
    commander: {
        QUICK_RUN_DISPLAY: ["echo", "always", "error", "silent"],
        COMMIT_RUN_DISPLAY: ["echo", "always"],
        "BUILTIN.shell": ["cmd/bash", "powershell", "gitbash", "wsl"],
    },
    blur: {
        BLUR_TYPE: ["blur", "hide"],
    },
    toolbar: {
        DEFAULT_TOOL: ["", "plu", "tab", "his", "ops", "mode", "theme", "out", "func", "all"],
    },
    resize_image: {
        IMAGE_ALIGN: ["center", "left", "right"],
    },
    markmap: {
        TITLE_BAR_BUTTONS: ["download", "settings", "fit", "pinRight", "pinTop", "unfold", "expand", "close"],
    },
    auto_number: {
        ALIGN: ["left", "right", "center"],
        POSITION_TABLE: ["before", "after"],
    },
    fence_enhance: {
        LINE_BREAKS_ON_COPY: ["lf", "crlf", "preserve"],
        FOLD_OVERFLOW: ["hidden", "scroll"],
        NUMBERING_BASE: ["0-based", "1-based"],
    },
    sidebar_enhance: {
        OUTLINE_FOLD_STATE: ["alwaysUnfold", "alwaysFold", "remember"],
    },
    text_stylize: {
        TOOLS: ["weight", "italic", "underline", "throughline", "overline", "superScript", "subScript", "emphasis", "blur", "title", "increaseSize", "decreaseSize", "increaseLetterSpacing", "decreaseLetterSpacing", "family", "foregroundColor", "backgroundColor", "borderColor", "erase", "blank", "setBrush", "useBrush"],
    },
    resource_manager: {
        RESOURCE_GRAMMARS: ["markdown", "html"],
        TRAVERSE_STRATEGY: ["bfs", "dfs"],
    },
    slash_commands: {
        SUGGESTION_TIMING: ["on_input", "debounce"],
        MATCH_STRATEGY: ["prefix", "substr", "abbr"],
        ORDER_STRATEGY: ["predefined", "lexicographic", "length_based", "earliest_hit"],
        "COMMANDS.type": ["snippet", "gen-snp", "command"],
        "COMMANDS.scope": ["plain", "inline_math"],
    },
    preferences: {
        OBJECT_SETTINGS_FORMAT: ["JSON", "TOML", "YAML"],
        DEPENDENCIES_FAILURE_BEHAVIOR: ["readonly", "hide"],
    },
    static_markers: {
        STATIC_MARKERS: ["strong", "em", "del", "underline", "superscript", "subscript", "code", "image", "link", "footnote", "highlight", "emoji", "inlineMath", "inlineHTML"],
    },
    echarts: {
        RENDERER: ["svg", "canvas"],
        EXPORT_TYPE: ["svg", "png", "jpg"],
    },
    plantUML: {
        OUTPUT_FORMAT: ["svg", "png", "txt"],
    },
    toc: {
        title_bar_buttons: ["header", "image", "table", "fence", "link", "math"],
    },
    imageReviewer: {
        operations: ["close", "download", "scroll", "play", "location", "nextImage", "previousImage", "firstImage", "lastImage", "thumbnailNav", "waterFall", "zoomIn", "zoomOut", "rotateLeft", "rotateRight", "hFlip", "vFlip", "translateLeft", "translateRight", "translateUp", "translateDown", "incHSkew", "decHSkew", "incVSkew", "decVSkew", "originSize", "fixScreen", "autoSize", "restore", "info", "dummy"],
        tool_position: ["bottom", "top"],
        show_message: ["index", "title", "size"],
        first_image_strategies: ["inViewBoxImage", "closestViewBoxImage", "firstImage"],
        thumbnail_object_fit: ["fill", "contain", "cover", "scale-down"],
    },
    markdownLint: {
        title_bar_buttons: ["settings", "detailAll", "fixAll", "toggleSourceMode", "refresh", "close"],
        columns: ["idx", "line", "rule", "desc", "ops"],
        tools: ["info", "locate", "fix"],
        result_order_by: ["index", "lineNumber", "ruleName", "ruleDesc"],
    },
})

/******** Schemas ********/
const schema_global = [
    UntitledBox(
        Switch("ENABLE", prop_protected),
        Select("LOCALE", OPTIONS.global.LOCALE),
        Select("EXIT_INTERACTIVE_MODE", OPTIONS.global.EXIT_INTERACTIVE_MODE, { minItems: 1 }),
    ),
    UntitledBox(
        Action("runtimeSettings"),
        Action("restoreSettings"),
        Action("restoreAllSettings"),
        Action("exportSettings"),
        Action("importSettings"),
    ),
    UntitledBox(
        Action("visitRepo"),
        Action("viewDeepWiki", { tooltip: Tip.action("neverGonnaTellALie", "fa fa-book") }),
        Action("openPluginFolder"),
        Action("editStyles"),
        Action("developPlugins"),
        Action("viewGithubImageBed"),
    ),
    UntitledBox(
        Action("updatePlugin"),
        Action("uninstallPlugin"),
        Action("sendEmail", { tooltip: Tip.action("toggleDevTools", "fa fa-wrench") }),
        Action("donate"),
        Static("pluginVersion"),
    ),
]

const schema_window_tab = [
    box_basePluginLite,
    TitledBox(
        "appearance",
        Switch("SHOW_TAB_CLOSE_BUTTON"),
        Switch("TRIM_FILE_EXT"),
        Switch("SHOW_DIR_ON_DUPLICATE"),
        Switch("HIDE_WINDOW_TITLE_BAR"),
        Text("TAB_MIN_WIDTH"),
        Text("TAB_MAX_WIDTH"),
        Integer("MAX_TAB_NUM", prop_minusOne),
    ),
    TitledBox(
        "behavior",
        Switch("REOPEN_CLOSED_TABS_WHEN_INIT"),
        Select("NEW_TAB_POSITION", OPTIONS.window_tab.NEW_TAB_POSITION),
        Select("TAB_SWITCH_ON_CLOSE", OPTIONS.window_tab.TAB_SWITCH_ON_CLOSE),
        Select("LAST_TAB_CLOSE_ACTION", OPTIONS.window_tab.LAST_TAB_CLOSE_ACTION),
    ),
    TitledBox(
        "mouseInteraction",
        Switch("CTRL_CLICK_TO_NEW_WINDOW"),
        Switch("MIDDLE_CLICK_TO_CLOSE"),
        Switch("CTRL_WHEEL_TO_SWITCH"),
        Switch("WHEEL_TO_SCROLL_TAB_BAR"),
        Switch("SHOW_FULL_PATH_WHEN_HOVER"),
    ),
    TitledBox(
        "drag",
        Select("DRAG_STYLE", OPTIONS.window_tab.DRAG_STYLE),
        Select("TAB_DETACHMENT", OPTIONS.window_tab.TAB_DETACHMENT, { dependencies: Dep.eq("DRAG_STYLE", "JetBrains") }),
        Float("DETACHMENT_THRESHOLD", {
            tooltip: "detachThreshold", min: 0.1, step: 0.1,
            dependencies: Dep.and(Dep.eq("DRAG_STYLE", "JetBrains"), Dep.eq("TAB_DETACHMENT", "resistant"))
        }),
        Float("DRAG_NEW_WINDOW_THRESHOLD", { tooltip: "newWindow", min: -1, step: 0.5, dependencies: Dep.ne("TAB_DETACHMENT", "lockVertical") }),
    ),
    TransferBox("CONTEXT_MENU", OPTIONS.window_tab.CONTEXT_MENU),
    TitledBox(
        "hotkey",
        Array_("CLOSE_HOTKEY"),
        Array_("SWITCH_PREVIOUS_TAB_HOTKEY"),
        Array_("SWITCH_NEXT_TAB_HOTKEY"),
        Array_("SWITCH_LAST_ACTIVE_TAB_HOTKEY"),
        Array_("SORT_TABS_HOTKEY"),
        Array_("COPY_PATH_HOTKEY"),
        Array_("TOGGLE_TAB_BAR_HOTKEY"),
    ),
    box_settingHandler,
]

const schema_search_multi = [
    box_basePluginFull,
    TitledBox(
        "search",
        Switch("CASE_SENSITIVE"),
        Switch("OPTIMIZE_SEARCH", { tooltip: "breakOrder" }),
        Switch("STOP_SEARCHING_ON_HIDING"),
    ),
    TitledBox(
        "searchResult",
        Switch("RELATIVE_PATH"),
        Switch("SHOW_EXT"),
        Switch("SHOW_MTIME"),
        Switch("REMOVE_BUTTON_HINT"),
        Integer("MAX_HITS", { min: 1, max: 5000 }),
        Palette("HIGHLIGHT_COLORS"),
    ),
    TitledBox(
        "windowInteraction",
        Switch("BACKSPACE_TO_HIDE"),
    ),
    ArrayBox("ALLOW_EXT"),
    ArrayBox("IGNORE_FOLDERS"),
    TitledBox(
        "advanced",
        Switch("FOLLOW_SYMBOLIC_LINKS"),
        Select("TRAVERSE_STRATEGY", OPTIONS.search_multi.TRAVERSE_STRATEGY),
        Integer("TIMEOUT", { ...prop_minusOne, unit: UNITS.millisecond }),
        Integer("MAX_SIZE", { tooltip: "maxBytes", unit: UNITS.byte, min: 1, max: 2000000 }),
        Integer("MAX_STATS", prop_minusOne),
        Integer("MAX_DEPTH", prop_minusOne),
        Integer("CONCURRENCY_LIMIT", { min: 1 }),
    ),
    box_settingHandler,
]

const schema_commander = [
    box_basePluginFull,
    TitledBox(
        "cmdDisplay",
        Select("QUICK_RUN_DISPLAY", OPTIONS.commander.QUICK_RUN_DISPLAY),
        Select("COMMIT_RUN_DISPLAY", OPTIONS.commander.COMMIT_RUN_DISPLAY),
    ),
    TitledBox(
        "windowInteraction",
        Switch("BACKSPACE_TO_HIDE"),
    ),
    TableBox(
        "BUILTIN",
        ["name", "shell", "cmd"],
        [
            UntitledBox(
                Switch("disable"),
                Select("shell", OPTIONS.commander["BUILTIN.shell"]),
                Text("name"),
            ),
            TextareaBox("cmd", { rows: 5, placeholder: "envInfo" }),
        ],
        {
            name: "",
            disable: false,
            shell: "cmd/bash",
            cmd: "",
        },
    ),
    box_settingHandler,
]

const schema_md_padding = [
    box_basePluginFull,
    ArrayBox("IGNORE_WORDS"),
    ArrayBox("IGNORE_PATTERNS"),
    box_settingHandler,
]

const schema_read_only = [
    box_basePluginFull,
    UntitledBox(
        Switch("READ_ONLY_DEFAULT"),
        Switch("CLICK_HYPERLINK_TO_OPEN_WHEN_READ_ONLY"),
        Switch("NO_EXPAND_WHEN_READ_ONLY"),
        Switch("REMOVE_EXPAND_WHEN_READ_ONLY", { dependencies: Dep.false("NO_EXPAND_WHEN_READ_ONLY") }),
        Text("SHOW_TEXT"),
    ),
    TitledBox(
        "advanced",
        Switch("DISABLE_CONTEXT_MENU_WHEN_READ_ONLY"),
        Select("REMAIN_AVAILABLE_MENU_KEY", null, { dependencies: Dep.true("DISABLE_CONTEXT_MENU_WHEN_READ_ONLY") }),
    ),
    box_settingHandler,
]

const schema_blur = [
    box_basePluginFull,
    UntitledBox(
        Switch("BLUR_DEFAULT"),
        Switch("RESTORE_WHEN_HOVER"),
        Select("BLUR_TYPE", OPTIONS.blur.BLUR_TYPE),
        Integer("BLUR_LEVEL", { unit: UNITS.pixel, min: 1, dependencies: Dep.eq("BLUR_TYPE", "blur") }),
    ),
    box_settingHandler,
]

const schema_dark = [
    box_basePluginFull,
    UntitledBox(
        Switch("DARK_DEFAULT"),
    ),
    box_settingHandler,
]

const schema_no_image = [
    box_basePluginFull,
    UntitledBox(
        Switch("DEFAULT_NO_IMAGE_MODE"),
        Switch("RESHOW_WHEN_HOVER"),
        Integer("TRANSITION_DURATION", { unit: UNITS.millisecond, min: 0 }),
        Integer("TRANSITION_DELAY", { unit: UNITS.millisecond, min: 0 }),
    ),
    box_settingHandler,
]

const schema_myopic_defocus = [
    box_basePluginFull,
    UntitledBox(
        Action("myopicDefocusEffectDemo", { explain: "enableMyopicDefocus" }),
    ),
    UntitledBox(
        Switch("DEFAULT_DEFOCUS_MODE"),
        Range("EFFECT_STRENGTH", { unit: UNITS.percent, min: 1, max: 35 }),
        Float("SCREEN_SIZE", { unit: UNITS.inch, min: 1 }),
        Integer("SCREEN_RESOLUTION_X", { unit: UNITS.pixel, min: 1 }),
        Integer("SCREEN_RESOLUTION_Y", { unit: UNITS.pixel, min: 1 }),
        Float("SCREEN_DISTANCE", { unit: UNITS.centimeter, min: 1 }),
    ),
    box_settingHandler,
]

const schema_toolbar = [
    box_basePluginFull,
    TitledBox(
        "searchBarPosition",
        Range("TOOLBAR_TOP_PERCENT", prop_percent),
        Range("TOOLBAR_WIDTH_PERCENT", prop_percent),
    ),
    TitledBox(
        "input",
        Select("DEFAULT_TOOL", OPTIONS.toolbar.DEFAULT_TOOL),
        Switch("USE_NEGATIVE_SEARCH"),
        Switch("BACKSPACE_TO_HIDE"),
        Integer("DEBOUNCE_INTERVAL", { unit: UNITS.millisecond, min: 10 }),
    ),
    box_settingHandler,
]

const schema_resize_image = [
    box_basePluginLite,
    TitledBox(
        "image",
        Switch("RECORD_RESIZE"),
        Switch("ALLOW_EXCEED_LIMIT"),
        Select("IMAGE_ALIGN", OPTIONS.resize_image.IMAGE_ALIGN),
    ),
    TitledBox(
        "modifierKeys",
        Hotkey("MODIFIER_KEY.TEMPORARY", { tooltip: "modifyKeyExample" }),
        Hotkey("MODIFIER_KEY.PERSISTENT"),
    ),
    box_settingHandler,
]

const schema_resize_table = [
    box_basePluginLite,
    UntitledBox(
        Switch("RECORD_RESIZE"),
        Switch("REMOVE_MIN_CELL_WIDTH"),
        Integer("DRAG_THRESHOLD", { unit: UNITS.pixel, min: 1 }),
    ),
    box_settingHandler,
]

const schema_datatables = [
    box_basePluginLite,
    UntitledBox(
        Switch("ORDERING"),
        Switch("DEFAULT_ORDER"),
        Switch("SEARCHING"),
        Switch("REGEX"),
        Switch("CASE_INSENSITIVE"),
        Switch("SCROLL_COLLAPSE"),
        Switch("PAGING"),
        Integer("PAGE_LENGTH", { unit: UNITS.item, min: 1 }),
    ),
    box_settingHandler,
]

const schema_go_top = [
    box_basePluginLite,
    TitledBox(
        "hotkey",
        Hotkey("HOTKEY_GO_TOP"),
        Hotkey("HOTKEY_GO_BOTTOM"),
    ),
    box_settingHandler,
]

const schema_markmap = [
    box_basePluginLite,
    TitledBox(
        "mindmapDiagram",
        Switch("ENABLE_TOC_MARKMAP"),
        Hotkey("TOC_HOTKEY", dep_markmapToc),
        Switch("FIX_SKIPPED_LEVEL_HEADERS", dep_markmapToc),
        Switch("REMOVE_HEADER_STYLES", dep_markmapToc),
        Switch("AUTO_FIT_WHEN_UPDATE", dep_markmapToc),
        Switch("AUTO_FIT_WHEN_FOLD", dep_markmapToc),
        Switch("KEEP_FOLD_STATE_WHEN_UPDATE", dep_markmapToc),
        Switch("USE_CONTEXT_MENU", dep_markmapToc),
        Switch("CLICK_TO_POSITIONING", dep_markmapToc),
        Switch("AUTO_COLLAPSE_PARAGRAPH_WHEN_FOLD", { tooltip: "experimental", ...dep_markmapToc }),
        Range("POSITIONING_VIEWPORT_HEIGHT", { tooltip: "positioningViewPort", min: 0.1, max: 0.95, step: 0.01, ...dep_markmapToc }),
        Range("WIDTH_PERCENT_WHEN_INIT", { min: 20, max: 95, step: 1, ...dep_markmapToc }),
        Range("HEIGHT_PERCENT_WHEN_INIT", { min: 20, max: 95, step: 1, ...dep_markmapToc }),
        Range("HEIGHT_PERCENT_WHEN_PIN_TOP", { min: 20, max: 95, step: 1, ...dep_markmapToc }),
        Range("WIDTH_PERCENT_WHEN_PIN_RIGHT", { min: 20, max: 95, step: 1, ...dep_markmapToc }),
    ),
    TransferBox("TITLE_BAR_BUTTONS", OPTIONS.markmap.TITLE_BAR_BUTTONS, { minItems: 1, ...dep_markmapToc }),
    TitledBox(
        "mindmapDiagramDefaultOptions",
        Switch("DEFAULT_TOC_OPTIONS.zoom", dep_markmapToc),
        Switch("DEFAULT_TOC_OPTIONS.pan", dep_markmapToc),
        Switch("DEFAULT_TOC_OPTIONS.toggleRecursively", dep_markmapToc),
        Range("DEFAULT_TOC_OPTIONS.initialExpandLevel", { min: 1, max: 7, step: 1, ...dep_markmapToc }),
        Range("DEFAULT_TOC_OPTIONS.colorFreezeLevel", { min: 1, max: 7, step: 1, ...dep_markmapToc }),
        Range("DEFAULT_TOC_OPTIONS.fitRatio", { min: 0.5, max: 1, step: 0.01, ...dep_markmapToc }),
        Range("DEFAULT_TOC_OPTIONS.maxInitialScale", { min: 0.5, max: 5, step: 0.25, ...dep_markmapToc }),
        Integer("DEFAULT_TOC_OPTIONS.maxWidth", { tooltip: "zero", unit: UNITS.pixel, min: 0, max: 100, step: 5, ...dep_markmapToc }),
        Integer("DEFAULT_TOC_OPTIONS.nodeMinHeight", { unit: UNITS.pixel, min: 5, max: 50, step: 1, ...dep_markmapToc }),
        Integer("DEFAULT_TOC_OPTIONS.spacingHorizontal", { unit: UNITS.pixel, min: 0, max: 100, step: 5, ...dep_markmapToc }),
        Integer("DEFAULT_TOC_OPTIONS.spacingVertical", { unit: UNITS.pixel, min: 0, max: 100, step: 5, ...dep_markmapToc }),
        Integer("DEFAULT_TOC_OPTIONS.paddingX", { unit: UNITS.pixel, min: 0, max: 100, step: 5, ...dep_markmapToc }),
        Integer("DEFAULT_TOC_OPTIONS.duration", { unit: UNITS.millisecond, min: 0, max: 1000, step: 10, ...dep_markmapToc }),
        Palette("DEFAULT_TOC_OPTIONS.color", dep_markmapToc),
    ),
    PaletteBox("CANDIDATE_COLOR_SCHEMES", { dimensions: 2, ...dep_markmapToc }),
    TitledBox(
        "mindmapDiagramExport",
        Switch("DOWNLOAD_OPTIONS.KEEP_ALPHA_CHANNEL", dep_markmapToc),
        Switch("DOWNLOAD_OPTIONS.REMOVE_USELESS_CLASSES", dep_markmapToc),
        Switch("DOWNLOAD_OPTIONS.REMOVE_FOREIGN_OBJECT", { tooltip: "removeForeignObj", ...dep_markmapToc }),
        Switch("DOWNLOAD_OPTIONS.SHOW_PATH_INQUIRY_DIALOG", dep_markmapToc),
        Switch("DOWNLOAD_OPTIONS.SHOW_IN_FINDER", dep_markmapToc),
        Range("DOWNLOAD_OPTIONS.IMAGE_QUALITY", { tooltip: "pixelImagesOnly", min: 0.01, max: 1, step: 0.01, ...dep_markmapToc }),
        Integer("DOWNLOAD_OPTIONS.PADDING_HORIZONTAL", { unit: UNITS.pixel, min: 1, step: 1, ...dep_markmapToc }),
        Integer("DOWNLOAD_OPTIONS.PADDING_VERTICAL", { unit: UNITS.pixel, min: 1, step: 1, ...dep_markmapToc }),
        Float("DOWNLOAD_OPTIONS.IMAGE_SCALE", { min: 0.1, step: 0.1, ...dep_markmapToc }),
        Text("DOWNLOAD_OPTIONS.FILENAME", dep_markmapToc),
        Text("DOWNLOAD_OPTIONS.FOLDER", { tooltip: "tempDir", ...dep_markmapToc }),
        Text("DOWNLOAD_OPTIONS.BACKGROUND_COLOR", { tooltip: "jpgFormatOnly", ...dep_markmapToc }),
        Text("DOWNLOAD_OPTIONS.TEXT_COLOR", dep_markmapToc),
        Text("DOWNLOAD_OPTIONS.OPEN_CIRCLE_COLOR", dep_markmapToc),
    ),
    TitledBox(
        "fence",
        Switch("ENABLE_FENCE_MARKMAP"),
        Switch("INTERACTIVE_MODE", dep_markmapFence),
        Hotkey("FENCE_HOTKEY", dep_markmapFence),
        Text("FENCE_LANGUAGE", { ...prop_protected, ...dep_markmapFence }),
        Text("DEFAULT_FENCE_HEIGHT", dep_markmapFence),
        Text("DEFAULT_FENCE_BACKGROUND_COLOR", dep_markmapFence),
    ),
    TitledBox(
        "fenceDiagramDefaultOptions",
        Switch("DEFAULT_FENCE_OPTIONS.zoom", dep_markmapFence),
        Switch("DEFAULT_FENCE_OPTIONS.pan", dep_markmapFence),
        Switch("DEFAULT_FENCE_OPTIONS.toggleRecursively", dep_markmapFence),
        Range("DEFAULT_FENCE_OPTIONS.initialExpandLevel", { min: 1, max: 7, step: 1, ...dep_markmapFence }),
        Range("DEFAULT_FENCE_OPTIONS.colorFreezeLevel", { min: 1, max: 7, step: 1, ...dep_markmapFence }),
        Range("DEFAULT_FENCE_OPTIONS.fitRatio", { min: 0.5, max: 1, step: 0.01, ...dep_markmapFence }),
        Range("DEFAULT_FENCE_OPTIONS.maxInitialScale", { min: 0.5, max: 5, step: 0.25, ...dep_markmapFence }),
        Integer("DEFAULT_FENCE_OPTIONS.maxWidth", { tooltip: "zero", unit: UNITS.pixel, min: 0, max: 1000, step: 10, ...dep_markmapFence }),
        Integer("DEFAULT_FENCE_OPTIONS.nodeMinHeight", { unit: UNITS.pixel, min: 5, max: 50, step: 1, ...dep_markmapFence }),
        Integer("DEFAULT_FENCE_OPTIONS.spacingHorizontal", { unit: UNITS.pixel, min: 0, max: 200, step: 1, ...dep_markmapFence }),
        Integer("DEFAULT_FENCE_OPTIONS.spacingVertical", { unit: UNITS.pixel, min: 0, max: 200, step: 1, ...dep_markmapFence }),
        Integer("DEFAULT_FENCE_OPTIONS.paddingX", { unit: UNITS.pixel, min: 0, max: 100, step: 1, ...dep_markmapFence }),
        Integer("DEFAULT_FENCE_OPTIONS.duration", { unit: UNITS.millisecond, min: 0, max: 1000, step: 10, ...dep_markmapFence }),
        Text("DEFAULT_FENCE_OPTIONS.height", dep_markmapFence),
        Text("DEFAULT_FENCE_OPTIONS.backgroundColor", dep_markmapFence),
        Palette("DEFAULT_FENCE_OPTIONS.color", dep_markmapFence),
    ),
    CodeBox("FENCE_TEMPLATE", dep_markmapFence),
    box_settingHandler,
]

const schema_auto_number = [
    box_basePluginLite,
    TitledBox(
        "autoNumbering",
        Switch("ENABLE_OUTLINE"),
        Switch("ENABLE_CONTENT"),
        Switch("ENABLE_TOC"),
        Switch("ENABLE_IMAGE"),
        Switch("ENABLE_TABLE"),
        Switch("ENABLE_FENCE"),
    ),
    TitledBox(
        "style",
        Text("FONT_FAMILY"),
        Switch("SHOW_IMAGE_NAME", { dependencies: Dep.true("ENABLE_IMAGE") }),
        Select("POSITION_TABLE", OPTIONS.auto_number.POSITION_TABLE, { dependencies: Dep.true("ENABLE_TABLE") }),
        Select("ALIGN", OPTIONS.auto_number.ALIGN, { dependencies: Dep.or(Dep.true("ENABLE_IMAGE"), Dep.true("ENABLE_TABLE"), Dep.true("ENABLE_FENCE")) }),
    ),
    TableBox(
        "LAYOUTS",
        ["name"],
        [
            UntitledBox(
                Hint("layoutSyntax", "layoutSyntax"),
                Hint("counterNames", "counterNames"),
                Hint("counterStyles", "counterStyles"),
            ),
            UntitledBox(
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
        ],
        {
            name: "",
            selected: true,
            layout: {
                "content-h1": "",
                "content-h2": "",
                "content-h3": "",
                "content-h4": "",
                "content-h5": "",
                "content-h6": "",
                "outline-h1": "",
                "outline-h2": "",
                "outline-h3": "",
                "outline-h4": "",
                "outline-h5": "",
                "outline-h6": "",
                "toc-h1": "",
                "toc-h2": "",
                "toc-h3": "",
                "toc-h4": "",
                "toc-h5": "",
                "toc-h6": "",
                "table": "",
                "image": "",
                "fence": "",
            },
        },
    ),
    UntitledBox(
        Switch("ENABLE_WHEN_EXPORT"),
    ),
    CodeBox("APPLY_EXPORT_HEADER_NUMBERING", { tooltip: "expertsOnly", dependencies: Dep.true("ENABLE_WHEN_EXPORT") }),
    box_settingHandler,
]

const schema_fence_enhance = [
    box_basePluginLite,
    TitledBox(
        "buttonGeneral",
        Switch("ENABLE_BUTTON"),
        Switch("AUTO_HIDE", dep_fenceEnhanceButton),
        Switch("REMOVE_BUTTON_HINT", dep_fenceEnhanceButton),
        Range("BUTTON_OPACITY", { min: 0, max: 1, step: 0.05, ...dep_fenceEnhanceButton }),
        Range("BUTTON_OPACITY_HOVER", { min: 0, max: 1, step: 0.05, ...dep_fenceEnhanceButton }),
        Text("BUTTON_SIZE", dep_fenceEnhanceButton),
        Text("BUTTON_COLOR", dep_fenceEnhanceButton),
        Text("BUTTON_PADDING", dep_fenceEnhanceButton),
        Text("BUTTON_TOP", dep_fenceEnhanceButton),
        Text("BUTTON_RIGHT", dep_fenceEnhanceButton),
        Integer("WAIT_RECOVER_INTERVAL", { unit: UNITS.millisecond, min: 500, step: 100, ...dep_fenceEnhanceButton }),
    ),
    TitledBox(
        "functionButtons",
        Switch("ENABLE_COPY", dep_fenceEnhanceButton),
        Switch("TRIM_WHITESPACE_ON_COPY", { dependencies: Dep.and(Dep.true("ENABLE_BUTTON"), Dep.true("ENABLE_COPY")) }),
        Switch("COPY_AS_MARKDOWN", { dependencies: Dep.follow("TRIM_WHITESPACE_ON_COPY") }),
        Select("LINE_BREAKS_ON_COPY", OPTIONS.fence_enhance.LINE_BREAKS_ON_COPY, { dependencies: Dep.follow("TRIM_WHITESPACE_ON_COPY") }),
        Divider(),
        Switch("ENABLE_INDENT", dep_fenceEnhanceButton),
        Array_("EXCLUDE_LANGUAGE_ON_INDENT", { dependencies: Dep.and(Dep.true("ENABLE_BUTTON"), Dep.true("ENABLE_INDENT")) }),
        Divider(),
        Switch("ENABLE_FOLD", dep_fenceEnhanceButton),
        Select("FOLD_OVERFLOW", OPTIONS.fence_enhance.FOLD_OVERFLOW, { dependencies: Dep.and(Dep.true("ENABLE_BUTTON"), Dep.true("ENABLE_FOLD")) }),
        Integer("MANUAL_FOLD_LINES", { unit: UNITS.line, min: 1, step: 1, dependencies: Dep.follow("FOLD_OVERFLOW") }),
        Switch("DEFAULT_FOLD", { dependencies: Dep.follow("FOLD_OVERFLOW") }),
        Switch("EXPAND_ON_FOCUS", { dependencies: Dep.follow("DEFAULT_FOLD_THRESHOLD") }),
        Switch("FOLD_ON_BLUR", { dependencies: Dep.follow("DEFAULT_FOLD_THRESHOLD") }),
        Integer("DEFAULT_FOLD_THRESHOLD", { unit: UNITS.line, min: 0, step: 1, dependencies: Dep.and(Dep.follow("FOLD_OVERFLOW"), Dep.true("DEFAULT_FOLD")) }),
        Integer("AUTO_FOLD_LINES", { unit: UNITS.line, min: 1, step: 1, dependencies: Dep.follow("DEFAULT_FOLD_THRESHOLD") }),
    ),
    TableBox(
        "CUSTOM_BUTTONS",
        ["HINT", "ICON"],
        [
            UntitledBox(
                Switch("DISABLE"),
                Icon("ICON"),
                Text("HINT"),
            ),
            CodeBox("ON_INIT"),
            CodeBox("ON_RENDER"),
            CodeBox("ON_CLICK"),
        ],
        {
            DISABLE: false,
            ICON: "fa fa-bomb",
            HINT: "",
            ON_INIT: "plu => console.log('Button initialized')",
            ON_RENDER: "({ btn, fence, cid, enhance }) => console.log('Button rendered')",
            ON_CLICK: "({ ev, btn, cont, fence, cm, cid, plu }) => console.log('Button has been clicked')",
        },
        dep_fenceEnhanceButton,
    ),
    TitledBox(
        "buttonHotkeys",
        Switch("ENABLE_HOTKEY", { tooltip: Tip.action("viewCodeMirrorKeymapsManual", "fa fa-chain") }),
        Text("SWAP_PREVIOUS_LINE", dep_fenceEnhanceHotkey),
        Text("SWAP_NEXT_LINE", dep_fenceEnhanceHotkey),
        Text("COPY_PREVIOUS_LINE", dep_fenceEnhanceHotkey),
        Text("COPY_NEXT_LINE", dep_fenceEnhanceHotkey),
        Text("INSERT_LINE_PREVIOUS", dep_fenceEnhanceHotkey),
        Text("INSERT_LINE_NEXT", dep_fenceEnhanceHotkey),
    ),
    TableBox(
        "CUSTOM_HOTKEYS",
        ["HOTKEY", "CALLBACK"],
        [
            UntitledBox(
                Switch("DISABLE"),
                Text("HOTKEY"),
            ),
            CodeBox("CALLBACK"),
        ],
        {
            DISABLE: false,
            HOTKEY: "",
            CALLBACK: "({ pre, cid, cm, cursor, lineNum, lastNum, separator }) => console.log('callback')",
        },
        dep_fenceEnhanceHotkey,
    ),
    TitledBox(
        "lineHighlighting",
        Switch("HIGHLIGHT_BY_LANGUAGE", { tooltip: Tip.action("viewVitePressLineHighlighting", "fa fa-chain") }),
        Switch("HIGHLIGHT_WHEN_HOVER"),
        Select("NUMBERING_BASE", OPTIONS.fence_enhance.NUMBERING_BASE, { dependencies: Dep.true("HIGHLIGHT_BY_LANGUAGE") }),
        Text("HIGHLIGHT_PATTERN", { dependencies: Dep.follow("NUMBERING_BASE") }),
        Text("HIGHLIGHT_LINE_COLOR", { dependencies: Dep.or(Dep.follow("NUMBERING_BASE"), Dep.true("HIGHLIGHT_WHEN_HOVER")) }),
    ),
    TitledBox(
        "advanced",
        Switch("ENABLE_LANGUAGE_FOLD", { tooltip: Tip.action("viewCodeFoldingDemo", "fa fa-chain") }),
        Switch("INDENTED_WRAPPED_LINE", { tooltip: Tip.action("viewIndentedWrappedLineDemo", "fa fa-chain") }),
        Switch("PRELOAD_ALL_FENCES", { tooltip: "dangerous" }),
    ),
    box_settingHandler,
]

const schema_collapse_paragraph = [
    UntitledBox(
        Switch("ENABLE", { tooltip: "ConflictWithOptionExpandSimpleBlock" }),
        field_NAME,
    ),
    TitledBox(
        "mode",
        Switch("RECORD_COLLAPSE"),
        Switch("STRICT_MODE"),
        Switch("STRICT_MODE_IN_CONTEXT_MENU"),
    ),
    TitledBox(
        "modifierKey",
        Hotkey("MODIFIER_KEY.COLLAPSE_SINGLE", { tooltip: "modifierKeyExample" }),
        Hotkey("MODIFIER_KEY.COLLAPSE_SIBLINGS"),
        Hotkey("MODIFIER_KEY.COLLAPSE_ALL_SIBLINGS"),
        Hotkey("MODIFIER_KEY.COLLAPSE_RECURSIVE"),
    ),
    box_settingHandler,
]

const schema_collapse_list = [
    box_basePluginLite,
    UntitledBox(
        Switch("RECORD_COLLAPSE"),
        Text("TRIANGLE_COLOR"),
    ),
    box_settingHandler,
]

const schema_collapse_table = [
    box_basePluginLite,
    UntitledBox(
        Switch("RECORD_COLLAPSE"),
    ),
    box_settingHandler,
]

const schema_truncate_text = [
    box_basePluginLite,
    TitledBox(
        "hotkey",
        Hotkey("HIDE_FRONT_HOTKEY"),
        Hotkey("HIDE_BASE_VIEW_HOTKEY"),
        Hotkey("SHOW_ALL_HOTKEY"),
        Integer("REMAIN_LENGTH", { min: 1, dependencies: Dep.or(Dep.bool("HIDE_FRONT_HOTKEY", true), Dep.bool("HIDE_BASE_VIEW_HOTKEY", true)) }),
    ),
    box_settingHandler,
]

const schema_export_enhance = [
    box_basePluginLite,
    UntitledBox(
        Switch("DOWNLOAD_NETWORK_IMAGE"),
        Integer("DOWNLOAD_THREADS", { min: 1, dependencies: Dep.true("DOWNLOAD_NETWORK_IMAGE") }),
    ),
    box_settingHandler,
]

const schema_text_stylize = [
    UntitledBox(
        field_ENABLE,
        field_NAME,
        Hotkey("SHOW_MODAL_HOTKEY"),
    ),
    TransferBox("TOOLS", OPTIONS.text_stylize.TOOLS, { minItems: 1 }),
    TableBox(
        "ACTION_HOTKEYS",
        ["hotkey", "action"],
        [
            UntitledBox(
                Select("action", OPTIONS.text_stylize.TOOLS),
                Hotkey("hotkey"),
            ),
        ],
        {
            hotkey: "",
            action: "weight",
        },
    ),
    TitledBox(
        "buttonDefaultOptions",
        Color("DEFAULT_COLORS.FOREGROUND"),
        Color("DEFAULT_COLORS.BACKGROUND"),
        Color("DEFAULT_COLORS.BORDER"),
        Text("DEFAULT_FORMAT_BRUSH", { tooltip: "brushExample" }),
    ),
    PaletteBox("COLOR_TABLE", { dimensions: 2, allowJagged: false }),
    box_settingHandler,
]

const schema_cipher = [
    box_basePluginLite,
    UntitledBox(
        Switch("SHOW_HINT_MODAL"),
        Password("SECRET_KEY", prop_protected),
    ),
    TitledBox(
        "hotkey",
        Hotkey("ENCRYPT_HOTKEY"),
        Hotkey("DECRYPT_HOTKEY"),
    ),
    box_settingHandler,
]

const schema_resource_manager = [
    box_basePluginFull,
    TitledBox(
        "windowPosition",
        Range("MODAL_LEFT_PERCENT", prop_percent),
        Range("MODAL_WIDTH_PERCENT", prop_percent),
        Range("MODAL_HEIGHT_PERCENT", prop_percent),
    ),
    ArrayBox("RESOURCE_EXT"),
    ArrayBox("MARKDOWN_EXT"),
    ArrayBox("IGNORE_FOLDERS"),
    TitledBox(
        "advanced",
        Select("RESOURCE_GRAMMARS", OPTIONS.resource_manager.RESOURCE_GRAMMARS, { minItems: 1 }),
        Select("TRAVERSE_STRATEGY", OPTIONS.resource_manager.TRAVERSE_STRATEGY),
        Switch("FOLLOW_SYMBOLIC_LINKS"),
        Integer("TIMEOUT", { unit: UNITS.millisecond, min: 1 }),
        Integer("MAX_STATS", prop_minusOne),
        Integer("MAX_DEPTH", prop_minusOne),
        Integer("CONCURRENCY_LIMIT", { min: 1 }),
    ),
    box_settingHandler,
]

const schema_easy_modify = [
    box_basePluginLite,
    TitledBox(
        "hotkey",
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
    box_settingHandler,
]

const schema_custom = [
    UntitledBox(
        Switch("ENABLE", prop_protected),
        field_NAME,
    ),
    UntitledBox(
        Switch("HIDE_DISABLE_PLUGINS"),
    ),
    box_settingHandler,
]

const schema_slash_commands = [
    box_basePluginLite,
    TitledBox(
        "trigger",
        Text("TRIGGER_REGEXP"),
        Text("FUNC_PARAM_SEPARATOR", prop_protected),
        Select("SUGGESTION_TIMING", OPTIONS.slash_commands.SUGGESTION_TIMING),
        Select("MATCH_STRATEGY", OPTIONS.slash_commands.MATCH_STRATEGY),
        Select("ORDER_STRATEGY", OPTIONS.slash_commands.ORDER_STRATEGY),
    ),
    TableBox(
        "COMMANDS",
        ["keyword", "type"],
        [
            UntitledBox(
                Switch("enable"),
                Select("type", OPTIONS.slash_commands["COMMANDS.type"]),
                Select("scope", OPTIONS.slash_commands["COMMANDS.scope"]),
                Text("keyword", { placeholder: "LettersAndNumbersOnly" }),
                Text("icon", { placeholder: "emojiOnly" }),
                Text("hint"),
                Integer("cursorOffset.0"),
                Integer("cursorOffset.1"),
            ),
            CodeBox("callback", { placeholder: "callbackType" }),
        ],
        {
            enable: true,
            type: "snippet",
            scope: "plain",
            keyword: "",
            icon: "🧰",
            hint: "",
            cursorOffset: [0, 0],
            callback: "",
        },
    ),
    box_settingHandler,
]

const schema_right_click_menu = [
    UntitledBox(
        Switch("ENABLE", prop_protected),
        field_NAME,
    ),
    TitledBox(
        "style",
        Switch("SHOW_PLUGIN_HOTKEY"),
        Switch("SHOW_ACTION_OPTIONS_ICON"),
        Switch("DO_NOT_HIDE"),
        Switch("HIDE_OTHER_OPTIONS"),
        Text("MENU_MIN_WIDTH"),
    ),
    TableBox(
        "MENUS",
        ["NAME", "LIST"],
        [
            UntitledBox(
                Text("NAME"),
            ),
            TransferBox("LIST"),
        ],
        {
            NAME: "",
            LIST: [],
        },
    ),
    TitledBox(
        "advanced",
        Switch("FIND_LOST_PLUGINS"),
    ),
    box_settingHandler,
]

const schema_pie_menu = [
    box_basePluginFull,
    UntitledBox(
        Hotkey("MODIFIER_KEY", { tooltip: "example" }),
    ),
    TableBox(
        "BUTTONS",
        ["CALLBACK", "ICON"],
        [
            UntitledBox(
                Icon("ICON"),
                Text("CALLBACK"),
            ),
        ],
        {
            ICON: "fa fa-bomb",
            CALLBACK: "",
        },
    ),
    box_settingHandler,
]

const schema_preferences = [
    UntitledBox(
        Switch("ENABLE", prop_protected),
        field_NAME,
        field_HOTKEY,
    ),
    UntitledBox(
        Switch("SEARCH_PLUGIN_FIXEDNAME"),
        Switch("COLLAPSIBLE_BOX"),
        Select("DEPENDENCIES_FAILURE_BEHAVIOR", OPTIONS.preferences.DEPENDENCIES_FAILURE_BEHAVIOR),
        Select("OBJECT_SETTINGS_FORMAT", OPTIONS.preferences.OBJECT_SETTINGS_FORMAT),
        Select("DEFAULT_MENU"),
        Select("HIDE_MENUS"),
    ),
    CodeBox("FORM_RENDERING_HOOK", { tooltip: "expertsOnly" }),
    box_settingHandler,
]

const schema_hotkeys = [
    box_basePluginFull,
    TableBox(
        "CUSTOM_HOTKEYS",
        ["hotkey", "desc"],
        [
            UntitledBox(
                Switch("enable"),
                Hotkey("hotkey"),
                Text("desc"),
                Text("plugin"),
                Text("function"),
                Text("closestSelector"),
            ),
            CodeBox("evil"),
        ],
        {
            enable: true,
            hotkey: "",
            desc: "",
            plugin: "",
            function: "",
            closestSelector: "",
            evil: "(anchorNode) => console.log(`invoke with anchor: ${anchorNode}`)",
        },
    ),
    box_settingHandler,
]

const schema_editor_width_slider = [
    box_basePluginLite,
    UntitledBox(
        Integer("WIDTH_RATIO", { tooltip: "minusOneMeansDisable", unit: UNITS.percent, min: -1, max: 100, step: 1 }),
    ),
    box_settingHandler,
]

const schema_article_uploader = [
    UntitledBox(
        Switch("ENABLE", { tooltip: Tip.action("viewArticleUploaderReadme", "fa fa-flask") }),
        field_NAME,
    ),
    UntitledBox(
        Switch("HIDE"),
    ),
    TitledBox(
        "hotkey",
        Hotkey("UPLOAD_ALL_HOTKEY", { dependencies: Dep.or(Dep.true("upload.cnblog.enabled"), Dep.true("upload.wordpress.enabled"), Dep.true("upload.csdn.enabled")) }),
        Hotkey("UPLOAD_CNBLOG_HOTKEY", { dependencies: Dep.true("upload.cnblog.enabled") }),
        Hotkey("UPLOAD_WORDPRESS_HOTKEY", { dependencies: Dep.true("upload.wordpress.enabled") }),
        Hotkey("UPLOAD_CSDN_HOTKEY", { dependencies: Dep.true("upload.csdn.enabled") }),
    ),
    TitledBox(
        "upload",
        Switch("upload.reconfirm"),
        Switch("upload.selenium.headless"),
    ),
    TitledBox(
        "wordPress",
        Switch("upload.wordpress.enabled"),
        Text("upload.wordpress.hostname", { dependencies: Dep.true("upload.wordpress.enabled") }),
        Text("upload.wordpress.loginUrl", { dependencies: Dep.true("upload.wordpress.enabled") }),
        Text("upload.wordpress.username", { dependencies: Dep.true("upload.wordpress.enabled") }),
        Password("upload.wordpress.password", { dependencies: Dep.true("upload.wordpress.enabled") }),
    ),
    TitledBox(
        "cnblog",
        Switch("upload.cnblog.enabled"),
        Text("upload.cnblog.username", { dependencies: Dep.true("upload.cnblog.enabled") }),
        Password("upload.cnblog.password", { dependencies: Dep.true("upload.cnblog.enabled") }),
    ),
    TitledBox(
        "csdn",
        Switch("upload.csdn.enabled"),
        Text("upload.csdn.cookie", { dependencies: Dep.true("upload.csdn.enabled") }),
    ),
    box_settingHandler,
]

const schema_ripgrep = [
    box_basePluginFull,
    TitledBox(
        "windowPosition",
        Range("TOP_PERCENT", prop_percent),
        Range("WIDTH_PERCENT", prop_percent),
    ),
    TitledBox(
        "interaction",
        Switch("BACKSPACE_TO_HIDE"),
    ),
    box_settingHandler,
]

const schema_static_markers = [
    box_basePluginFull,
    CheckboxBox("STATIC_MARKERS", OPTIONS.static_markers.STATIC_MARKERS, { columns: 4 }),
    box_settingHandler,
]

const schema_sidebar_enhance = [
    box_basePluginLite,
    UntitledBox(
        Switch("CTRL_WHEEL_TO_SCROLL_SIDEBAR"),
        Switch("SORTABLE_OUTLINE"),
        Select("OUTLINE_FOLD_STATE", OPTIONS.sidebar_enhance.OUTLINE_FOLD_STATE),
    ),
    UntitledBox(
        Array_("HIDDEN_NODE_PATTERNS"),
    ),
    UntitledBox(
        Switch("DISPLAY_NON_MARKDOWN_FILES"),
        Array_("OPEN_BY_TYPORA_EXT", { dependencies: Dep.true("DISPLAY_NON_MARKDOWN_FILES") }),
        Array_("OPEN_BY_SYSTEM_EXT", { dependencies: Dep.true("DISPLAY_NON_MARKDOWN_FILES") }),
        Switch("CUSTOMIZE_SIDEBAR_ICONS", { dependencies: Dep.true("DISPLAY_NON_MARKDOWN_FILES") }),
    ),
    TableBox(
        "SIDEBAR_ICONS",
        ["extensions", "icon"],
        [
            UntitledBox(
                Switch("enable"),
                Text("icon"),
                Array_("extensions"),
            ),
        ],
        {
            enable: true,
            icon: "fa fa-file-text-o",
            extensions: [],
        },
        { dependencies: Dep.and(Dep.true("CUSTOMIZE_SIDEBAR_ICONS"), Dep.follow("CUSTOMIZE_SIDEBAR_ICONS")) },
    ),
    UntitledBox(
        Switch("ENABLE_FILE_COUNT"),
        Text("FONT_WEIGHT", dep_countFile),
        Text("TEXT_COLOR", dep_countFile),
        Text("BACKGROUND_COLOR", dep_countFile),
    ),
    UntitledBox(
        Array_("COUNT_EXT", dep_countFile),
        Array_("IGNORE_FOLDERS", dep_countFile),
    ),
    UntitledBox(
        Switch("FOLLOW_SYMBOLIC_LINKS", dep_countFile),
        Integer("IGNORE_MIN_NUM", { tooltip: "ignoreMinNum", min: 1, ...dep_countFile }),
        Integer("MAX_SIZE", { tooltip: "maxBytes", unit: UNITS.byte, min: 1, max: 2000000, ...dep_countFile }),
        Integer("MAX_STATS", { min: 100, ...dep_countFile }),
        Integer("CONCURRENCY_LIMIT", { min: 1, ...dep_countFile }),
    ),
    box_settingHandler,
]

const schema_cursor_history = [
    box_basePluginLite,
    TitledBox(
        "hotkey",
        Hotkey("HOTKEY_GO_FORWARD"),
        Hotkey("HOTKEY_GO_BACK"),
    ),
    UntitledBox(
        Integer("MAX_HISTORY_ENTRIES", { min: 1, step: 1 }),
    ),
    box_settingHandler,
]

const schema_json_rpc = [
    UntitledBox(
        Switch("ENABLE", { tooltip: Tip.action("viewJsonRPCReadme", "fa fa-flask") }),
        field_NAME,
    ),
    TitledBox(
        "rpcServer",
        Switch("SERVER_OPTIONS.strict"),
        Text("SERVER_OPTIONS.host"),
        Integer("SERVER_OPTIONS.port", { min: 0, max: 65535, step: 1 }),
        Text("SERVER_OPTIONS.path"),
    ),
    box_settingHandler,
]

const schema_updater = [
    box_basePluginFull,
    UntitledBox(
        Integer("NETWORK_REQUEST_TIMEOUT", { unit: UNITS.millisecond, min: 30000 }),
        Text("PROXY"),
    ),
    TitledBox(
        "autoUpdate",
        Switch("AUTO_UPDATE"),
        Integer("UPDATE_LOOP_INTERVAL", { tooltip: "loopInterval", unit: UNITS.millisecond, min: -1, dependencies: Dep.true("AUTO_UPDATE") }),
        Integer("START_UPDATE_INTERVAL", { tooltip: "waitInterval", unit: UNITS.millisecond, min: -1, dependencies: Dep.true("AUTO_UPDATE") }),
    ),
    box_settingHandler,
]

const schema_test = [
    box_basePluginLite,
    box_settingHandler,
]

const schema_kanban = [
    box_customPluginLite,
    TitledBox(
        "fence",
        Text("LANGUAGE", prop_protected),
        Switch("INTERACTIVE_MODE"),
        Switch("STRICT_MODE"),
    ),
    TitledBox(
        "kanbanStyle",
        Integer("KANBAN_WIDTH", { unit: UNITS.pixel, min: 1 }),
        Integer("KANBAN_MAX_HEIGHT", { unit: UNITS.pixel, min: 1 }),
        Float("KANBAN_TASK_DESC_MAX_HEIGHT", { tooltip: "minusOneMeansShowAll", unit: UNITS.em, min: -1 }),
        Switch("HIDE_DESC_WHEN_EMPTY"),
        Switch("WRAP"),
        Switch("CTRL_WHEEL_TO_SWITCH"),
        Switch("ALLOW_MARKDOWN_INLINE_STYLE"),
        Palette("KANBAN_COLOR"),
        Palette("TASK_COLOR"),
    ),
    CodeBox("TEMPLATE"),
    box_settingHandler,
]

const schema_chat = [
    box_customPluginLite,
    TitledBox(
        "fence",
        Text("LANGUAGE", prop_protected),
        Switch("INTERACTIVE_MODE"),
        Switch("DEFAULT_OPTIONS.useStrict"),
    ),
    TitledBox(
        "defaultOption",
        Switch("DEFAULT_OPTIONS.showNickname"),
        Switch("DEFAULT_OPTIONS.showAvatar"),
        Switch("DEFAULT_OPTIONS.notAllowShowTime"),
        Switch("DEFAULT_OPTIONS.allowMarkdown"),
        Text("DEFAULT_OPTIONS.senderNickname"),
        Text("DEFAULT_OPTIONS.timeNickname"),
    ),
    CodeBox("TEMPLATE"),
    box_settingHandler,
]

const schema_timeline = [
    box_customPluginLite,
    box_langMode,
    TitledBox(
        "diagramStyle",
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
    CodeBox("TEMPLATE"),
    box_settingHandler,
]

const schema_echarts = [
    box_customPluginLite,
    box_langMode,
    box_chartStyle,
    CodeBox("TEMPLATE"),
    TitledBox(
        "advanced",
        Select("RENDERER", OPTIONS.echarts.RENDERER, { tooltip: Tip.action("chooseEchartsRenderer", "fa fa-link") }),
        Select("EXPORT_TYPE", OPTIONS.echarts.EXPORT_TYPE),
    ),
    box_settingHandler,
]

const schema_chart = [
    box_customPluginLite,
    box_langMode,
    box_chartStyle,
    CodeBox("TEMPLATE"),
    box_settingHandler,
]

const schema_wavedrom = [
    box_customPluginLite,
    TitledBox(
        "fenceLanguageMode",
        Text("LANGUAGE", prop_protected),
        Switch("INTERACTIVE_MODE"),
        Switch("SAFE_MODE"),
    ),
    box_chartStyle,
    CodeBox("TEMPLATE"),
    ArrayBox("SKIN_FILES", { tooltip: Tip.action("downloadWaveDromSkins", "fa fa-download") }),
    box_settingHandler,
]

const schema_calendar = [
    box_customPluginLite,
    box_langMode,
    box_chartStyle,
    CodeBox("TEMPLATE"),
    box_settingHandler,
]

const schema_abc = [
    box_customPluginLite,
    box_langMode,
    box_chartStyle,
    CodeBox("TEMPLATE"),
    DictBox("VISUAL_OPTIONS", null, { tooltip: Tip.action("viewAbcVisualOptionsHelp", "fa fa-link") }),
    box_settingHandler,
]

const schema_drawIO = [
    box_customPluginLite,
    box_langMode,
    box_chartStyle,
    CodeBox("TEMPLATE"),
    TitledBox(
        "advanced",
        Text("RESOURCE_URI"),
        Text("PROXY"),
        Integer("SERVER_TIMEOUT", { unit: UNITS.millisecond, min: 1000 }),
        Integer("MEMORIZED_URL_COUNT", { min: 1 }),
    ),
    box_settingHandler,
]

const schema_plantUML = [
    UntitledBox(
        Switch("enable", { tooltip: Tip.action("installPlantUMLServer", "fa fa-flask") }),
        field_hide,
        field_name,
        field_order,
    ),
    UntitledBox(
        Text("SERVER_URL"),
        Integer("SERVER_TIMEOUT", { unit: UNITS.millisecond, min: 1000 }),
        Integer("MEMORIZED_URL_COUNT", { min: 1 }),
        Select("OUTPUT_FORMAT", OPTIONS.plantUML.OUTPUT_FORMAT),
    ),
    box_langMode,
    box_chartStyle,
    CodeBox("TEMPLATE"),
    box_settingHandler,
]

const schema_marp = [
    box_customPluginLite,
    box_langMode,
    DictBox("MARP_CORE_OPTIONS", null, { tooltip: Tip.action("viewMarpOptions", "fa fa-link") }),
    CodeBox("TEMPLATE"),
    box_settingHandler,
]

const schema_callouts = [
    box_customPluginLite,
    TitledBox(
        "style",
        Switch("set_title_color"),
        Text("box_shadow"),
    ),
    TitledBox(
        "mouseHover",
        Switch("hover_to_show_fold_callout"),
    ),
    TitledBox(
        "fontFamily",
        Text("font_family"),
        Switch("use_network_icon_when_exporting", { tooltip: "messingFont" }),
        Text("network_icon_url", { dependencies: Dep.true("use_network_icon_when_exporting") }),
    ),
    TitledBox(
        "defaultOptions",
        Text("default_background_color"),
        Text("default_left_line_color"),
        Text("default_icon"),
    ),
    TableBox(
        "list",
        ["type", "icon", "background_color"],
        [
            UntitledBox(
                Text("type"),
                Text("icon"),
                Text("background_color"),
                Text("left_line_color"),
            ),
        ],
        {
            type: "",
            icon: "",
            background_color: "",
            left_line_color: "",
        },
    ),
    CodeBox("template"),
    box_settingHandler,
]

const schema_templater = [
    box_customPluginFull,
    UntitledBox(
        Switch("auto_open"),
    ),
    TableBox(
        "template_variables",
        ["name", "callback"],
        [
            UntitledBox(
                Switch("enable"),
                Text("name"),
            ),
            CodeBox("callback"),
        ],
        {
            enable: true,
            name: "",
            callback: "(...args) => console.log(`invoke with params: ${args}`)",
        },
    ),
    TableBox(
        "template",
        ["name", "text"],
        [
            UntitledBox(
                Text("name"),
            ),
            TextareaBox("text", { rows: 10 }),
        ],
        {
            name: "",
            text: "",
        },
    ),
    ArrayBox("template_folders"),
    box_settingHandler,
]

const schema_chineseSymbolAutoPairer = [
    box_customPluginLite,
    UntitledBox(
        Switch("auto_skip"),
        Switch("auto_delete_pair"),
        Switch("auto_swap"),
        Switch("auto_surround_pair"),
        Switch("auto_select_after_surround"),
    ),
    TableBox(
        "auto_pair_symbols",
        ["0", "1"],
        [
            UntitledBox(
                Text("0"),
                Text("1"),
            ),
        ],
        ["", ""],
    ),
    TableBox(
        "auto_swap_symbols",
        ["0", "1"],
        [
            UntitledBox(
                Text("0"),
                Text("1"),
            ),
        ],
        ["", ""],
    ),
    box_settingHandler,
]

const schema_toc = [
    box_customPluginFull,
    UntitledBox(
        Switch("default_show_toc"),
        Switch("remove_header_styles"),
        Switch("sortable"),
        Switch("right_click_outline_button_to_toggle"),
        Range("width_percent_when_pin_right", prop_percent),
    ),
    TransferBox("title_bar_buttons", OPTIONS.toc.title_bar_buttons),
    TitledBox(
        "displayHeader",
        Switch("include_headings.image", { dependencies: Dep.contains("title_bar_buttons", "image") }),
        Switch("include_headings.table", { dependencies: Dep.contains("title_bar_buttons", "table") }),
        Switch("include_headings.fence", { dependencies: Dep.contains("title_bar_buttons", "fence") }),
        Switch("include_headings.link", { dependencies: Dep.contains("title_bar_buttons", "link") }),
        Switch("include_headings.math", { dependencies: Dep.contains("title_bar_buttons", "math") }),
    ),
    box_settingHandler,
]

const schema_scrollBookmarker = [
    box_customPluginFull,
    UntitledBox(
        Hotkey("modifier_key", { tooltip: "modifierKeyExample" }),
        Switch("auto_popup_modal"),
    ),
    box_settingHandler,
]

const schema_imageReviewer = [
    box_customPluginFull,
    TitledBox(
        "style",
        Range("mask_background_opacity", { min: 0, max: 1, step: 0.05 }),
        Range("image_max_width", prop_percent),
        Range("image_max_height", prop_percent),
        Text("thumbnail_height"),
        Integer("blur_level", { unit: UNITS.pixel, min: 1 }),
        Integer("thumbnail_scroll_padding_count", { min: 0 }),
        Integer("water_fall_columns", { min: 0 }),
    ),
    TitledBox(
        "component",
        Switch("show_thumbnail_nav"),
        Select("tool_position", OPTIONS.imageReviewer.tool_position),
    ),
    TransferBox("show_message", OPTIONS.imageReviewer.show_message),
    TransferBox("tool_function", OPTIONS.imageReviewer.operations, { minItems: 1 }),
    TitledBox(
        "behavior",
        Switch("filter_error_image"),
        Select("first_image_strategies", OPTIONS.imageReviewer.first_image_strategies, { minItems: 1 }),
        Select("thumbnail_object_fit", OPTIONS.imageReviewer.thumbnail_object_fit),
        Integer("play_second", { unit: UNITS.second, min: 1 }),
    ),
    TitledBox(
        "adjustScale",
        Float("zoom_scale", { min: 0.01 }),
        Integer("rotate_scale", { unit: UNITS.degree, min: 1 }),
        Integer("skew_scale", { unit: UNITS.degree, min: 1 }),
        Integer("translate_scale", { unit: UNITS.pixel, min: 1 }),
    ),
    TitledBox(
        "mouseEvent",
        Switch("click_mask_to_exit"),
        Select("mousedown_function.0", OPTIONS.imageReviewer.operations),
        Select("mousedown_function.1", OPTIONS.imageReviewer.operations),
        Select("mousedown_function.2", OPTIONS.imageReviewer.operations),
        Select("ctrl_mousedown_function.0", OPTIONS.imageReviewer.operations),
        Select("ctrl_mousedown_function.1", OPTIONS.imageReviewer.operations),
        Select("ctrl_mousedown_function.2", OPTIONS.imageReviewer.operations),
        Select("shift_mousedown_function.0", OPTIONS.imageReviewer.operations),
        Select("shift_mousedown_function.1", OPTIONS.imageReviewer.operations),
        Select("shift_mousedown_function.2", OPTIONS.imageReviewer.operations),
        Select("alt_mousedown_function.0", OPTIONS.imageReviewer.operations),
        Select("alt_mousedown_function.1", OPTIONS.imageReviewer.operations),
        Select("alt_mousedown_function.2", OPTIONS.imageReviewer.operations),
        Select("wheel_function.0", OPTIONS.imageReviewer.operations),
        Select("wheel_function.1", OPTIONS.imageReviewer.operations),
        Select("ctrl_wheel_function.0", OPTIONS.imageReviewer.operations),
        Select("ctrl_wheel_function.1", OPTIONS.imageReviewer.operations),
        Select("shift_wheel_function.0", OPTIONS.imageReviewer.operations),
        Select("shift_wheel_function.1", OPTIONS.imageReviewer.operations),
        Select("alt_wheel_function.0", OPTIONS.imageReviewer.operations),
        Select("alt_wheel_function.1", OPTIONS.imageReviewer.operations),
    ),
    TableBox(
        "hotkey_function",
        ["0", "1"],
        [
            UntitledBox(
                Select("1", OPTIONS.imageReviewer.operations),
                Hotkey("0"),
            ),
        ],
        ["", "nextImage"],
    ),
    box_settingHandler,
]

const schema_markdownLint = [
    box_customPluginFull,
    TitledBox(
        "detectAndFix",
        Switch("translate"),
        Switch("right_click_table_to_toggle_source_mode"),
        Select("title_bar_buttons", OPTIONS.markdownLint.title_bar_buttons),
        Select("columns", OPTIONS.markdownLint.columns, { minItems: 1 }),
        Select("result_order_by", OPTIONS.markdownLint.result_order_by),
        Select("tools", OPTIONS.markdownLint.tools, { minItems: 1 }),
        Hotkey("hotkey_fix_lint_error"),
    ),
    TitledBox(
        "indicator",
        Switch("use_button"),
        Switch("right_click_button_to_fix", { dependencies: Dep.true("use_button") }),
        Text("button_width", { dependencies: Dep.true("use_button") }),
        Text("button_height", { dependencies: Dep.true("use_button") }),
        Text("button_right", { dependencies: Dep.true("use_button") }),
        Text("button_border_radius", { dependencies: Dep.true("use_button") }),
        Range("button_opacity", { min: 0, max: 1, step: 0.05, dependencies: Dep.true("use_button") }),
        Color("pass_color", { dependencies: Dep.true("use_button") }),
        Color("error_color", { dependencies: Dep.true("use_button") }),
    ),
    DictBox("rule_config", null, { tooltip: Tip.action("viewMarkdownlintRules", "fa fa-link") }),
    ArrayBox("custom_rule_files"),
    box_settingHandler,
]

const schema_quickButton = [
    box_customPluginFull,
    TitledBox(
        "buttonStyle",
        Switch("support_right_click"),
        Switch("hide_button_hint"),
        Text("button_size"),
        Text("button_border_radius"),
        Text("button_box_shadow"),
        Text("button_gap"),
        Text("position_right"),
        Text("position_bottom"),
    ),
    TableBox(
        "buttons",
        ["coordinate", "icon"],
        [
            UntitledBox(
                Switch("disable"),
                Integer("coordinate.0", { tooltip: "coord0", min: 0 }),
                Integer("coordinate.1", { tooltip: "coord1", min: 0 }),
                Icon("icon"),
                Text("size"),
                Text("color"),
                Text("bgColor"),
                Text("hint"),
                Text("callback", { tooltip: "exclusive", dependencies: Dep.bool("evil", false) }),
            ),
            CodeBox("evil", { placeholder: "customCallback", dependencies: Dep.bool("callback", false) }),
        ],
        {
            disable: true,
            coordinate: [0, 0],
            icon: "fa fa-bomb",
            size: "17px",
            color: "",
            bgColor: "",
            hint: "",
            callback: "",
            evil: "",
        },
    ),
    box_settingHandler,
]

const schema_blockSideBySide = [
    box_customPluginFull,
    box_settingHandler,
]

const schema_redirectLocalRootUrl = [
    box_customPluginLite,
    UntitledBox(
        Text("root"),
        Text("filter_regexp"),
    ),
    box_settingHandler,
]

const SCHEMAS = {
    global: schema_global,
    window_tab: schema_window_tab,
    search_multi: schema_search_multi,
    commander: schema_commander,
    md_padding: schema_md_padding,
    read_only: schema_read_only,
    blur: schema_blur,
    dark: schema_dark,
    no_image: schema_no_image,
    myopic_defocus: schema_myopic_defocus,
    toolbar: schema_toolbar,
    resize_image: schema_resize_image,
    resize_table: schema_resize_table,
    datatables: schema_datatables,
    go_top: schema_go_top,
    markmap: schema_markmap,
    auto_number: schema_auto_number,
    fence_enhance: schema_fence_enhance,
    collapse_paragraph: schema_collapse_paragraph,
    collapse_list: schema_collapse_list,
    collapse_table: schema_collapse_table,
    truncate_text: schema_truncate_text,
    export_enhance: schema_export_enhance,
    text_stylize: schema_text_stylize,
    cipher: schema_cipher,
    resource_manager: schema_resource_manager,
    easy_modify: schema_easy_modify,
    custom: schema_custom,
    slash_commands: schema_slash_commands,
    right_click_menu: schema_right_click_menu,
    pie_menu: schema_pie_menu,
    preferences: schema_preferences,
    hotkeys: schema_hotkeys,
    editor_width_slider: schema_editor_width_slider,
    article_uploader: schema_article_uploader,
    ripgrep: schema_ripgrep,
    static_markers: schema_static_markers,
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
    templater: schema_templater,
    chineseSymbolAutoPairer: schema_chineseSymbolAutoPairer,
    toc: schema_toc,
    scrollBookmarker: schema_scrollBookmarker,
    imageReviewer: schema_imageReviewer,
    markdownLint: schema_markdownLint,
    quickButton: schema_quickButton,
    blockSideBySide: schema_blockSideBySide,
    redirectLocalRootUrl: schema_redirectLocalRootUrl,
}

const I18N = (schemas, i18nData = require("../global/locales/en.json")) => {
    const PREFIX_DEPENDENT_PROPS = { label: "$label" }
    const SPECIAL_PROPS = { options: "$option", thMap: "$label" }
    const GLOBAL_PROPS = { explain: "$explain", placeholder: "$placeholder", hintHeader: "$hintHeader", hintDetail: "$hintDetail", divider: "$divider", unit: "$unit" }
    const TAB_PROPS = { tabs: "$tab" }
    const NESTED_PROPS = ["nestedBoxes", "subSchema"]

    const translateTitle = (item, label, t, prefix) => {
        if (label) {
            const i18nKey = prefix ? `${prefix}.${label}` : label
            item.title = t(`$label.${i18nKey}`)
        } else if (item.title) {
            const i18nKey = prefix ? `${prefix}.${item.title}` : item.title
            item.title = t(`$title.${i18nKey}`)
        }
    }
    const translateTooltip = (item, t) => {
        if (item.tooltip == null) return
        const tips = Array.isArray(item.tooltip) ? item.tooltip : [item.tooltip]
        item.tooltip = tips.map(tip => {
            if (typeof tip === "string") {
                return t(`$tooltip.${tip}`)
            }
            if (typeof tip?.text === "string") {
                tip = { ...tip, text: t(`$tooltip.${tip.text}`) }
            }
            if (typeof tip?.action === "string" && tip?.text == null) {
                tip = { ...tip, text: t(`$tooltip.${tip.action}`) }
            }
            return tip
        })
    }
    const translateFields = (box, t, prefix) => {
        if (!Array.isArray(box.fields)) return
        box.fields = box.fields.map(field => {
            const newField = { ...field }
            translateTooltip(newField, t)
            Object.entries(PREFIX_DEPENDENT_PROPS).forEach(([prop, i18nPrefix]) => {
                if (newField[prop] != null) {
                    const key = prefix ? `${prefix}.${newField[prop]}` : newField[prop]
                    newField[prop] = t(`${i18nPrefix}.${key}`)
                }
            })
            Object.entries(GLOBAL_PROPS).forEach(([prop, i18nPrefix]) => {
                if (newField[prop] != null) {
                    newField[prop] = t(`${i18nPrefix}.${newField[prop]}`)
                }
            })
            Object.entries(SPECIAL_PROPS).forEach(([prop, i18nPrefix]) => {
                if (newField[prop] != null && typeof newField[prop] === "object" && !Array.isArray(newField[prop])) {
                    newField[prop] = Object.fromEntries(
                        Object.entries(newField[prop]).map(([k, v]) => [k, t(`${i18nPrefix}.${v}`)])
                    )
                }
            })
            Object.entries(TAB_PROPS).forEach(([prop, i18nPrefix]) => {
                if (Array.isArray(newField[prop])) {
                    newField[prop].label = t(`${i18nPrefix}.${newField[prop].label}`)
                    newField[prop].schema = newField[prop].schema.map(nested => translateBox(nested, t, newField.key))
                }
            })
            NESTED_PROPS.forEach(prop => {
                if (Array.isArray(newField[prop])) {
                    newField[prop] = newField[prop].map(nested => translateBox(nested, t, newField.key))
                }
            })
            return newField
        })
    }
    const translateBox = (box, t, prefix = "") => {
        const { label, ...newBox } = { ...box }
        translateTitle(newBox, label, t, prefix)
        translateTooltip(newBox, t)
        translateFields(newBox, t, prefix)
        return newBox
    }

    return Object.fromEntries(
        Object.entries(schemas).map(([fixedName, boxes]) => {
            const t = (i18nKey) => i18nData[fixedName]?.[i18nKey] ?? i18nData.settings?.[i18nKey] ?? i18nKey
            const translatedBoxes = boxes.map(box => translateBox(box, t))
            return [fixedName, translatedBoxes]
        })
    )
}

module.exports = I18N(SCHEMAS, require("../global/core/i18n").data)
