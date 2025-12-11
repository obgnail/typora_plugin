const Action = (key, { ...args } = {}) => {
    return { type: "action", key, label: key, ...args }
}
const Static = (key, { ...args } = {}) => {
    return { type: "static", key, label: key, ...args }
}
const Hint = (header, detail, { unsafe = false, ...args } = {}) => {
    return { type: "hint", hintHeader: header, hintDetail: detail, unsafe, ...args }
}
const Custom = (content, { unsafe = false, ...args } = {}) => {
    return { type: "custom", content, unsafe, ...args }
}
const Switch = (key, { tooltip, disabled, dependencies, ...args } = {}) => {
    return { type: "switch", key, label: key, tooltip, disabled, dependencies, ...args }
}
const Text = (key, { tooltip, placeholder, disabled, dependencies, ...args } = {}) => {
    return { type: "text", key, label: key, tooltip, placeholder, disabled, dependencies, ...args }
}
const Password = (key, { tooltip, placeholder, disabled, dependencies, ...args } = {}) => {
    return { type: "password", key, label: key, tooltip, placeholder, disabled, dependencies, ...args }
}
const Color = (key, { tooltip, disabled, dependencies, ...args } = {}) => {
    return { type: "color", key, label: key, tooltip, disabled, dependencies, ...args }
}
const Hotkey = (key, { tooltip, placeholder, disabled, dependencies, ...args } = {}) => {
    return { type: "hotkey", key, label: key, tooltip, placeholder, disabled, dependencies, ...args }
}
const Number = (key, { tooltip, unit, min, max, step, dependencies, ...args } = {}) => {
    const type = unit ? "unit" : "number"
    return { type, key, unit, min, max, step, label: key, tooltip, dependencies, ...args }
}
const Range = (key, { tooltip, min, max, step, dependencies, ...args } = {}) => {
    return { type: "range", key, min, max, step, label: key, tooltip, dependencies, ...args }
}
const Select = (key, options, { tooltip, minItems, maxItems, disabledOptions, dependencies, ...args } = {}) => {
    return { type: "select", key, label: key, tooltip, options, minItems, maxItems, disabledOptions, dependencies, ...args }
}
const Array_Inline = (key, { tooltip, dependencies, ...args } = {}) => {
    return { type: "array", isBlockLayout: false, key, label: key, tooltip, dependencies, ...args }
}
const Radio_Inline = (key, options, { tooltip, columns = 1, dependencies, ...args } = {}) => {
    return { type: "radio", isBlockLayout: false, key, label: key, tooltip, options, columns, dependencies, ...args }
}
const Checkbox_Inline = (key, options, { tooltip, minItems, maxItems, columns = 1, dependencies, ...args } = {}) => {
    return { type: "checkbox", isBlockLayout: false, key, label: key, tooltip, options, minItems, maxItems, columns, dependencies, ...args }
}
const Composite = (key, subSchema, defaultValues, { tooltip, disabled, dependencies, ...args } = {}) => {
    return { type: "composite", key, label: key, subSchema, defaultValues, tooltip, disabled, dependencies, ...args }
}

const UntitledBox = (...fields) => ({ title: undefined, fields })
const TitledBox = (title, ...fields) => ({ title, fields })

const WithDependencies = (source, dependencies) => ({ ...source, dependencies })

const ObjectBox = (key, { rows = 10, dependencies, ...args } = {}) => {
    const box = TitledBox(key, { type: "object", key, rows, ...args })
    return WithDependencies(box, dependencies)
}
const TextareaBox = (key, { rows = 10, placeholder, dependencies, ...args } = {}) => {
    const box = TitledBox(key, { type: "textarea", key, rows, placeholder, ...args })
    return WithDependencies(box, dependencies)
}
const ArrayBox = (key, { dependencies, ...args } = {}) => {
    const box = TitledBox(key, { type: "array", key, ...args })
    return WithDependencies(box, dependencies)
}
const TableBox = (key, ths, nestedBoxes, defaultValues, { dependencies, ...args } = {}) => {
    nestedBoxes.forEach(box => {
        if (box.title) box.title = `${key}.${box.title}`
        box.fields.forEach(field => {
            if (field.label) field.label = `${key}.${field.label}`
        })
    })
    const boxDependencyUnmetAction = "readonly"
    const thMap = Object.fromEntries(ths.map(th => [th, `${key}.${th}`]))
    const box = TitledBox(key, { type: "table", key, nestedBoxes, defaultValues, thMap, boxDependencyUnmetAction, ...args })
    return WithDependencies(box, dependencies)
}
const RadioBox = (key, options, { columns = 1, dependencies, ...args } = {}) => {
    const box = TitledBox(key, { type: "radio", key, options, columns, ...args })
    return WithDependencies(box, dependencies)
}
const CheckboxBox = (key, options, { minItems, maxItems, columns = 1, dependencies, ...args } = {}) => {
    const box = TitledBox(key, { type: "checkbox", options, key, minItems, maxItems, columns, ...args })
    return WithDependencies(box, dependencies)
}

const prop_percent = { min: 0, max: 100, step: 1 }
const prop_protected = { tooltip: "protected", disabled: true }

const dep_markmapToc = { dependencies: { ENABLE_TOC_MARKMAP: true } }
const dep_markmapFence = { dependencies: { ENABLE_FENCE_MARKMAP: true } }
const dep_fenceEnhanceButton = { dependencies: { ENABLE_BUTTON: true } }
const dep_fenceEnhanceHotkey = { dependencies: { ENABLE_HOTKEY: true } }

const field_ENABLE = Switch("ENABLE")
const field_NAME = Text("NAME", { placeholder: "defaultIfEmpty" })
const field_HOTKEY = Hotkey("HOTKEY")
const field_enable = Switch("enable")
const field_hide = Switch("hide")
const field_name = Text("name", { placeholder: "defaultIfEmpty" })
const field_order = Number("order")
const field_hotkey = Hotkey("hotkey")

const box_basePluginLite = UntitledBox(field_ENABLE, field_NAME)
const box_basePluginFull = UntitledBox(field_ENABLE, field_NAME, field_HOTKEY)
const box_customPluginLite = UntitledBox(field_enable, field_hide, field_name, field_order)
const box_customPluginFull = UntitledBox(field_enable, field_hide, field_name, field_order, field_hotkey)
const box_settingHandler = UntitledBox(Action("runtimeSettings"), Action("restoreSettings"))

