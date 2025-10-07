const Label = (key) => key ? `$label.${key}` : undefined
const Tooltip = (tooltip) => tooltip ? `$tooltip.${tooltip}` : undefined
const Placeholder = (placeholder) => placeholder ? `$placeholder.${placeholder}` : undefined
const HintHeader = (header) => header ? `$hintHeader.${header}` : undefined
const HintDetail = (detail) => detail ? `$hintDetail.${detail}` : undefined

const Action = (key) => {
    const label = Label(key)
    return { type: "action", key, label }
}
const Static = (key) => {
    const label = Label(key)
    return { type: "static", key, label }
}
const Hint = (header, detail, unsafe = false) => {
    const hintHeader = HintHeader(header)
    const hintDetail = HintDetail(detail)
    return { type: "hint", hintHeader, hintDetail, unsafe }
}
const Custom = (content, unsafe = false) => {
    return { type: "custom", content, unsafe }
}
const Switch = (key, { tooltip, disabled, dependencies, ...args } = {}) => {
    const label = Label(key)
    tooltip = Tooltip(tooltip)
    return { type: "switch", key, label, tooltip, disabled, dependencies, ...args }
}
const Text = (key, { tooltip, placeholder, disabled, dependencies, ...args } = {}) => {
    const label = Label(key)
    tooltip = Tooltip(tooltip)
    placeholder = Placeholder(placeholder)
    return { type: "text", key, label, tooltip, placeholder, disabled, dependencies, ...args }
}
const Color = (key, { tooltip, disabled, dependencies, ...args } = {}) => {
    const label = Label(key)
    tooltip = Tooltip(tooltip)
    return { type: "color", key, label, tooltip, disabled, dependencies, ...args }
}
const Hotkey = (key, { tooltip, placeholder, disabled, dependencies, ...args } = {}) => {
    const label = Label(key)
    tooltip = Tooltip(tooltip)
    placeholder = Placeholder(placeholder)
    return { type: "hotkey", key, label, tooltip, placeholder, disabled, dependencies, ...args }
}
const Number = (key, { tooltip, unit, min, max, step, dependencies, ...args } = {}) => {
    const label = Label(key)
    tooltip = Tooltip(tooltip)
    const type = unit ? "unit" : "number"
    return { type, key, unit, min, max, step, label, tooltip, dependencies, ...args }
}
const Range = (key, { tooltip, min, max, step, dependencies, ...args } = {}) => {
    const label = Label(key)
    tooltip = Tooltip(tooltip)
    return { type: "range", key, min, max, step, label, tooltip, dependencies, ...args }
}
const Select = (key, options, { tooltip, minItems, maxItems, dependencies, ...args } = {}) => {
    const label = Label(key)
    tooltip = Tooltip(tooltip)
    return { type: "select", key, label, tooltip, options, minItems, maxItems, dependencies, ...args }
}
const Array_Inline = (key, { tooltip, dependencies, ...args } = {}) => {
    const label = Label(key)
    tooltip = Tooltip(tooltip)
    return { type: "array", isBlockLayout: false, key, label, tooltip, dependencies, ...args }
}
const Radio_Inline = (key, options, { tooltip, dependencies, ...args } = {}) => {
    const label = Label(key)
    tooltip = Tooltip(tooltip)
    return { type: "radio", isBlockLayout: false, key, label, tooltip, options, dependencies, ...args }
}
const Checkbox_Inline = (key, options, { tooltip, minItems, maxItems, dependencies, ...args } = {}) => {
    const label = Label(key)
    tooltip = Tooltip(tooltip)
    return { type: "checkbox", isBlockLayout: false, key, label, tooltip, options, minItems, maxItems, dependencies, ...args }
}
const Composite = (key, subSchema, defaultValues, { tooltip, disabled, dependencies, ...args } = {}) => {
    const label = Label(key)
    tooltip = Tooltip(tooltip)
    return { type: "composite", key, label, subSchema, defaultValues, tooltip, disabled, dependencies, ...args }
}

const Title = (title) => `$title.${title}`
const UntitledBox = (...fields) => ({ title: undefined, fields })
const TitledBox = (title, ...fields) => ({ title, fields })

const ObjectBox = (key, { rows = 10, dependencies, ...args } = {}) => {
    return TitledBox(Title(key), { type: "object", key, rows, dependencies, ...args })
}
const TextareaBox = (key, { rows = 10, placeholder, dependencies, ...args } = {}) => {
    placeholder = Placeholder(placeholder)
    return TitledBox(Title(key), { type: "textarea", key, rows, placeholder, dependencies, ...args })
}
const ArrayBox = (key, { dependencies, ...args } = {}) => {
    return TitledBox(Title(key), { type: "array", key, dependencies, ...args })
}
const TableBox = (key, ths, nestedBoxes, defaultValues, { dependencies, ...args } = {}) => {
    const setNamespace = (item, namespace) => item.replace(/^([^.]+)\.(.*)$/, `$1.${namespace}.$2`)
    nestedBoxes.forEach(box => {
        if (box.title) box.title = setNamespace(box.title, key)
        box.fields.forEach(field => {
            if (field.label) field.label = setNamespace(field.label, key)
        })
    })
    const thMap = Object.fromEntries(ths.map(th => [th, `$label.${key}.${th}`]))
    return TitledBox(Title(key), { type: "table", key, nestedBoxes, defaultValues, thMap, dependencies, ...args })
}
const RadioBox = (key, options, { dependencies, ...args } = {}) => {
    return TitledBox(Title(key), { type: "radio", key, options, dependencies, ...args })
}
const CheckboxBox = (key, options, { minItems, maxItems, dependencies, ...args } = {}) => {
    return TitledBox(Title(key), { type: "checkbox", options, key, minItems, maxItems, dependencies, ...args })
}

const prop_ENABLE = Switch("ENABLE")
const prop_NAME = Text("NAME", { placeholder: "defaultIfEmpty" })
const prop_HOTKEY = Hotkey("HOTKEY")
const prop_enable = Switch("enable")
const prop_hide = Switch("hide")
const prop_name = Text("name", { placeholder: "defaultIfEmpty" })
const prop_order = Number("order")
const prop_hotkey = Hotkey("hotkey")

const pluginLiteBasePropBox = UntitledBox(prop_ENABLE, prop_NAME)
const pluginFullBasePropBox = UntitledBox(prop_ENABLE, prop_NAME, prop_HOTKEY)
const customPluginLiteBasePropBox = UntitledBox(prop_enable, prop_hide, prop_name, prop_order)
const customPluginFullBasePropBox = UntitledBox(prop_enable, prop_hide, prop_name, prop_order, prop_hotkey)
const handleSettingsBox = UntitledBox(Action("runtimeSettings"), Action("restoreSettings"))