const box_langMode = TitledBox("fenceLanguageMode", Text("LANGUAGE", prop_protected), Switch("INTERACTIVE_MODE"))
const box_chartStyle = TitledBox("diagramStyle", Text("DEFAULT_FENCE_HEIGHT"), Text("DEFAULT_FENCE_BACKGROUND_COLOR"))

const UNITS = {
    byte: "byte",
    pixel: "pixel",
    millisecond: "millisecond",
    second: "second",
    item: "item",
    line: "line",
    percent: "percent",
    degree: "degree",
    em: "em",
}

const OPTIONS = {
    global: {
        LOCALE: ["auto", "en", "zh-CN", "zh-TW"],
        EXIT_INTERACTIVE_MODE: ["click_exit_button", "ctrl_click_fence"],
    },
    window_tab: {
        CONTEXT_MENU: ["closeTab", "closeOtherTabs", "closeLeftTabs", "closeRightTabs", "copyPath", "showInFinder", "openInNewWindow", "sortTabs"],
        NEW_TAB_POSITION: ["right", "end"],
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
}

Object.values(OPTIONS).forEach(field => {
    Object.entries(field).forEach(([fieldKey, options]) => {
        field[fieldKey] = Object.fromEntries(options.map(option => [option, `${fieldKey}.${option}`]))
    })
})

const conf_global = [
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
        Action("viewDeepWiki"),
        Action("openPluginFolder"),
        Action("editStyles"),
        Action("developPlugins"),
        Action("githubImageBed"),
    ),
    UntitledBox(
        Action("updatePlugin"),
        Action("uninstallPlugin"),
        Action("sendEmail"),
        Action("donate"),
        Static("pluginVersion"),
    ),
]

const conf_window_tab = [
    box_basePluginLite,
    TitledBox(
        "appearance",
        Switch("SHOW_TAB_CLOSE_BUTTON"),
        Switch("TRIM_FILE_EXT"),
        Switch("SHOW_DIR_ON_DUPLICATE"),
        Switch("HIDE_WINDOW_TITLE_BAR"),
        Text("TAB_MIN_WIDTH"),
        Text("TAB_MAX_WIDTH"),
        Number("MAX_TAB_NUM", { tooltip: "minusOneMeansUnlimited", min: -1 }),
    ),
    TitledBox(
        "behavior",
        Switch("REOPEN_CLOSED_TABS_WHEN_INIT"),
        Select("NEW_TAB_POSITION", OPTIONS.window_tab.NEW_TAB_POSITION),
        Select("TAB_SWITCH_ON_CLOSE", OPTIONS.window_tab.TAB_SWITCH_ON_CLOSE),
        Select("LAST_TAB_CLOSE_ACTION", OPTIONS.window_tab.LAST_TAB_CLOSE_ACTION),
    ),
    UntitledBox(
        Switch("USE_CONTEXT_MENU"),
        Select("CONTEXT_MENU", OPTIONS.window_tab.CONTEXT_MENU, { dependencies: { USE_CONTEXT_MENU: true } }),
    ),
    TitledBox(
        "mouseInteraction",
        Switch("CTRL_CLICK_TO_NEW_WINDOW"),
        Switch("MIDDLE_CLICK_TO_CLOSE"),
        Switch("CTRL_WHEEL_TO_SWITCH"),
        Switch("WHEEL_TO_SCROLL_TAB_BAR"),
        Switch("SHOW_FULL_PATH_WHEN_HOVER"),
    ),
    UntitledBox(
        Select("DRAG_STYLE", OPTIONS.window_tab.DRAG_STYLE),
        Select("TAB_DETACHMENT", OPTIONS.window_tab.TAB_DETACHMENT, { dependencies: { DRAG_STYLE: "JetBrains" } }),
        Number("DETACHMENT_THRESHOLD", { tooltip: "detachThreshold", min: 0.1, max: 3, step: 0.1, dependencies: { DRAG_STYLE: "JetBrains", TAB_DETACHMENT: "resistant" } }),
        Number("DRAG_NEW_WINDOW_THRESHOLD", { tooltip: "newWindow", min: -1, dependencies: { TAB_DETACHMENT: { $ne: "lockVertical" } } }),
    ),
    ArrayBox("CLOSE_HOTKEY"),
    ArrayBox("SWITCH_PREVIOUS_TAB_HOTKEY"),
    ArrayBox("SWITCH_NEXT_TAB_HOTKEY"),
    ArrayBox("SORT_TABS_HOTKEY"),
    ArrayBox("COPY_PATH_HOTKEY"),
    ArrayBox("TOGGLE_TAB_BAR_HOTKEY"),
    box_settingHandler,
]

const conf_search_multi = [
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
        Number("MAX_HITS", { min: 1 }),
    ),
    TitledBox(
        "windowInteraction",
        Switch("BACKSPACE_TO_HIDE"),
    ),
    ArrayBox("ALLOW_EXT"),
    ArrayBox("IGNORE_FOLDERS"),
    ArrayBox("HIGHLIGHT_COLORS"),
    TitledBox(
        "advanced",
        Switch("FOLLOW_SYMBOLIC_LINKS"),
        Select("TRAVERSE_STRATEGY", OPTIONS.search_multi.TRAVERSE_STRATEGY),
        Number("TIMEOUT", { tooltip: "minusOneMeansUnlimited", unit: UNITS.millisecond, min: -1 }),
        Number("MAX_SIZE", { tooltip: "maxBytes", unit: UNITS.byte, min: 1, max: 2000000 }),
        Number("MAX_STATS", { tooltip: "minusOneMeansUnlimited", min: -1 }),
        Number("MAX_DEPTH", { tooltip: "minusOneMeansUnlimited", min: -1 }),
        Number("CONCURRENCY_LIMIT", { min: 1 }),
    ),
    box_settingHandler,
]

const conf_commander = [
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

const conf_md_padding = [
    box_basePluginFull,
    ArrayBox("IGNORE_WORDS"),
    ArrayBox("IGNORE_PATTERNS"),
    box_settingHandler,
]

const conf_read_only = [
    box_basePluginFull,
    TitledBox(
        "underReadOnly",
        Switch("READ_ONLY_DEFAULT"),
        Text("SHOW_TEXT"),
    ),
    UntitledBox(
        Switch("DISABLE_CONTEXT_MENU_WHEN_READ_ONLY"),
        Select("REMAIN_AVAILABLE_MENU_KEY", undefined, { dependencies: { DISABLE_CONTEXT_MENU_WHEN_READ_ONLY: true } }),
    ),
    UntitledBox(
        Switch("CLICK_HYPERLINK_TO_OPEN_WHEN_READ_ONLY"),
        Switch("NO_EXPAND_WHEN_READ_ONLY"),
        Switch("REMOVE_EXPAND_WHEN_READ_ONLY", { dependencies: { NO_EXPAND_WHEN_READ_ONLY: false } }),
    ),
    box_settingHandler,
]

const conf_blur = [
    box_basePluginFull,
    UntitledBox(
        Switch("BLUR_DEFAULT"),
        Switch("RESTORE_WHEN_HOVER"),
        Select("BLUR_TYPE", OPTIONS.blur.BLUR_TYPE),
        Number("BLUR_LEVEL", { unit: UNITS.pixel, min: 1, dependencies: { BLUR_TYPE: "blur" } }),
    ),
    box_settingHandler,
]

const conf_dark = [
    box_basePluginFull,
    UntitledBox(
        Switch("DARK_DEFAULT"),
    ),
    box_settingHandler,
]

const conf_no_image = [
    box_basePluginFull,
    UntitledBox(
        Switch("DEFAULT_NO_IMAGE_MODE"),
        Switch("RESHOW_WHEN_HOVER"),
        Number("TRANSITION_DURATION", { unit: UNITS.millisecond, min: 0 }),
        Number("TRANSITION_DELAY", { unit: UNITS.millisecond, min: 0 }),
    ),
    box_settingHandler,
]

const conf_toolbar = [
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
        Number("DEBOUNCE_INTERVAL", { unit: UNITS.millisecond, min: 10 }),
    ),
    box_settingHandler,
]

const conf_resize_image = [
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

const conf_resize_table = [
    box_basePluginLite,
    UntitledBox(
        Switch("RECORD_RESIZE"),
        Switch("REMOVE_MIN_CELL_WIDTH"),
        Number("DRAG_THRESHOLD", { unit: UNITS.pixel, min: 1 }),
    ),
    box_settingHandler,
]

const conf_datatables = [
    box_basePluginLite,
    UntitledBox(
        Switch("ORDERING"),
        Switch("DEFAULT_ORDER"),
        Switch("SEARCHING"),
        Switch("REGEX"),
        Switch("CASE_INSENSITIVE"),
        Switch("SCROLL_COLLAPSE"),
        Switch("PAGING"),
        Number("PAGE_LENGTH", { unit: UNITS.item, min: 1 }),
    ),
    box_settingHandler,
]

const conf_go_top = [
    box_basePluginLite,
    TitledBox(
        "hotkey",
        Hotkey("HOTKEY_GO_TOP"),
        Hotkey("HOTKEY_GO_BOTTOM"),
    ),
    box_settingHandler,
]

const conf_markmap = [
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
        Text("NODE_BORDER_WHEN_HOVER", dep_markmapToc),
        Select("TITLE_BAR_BUTTONS", OPTIONS.markmap.TITLE_BAR_BUTTONS, { minItems: 1, ...dep_markmapToc }),
    ),
    TitledBox(
        "mindmapDiagramDefaultOptions",
        Switch("DEFAULT_TOC_OPTIONS.zoom", dep_markmapToc),
        Switch("DEFAULT_TOC_OPTIONS.pan", dep_markmapToc),
        Switch("DEFAULT_TOC_OPTIONS.toggleRecursively", dep_markmapToc),
        Range("DEFAULT_TOC_OPTIONS.initialExpandLevel", { min: 1, max: 7, step: 1, ...dep_markmapToc }),
        Range("DEFAULT_TOC_OPTIONS.colorFreezeLevel", { min: 1, max: 7, step: 1, ...dep_markmapToc }),
        Range("DEFAULT_TOC_OPTIONS.fitRatio", { min: 0.5, max: 1, step: 0.01, ...dep_markmapToc }),
        Range("DEFAULT_TOC_OPTIONS.maxInitialScale", { min: 0.5, max: 5, step: 0.25, ...dep_markmapToc }),
        Number("DEFAULT_TOC_OPTIONS.maxWidth", { tooltip: "zero", unit: UNITS.pixel, min: 0, max: 100, step: 5, ...dep_markmapToc }),
        Number("DEFAULT_TOC_OPTIONS.nodeMinHeight", { unit: UNITS.pixel, min: 5, max: 50, step: 1, ...dep_markmapToc }),
        Number("DEFAULT_TOC_OPTIONS.spacingHorizontal", { unit: UNITS.pixel, min: 0, max: 100, step: 5, ...dep_markmapToc }),
        Number("DEFAULT_TOC_OPTIONS.spacingVertical", { unit: UNITS.pixel, min: 0, max: 100, step: 5, ...dep_markmapToc }),
        Number("DEFAULT_TOC_OPTIONS.paddingX", { unit: UNITS.pixel, min: 0, max: 100, step: 5, ...dep_markmapToc }),
        Number("DEFAULT_TOC_OPTIONS.duration", { unit: UNITS.millisecond, min: 0, max: 1000, step: 10, ...dep_markmapToc }),
    ),
    ArrayBox("DEFAULT_TOC_OPTIONS.color", dep_markmapToc),
    ObjectBox("CANDIDATE_COLOR_SCHEMES", dep_markmapToc),
    TitledBox(
        "mindmapDiagramExport",
        Switch("DOWNLOAD_OPTIONS.KEEP_ALPHA_CHANNEL", dep_markmapToc),
        Switch("DOWNLOAD_OPTIONS.REMOVE_USELESS_CLASSES", dep_markmapToc),
        Switch("DOWNLOAD_OPTIONS.REMOVE_FOREIGN_OBJECT", { tooltip: "removeForeignObj", ...dep_markmapToc }),
        Switch("DOWNLOAD_OPTIONS.SHOW_PATH_INQUIRY_DIALOG", dep_markmapToc),
        Switch("DOWNLOAD_OPTIONS.SHOW_IN_FINDER", dep_markmapToc),
        Range("DOWNLOAD_OPTIONS.IMAGE_QUALITY", { tooltip: "pixelImagesOnly", min: 0.01, max: 1, step: 0.01, ...dep_markmapToc }),
        Number("DOWNLOAD_OPTIONS.PADDING_HORIZONTAL", { unit: UNITS.pixel, min: 1, step: 1, ...dep_markmapToc }),
        Number("DOWNLOAD_OPTIONS.PADDING_VERTICAL", { unit: UNITS.pixel, min: 1, step: 1, ...dep_markmapToc }),
        Number("DOWNLOAD_OPTIONS.IMAGE_SCALE", { min: 0.1, step: 0.1, ...dep_markmapToc }),
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
        Number("DEFAULT_FENCE_OPTIONS.maxWidth", { tooltip: "zero", unit: UNITS.pixel, min: 0, max: 1000, step: 10, ...dep_markmapFence }),
        Number("DEFAULT_FENCE_OPTIONS.nodeMinHeight", { unit: UNITS.pixel, min: 5, max: 50, step: 1, ...dep_markmapFence }),
        Number("DEFAULT_FENCE_OPTIONS.spacingHorizontal", { unit: UNITS.pixel, min: 0, max: 200, step: 1, ...dep_markmapFence }),
        Number("DEFAULT_FENCE_OPTIONS.spacingVertical", { unit: UNITS.pixel, min: 0, max: 200, step: 1, ...dep_markmapFence }),
        Number("DEFAULT_FENCE_OPTIONS.paddingX", { unit: UNITS.pixel, min: 0, max: 100, step: 1, ...dep_markmapFence }),
        Number("DEFAULT_FENCE_OPTIONS.duration", { unit: UNITS.millisecond, min: 0, max: 1000, step: 10, ...dep_markmapFence }),
        Text("DEFAULT_FENCE_OPTIONS.height", dep_markmapFence),
        Text("DEFAULT_FENCE_OPTIONS.backgroundColor", dep_markmapFence),
    ),
    ArrayBox("DEFAULT_FENCE_OPTIONS.color", dep_markmapFence),
    TextareaBox("FENCE_TEMPLATE", dep_markmapFence),
    box_settingHandler,
]