const protectedAttrs = { tooltip: "protected", disabled: true }
const markmapTocDep = { dependencies: { ENABLE_TOC_MARKMAP: true } }
const markmapFenceDep = { dependencies: { ENABLE_FENCE_MARKMAP: true } }
const fenceEnhanceButtonDep = { dependencies: { ENABLE_BUTTON: true } }
const fenceEnhanceHotkeyDep = { dependencies: { ENABLE_HOTKEY: true } }

const langModeBox = TitledBox(Title("fenceLanguageMode"), Text("LANGUAGE", protectedAttrs), Switch("INTERACTIVE_MODE"))
const chartStyleBox = TitledBox(Title("diagramStyle"), Text("DEFAULT_FENCE_HEIGHT"), Text("DEFAULT_FENCE_BACKGROUND_COLOR"))

const UNITS = {
    byte: "$unit.byte",
    pixel: "$unit.pixel",
    millisecond: "$unit.millisecond",
    second: "$unit.second",
    item: "$unit.item",
    line: "$unit.line",
    percent: "$unit.percent",
    degree: "$unit.degree",
    em: "$unit.em",
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
    auto_number: {
        ALIGN: ["left", "right", "center"],
        POSITION_TABLE: ["before", "after"],
    },
    fence_enhance: {
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
    echarts: {
        RENDERER: ["svg", "canvas"],
        EXPORT_TYPE: ["svg", "png", "jpg"],
    },
    imageReviewer: {
        operations: ["close", "download", "scroll", "play", "location", "nextImage", "previousImage", "firstImage", "lastImage", "thumbnailNav", "waterFall", "zoomIn", "zoomOut", "rotateLeft", "rotateRight", "hFlip", "vFlip", "translateLeft", "translateRight", "translateUp", "translateDown", "incHSkew", "decHSkew", "incVSkew", "decVSkew", "originSize", "fixScreen", "autoSize", "restore", "info", "dummy"],
        tool_position: ["bottom", "top"],
        show_message: ["index", "title", "size"],
        first_image_strategies: ["inViewBoxImage", "closestViewBoxImage", "firstImage"],
        thumbnail_object_fit: ["fill", "contain", "cover", "scale-down"],
    },
    markdownLint: {
        columns: ["idx", "line", "rule", "desc", "ops"],
        tools: ["info", "locate", "fix"],
        result_order_by: ["index", "lineNumber", "ruleName", "ruleDesc"],
    },
}

Object.values(OPTIONS).forEach(obj => {
    Object.entries(obj).forEach(([k, list]) => {
        obj[k] = Object.fromEntries(list.map(e => [e, `$option.${k}.${e}`]))
    })
})

const SETTING_SCHEMAS = {
    global: [
        UntitledBox(
            Switch("ENABLE", protectedAttrs),
            Select("LOCALE", OPTIONS.global.LOCALE),
            Select("EXIT_INTERACTIVE_MODE", OPTIONS.global.EXIT_INTERACTIVE_MODE, { minItems: 1 }),
        ),
        UntitledBox(
            Action("runtimeSettings"),
            Action("openSettingsFolder"),
            Action("backupSettings"),
            Action("restoreSettings"),
            Action("restoreAllSettings"),
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
    ],
    window_tab: [
        pluginLiteBasePropBox,
        TitledBox(
            Title("appearance"),
            Switch("SHOW_TAB_CLOSE_BUTTON"),
            Switch("TRIM_FILE_EXT"),
            Switch("SHOW_DIR_ON_DUPLICATE"),
            Switch("HIDE_WINDOW_TITLE_BAR"),
            Text("TAB_MIN_WIDTH"),
            Text("TAB_MAX_WIDTH"),
            Number("MAX_TAB_NUM", { tooltip: "minusOneMeansUnlimited", min: -1 }),
        ),
        TitledBox(
            Title("behavior"),
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
            Title("mouseInteraction"),
            Switch("CTRL_CLICK_TO_NEW_WINDOW"),
            Switch("WHEEL_TO_SCROLL_TAB_BAR"),
            Switch("CTRL_WHEEL_TO_SWITCH"),
            Switch("MIDDLE_CLICK_TO_CLOSE"),
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
        handleSettingsBox,
    ],
    search_multi: [
        pluginFullBasePropBox,
        TitledBox(
            Title("search"),
            Switch("CASE_SENSITIVE"),
            Switch("OPTIMIZE_SEARCH", { tooltip: "breakOrder" }),
            Switch("STOP_SEARCHING_ON_HIDING"),
        ),
        TitledBox(
            Title("searchResult"),
            Switch("RELATIVE_PATH"),
            Switch("SHOW_EXT"),
            Switch("SHOW_MTIME"),
            Switch("REMOVE_BUTTON_HINT"),
            Number("MAX_HITS", { min: 1 }),
        ),
        TitledBox(
            Title("windowInteraction"),
            Switch("BACKSPACE_TO_HIDE"),
        ),
        ArrayBox("ALLOW_EXT"),
        ArrayBox("IGNORE_FOLDERS"),
        ArrayBox("HIGHLIGHT_COLORS"),
        TitledBox(
            Title("advanced"),
            Switch("FOLLOW_SYMBOLIC_LINKS"),
            Select("TRAVERSE_STRATEGY", OPTIONS.search_multi.TRAVERSE_STRATEGY),
            Number("TIMEOUT", { tooltip: "minusOneMeansUnlimited", unit: UNITS.millisecond, min: -1 }),
            Number("MAX_SIZE", { tooltip: "maxBytes", unit: UNITS.byte, min: 1, max: 2000000 }),
            Number("MAX_STATS", { tooltip: "minusOneMeansUnlimited", min: -1 }),
            Number("MAX_DEPTH", { tooltip: "minusOneMeansUnlimited", min: -1 }),
            Number("CONCURRENCY_LIMIT", { min: 1 }),
        ),
        handleSettingsBox,
    ],
    commander: [
        pluginFullBasePropBox,
        TitledBox(
            Title("cmdDisplay"),
            Select("QUICK_RUN_DISPLAY", OPTIONS.commander.QUICK_RUN_DISPLAY),
            Select("COMMIT_RUN_DISPLAY", OPTIONS.commander.COMMIT_RUN_DISPLAY),
        ),
        TitledBox(
            Title("windowInteraction"),
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
        handleSettingsBox,
    ],
    md_padding: [
        pluginFullBasePropBox,
        ArrayBox("IGNORE_WORDS"),
        ArrayBox("IGNORE_PATTERNS"),
        handleSettingsBox,
    ],
    read_only: [
        pluginFullBasePropBox,
        TitledBox(
            Title("underReadOnly"),
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
        handleSettingsBox,
    ],
    blur: [
        pluginFullBasePropBox,
        UntitledBox(
            Switch("BLUR_DEFAULT"),
            Switch("RESTORE_WHEN_HOVER"),
            Select("BLUR_TYPE", OPTIONS.blur.BLUR_TYPE),
            Number("BLUR_LEVEL", { unit: UNITS.pixel, min: 1, dependencies: { BLUR_TYPE: "blur" } }),
        ),
        handleSettingsBox,
    ],
    dark: [
        pluginFullBasePropBox,
        UntitledBox(
            Switch("DARK_DEFAULT"),
        ),
        handleSettingsBox,
    ],
    no_image: [
        pluginFullBasePropBox,
        UntitledBox(
            Switch("DEFAULT_NO_IMAGE_MODE"),
            Switch("RESHOW_WHEN_HOVER"),
            Number("TRANSITION_DURATION", { unit: UNITS.millisecond, min: 0 }),
            Number("TRANSITION_DELAY", { unit: UNITS.millisecond, min: 0 }),
        ),
        handleSettingsBox,
    ],
    toolbar: [
        pluginFullBasePropBox,
        TitledBox(
            Title("searchBarPosition"),
            Range("TOOLBAR_TOP_PERCENT", { min: 0, max: 100, step: 1 }),
            Range("TOOLBAR_WIDTH_PERCENT", { min: 0, max: 100, step: 1 }),
        ),
        TitledBox(
            Title("input"),
            Select("DEFAULT_TOOL", OPTIONS.toolbar.DEFAULT_TOOL),
            Switch("USE_NEGATIVE_SEARCH"),
            Switch("BACKSPACE_TO_HIDE"),
            Number("DEBOUNCE_INTERVAL", { unit: UNITS.millisecond, min: 10 }),
        ),
        handleSettingsBox,
    ],
    resize_image: [
        pluginLiteBasePropBox,
        TitledBox(
            Title("image"),
            Switch("RECORD_RESIZE"),
            Switch("ALLOW_EXCEED_LIMIT"),
            Select("IMAGE_ALIGN", OPTIONS.resize_image.IMAGE_ALIGN),
        ),
        TitledBox(
            Title("modifierKeys"),
            Hotkey("MODIFIER_KEY.TEMPORARY", { tooltip: "modifyKeyExample" }),
            Hotkey("MODIFIER_KEY.PERSISTENT"),
        ),
        handleSettingsBox,
    ],
    resize_table: [
        pluginLiteBasePropBox,
        UntitledBox(
            Switch("RECORD_RESIZE"),
            Switch("REMOVE_MIN_CELL_WIDTH"),
            Number("DRAG_THRESHOLD", { unit: UNITS.pixel, min: 1 }),
        ),
        handleSettingsBox,
    ],
    datatables: [
        pluginLiteBasePropBox,
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
        handleSettingsBox,
    ],
    go_top: [
        pluginLiteBasePropBox,
        TitledBox(
            Title("hotkey"),
            Hotkey("HOTKEY_GO_TOP"),
            Hotkey("HOTKEY_GO_BOTTOM"),
        ),
        handleSettingsBox,
    ],
    markmap: [
        pluginLiteBasePropBox,
        TitledBox(
            Title("mindmapDiagram"),
            Switch("ENABLE_TOC_MARKMAP"),
            Hotkey("TOC_HOTKEY", markmapTocDep),
            Switch("FIX_SKIPPED_LEVEL_HEADERS", markmapTocDep),
            Switch("REMOVE_HEADER_STYLES", markmapTocDep),
            Switch("AUTO_FIT_WHEN_UPDATE", markmapTocDep),
            Switch("AUTO_FIT_WHEN_FOLD", markmapTocDep),
            Switch("KEEP_FOLD_STATE_WHEN_UPDATE", markmapTocDep),
            Switch("USE_CONTEXT_MENU", markmapTocDep),
            Switch("CLICK_TO_POSITIONING", markmapTocDep),
            Switch("AUTO_COLLAPSE_PARAGRAPH_WHEN_FOLD", { tooltip: "experimental", ...markmapTocDep }),
            Range("POSITIONING_VIEWPORT_HEIGHT", { tooltip: "positioningViewPort", min: 0.1, max: 0.95, step: 0.01, ...markmapTocDep }),
            Range("WIDTH_PERCENT_WHEN_INIT", { min: 20, max: 95, step: 1, ...markmapTocDep }),
            Range("HEIGHT_PERCENT_WHEN_INIT", { min: 20, max: 95, step: 1, ...markmapTocDep }),
            Range("HEIGHT_PERCENT_WHEN_PIN_TOP", { min: 20, max: 95, step: 1, ...markmapTocDep }),
            Range("WIDTH_PERCENT_WHEN_PIN_RIGHT", { min: 20, max: 95, step: 1, ...markmapTocDep }),
            Text("NODE_BORDER_WHEN_HOVER", markmapTocDep),
        ),
        TitledBox(
            Title("mindmapDiagramDefaultOptions"),
            Switch("DEFAULT_TOC_OPTIONS.zoom", markmapTocDep),
            Switch("DEFAULT_TOC_OPTIONS.pan", markmapTocDep),
            Switch("DEFAULT_TOC_OPTIONS.toggleRecursively", markmapTocDep),
            Range("DEFAULT_TOC_OPTIONS.initialExpandLevel", { min: 1, max: 7, step: 1, ...markmapTocDep }),
            Range("DEFAULT_TOC_OPTIONS.colorFreezeLevel", { min: 1, max: 7, step: 1, ...markmapTocDep }),
            Range("DEFAULT_TOC_OPTIONS.fitRatio", { min: 0.5, max: 1, step: 0.01, ...markmapTocDep }),
            Range("DEFAULT_TOC_OPTIONS.maxInitialScale", { min: 0.5, max: 5, step: 0.25, ...markmapTocDep }),
            Number("DEFAULT_TOC_OPTIONS.maxWidth", { tooltip: "zero", unit: UNITS.pixel, min: 0, max: 100, step: 5, ...markmapTocDep }),
            Number("DEFAULT_TOC_OPTIONS.nodeMinHeight", { unit: UNITS.pixel, min: 5, max: 50, step: 1, ...markmapTocDep }),
            Number("DEFAULT_TOC_OPTIONS.spacingHorizontal", { unit: UNITS.pixel, min: 0, max: 100, step: 5, ...markmapTocDep }),
            Number("DEFAULT_TOC_OPTIONS.spacingVertical", { unit: UNITS.pixel, min: 0, max: 100, step: 5, ...markmapTocDep }),
            Number("DEFAULT_TOC_OPTIONS.paddingX", { unit: UNITS.pixel, min: 0, max: 100, step: 5, ...markmapTocDep }),
            Number("DEFAULT_TOC_OPTIONS.duration", { unit: UNITS.millisecond, min: 0, max: 1000, step: 10, ...markmapTocDep }),
        ),
        ArrayBox("DEFAULT_TOC_OPTIONS.color", markmapTocDep),
        ObjectBox("CANDIDATE_COLOR_SCHEMES", markmapTocDep),
        TitledBox(
            Title("mindmapDiagramExport"),
            Switch("DOWNLOAD_OPTIONS.KEEP_ALPHA_CHANNEL", markmapTocDep),
            Switch("DOWNLOAD_OPTIONS.REMOVE_USELESS_CLASSES", markmapTocDep),
            Switch("DOWNLOAD_OPTIONS.REMOVE_FOREIGN_OBJECT", { tooltip: "removeForeignObj", ...markmapTocDep }),
            Switch("DOWNLOAD_OPTIONS.SHOW_PATH_INQUIRY_DIALOG", markmapTocDep),
            Switch("DOWNLOAD_OPTIONS.SHOW_IN_FINDER", markmapTocDep),
            Range("DOWNLOAD_OPTIONS.IMAGE_QUALITY", { tooltip: "pixelImagesOnly", min: 0.01, max: 1, step: 0.01, ...markmapTocDep }),
            Number("DOWNLOAD_OPTIONS.PADDING_HORIZONTAL", { unit: UNITS.pixel, min: 1, step: 1, ...markmapTocDep }),
            Number("DOWNLOAD_OPTIONS.PADDING_VERTICAL", { unit: UNITS.pixel, min: 1, step: 1, ...markmapTocDep }),
            Number("DOWNLOAD_OPTIONS.IMAGE_SCALE", { min: 0.1, step: 0.1, ...markmapTocDep }),
            Text("DOWNLOAD_OPTIONS.FILENAME", markmapTocDep),
            Text("DOWNLOAD_OPTIONS.FOLDER", { tooltip: "tempDir", ...markmapTocDep }),
            Text("DOWNLOAD_OPTIONS.BACKGROUND_COLOR", { tooltip: "jpgFormatOnly", ...markmapTocDep }),
            Text("DOWNLOAD_OPTIONS.TEXT_COLOR", markmapTocDep),
            Text("DOWNLOAD_OPTIONS.OPEN_CIRCLE_COLOR", markmapTocDep),
        ),
        TitledBox(
            Title("fence"),
            Switch("ENABLE_FENCE_MARKMAP"),
            Switch("INTERACTIVE_MODE", markmapFenceDep),
            Hotkey("FENCE_HOTKEY", markmapFenceDep),
            Text("FENCE_LANGUAGE", { ...protectedAttrs, ...markmapFenceDep }),
            Text("DEFAULT_FENCE_HEIGHT", markmapFenceDep),
            Text("DEFAULT_FENCE_BACKGROUND_COLOR", markmapFenceDep),
        ),
        TitledBox(
            Title("fenceDiagramDefaultOptions"),
            Switch("DEFAULT_FENCE_OPTIONS.zoom", markmapFenceDep),
            Switch("DEFAULT_FENCE_OPTIONS.pan", markmapFenceDep),
            Switch("DEFAULT_FENCE_OPTIONS.toggleRecursively", markmapFenceDep),
            Range("DEFAULT_FENCE_OPTIONS.initialExpandLevel", { min: 1, max: 7, step: 1, ...markmapFenceDep }),
            Range("DEFAULT_FENCE_OPTIONS.colorFreezeLevel", { min: 1, max: 7, step: 1, ...markmapFenceDep }),
            Range("DEFAULT_FENCE_OPTIONS.fitRatio", { min: 0.5, max: 1, step: 0.01, ...markmapFenceDep }),
            Range("DEFAULT_FENCE_OPTIONS.maxInitialScale", { min: 0.5, max: 5, step: 0.25, ...markmapFenceDep }),
            Number("DEFAULT_FENCE_OPTIONS.maxWidth", { tooltip: "zero", unit: UNITS.pixel, min: 0, max: 1000, step: 10, ...markmapFenceDep }),
            Number("DEFAULT_FENCE_OPTIONS.nodeMinHeight", { unit: UNITS.pixel, min: 5, max: 50, step: 1, ...markmapFenceDep }),
            Number("DEFAULT_FENCE_OPTIONS.spacingHorizontal", { unit: UNITS.pixel, min: 0, max: 200, step: 1, ...markmapFenceDep }),
            Number("DEFAULT_FENCE_OPTIONS.spacingVertical", { unit: UNITS.pixel, min: 0, max: 200, step: 1, ...markmapFenceDep }),
            Number("DEFAULT_FENCE_OPTIONS.paddingX", { unit: UNITS.pixel, min: 0, max: 100, step: 1, ...markmapFenceDep }),
            Number("DEFAULT_FENCE_OPTIONS.duration", { unit: UNITS.millisecond, min: 0, max: 1000, step: 10, ...markmapFenceDep }),
            Text("DEFAULT_FENCE_OPTIONS.height", markmapFenceDep),
            Text("DEFAULT_FENCE_OPTIONS.backgroundColor", markmapFenceDep),
        ),
        ArrayBox("DEFAULT_FENCE_OPTIONS.color", markmapFenceDep),
        TextareaBox("FENCE_TEMPLATE", markmapFenceDep),
        handleSettingsBox,
    ],
    auto_number: [
        pluginLiteBasePropBox,
        TitledBox(
            Title("autoNumbering"),
            Switch("ENABLE_OUTLINE"),
            Switch("ENABLE_CONTENT"),
            Switch("ENABLE_TOC"),
            Switch("ENABLE_TABLE"),
            Switch("ENABLE_IMAGE"),
            Switch("ENABLE_FENCE"),
        ),
        TitledBox(
            Title("style"),
            Select("ALIGN", OPTIONS.auto_number.ALIGN),
            Text("FONT_FAMILY"),
        ),
        UntitledBox(
            Switch("SHOW_IMAGE_NAME", { dependencies: { ENABLE_IMAGE: true } }),
            Select("POSITION_TABLE", OPTIONS.auto_number.POSITION_TABLE, { dependencies: { ENABLE_TABLE: true } }),
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
        TextareaBox("APPLY_EXPORT_HEADER_NUMBERING", { rows: 12, readonly: true, dependencies: { ENABLE_WHEN_EXPORT: true } }),
        handleSettingsBox,
    ],
    fence_enhance: [
        pluginLiteBasePropBox,
        TitledBox(
            Title("buttonStyle"),
            Switch("ENABLE_BUTTON"),
            Switch("AUTO_HIDE", fenceEnhanceButtonDep),
            Switch("REMOVE_BUTTON_HINT", fenceEnhanceButtonDep),
            Range("BUTTON_OPACITY", { min: 0, max: 1, step: 0.05, ...fenceEnhanceButtonDep }),
            Range("BUTTON_OPACITY_HOVER", { min: 0, max: 1, step: 0.05, ...fenceEnhanceButtonDep }),
            Text("BUTTON_SIZE", fenceEnhanceButtonDep),
            Text("BUTTON_COLOR", fenceEnhanceButtonDep),
            Text("BUTTON_MARGIN", fenceEnhanceButtonDep),
            Text("BUTTON_TOP", fenceEnhanceButtonDep),
            Text("BUTTON_RIGHT", fenceEnhanceButtonDep),
            Number("WAIT_RECOVER_INTERVAL", { unit: UNITS.millisecond, min: 500, step: 100, ...fenceEnhanceButtonDep }),
        ),
        TitledBox(
            Title("buttons"),
            Switch("ENABLE_COPY", fenceEnhanceButtonDep),
        ),
        UntitledBox(
            Switch("ENABLE_INDENT", fenceEnhanceButtonDep),
        ),
        UntitledBox(
            Switch("ENABLE_FOLD", fenceEnhanceButtonDep),
            Select("FOLD_OVERFLOW", OPTIONS.fence_enhance.FOLD_OVERFLOW, { dependencies: { ENABLE_BUTTON: true, ENABLE_FOLD: true } }),
            Number("FOLD_LINES", { unit: UNITS.line, min: 1, step: 1, dependencies: { $follow: "FOLD_OVERFLOW" } }),
            Switch("DEFAULT_FOLD", { dependencies: { $follow: "FOLD_OVERFLOW" } }),
            Switch("EXPAND_ON_FOCUS", { dependencies: { $follow: "DEFAULT_FOLD_THRESHOLD" } }),
            Switch("FOLD_ON_BLUR", { dependencies: { $follow: "DEFAULT_FOLD_THRESHOLD" } }),
            Number("DEFAULT_FOLD_THRESHOLD", { unit: UNITS.line, min: 0, step: 1, dependencies: { $and: [{ $follow: "FOLD_OVERFLOW" }, { DEFAULT_FOLD: true }] } }),
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
            fenceEnhanceButtonDep,
        ),
        TitledBox(
            Title("buttonHotkeys"),
            Switch("ENABLE_HOTKEY"),
            Text("SWAP_PREVIOUS_LINE", { tooltip: "codeMirrorStyle", ...fenceEnhanceHotkeyDep }),
            Text("SWAP_NEXT_LINE", fenceEnhanceHotkeyDep),
            Text("COPY_PREVIOUS_LINE", fenceEnhanceHotkeyDep),
            Text("COPY_NEXT_LINE", fenceEnhanceHotkeyDep),
            Text("INSERT_LINE_PREVIOUS", fenceEnhanceHotkeyDep),
            Text("INSERT_LINE_NEXT", fenceEnhanceHotkeyDep),
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
                CALLBACK: "({ pre, cid, fence, cursor, lineNum, lastNum, separator }) => console.log('callback')",
            },
            fenceEnhanceHotkeyDep,
        ),
        TitledBox(
            Title("lineHighlighting"),
            Switch("HIGHLIGHT_BY_LANGUAGE"),
            Switch("HIGHLIGHT_WHEN_HOVER"),
            Select("NUMBERING_BASE", OPTIONS.fence_enhance.NUMBERING_BASE, { dependencies: { HIGHLIGHT_BY_LANGUAGE: true } }),
            Text("HIGHLIGHT_PATTERN", { dependencies: { $follow: "NUMBERING_BASE" } }),
            Text("HIGHLIGHT_LINE_COLOR", { dependencies: { $or: [{ $follow: "NUMBERING_BASE" }, { HIGHLIGHT_WHEN_HOVER: true }] } }),
            Action("viewVitePressLineHighlighting"),
        ),
        TitledBox(
            Title("advanced"),
            Switch("ENABLE_LANGUAGE_FOLD"),
            Switch("INDENTED_WRAPPED_LINE"),
            Switch("PRELOAD_ALL_FENCES", { tooltip: "dangerous" }),
        ),
        handleSettingsBox,
    ],
    collapse_paragraph: [
        pluginLiteBasePropBox,
        TitledBox(
            Title("mode"),
            Switch("RECORD_COLLAPSE"),
            Switch("STRICT_MODE"),
            Switch("STRICT_MODE_IN_CONTEXT_MENU"),
        ),
        TitledBox(
            Title("modifierKey"),
            Hotkey("MODIFIER_KEY.COLLAPSE_SINGLE", { tooltip: "modifierKeyExample" }),
            Hotkey("MODIFIER_KEY.COLLAPSE_SIBLINGS"),
            Hotkey("MODIFIER_KEY.COLLAPSE_ALL_SIBLINGS"),
            Hotkey("MODIFIER_KEY.COLLAPSE_RECURSIVE"),
        ),
        handleSettingsBox,
    ],
    collapse_list: [
        pluginLiteBasePropBox,
        UntitledBox(
            Switch("RECORD_COLLAPSE"),
            Text("TRIANGLE_COLOR"),
        ),
        handleSettingsBox,
    ],
    collapse_table: [
        pluginLiteBasePropBox,
        UntitledBox(
            Switch("RECORD_COLLAPSE"),
        ),
        handleSettingsBox,
    ],
    truncate_text: [
        pluginLiteBasePropBox,
        TitledBox(
            Title("hotkey"),
            Hotkey("HIDE_FRONT_HOTKEY"),
            Hotkey("HIDE_BASE_VIEW_HOTKEY"),
            Hotkey("SHOW_ALL_HOTKEY"),
            Number("REMAIN_LENGTH", { min: 1, dependencies: { $or: [{ HIDE_FRONT_HOTKEY: { $bool: true } }, { HIDE_BASE_VIEW_HOTKEY: { $bool: true } }] } }),
        ),
        handleSettingsBox,
    ],
    export_enhance: [
        pluginLiteBasePropBox,
        TitledBox(
            Title("networkImage"),
            Switch("DOWNLOAD_NETWORK_IMAGE"),
            Number("DOWNLOAD_THREADS", { min: 1, dependencies: { DOWNLOAD_NETWORK_IMAGE: true } }),
        ),
        handleSettingsBox,
    ],
    text_stylize: [
        UntitledBox(
            prop_ENABLE,
            prop_NAME,
            Hotkey("SHOW_MODAL_HOTKEY"),
        ),
        TitledBox(
            Title("toolBar"),
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
            Title("buttonDefaultOptions"),
            Color("DEFAULT_COLORS.FOREGROUND"),
            Color("DEFAULT_COLORS.BACKGROUND"),
            Color("DEFAULT_COLORS.BORDER"),
            Text("DEFAULT_FORMAT_BRUSH", { tooltip: "brushExample" }),
        ),
        ObjectBox("COLOR_TABLE"),
        handleSettingsBox,
    ],
    cipher: [
        pluginLiteBasePropBox,
        TitledBox(
            Title("hotkey"),
            Hotkey("ENCRYPT_HOTKEY"),
            Hotkey("DECRYPT_HOTKEY"),
            Switch("SHOW_HINT_MODAL"),
        ),
        handleSettingsBox,
    ],
    resource_manager: [
        pluginFullBasePropBox,
        TitledBox(
            Title("windowPosition"),
            Range("MODAL_LEFT_PERCENT", { min: 0, max: 100, step: 1 }),
            Range("MODAL_WIDTH_PERCENT", { min: 0, max: 100, step: 1 }),
            Range("MODAL_HEIGHT_PERCENT", { min: 0, max: 100, step: 1 }),
        ),
        ArrayBox("RESOURCE_EXT"),
        ArrayBox("MARKDOWN_EXT"),
        ArrayBox("IGNORE_FOLDERS"),
        TitledBox(
            Title("advanced"),
            Select("RESOURCE_GRAMMARS", OPTIONS.resource_manager.RESOURCE_GRAMMARS, { minItems: 1 }),
            Select("TRAVERSE_STRATEGY", OPTIONS.resource_manager.TRAVERSE_STRATEGY),
            Switch("FOLLOW_SYMBOLIC_LINKS"),
            Number("TIMEOUT", { unit: UNITS.millisecond, min: 1 }),
            Number("MAX_STATS", { tooltip: "minusOneMeansUnlimited", min: -1 }),
            Number("MAX_DEPTH", { tooltip: "minusOneMeansUnlimited", min: -1 }),
            Number("CONCURRENCY_LIMIT", { min: 1 }),
        ),
        handleSettingsBox,
    ],
    easy_modify: [
        pluginLiteBasePropBox,
        TitledBox(
            Title("hotkey"),
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
        ),
        handleSettingsBox,
    ],
    custom: [
        UntitledBox(
            Switch("ENABLE", protectedAttrs),
            prop_NAME,
        ),
        UntitledBox(
            Switch("HIDE_DISABLE_PLUGINS"),
        ),
        handleSettingsBox,
    ],
    slash_commands: [
        pluginLiteBasePropBox,
        TitledBox(
            Title("trigger"),
            Text("TRIGGER_REGEXP"),
            Text("FUNC_PARAM_SEPARATOR", protectedAttrs),
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
        handleSettingsBox,
    ],
    right_click_menu: [
        UntitledBox(
            Switch("ENABLE", protectedAttrs),
            prop_NAME,
        ),
        TitledBox(
            Title("style"),
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
            Title("advanced"),
            Switch("FIND_LOST_PLUGINS"),
        ),
        handleSettingsBox,
    ],
    pie_menu: [
        pluginFullBasePropBox,
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
        handleSettingsBox,
    ],
    preferences: [
        UntitledBox(
            Switch("ENABLE", protectedAttrs),
            prop_NAME,
            prop_HOTKEY,
        ),
        UntitledBox(
            Switch("SEARCH_PLUGIN_FIXEDNAME"),
            Select("OBJECT_SETTINGS_FORMAT", OPTIONS.preferences.OBJECT_SETTINGS_FORMAT),
            Select("DEFAULT_MENU"),
            Select("HIDE_MENUS"),
        ),
        UntitledBox(
            Switch("VALIDATE_CONFIG_OPTIONS"),
            Select("DEPENDENCIES_FAILURE_BEHAVIOR", OPTIONS.preferences.DEPENDENCIES_FAILURE_BEHAVIOR),
        ),
        TextareaBox("FORM_RENDERING_HOOK", { rows: 3, readonly: true }),
        handleSettingsBox,
    ],
    file_counter: [
        pluginLiteBasePropBox,
        TitledBox(
            Title("textStyle"),
            Text("FONT_WEIGHT"),
            Text("COLOR"),
            Text("BACKGROUND_COLOR"),
            Text("BEFORE_TEXT"),
        ),
        TitledBox(
            Title("mouseInteraction"),
            Switch("CTRL_WHEEL_TO_SCROLL_SIDEBAR_MENU"),
        ),
        ArrayBox("ALLOW_EXT"),
        ArrayBox("IGNORE_FOLDERS"),
        TitledBox(
            Title("advanced"),
            Switch("FOLLOW_SYMBOLIC_LINKS"),
            Number("IGNORE_MIN_NUM", { tooltip: "ignoreMinNum", min: 1 }),
            Number("MAX_SIZE", { tooltip: "maxBytes", unit: UNITS.byte, min: 1, max: 2000000 }),
            Number("MAX_STATS", { min: 100 }),
            Number("CONCURRENCY_LIMIT", { min: 1 }),
        ),
        handleSettingsBox,
    ],
    hotkeys: [
        pluginFullBasePropBox,
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
        handleSettingsBox,
    ],
    editor_width_slider: [
        pluginLiteBasePropBox,
        UntitledBox(
            Number("WIDTH_RATIO", { tooltip: "minusOneMeansDisable", unit: UNITS.percent, min: -1, max: 100, step: 1 }),
        ),
        handleSettingsBox,
    ],
    article_uploader: [
        pluginLiteBasePropBox,
        UntitledBox(
            Switch("HIDE"),
        ),
        TitledBox(
            Title("hotkey", { dependencies: { $or: [{ $follow: "UPLOAD_CNBLOG_HOTKEY" }, { $follow: "UPLOAD_WORDPRESS_HOTKEY" }, { $follow: "UPLOAD_CSDN_HOTKEY" }] } }),
            Hotkey("UPLOAD_ALL_HOTKEY", { dependencies: { $or: [{ "upload.cnblog.enabled": true }, { "upload.wordpress.enabled": true }, { "upload.csdn.enabled": true }] } }),
            Hotkey("UPLOAD_CNBLOG_HOTKEY", { dependencies: { "upload.cnblog.enabled": true } }),
            Hotkey("UPLOAD_WORDPRESS_HOTKEY", { dependencies: { "upload.wordpress.enabled": true } }),
            Hotkey("UPLOAD_CSDN_HOTKEY", { dependencies: { "upload.csdn.enabled": true } }),
        ),
        TitledBox(
            Title("upload"),
            Switch("upload.reconfirm"),
            Switch("upload.selenium.headless"),
        ),
        TitledBox(
            Title("wordPress"),
            Switch("upload.wordpress.enabled"),
            Text("upload.wordpress.hostname", { dependencies: { "upload.wordpress.enabled": true } }),
            Text("upload.wordpress.loginUrl", { dependencies: { "upload.wordpress.enabled": true } }),
            Text("upload.wordpress.username", { dependencies: { "upload.wordpress.enabled": true } }),
            Text("upload.wordpress.password", { dependencies: { "upload.wordpress.enabled": true } }),
        ),
        TitledBox(
            Title("cnblog"),
            Switch("upload.cnblog.enabled"),
            Text("upload.cnblog.username", { dependencies: { "upload.cnblog.enabled": true } }),
            Text("upload.cnblog.password", { dependencies: { "upload.cnblog.enabled": true } }),
        ),
        TitledBox(
            Title("csdn"),
            Switch("upload.csdn.enabled"),
            Text("upload.csdn.cookie", { dependencies: { "upload.csdn.enabled": true } }),
        ),
        UntitledBox(
            Action("viewArticleUploaderReadme"),
        ),
        handleSettingsBox,
    ],
    ripgrep: [
        pluginFullBasePropBox,
        TitledBox(
            Title("windowPosition"),
            Range("TOP_PERCENT", { min: 0, max: 100, step: 1 }),
            Range("WIDTH_PERCENT", { min: 0, max: 100, step: 1 }),
        ),
        TitledBox(
            Title("interaction"),
            Switch("BACKSPACE_TO_HIDE"),
        ),
        handleSettingsBox,
    ],
    static_markers: [
        pluginFullBasePropBox,
        handleSettingsBox,
    ],
    cursor_history: [
        pluginLiteBasePropBox,
        TitledBox(
            Title("hotkey"),
            Hotkey("HOTKEY_GO_FORWARD"),
            Hotkey("HOTKEY_GO_BACK"),
        ),
        UntitledBox(
            Number("MAX_HISTORY_ENTRIES", { min: 1, step: 1 }),
        ),
        handleSettingsBox,
    ],
    json_rpc: [
        pluginLiteBasePropBox,
        TitledBox(
            Title("rpcServer"),
            Switch("SERVER_OPTIONS.strict"),
            Text("SERVER_OPTIONS.host"),
            Number("SERVER_OPTIONS.port", { min: 0, max: 65535, step: 1 }),
            Text("SERVER_OPTIONS.path"),
        ),
        UntitledBox(
            Action("viewJsonRPCReadme"),
        ),
        handleSettingsBox,
    ],
    updater: [
        pluginFullBasePropBox,
        UntitledBox(
            Number("NETWORK_REQUEST_TIMEOUT", { unit: UNITS.millisecond, min: 30000 }),
            Text("PROXY"),
        ),
        TitledBox(
            Title("autoUpdate"),
            Switch("AUTO_UPDATE"),
            Number("UPDATE_LOOP_INTERVAL", { tooltip: "loopInterval", unit: UNITS.millisecond, min: -1, dependencies: { AUTO_UPDATE: true } }),
            Number("START_UPDATE_INTERVAL", { tooltip: "waitInterval", unit: UNITS.millisecond, min: -1, dependencies: { AUTO_UPDATE: true } }),
        ),
        handleSettingsBox,
    ],
    test: [
        pluginLiteBasePropBox,
        handleSettingsBox,
    ],
    kanban: [
        customPluginLiteBasePropBox,
        TitledBox(
            Title("fence"),
            Text("LANGUAGE", protectedAttrs),
            Switch("INTERACTIVE_MODE"),
            Switch("STRICT_MODE"),
        ),
        TitledBox(
            Title("kanbanStyle"),
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
        handleSettingsBox,
    ],
    chat: [
        customPluginLiteBasePropBox,
        TitledBox(
            Title("fence"),
            Text("LANGUAGE", protectedAttrs),
            Switch("INTERACTIVE_MODE"),
            Switch("DEFAULT_OPTIONS.useStrict"),
        ),
        TitledBox(
            Title("defaultOption"),
            Switch("DEFAULT_OPTIONS.showNickname"),
            Switch("DEFAULT_OPTIONS.showAvatar"),
            Switch("DEFAULT_OPTIONS.notAllowShowTime"),
            Switch("DEFAULT_OPTIONS.allowMarkdown"),
            Text("DEFAULT_OPTIONS.senderNickname"),
            Text("DEFAULT_OPTIONS.timeNickname"),
        ),
        TextareaBox("TEMPLATE"),
        handleSettingsBox,
    ],
    timeline: [
        customPluginLiteBasePropBox,
        langModeBox,
        TitledBox(
            Title("diagramStyle"),
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
        handleSettingsBox,
    ],
    echarts: [
        customPluginLiteBasePropBox,
        langModeBox,
        chartStyleBox,
        TextareaBox("TEMPLATE"),
        TitledBox(
            Title("advanced"),
            Select("RENDERER", OPTIONS.echarts.RENDERER, { tooltip: "svgBetter" }),
            Select("EXPORT_TYPE", OPTIONS.echarts.EXPORT_TYPE),
            Action("chooseEchartsRenderer"),
        ),
        handleSettingsBox,
    ],
    chart: [
        customPluginLiteBasePropBox,
        langModeBox,
        chartStyleBox,
        TextareaBox("TEMPLATE"),
        handleSettingsBox,
    ],
    wavedrom: [
        customPluginLiteBasePropBox,
        TitledBox(
            Title("fenceLanguageMode"),
            Text("LANGUAGE", protectedAttrs),
            Switch("INTERACTIVE_MODE"),
            Switch("SAFE_MODE"),
        ),
        chartStyleBox,
        TextareaBox("TEMPLATE"),
        handleSettingsBox,
    ],
    calendar: [
        customPluginLiteBasePropBox,
        langModeBox,
        chartStyleBox,
        TextareaBox("TEMPLATE"),
        handleSettingsBox,
    ],
    abc: [
        customPluginLiteBasePropBox,
        langModeBox,
        chartStyleBox,
        TextareaBox("TEMPLATE"),
        ObjectBox("VISUAL_OPTIONS", { rows: 5 }),
        UntitledBox(
            Action("viewAbcVisualOptionsHelp"),
        ),
        handleSettingsBox,
    ],
    drawIO: [
        customPluginLiteBasePropBox,
        langModeBox,
        chartStyleBox,
        TextareaBox("TEMPLATE"),
        TitledBox(
            Title("advanced"),
            Text("RESOURCE_URI"),
        ),
        handleSettingsBox,
    ],
    marp: [
        customPluginLiteBasePropBox,
        langModeBox,
        TextareaBox("TEMPLATE"),
        handleSettingsBox,
    ],
    callouts: [
        customPluginLiteBasePropBox,
        TitledBox(
            Title("style"),
            Switch("set_title_color"),
            Text("box_shadow"),
        ),
        TitledBox(
            Title("mouseHover"),
            Switch("hover_to_show_fold_callout"),
        ),
        TitledBox(
            Title("fontFamily"),
            Text("font_family"),
            Switch("use_network_icon_when_exporting", { tooltip: "messingFont" }),
            Text("network_icon_url", { dependencies: { use_network_icon_when_exporting: true } }),
        ),
        TitledBox(
            Title("defaultOptions"),
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
        handleSettingsBox,
    ],
    templater: [
        customPluginFullBasePropBox,
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
        handleSettingsBox,
    ],
    chineseSymbolAutoPairer: [
        customPluginLiteBasePropBox,
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
        handleSettingsBox,
    ],
    toc: [
        customPluginFullBasePropBox,
        UntitledBox(
            Switch("default_show_toc"),
            Switch("remove_header_styles"),
            Switch("sortable"),
            Switch("right_click_outline_button_to_toggle"),
        ),
        TitledBox(
            Title("tocStyle"),
            Range("width_percent_when_pin_right", { min: 0, max: 100, step: 1 }),
            Text("toc_font_size"),
        ),
        TitledBox(
            Title("name"),
            Text("show_name.fence"),
            Text("show_name.image"),
            Text("show_name.table"),
            Text("show_name.link"),
            Text("show_name.math"),
        ),
        TitledBox(
            Title("displayHeader"),
            Switch("include_headings.fence"),
            Switch("include_headings.image"),
            Switch("include_headings.table"),
            Switch("include_headings.link"),
            Switch("include_headings.math"),
        ),
        handleSettingsBox,
    ],
    scrollBookmarker: [
        customPluginFullBasePropBox,
        UntitledBox(
            Hotkey("modifier_key", { tooltip: "modifierKeyExample" }),
            Switch("auto_popup_modal"),
        ),
        handleSettingsBox,
    ],
    imageReviewer: [
        customPluginFullBasePropBox,
        TitledBox(
            Title("style"),
            Range("mask_background_opacity", { min: 0, max: 1, step: 0.05 }),
            Range("image_max_width", { min: 0, max: 100, step: 1 }),
            Range("image_max_height", { min: 0, max: 100, step: 1 }),
            Text("thumbnail_height"),
            Number("blur_level", { unit: UNITS.pixel, min: 1 }),
            Number("thumbnail_scroll_padding_count", { min: 0 }),
            Number("water_fall_columns", { min: 0 }),
        ),
        TitledBox(
            Title("component"),
            Switch("show_thumbnail_nav"),
            Select("tool_position", OPTIONS.imageReviewer.tool_position),
            Select("show_message", OPTIONS.imageReviewer.show_message),
            Select("tool_function", OPTIONS.imageReviewer.operations, { minItems: 1 }),
        ),
        TitledBox(
            Title("behavior"),
            Switch("filter_error_image"),
            Select("first_image_strategies", OPTIONS.imageReviewer.first_image_strategies, { minItems: 1 }),
            Select("thumbnail_object_fit", OPTIONS.imageReviewer.thumbnail_object_fit),
            Number("play_second", { unit: UNITS.second, min: 1 }),
        ),
        TitledBox(
            Title("mouseEvent"),
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
            Title("adjustScale"),
            Number("zoom_scale", { min: 0.01 }),
            Number("rotate_scale", { unit: UNITS.degree, min: 1 }),
            Number("skew_scale", { unit: UNITS.degree, min: 1 }),
            Number("translate_scale", { unit: UNITS.pixel, min: 1 }),
        ),
        handleSettingsBox,
    ],
    markdownLint: [
        customPluginFullBasePropBox,
        TitledBox(
            Title("detectAndFix"),
            Switch("translate"),
            Switch("right_click_table_to_toggle_source_mode"),
            Select("columns", OPTIONS.markdownLint.columns, { minItems: 1 }),
            Select("result_order_by", OPTIONS.markdownLint.result_order_by),
            Select("tools", OPTIONS.markdownLint.tools, { minItems: 1 }),
            Hotkey("hotkey_fix_lint_error"),
        ),
        TitledBox(
            Title("square"),
            Switch("use_button"),
            Switch("right_click_button_to_fix", { dependencies: { use_button: true } }),
            Text("button_width", { dependencies: { use_button: true } }),
            Text("button_height", { dependencies: { use_button: true } }),
            Text("button_border_radius", { dependencies: { use_button: true } }),
            Color("pass_color", { dependencies: { use_button: true } }),
            Color("error_color", { dependencies: { use_button: true } }),
        ),
        ObjectBox("rule_config", { rows: 10 }),
        ArrayBox("custom_rules_files"),
        UntitledBox(
            Action("viewMarkdownlintRules"),
            Action("viewCustomMarkdownlintRules"),
        ),
        handleSettingsBox,
    ],
    quickButton: [
        customPluginFullBasePropBox,
        TitledBox(
            Title("buttonStyle"),
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
        handleSettingsBox,
    ],
    blockSideBySide: [
        customPluginFullBasePropBox,
        handleSettingsBox,
    ],
    sortableOutline: [
        customPluginLiteBasePropBox,
        UntitledBox(
            Switch("auto_save_file"),
        ),
        handleSettingsBox,
    ],
    redirectLocalRootUrl: [
        customPluginLiteBasePropBox,
        UntitledBox(
            Text("root"),
            Text("filter_regexp"),
        ),
        handleSettingsBox,
    ],
}

module.exports = JSON.parse(JSON.stringify(SETTING_SCHEMAS))