const conf_auto_number = [
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
    UntitledBox(
        Text("FONT_FAMILY"),
        Switch("SHOW_IMAGE_NAME", { dependencies: { ENABLE_IMAGE: true } }),
        Select("POSITION_TABLE", OPTIONS.auto_number.POSITION_TABLE, { dependencies: { ENABLE_TABLE: true } }),
        Select("ALIGN", OPTIONS.auto_number.ALIGN, { dependencies: { $or: [{ ENABLE_IMAGE: true }, { ENABLE_TABLE: true }, { ENABLE_FENCE: true }] } }),
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
    TextareaBox("APPLY_EXPORT_HEADER_NUMBERING", { rows: 12, dependencies: { ENABLE_WHEN_EXPORT: true } }),
    box_settingHandler,
]

const conf_fence_enhance = [
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
        Number("WAIT_RECOVER_INTERVAL", { unit: UNITS.millisecond, min: 500, step: 100, ...dep_fenceEnhanceButton }),
    ),
    TitledBox(
        "functionButtons",
        Switch("ENABLE_COPY", dep_fenceEnhanceButton),
        Switch("TRIM_WHITESPACE_ON_COPY", { dependencies: { ENABLE_BUTTON: true, ENABLE_COPY: true } }),
        Switch("COPY_AS_MARKDOWN", { dependencies: { $follow: "TRIM_WHITESPACE_ON_COPY" } }),
        Select("LINE_BREAKS_ON_COPY", OPTIONS.fence_enhance.LINE_BREAKS_ON_COPY, { dependencies: { $follow: "TRIM_WHITESPACE_ON_COPY" } }),
    ),
    UntitledBox(
        Switch("ENABLE_INDENT", dep_fenceEnhanceButton),
        Array_Inline("EXCLUDE_LANGUAGE_ON_INDENT", { dependencies: { ENABLE_BUTTON: true, ENABLE_INDENT: true } }),
    ),
    UntitledBox(
        Switch("ENABLE_FOLD", dep_fenceEnhanceButton),
        Select("FOLD_OVERFLOW", OPTIONS.fence_enhance.FOLD_OVERFLOW, { dependencies: { ENABLE_BUTTON: true, ENABLE_FOLD: true } }),
        Number("MANUAL_FOLD_LINES", { unit: UNITS.line, min: 1, step: 1, dependencies: { $follow: "FOLD_OVERFLOW" } }),
        Switch("DEFAULT_FOLD", { dependencies: { $follow: "FOLD_OVERFLOW" } }),
        Switch("EXPAND_ON_FOCUS", { dependencies: { $follow: "DEFAULT_FOLD_THRESHOLD" } }),
        Switch("FOLD_ON_BLUR", { dependencies: { $follow: "DEFAULT_FOLD_THRESHOLD" } }),
        Number("DEFAULT_FOLD_THRESHOLD", { unit: UNITS.line, min: 0, step: 1, dependencies: { $and: [{ $follow: "FOLD_OVERFLOW" }, { DEFAULT_FOLD: true }] } }),
        Number("AUTO_FOLD_LINES", { unit: UNITS.line, min: 1, step: 1, dependencies: { $follow: "DEFAULT_FOLD_THRESHOLD" } }),
    ),
    TableBox(
        "CUSTOM_BUTTONS",
        ["HINT", "ICON"],
        [
            UntitledBox(
                Switch("DISABLE"),
                Text("ICON"),
                Text("HINT"),
            ),
            TextareaBox("ON_INIT", { rows: 3 }),
            TextareaBox("ON_RENDER", { rows: 3 }),
            TextareaBox("ON_CLICK", { rows: 3 }),
        ],
        {
            DISABLE: false,
            ICON: "fa fa-bomb",
            HINT: "",
            ON_INIT: "plu => console.log('The button has been initialized')",
            ON_RENDER: "({ btn, fence, cid, enhance }) => console.log('The button has been rendered')",
            ON_CLICK: "({ ev, btn, cont, fence, cm, cid, plu }) => console.log('The button has been clicked')",
        },
        dep_fenceEnhanceButton,
    ),
    TitledBox(
        "buttonHotkeys",
        Switch("ENABLE_HOTKEY"),
        Text("SWAP_PREVIOUS_LINE", { tooltip: "codeMirrorStyle", ...dep_fenceEnhanceHotkey }),
        Text("SWAP_NEXT_LINE", dep_fenceEnhanceHotkey),
        Text("COPY_PREVIOUS_LINE", dep_fenceEnhanceHotkey),
        Text("COPY_NEXT_LINE", dep_fenceEnhanceHotkey),
        Text("INSERT_LINE_PREVIOUS", dep_fenceEnhanceHotkey),
        Text("INSERT_LINE_NEXT", dep_fenceEnhanceHotkey),
        Action("viewCodeMirrorKeymapsManual"),
    ),
    TableBox(
        "CUSTOM_HOTKEYS",
        ["HOTKEY", "CALLBACK"],
        [
            UntitledBox(
                Switch("DISABLE"),
                Text("HOTKEY"),
            ),
            TextareaBox("CALLBACK", { rows: 5 }),
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
        Switch("HIGHLIGHT_BY_LANGUAGE"),
        Switch("HIGHLIGHT_WHEN_HOVER"),
        Select("NUMBERING_BASE", OPTIONS.fence_enhance.NUMBERING_BASE, { dependencies: { HIGHLIGHT_BY_LANGUAGE: true } }),
        Text("HIGHLIGHT_PATTERN", { dependencies: { $follow: "NUMBERING_BASE" } }),
        Text("HIGHLIGHT_LINE_COLOR", { dependencies: { $or: [{ $follow: "NUMBERING_BASE" }, { HIGHLIGHT_WHEN_HOVER: true }] } }),
        Action("viewVitePressLineHighlighting"),
    ),
    TitledBox(
        "advanced",
        Switch("ENABLE_LANGUAGE_FOLD"),
        Switch("INDENTED_WRAPPED_LINE"),
        Switch("PRELOAD_ALL_FENCES", { tooltip: "dangerous" }),
    ),
    box_settingHandler,
]

const conf_collapse_paragraph = [
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

const conf_collapse_list = [
    box_basePluginLite,
    UntitledBox(
        Switch("RECORD_COLLAPSE"),
        Text("TRIANGLE_COLOR"),
    ),
    box_settingHandler,
]

const conf_collapse_table = [
    box_basePluginLite,
    UntitledBox(
        Switch("RECORD_COLLAPSE"),
    ),
    box_settingHandler,
]

const conf_truncate_text = [
    box_basePluginLite,
    TitledBox(
        "hotkey",
        Hotkey("HIDE_FRONT_HOTKEY"),
        Hotkey("HIDE_BASE_VIEW_HOTKEY"),
        Hotkey("SHOW_ALL_HOTKEY"),
        Number("REMAIN_LENGTH", { min: 1, dependencies: { $or: [{ HIDE_FRONT_HOTKEY: { $bool: true } }, { HIDE_BASE_VIEW_HOTKEY: { $bool: true } }] } }),
    ),
    box_settingHandler,
]

const conf_export_enhance = [
    box_basePluginLite,
    UntitledBox(
        Switch("DOWNLOAD_NETWORK_IMAGE"),
        Number("DOWNLOAD_THREADS", { min: 1, dependencies: { DOWNLOAD_NETWORK_IMAGE: true } }),
    ),
    box_settingHandler,
]

const conf_text_stylize = [
    UntitledBox(
        field_ENABLE,
        field_NAME,
        Hotkey("SHOW_MODAL_HOTKEY"),
    ),
    TitledBox(
        "toolBar",
        Text("MODAL_BACKGROUND_COLOR"),
        Select("TOOLS", OPTIONS.text_stylize.TOOLS, { minItems: 1 }),
    ),
    TableBox(
        "ACTION_HOTKEYS",
        ["hotkey", "action"],
        [
            UntitledBox(
                Hotkey("hotkey"),
                Select("action", OPTIONS.text_stylize.TOOLS),
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
    ObjectBox("COLOR_TABLE"),
    box_settingHandler,
]

const conf_cipher = [
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

const conf_resource_manager = [
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
        Number("TIMEOUT", { unit: UNITS.millisecond, min: 1 }),
        Number("MAX_STATS", { tooltip: "minusOneMeansUnlimited", min: -1 }),
        Number("MAX_DEPTH", { tooltip: "minusOneMeansUnlimited", min: -1 }),
        Number("CONCURRENCY_LIMIT", { min: 1 }),
    ),
    box_settingHandler,
]

const conf_easy_modify = [
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

const conf_custom = [
    UntitledBox(
        Switch("ENABLE", prop_protected),
        field_NAME,
    ),
    UntitledBox(
        Switch("HIDE_DISABLE_PLUGINS"),
    ),
    box_settingHandler,
]

const conf_slash_commands = [
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
                Number("cursorOffset.0"),
                Number("cursorOffset.1"),
            ),
            TextareaBox("callback", { rows: 5, placeholder: "callbackType" }),
        ],
        {
            enable: true,
            type: "snippet",
            scope: "plain",
            keyword: "",
            icon: "",
            hint: "",
            cursorOffset: [0, 0],
            callback: "",
        },
    ),
    box_settingHandler,
]

const conf_right_click_menu = [
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
            ObjectBox("LIST", { rows: 10 }),
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

const conf_pie_menu = [
    box_basePluginFull,
    UntitledBox(
        Hotkey("MODIFIER_KEY", { tooltip: "example" }),
    ),
    TableBox(
        "BUTTONS",
        ["CALLBACK", "ICON"],
        [
            UntitledBox(
                Text("ICON"),
                Text("CALLBACK"),
            ),
        ],
        {
            ICON: "",
            CALLBACK: "",
        },
    ),
    box_settingHandler,
]

const conf_preferences = [
    UntitledBox(
        Switch("ENABLE", prop_protected),
        field_NAME,
        field_HOTKEY,
    ),
    UntitledBox(
        Switch("SEARCH_PLUGIN_FIXEDNAME"),
        Select("DEFAULT_MENU"),
        Select("HIDE_MENUS"),
    ),
    UntitledBox(
        Switch("VALIDATE_CONFIG_OPTIONS", prop_protected),
        Select("DEPENDENCIES_FAILURE_BEHAVIOR", OPTIONS.preferences.DEPENDENCIES_FAILURE_BEHAVIOR),
        Select("OBJECT_SETTINGS_FORMAT", OPTIONS.preferences.OBJECT_SETTINGS_FORMAT),
    ),
    TextareaBox("FORM_RENDERING_HOOK", { rows: 3, readonly: true }),
    box_settingHandler,
]

const conf_file_counter = [
    box_basePluginLite,
    TitledBox(
        "textStyle",
        Text("FONT_WEIGHT"),
        Text("COLOR"),
        Text("BACKGROUND_COLOR"),
        Text("BEFORE_TEXT"),
    ),
    TitledBox(
        "mouseInteraction",
        Switch("CTRL_WHEEL_TO_SCROLL_SIDEBAR_MENU"),
    ),
    ArrayBox("ALLOW_EXT"),
    ArrayBox("IGNORE_FOLDERS"),
    TitledBox(
        "advanced",
        Switch("FOLLOW_SYMBOLIC_LINKS"),
        Number("IGNORE_MIN_NUM", { tooltip: "ignoreMinNum", min: 1 }),
        Number("MAX_SIZE", { tooltip: "maxBytes", unit: UNITS.byte, min: 1, max: 2000000 }),
        Number("MAX_STATS", { min: 100 }),
        Number("CONCURRENCY_LIMIT", { min: 1 }),
    ),
    box_settingHandler,
]

const conf_hotkeys = [
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
            TextareaBox("evil", { rows: 3 }),
        ],
        {
            enable: true,
            hotkey: "",
            desc: "",
            plugin: "",
            function: "",
            closestSelector: "",
            evil: "",
        },
    ),
    box_settingHandler,
]

const conf_editor_width_slider = [
    box_basePluginLite,
    UntitledBox(
        Number("WIDTH_RATIO", { tooltip: "minusOneMeansDisable", unit: UNITS.percent, min: -1, max: 100, step: 1 }),
    ),
    box_settingHandler,
]

const conf_article_uploader = [
    box_basePluginLite,
    UntitledBox(
        Switch("HIDE"),
    ),
    TitledBox(
        "hotkey",
        Hotkey("UPLOAD_ALL_HOTKEY", { dependencies: { $or: [{ "upload.cnblog.enabled": true }, { "upload.wordpress.enabled": true }, { "upload.csdn.enabled": true }] } }),
        Hotkey("UPLOAD_CNBLOG_HOTKEY", { dependencies: { "upload.cnblog.enabled": true } }),
        Hotkey("UPLOAD_WORDPRESS_HOTKEY", { dependencies: { "upload.wordpress.enabled": true } }),
        Hotkey("UPLOAD_CSDN_HOTKEY", { dependencies: { "upload.csdn.enabled": true } }),
    ),
    TitledBox(
        "upload",
        Switch("upload.reconfirm"),
        Switch("upload.selenium.headless"),
    ),
    TitledBox(
        "wordPress",
        Switch("upload.wordpress.enabled"),
        Text("upload.wordpress.hostname", { dependencies: { "upload.wordpress.enabled": true } }),
        Text("upload.wordpress.loginUrl", { dependencies: { "upload.wordpress.enabled": true } }),
        Text("upload.wordpress.username", { dependencies: { "upload.wordpress.enabled": true } }),
        Password("upload.wordpress.password", { dependencies: { "upload.wordpress.enabled": true } }),
    ),
    TitledBox(
        "cnblog",
        Switch("upload.cnblog.enabled"),
        Text("upload.cnblog.username", { dependencies: { "upload.cnblog.enabled": true } }),
        Password("upload.cnblog.password", { dependencies: { "upload.cnblog.enabled": true } }),
    ),
    TitledBox(
        "csdn",
        Switch("upload.csdn.enabled"),
        Text("upload.csdn.cookie", { dependencies: { "upload.csdn.enabled": true } }),
    ),
    UntitledBox(
        Action("viewArticleUploaderReadme"),
    ),
    box_settingHandler,
]

const conf_ripgrep = [
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

const conf_static_markers = [
    box_basePluginFull,
    CheckboxBox("STATIC_MARKERS", OPTIONS.static_markers.STATIC_MARKERS, { columns: 4 }),
    box_settingHandler,
]

const conf_sidebar_enhance = [
    box_basePluginLite,
    UntitledBox(
        Switch("KEEP_OUTLINE_FOLD_STATE", { tooltip: "canCollapseOutlinePanel" }),
        Switch("SORTABLE_OUTLINE"),
    ),
    UntitledBox(
        Switch("DISPLAY_NON_MARKDOWN_FILES"),
        Array_Inline("SUPPORTED_FILE_EXT", { dependencies: { DISPLAY_NON_MARKDOWN_FILES: true } }),
    ),
    box_settingHandler,
]

const conf_cursor_history = [
    box_basePluginLite,
    TitledBox(
        "hotkey",
        Hotkey("HOTKEY_GO_FORWARD"),
        Hotkey("HOTKEY_GO_BACK"),
    ),
    UntitledBox(
        Number("MAX_HISTORY_ENTRIES", { min: 1, step: 1 }),
    ),
    box_settingHandler,
]

const conf_json_rpc = [
    box_basePluginLite,
    TitledBox(
        "rpcServer",
        Switch("SERVER_OPTIONS.strict"),
        Text("SERVER_OPTIONS.host"),
        Number("SERVER_OPTIONS.port", { min: 0, max: 65535, step: 1 }),
        Text("SERVER_OPTIONS.path"),
    ),
    UntitledBox(
        Action("viewJsonRPCReadme"),
    ),
    box_settingHandler,
]

const conf_updater = [
    box_basePluginFull,
    UntitledBox(
        Number("NETWORK_REQUEST_TIMEOUT", { unit: UNITS.millisecond, min: 30000 }),
        Text("PROXY"),
    ),
    TitledBox(
        "autoUpdate",
        Switch("AUTO_UPDATE"),
        Number("UPDATE_LOOP_INTERVAL", { tooltip: "loopInterval", unit: UNITS.millisecond, min: -1, dependencies: { AUTO_UPDATE: true } }),
        Number("START_UPDATE_INTERVAL", { tooltip: "waitInterval", unit: UNITS.millisecond, min: -1, dependencies: { AUTO_UPDATE: true } }),
    ),
    box_settingHandler,
]

const conf_test = [
    box_basePluginLite,
    box_settingHandler,
]

const conf_kanban = [
    box_customPluginLite,
    TitledBox(
        "fence",
        Text("LANGUAGE", prop_protected),
        Switch("INTERACTIVE_MODE"),
        Switch("STRICT_MODE"),
    ),
    TitledBox(
        "kanbanStyle",
        Number("KANBAN_WIDTH", { unit: UNITS.pixel, min: 1 }),
        Number("KANBAN_MAX_HEIGHT", { unit: UNITS.pixel, min: 1 }),
        Number("KANBAN_TASK_DESC_MAX_HEIGHT", { tooltip: "minusOneMeansShowAll", unit: UNITS.em, min: -1 }),
        Switch("HIDE_DESC_WHEN_EMPTY"),
        Switch("WRAP"),
        Switch("CTRL_WHEEL_TO_SWITCH"),
        Switch("ALLOW_MARKDOWN_INLINE_STYLE"),
    ),
    ArrayBox("KANBAN_COLOR"),
    ArrayBox("TASK_COLOR"),
    TextareaBox("TEMPLATE"),
    box_settingHandler,
]

const conf_chat = [
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
    TextareaBox("TEMPLATE"),
    box_settingHandler,
]

const conf_timeline = [
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
    TextareaBox("TEMPLATE"),
    box_settingHandler,
]

const conf_echarts = [
    box_customPluginLite,
    box_langMode,
    box_chartStyle,
    TextareaBox("TEMPLATE"),
    TitledBox(
        "advanced",
        Select("RENDERER", OPTIONS.echarts.RENDERER, { tooltip: "svgBetter" }),
        Select("EXPORT_TYPE", OPTIONS.echarts.EXPORT_TYPE),
        Action("chooseEchartsRenderer"),
    ),
    box_settingHandler,
]

const conf_chart = [
    box_customPluginLite,
    box_langMode,
    box_chartStyle,
    TextareaBox("TEMPLATE"),
    box_settingHandler,
]

const conf_wavedrom = [
    box_customPluginLite,
    TitledBox(
        "fenceLanguageMode",
        Text("LANGUAGE", prop_protected),
        Switch("INTERACTIVE_MODE"),
        Switch("SAFE_MODE"),
    ),
    box_chartStyle,
    TextareaBox("TEMPLATE"),
    ArrayBox("SKIN_FILES"),
    UntitledBox(
        Action("downloadWaveDromSkins"),
    ),
    box_settingHandler,
]

const conf_calendar = [
    box_customPluginLite,
    box_langMode,
    box_chartStyle,
    TextareaBox("TEMPLATE"),
    box_settingHandler,
]

const conf_abc = [
    box_customPluginLite,
    box_langMode,
    box_chartStyle,
    TextareaBox("TEMPLATE"),
    ObjectBox("VISUAL_OPTIONS", { rows: 5 }),
    UntitledBox(
        Action("viewAbcVisualOptionsHelp"),
    ),
    box_settingHandler,
]

const conf_drawIO = [
    box_customPluginLite,
    box_langMode,
    box_chartStyle,
    TextareaBox("TEMPLATE"),
    TitledBox(
        "advanced",
        Text("RESOURCE_URI"),
        Number("SERVER_TIMEOUT", { unit: UNITS.millisecond, min: 1000 }),
        Number("MEMORIZED_URL_COUNT", { min: 1 }),
    ),
    box_settingHandler,
]

const conf_plantUML = [
    box_customPluginLite,
    UntitledBox(
        Text("SERVER_URL"),
        Select("OUTPUT_FORMAT", OPTIONS.plantUML.OUTPUT_FORMAT),
        Number("SERVER_TIMEOUT", { unit: UNITS.millisecond, min: 1000 }),
        Number("MEMORIZED_URL_COUNT", { min: 1 }),
        Action("installPlantUMLServer"),
    ),
    box_langMode,
    box_chartStyle,
    TextareaBox("TEMPLATE"),
    box_settingHandler,
]

const conf_marp = [
    box_customPluginLite,
    box_langMode,
    ObjectBox("MARP_CORE_OPTIONS", { rows: 5 }),
    TextareaBox("TEMPLATE"),
    box_settingHandler,
]

const conf_callouts = [
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
        Text("network_icon_url", { dependencies: { use_network_icon_when_exporting: true } }),
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
    TextareaBox("template", { rows: 5 }),
    box_settingHandler,
]

const conf_templater = [
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
            TextareaBox("callback", { rows: 5 }),
        ],
        {
            enable: true,
            name: "",
            callback: "",
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

const conf_chineseSymbolAutoPairer = [
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

const conf_toc = [
    box_customPluginFull,
    UntitledBox(
        Switch("default_show_toc"),
        Switch("remove_header_styles"),
        Switch("sortable"),
        Switch("right_click_outline_button_to_toggle"),
    ),
    TitledBox(
        "tocStyle",
        Select("title_bar_buttons", OPTIONS.toc.title_bar_buttons),
        Range("width_percent_when_pin_right", prop_percent),
        Text("toc_font_size"),
    ),
    TitledBox(
        "displayHeader",
        Switch("include_headings.fence", { dependencies: { title_bar_buttons: { $contains: "fence" } } }),
        Switch("include_headings.image", { dependencies: { title_bar_buttons: { $contains: "image" } } }),
        Switch("include_headings.table", { dependencies: { title_bar_buttons: { $contains: "table" } } }),
        Switch("include_headings.link", { dependencies: { title_bar_buttons: { $contains: "link" } } }),
        Switch("include_headings.math", { dependencies: { title_bar_buttons: { $contains: "math" } } }),
    ),
    box_settingHandler,
]

const conf_scrollBookmarker = [
    box_customPluginFull,
    UntitledBox(
        Hotkey("modifier_key", { tooltip: "modifierKeyExample" }),
        Switch("auto_popup_modal"),
    ),
    box_settingHandler,
]

const conf_imageReviewer = [
    box_customPluginFull,
    TitledBox(
        "style",
        Range("mask_background_opacity", { min: 0, max: 1, step: 0.05 }),
        Range("image_max_width", prop_percent),
        Range("image_max_height", prop_percent),
        Text("thumbnail_height"),
        Number("blur_level", { unit: UNITS.pixel, min: 1 }),
        Number("thumbnail_scroll_padding_count", { min: 0 }),
        Number("water_fall_columns", { min: 0 }),
    ),
    TitledBox(
        "component",
        Switch("show_thumbnail_nav"),
        Select("tool_position", OPTIONS.imageReviewer.tool_position),
        Select("show_message", OPTIONS.imageReviewer.show_message),
        Select("tool_function", OPTIONS.imageReviewer.operations, { minItems: 1 }),
    ),
    TitledBox(
        "behavior",
        Switch("filter_error_image"),
        Select("first_image_strategies", OPTIONS.imageReviewer.first_image_strategies, { minItems: 1 }),
        Select("thumbnail_object_fit", OPTIONS.imageReviewer.thumbnail_object_fit),
        Number("play_second", { unit: UNITS.second, min: 1 }),
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
                Hotkey("0"),
                Select("1", OPTIONS.imageReviewer.operations),
            ),
        ],
        ["", "nextImage"],
    ),
    TitledBox(
        "adjustScale",
        Number("zoom_scale", { min: 0.01 }),
        Number("rotate_scale", { unit: UNITS.degree, min: 1 }),
        Number("skew_scale", { unit: UNITS.degree, min: 1 }),
        Number("translate_scale", { unit: UNITS.pixel, min: 1 }),
    ),
    box_settingHandler,
]

const conf_markdownLint = [
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
        Switch("right_click_button_to_fix", { dependencies: { use_button: true } }),
        Text("button_width", { dependencies: { use_button: true } }),
        Text("button_height", { dependencies: { use_button: true } }),
        Text("button_right", { dependencies: { use_button: true } }),
        Text("button_border_radius", { dependencies: { use_button: true } }),
        Range("button_opacity", { min: 0, max: 1, step: 0.05, dependencies: { use_button: true } }),
        Color("pass_color", { dependencies: { use_button: true } }),
        Color("error_color", { dependencies: { use_button: true } }),
    ),
    ObjectBox("rule_config", { rows: 10 }),
    ArrayBox("custom_rule_files"),
    UntitledBox(
        Action("viewMarkdownlintRules"),
        Action("viewCustomMarkdownlintRules"),
    ),
    box_settingHandler,
]

const conf_quickButton = [
    box_customPluginFull,
    TitledBox(
        "buttonStyle",
        Text("button_size"),
        Text("button_border_radius"),
        Text("button_box_shadow"),
        Text("button_gap"),
        Text("position_right"),
        Text("position_bottom"),
    ),
    UntitledBox(
        Switch("support_right_click"),
        Switch("hide_button_hint"),
    ),
    TableBox(
        "buttons",
        ["coordinate", "icon"],
        [
            UntitledBox(
                Switch("disable"),
                Number("coordinate.0", { tooltip: "buttons.coordinate.0", min: 0 }),
                Number("coordinate.1", { tooltip: "buttons.coordinate.1", min: 0 }),
                Text("icon"),
                Text("size"),
                Text("color"),
                Text("bgColor"),
                Text("hint"),
                Text("callback", { tooltip: "exclusive", dependencies: { evil: { $bool: false } } }),
            ),
            TextareaBox("evil", { placeholder: "customCallback", rows: 5, dependencies: { callback: { $bool: false } } }),
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

const conf_blockSideBySide = [
    box_customPluginFull,
    box_settingHandler,
]

const conf_redirectLocalRootUrl = [
    box_customPluginLite,
    UntitledBox(
        Text("root"),
        Text("filter_regexp"),
    ),
    box_settingHandler,
]

const SETTING_SCHEMAS = {
    global: conf_global,
    window_tab: conf_window_tab,
    search_multi: conf_search_multi,
    commander: conf_commander,
    md_padding: conf_md_padding,
    read_only: conf_read_only,
    blur: conf_blur,
    dark: conf_dark,
    no_image: conf_no_image,
    toolbar: conf_toolbar,
    resize_image: conf_resize_image,
    resize_table: conf_resize_table,
    datatables: conf_datatables,
    go_top: conf_go_top,
    markmap: conf_markmap,
    auto_number: conf_auto_number,
    fence_enhance: conf_fence_enhance,
    collapse_paragraph: conf_collapse_paragraph,
    collapse_list: conf_collapse_list,
    collapse_table: conf_collapse_table,
    truncate_text: conf_truncate_text,
    export_enhance: conf_export_enhance,
    text_stylize: conf_text_stylize,
    cipher: conf_cipher,
    resource_manager: conf_resource_manager,
    easy_modify: conf_easy_modify,
    custom: conf_custom,
    slash_commands: conf_slash_commands,
    right_click_menu: conf_right_click_menu,
    pie_menu: conf_pie_menu,
    preferences: conf_preferences,
    file_counter: conf_file_counter,
    hotkeys: conf_hotkeys,
    editor_width_slider: conf_editor_width_slider,
    article_uploader: conf_article_uploader,
    ripgrep: conf_ripgrep,
    static_markers: conf_static_markers,
    sidebar_enhance: conf_sidebar_enhance,
    cursor_history: conf_cursor_history,
    json_rpc: conf_json_rpc,
    updater: conf_updater,
    test: conf_test,
    kanban: conf_kanban,
    chat: conf_chat,
    timeline: conf_timeline,
    echarts: conf_echarts,
    chart: conf_chart,
    wavedrom: conf_wavedrom,
    calendar: conf_calendar,
    abc: conf_abc,
    drawIO: conf_drawIO,
    plantUML: conf_plantUML,
    marp: conf_marp,
    callouts: conf_callouts,
    templater: conf_templater,
    chineseSymbolAutoPairer: conf_chineseSymbolAutoPairer,
    toc: conf_toc,
    scrollBookmarker: conf_scrollBookmarker,
    imageReviewer: conf_imageReviewer,
    markdownLint: conf_markdownLint,
    quickButton: conf_quickButton,
    blockSideBySide: conf_blockSideBySide,
    redirectLocalRootUrl: conf_redirectLocalRootUrl,
}

const I18N = (schemas, i18n = require("../global/core/i18n").data) => {
    const PREFIX_MAP = {
        label: "$label",
        tooltip: "$tooltip",
        placeholder: "$placeholder",
        hintHeader: "$hintHeader",
        hintDetail: "$hintDetail",
        unit: "$unit",
        title: "$title",
        option: "$option",
    }

    const translateBox = (box, translate) => {
        const newBox = { ...box }
        if (newBox.title != null) {
            newBox.title = translate(`${PREFIX_MAP.title}.${newBox.title}`)
        }
        if (newBox.fields) {
            newBox.fields = newBox.fields.map(field => {
                const newField = { ...field }
                Object.entries(PREFIX_MAP).forEach(([prop, prefix]) => {
                    if (prop !== "title" && prop !== "option" && newField[prop] != null) {
                        newField[prop] = translate(`${prefix}.${newField[prop]}`)
                    }
                })
                if (newField.options && typeof newField.options === "object" && !Array.isArray(newField.options)) {
                    newField.options = Object.fromEntries(
                        Object.entries(newField.options).map(([k, v]) => [k, translate(`${PREFIX_MAP.option}.${v}`)])
                    )
                }
                if (newField.thMap && typeof newField.thMap === "object") {
                    newField.thMap = Object.fromEntries(
                        Object.entries(newField.thMap).map(([k, v]) => [k, translate(`${PREFIX_MAP.label}.${v}`)])
                    )
                }
                if (newField.nestedBoxes != null) {
                    newField.nestedBoxes = newField.nestedBoxes.map(box => translateBox(box, translate))
                }
                return newField
            })
        }
        return newBox
    }

    return Object.fromEntries(
        Object.entries(schemas).map(([fixedName, boxes]) => {
            const translate = (key) => i18n[fixedName]?.[key] || i18n.settings?.[key] || key
            const translatedBoxes = boxes.map(box => translateBox(box, translate))
            return [fixedName, translatedBoxes]
        })
    )
}

module.exports = I18N(SETTING_SCHEMAS)
