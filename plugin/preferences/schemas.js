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
const Hint = (header, detail) => {
    const hintHeader = HintHeader(header)
    const hintDetail = HintDetail(detail)
    return { type: "hint", hintHeader, hintDetail }
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
const Hotkey = (key, { tooltip, placeholder, disabled, dependencies, ...args } = {}) => {
    const label = Label(key)
    tooltip = Tooltip(tooltip)
    placeholder = Placeholder(placeholder)
    return { type: "hotkey", key, label, tooltip, placeholder, disabled, dependencies, ...args }
}
const Number = (key, { tooltip, unit, min, max, step, dependencies, ...args } = {}) => {
    const label = Label(key)
    tooltip = Tooltip(tooltip)
    return { type: "number", key, unit, min, max, step, label, tooltip, dependencies, ...args }
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

const UntitledBox = (...fields) => ({ title: undefined, fields })
const TitledBox = (title, ...fields) => ({ title: `$title.${title}`, fields })

const ObjectBOX = (key, { rows = 10, dependencies, ...args } = {}) => TitledBox(key, { type: "object", key, rows, dependencies, ...args })
const TextareaBox = (key, { rows = 10, dependencies, ...args } = {}) => TitledBox(key, { type: "textarea", key, rows, dependencies, ...args })
const ArrayBox = (key, { dependencies, ...args } = {}) => TitledBox(key, { type: "array", key, dependencies, ...args })
const RadioBox = (key, options, { dependencies, ...args } = {}) => TitledBox(key, { type: "radio", key, options, dependencies, ...args })
const CheckboxBox = (key, options, { minItems, maxItems, dependencies, ...args } = {}) => TitledBox(key, {
    type: "checkbox",
    options,
    key,
    minItems,
    maxItems,
    dependencies,
    ...args,
})
const TableBox = (key, ths, nestedBoxes, defaultValues, { dependencies, ...args } = {}) => TitledBox(key, {
    type: "table",
    key,
    nestedBoxes,
    defaultValues,
    dependencies,
    thMap: Object.fromEntries(ths.map(th => [th, `$label.${key}.${th}`])),
    ...args,
})

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

const langModeBox = TitledBox(
    "fenceLanguageMode",
    Text("LANGUAGE", protectedAttrs),
    Switch("INTERACTIVE_MODE"),
)
const chartStyleBox = TitledBox(
    "diagramStyle",
    Text("DEFAULT_FENCE_HEIGHT"),
    Text("DEFAULT_FENCE_BACKGROUND_COLOR"),
)

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
    text_stylize: {
        TOOLS: ["weight", "italic", "underline", "throughline", "overline", "superScript", "subScript", "emphasis", "blur", "title", "increaseSize", "decreaseSize", "increaseLetterSpacing", "decreaseLetterSpacing", "family", "foregroundColor", "backgroundColor", "borderColor", "erase", "blank", "setBrush", "useBrush"],
    },
    resource_manager: {
        RESOURCE_GRAMMARS: ["markdown", "html"],
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
            Action("deepWiki"),
            Action("editStyles"),
            Action("developPlugins"),
            Action("githubImageBed"),
            Action("sendEmail"),
        ),
        UntitledBox(
            Action("updatePlugin"),
            Action("uninstallPlugin"),
            Action("donate"),
            Static("pluginVersion"),
        ),
    ],
    window_tab: [
        pluginLiteBasePropBox,
        TitledBox(
            "appearance",
            Switch("SHOW_TAB_CLOSE_BUTTON"),
            Switch("TRIM_FILE_EXT"),
            Switch("SHOW_DIR_ON_DUPLICATE"),
            Switch("HIDE_WINDOW_TITLE_BAR"),
            Text("TAB_MIN_WIDTH"),
            Text("TAB_MAX_WIDTH"),
            Number("MAX_TAB_NUM", { tooltip: "minusOne", min: -1 }),
        ),
        TitledBox(
            "behavior",
            Select("NEW_TAB_POSITION", OPTIONS.window_tab.NEW_TAB_POSITION),
            Select("TAB_SWITCH_ON_CLOSE", OPTIONS.window_tab.TAB_SWITCH_ON_CLOSE),
            Select("LAST_TAB_CLOSE_ACTION", OPTIONS.window_tab.LAST_TAB_CLOSE_ACTION),
        ),
        TitledBox(
            "mouseInteraction",
            Switch("CTRL_CLICK_TO_NEW_WINDOW"),
            Switch("CTRL_WHEEL_TO_SWITCH"),
            Switch("MIDDLE_CLICK_TO_CLOSE"),
            Switch("SHOW_FULL_PATH_WHEN_HOVER"),
            Switch("USE_CONTEXT_MENU"),
            Select("CONTEXT_MENU", OPTIONS.window_tab.CONTEXT_MENU, { dependencies: { USE_CONTEXT_MENU: true } }),
            Select("DRAG_STYLE", OPTIONS.window_tab.DRAG_STYLE),
            Select("TAB_DETACHMENT", OPTIONS.window_tab.TAB_DETACHMENT, { dependencies: { DRAG_STYLE: "JetBrains" } }),
            Number("DETACHMENT_THRESHOLD", { tooltip: "detachThreshold", min: 0.1, max: 3, step: 0.1, dependencies: { DRAG_STYLE: "JetBrains", TAB_DETACHMENT: "resistant" } }),
            Number("DRAG_NEW_WINDOW_THRESHOLD", { tooltip: "newWindow", min: -1 }),
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
            "search",
            Switch("CASE_SENSITIVE"),
            Switch("OPTIMIZE_SEARCH", { tooltip: "breakOrder" }),
            Number("MAX_SIZE", { tooltip: "maxBytes", unit: UNITS.byte, min: 1, max: 2000000 }),
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
        handleSettingsBox,
    ],
    commander: [
        pluginFullBasePropBox,
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
                    { type: "switch", key: "disable", label: "$label.BUILTIN.disable" },
                    { type: "select", key: "shell", label: "$label.BUILTIN.shell", options: OPTIONS.commander["BUILTIN.shell"] },
                    { type: "text", key: "name", label: "$label.BUILTIN.name" },
                ),
                TitledBox("BUILTIN.cmd", { type: "textarea", key: "cmd", rows: 5, placeholder: "envInfo" }),
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
            "underReadOnly",
            Text("SHOW_TEXT"),
            Switch("READ_ONLY_DEFAULT"),
            Switch("CLICK_HYPERLINK_TO_OPEN_WHEN_READ_ONLY"),
            Switch("NO_EXPAND_WHEN_READ_ONLY"),
            Switch("REMOVE_EXPAND_WHEN_READ_ONLY", { dependencies: { NO_EXPAND_WHEN_READ_ONLY: false } }),
            Switch("DISABLE_CONTEXT_MENU_WHEN_READ_ONLY"),
        ),
        ArrayBox("REMAIN_AVAILABLE_MENU_KEY", { dependencies: { DISABLE_CONTEXT_MENU_WHEN_READ_ONLY: true } }),
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
            "searchBarPosition",
            Range("TOOLBAR_TOP_PERCENT", { min: 0, max: 100, step: 1 }),
            Range("TOOLBAR_WIDTH_PERCENT", { min: 0, max: 100, step: 1 }),
        ),
        TitledBox(
            "windowInteraction",
            Switch("AUTO_HIDE"),
            Switch("BACKSPACE_TO_HIDE"),
        ),
        TitledBox(
            "input",
            Select("DEFAULT_TOOL", OPTIONS.toolbar.DEFAULT_TOOL),
            Switch("USE_NEGATIVE_SEARCH"),
            Switch("PAUSE_ON_COMPOSITION", { tooltip: "pauseOnComposition" }),
            Number("DEBOUNCE_INTERVAL", { unit: UNITS.millisecond, min: 0 }),
        ),
        handleSettingsBox,
    ],
    resize_image: [
        pluginLiteBasePropBox,
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
        handleSettingsBox,
    ],
    resize_table: [
        pluginLiteBasePropBox,
        UntitledBox(
            Switch("RECORD_RESIZE"),
            Switch("REMOVE_MIN_CELL_WIDTH"),
            Number("DRAG_THRESHOLD", { unit: UNITS.pixel, min: 0 }),
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
            "hotkey",
            Hotkey("HOTKEY_GO_TOP"),
            Hotkey("HOTKEY_GO_BOTTOM"),
        ),
        handleSettingsBox,
    ],
    markmap: [
        pluginLiteBasePropBox,
        TitledBox(
            "mindmapDiagram",
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
            "mindmapDiagramDefaultOptions",
            Switch("DEFAULT_TOC_OPTIONS.zoom", markmapTocDep),
            Switch("DEFAULT_TOC_OPTIONS.pan", markmapTocDep),
            Switch("DEFAULT_TOC_OPTIONS.toggleRecursively", markmapTocDep),
            Range("DEFAULT_TOC_OPTIONS.initialExpandLevel", { min: 1, max: 6, step: 1, ...markmapTocDep }),
            Range("DEFAULT_TOC_OPTIONS.colorFreezeLevel", { min: 1, max: 6, step: 1, ...markmapTocDep }),
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
        ObjectBOX("CANDIDATE_COLOR_SCHEMES", markmapTocDep),
        TitledBox(
            "mindmapDiagramExport",
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
            "fence",
            Switch("ENABLE_FENCE_MARKMAP"),
            Switch("INTERACTIVE_MODE", markmapFenceDep),
            Hotkey("FENCE_HOTKEY", markmapFenceDep),
            Text("FENCE_LANGUAGE", { ...protectedAttrs, ...markmapFenceDep }),
            Text("DEFAULT_FENCE_HEIGHT", markmapFenceDep),
            Text("DEFAULT_FENCE_BACKGROUND_COLOR", markmapFenceDep),
        ),
        TitledBox(
            "fenceDiagramDefaultOptions",
            Switch("DEFAULT_FENCE_OPTIONS.zoom", markmapFenceDep),
            Switch("DEFAULT_FENCE_OPTIONS.pan", markmapFenceDep),
            Switch("DEFAULT_FENCE_OPTIONS.toggleRecursively", markmapFenceDep),
            Range("DEFAULT_FENCE_OPTIONS.initialExpandLevel", { min: 1, max: 6, step: 1, ...markmapFenceDep }),
            Range("DEFAULT_FENCE_OPTIONS.colorFreezeLevel", { min: 1, max: 6, step: 1, ...markmapFenceDep }),
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
            "autoNumbering",
            Switch("ENABLE_OUTLINE"),
            Switch("ENABLE_CONTENT"),
            Switch("ENABLE_TOC"),
            Switch("ENABLE_TABLE"),
            Switch("ENABLE_IMAGE"),
            Switch("ENABLE_FENCE"),
        ),
        TitledBox(
            "style",
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
                    { type: "switch", key: "selected", label: "$label.LAYOUTS.selected" },
                    { type: "text", key: "name", label: "$label.LAYOUTS.name" },
                    { type: "text", key: "layout.content-h1", label: "$label.LAYOUTS.layout.content-h1" },
                    { type: "text", key: "layout.content-h2", label: "$label.LAYOUTS.layout.content-h2" },
                    { type: "text", key: "layout.content-h3", label: "$label.LAYOUTS.layout.content-h3" },
                    { type: "text", key: "layout.content-h4", label: "$label.LAYOUTS.layout.content-h4" },
                    { type: "text", key: "layout.content-h5", label: "$label.LAYOUTS.layout.content-h5" },
                    { type: "text", key: "layout.content-h6", label: "$label.LAYOUTS.layout.content-h6" },
                    { type: "text", key: "layout.outline-h1", label: "$label.LAYOUTS.layout.outline-h1" },
                    { type: "text", key: "layout.outline-h2", label: "$label.LAYOUTS.layout.outline-h2" },
                    { type: "text", key: "layout.outline-h3", label: "$label.LAYOUTS.layout.outline-h3" },
                    { type: "text", key: "layout.outline-h4", label: "$label.LAYOUTS.layout.outline-h4" },
                    { type: "text", key: "layout.outline-h5", label: "$label.LAYOUTS.layout.outline-h5" },
                    { type: "text", key: "layout.outline-h6", label: "$label.LAYOUTS.layout.outline-h6" },
                    { type: "text", key: "layout.toc-h1", label: "$label.LAYOUTS.layout.toc-h1" },
                    { type: "text", key: "layout.toc-h2", label: "$label.LAYOUTS.layout.toc-h2" },
                    { type: "text", key: "layout.toc-h3", label: "$label.LAYOUTS.layout.toc-h3" },
                    { type: "text", key: "layout.toc-h4", label: "$label.LAYOUTS.layout.toc-h4" },
                    { type: "text", key: "layout.toc-h5", label: "$label.LAYOUTS.layout.toc-h5" },
                    { type: "text", key: "layout.toc-h6", label: "$label.LAYOUTS.layout.toc-h6" },
                    { type: "text", key: "layout.table", label: "$label.LAYOUTS.layout.table" },
                    { type: "text", key: "layout.image", label: "$label.LAYOUTS.layout.image" },
                    { type: "text", key: "layout.fence", label: "$label.LAYOUTS.layout.fence" },
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
        TitledBox(
            "advanced",
            Switch("ENABLE_WHEN_EXPORT"),
        ),
        handleSettingsBox,
    ],
    fence_enhance: [
        pluginLiteBasePropBox,
        TitledBox(
            "buttonStyle",
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
            "buttons",
            Switch("ENABLE_COPY", fenceEnhanceButtonDep),
            Switch("ENABLE_INDENT", fenceEnhanceButtonDep),
            Switch("ENABLE_FOLD", fenceEnhanceButtonDep),
            Switch("DEFAULT_FOLD", fenceEnhanceButtonDep),
            Number("DEFAULT_FOLD_THRESHOLD", { unit: UNITS.line, min: 0, step: 1, dependencies: { ENABLE_BUTTON: true, DEFAULT_FOLD: true } }),
        ),
        TableBox(
            "CUSTOM_BUTTONS",
            ["HINT", "ICON"],
            [
                UntitledBox(
                    { type: "switch", key: "DISABLE", label: "$label.CUSTOM_BUTTONS.DISABLE" },
                    { type: "text", key: "ICON", label: "$label.CUSTOM_BUTTONS.ICON" },
                    { type: "text", key: "HINT", label: "$label.CUSTOM_BUTTONS.HINT" },
                ),
                TitledBox("CUSTOM_BUTTONS.ON_INIT", { type: "textarea", key: "ON_INIT", rows: 3 }),
                TitledBox("CUSTOM_BUTTONS.ON_RENDER", { type: "textarea", key: "ON_RENDER", rows: 3 }),
                TitledBox("CUSTOM_BUTTONS.ON_CLICK", { type: "textarea", key: "ON_CLICK", rows: 3 }),
            ],
            {
                DISABLE: false,
                ICON: "fa fa-bomb",
                HINT: "",
                ON_INIT: "plu => console.log('The button has been initialized')",
                ON_RENDER: "btn => console.log('The button has been rendered')",
                ON_CLICK: "({ ev, btn, cont, fence, cm, cid, plu }) => console.log('The button has been clicked')",
            },
            fenceEnhanceButtonDep,
        ),
        TitledBox(
            "buttonHotkeys",
            Switch("ENABLE_HOTKEY"),
            Text("SWAP_PREVIOUS_LINE", { tooltip: "codeMirrorStyle", ...fenceEnhanceHotkeyDep }),
            Text("SWAP_NEXT_LINE", fenceEnhanceHotkeyDep),
            Text("COPY_PREVIOUS_LINE", fenceEnhanceHotkeyDep),
            Text("COPY_NEXT_LINE", fenceEnhanceHotkeyDep),
            Text("INSERT_LINE_PREVIOUS", fenceEnhanceHotkeyDep),
            Text("INSERT_LINE_NEXT", fenceEnhanceHotkeyDep),
            Action("viewCodeMirrorKeymapsManual"),
        ),
        TitledBox(
            "advanced",
            Switch("ENABLE_LANGUAGE_FOLD"),
            Switch("INDENTED_WRAPPED_LINE"),
            Switch("HIGHLIGHT_WHEN_HOVER"),
            Switch("HIGHLIGHT_BY_LANGUAGE"),
            Text("HIGHLIGHT_LINE_COLOR", { dependencies: { HIGHLIGHT_BY_LANGUAGE: true } }),
        ),
        handleSettingsBox,
    ],
    collapse_paragraph: [
        pluginLiteBasePropBox,
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
            "hotkey",
            Hotkey("HIDE_FRONT_HOTKEY"),
            Hotkey("SHOW_ALL_HOTKEY"),
            Hotkey("HIDE_BASE_VIEW_HOTKEY"),
            Number("REMAIN_LENGTH", { min: 1 }),
        ),
        handleSettingsBox,
    ],
    export_enhance: [
        pluginLiteBasePropBox,
        TitledBox(
            "networkImage",
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
            "toolBar",
            Text("MODAL_BACKGROUND_COLOR"),
            Select("TOOLS", OPTIONS.text_stylize.TOOLS, { minItems: 1 }),
        ),
        TableBox(
            "ACTION_HOTKEYS",
            ["hotkey", "action"],
            [
                UntitledBox(
                    { type: "hotkey", key: "hotkey", label: "$label.ACTION_HOTKEYS.hotkey" },
                    { type: "select", key: "action", label: "$label.ACTION_HOTKEYS.action", options: OPTIONS.text_stylize.TOOLS },
                ),
            ],
            {
                hotkey: "",
                action: "weight",
            },
        ),
        TitledBox(
            "buttonDefaultOptions",
            Text("DEFAULT_COLORS.FOREGROUND"),
            Text("DEFAULT_COLORS.BACKGROUND"),
            Text("DEFAULT_COLORS.BORDER"),
            Text("DEFAULT_FORMAT_BRUSH", { tooltip: "brushExample" }),
        ),
        ObjectBOX("COLOR_TABLE"),
        handleSettingsBox,
    ],
    cipher: [
        pluginLiteBasePropBox,
        TitledBox(
            "hotkey",
            Hotkey("ENCRYPT_HOTKEY"),
            Hotkey("DECRYPT_HOTKEY"),
            Switch("SHOW_HINT_MODAL"),
        ),
        handleSettingsBox,
    ],
    resource_manager: [
        pluginFullBasePropBox,
        TitledBox(
            "windowPosition",
            Range("MODAL_LEFT_PERCENT", { min: 0, max: 100, step: 1 }),
            Range("MODAL_WIDTH_PERCENT", { min: 0, max: 100, step: 1 }),
            Range("MODAL_HEIGHT_PERCENT", { min: 0, max: 100, step: 1 }),
        ),
        UntitledBox(
            Select("RESOURCE_GRAMMARS", OPTIONS.resource_manager.RESOURCE_GRAMMARS, { minItems: 1 }),
        ),
        ArrayBox("RESOURCE_EXT"),
        ArrayBox("MARKDOWN_EXT"),
        ArrayBox("IGNORE_FOLDERS"),
        handleSettingsBox,
    ],
    easy_modify: [
        pluginLiteBasePropBox,
        TitledBox(
            "hotkey",
            Hotkey("HOTKEY_COPY_FULL_PATH"),
            Hotkey("HOTKEY_INCREASE_HEADERS_LEVEL"),
            Hotkey("HOTKEY_DECREASE_HEADERS_LEVEL"),
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
            "trigger",
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
                    { type: "switch", key: "enable", label: "$label.COMMANDS.enable" },
                    { type: "select", key: "type", label: "$label.COMMANDS.type", options: OPTIONS.slash_commands["COMMANDS.type"] },
                    { type: "select", key: "scope", label: "$label.COMMANDS.scope", options: OPTIONS.slash_commands["COMMANDS.scope"] },
                    { type: "text", key: "keyword", label: "$label.COMMANDS.keyword", placeholder: "$placeholder.LettersAndNumbersOnly" },
                    { type: "text", key: "icon", label: "$label.COMMANDS.icon", placeholder: "$placeholder.emojiOnly" },
                    { type: "text", key: "hint", label: "$label.COMMANDS.hint" },
                    { type: "number", key: "cursorOffset.0", label: "$label.COMMANDS.cursorOffset.0" },
                    { type: "number", key: "cursorOffset.1", label: "$label.COMMANDS.cursorOffset.1" },
                ),
                TitledBox("COMMANDS.callback", { type: "textarea", key: "callback", rows: 5, placeholder: "$placeholder.callbackType" }),
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
                UntitledBox({ type: "text", key: "NAME", label: "$label.MENUS.NAME" }),
                TitledBox("MENUS.LIST", { type: "object", key: "LIST", rows: 10 }),
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
                    { type: "text", key: "ICON", label: "$label.BUTTONS.ICON" },
                    { type: "text", key: "CALLBACK", label: "$label.BUTTONS.CALLBACK" },
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
            Select("DEFAULT_MENU"),
            Select("HIDE_MENUS"),
            Select("OBJECT_SETTINGS_FORMAT", OPTIONS.preferences.OBJECT_SETTINGS_FORMAT),
            Switch("IGNORE_CONFIG_DEPENDENCIES"),
            Switch("SEARCH_PLUGIN_FIXEDNAME"),
        ),
        handleSettingsBox,
    ],
    file_counter: [
        pluginLiteBasePropBox,
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
        TitledBox(
            "search",
            Number("IGNORE_MIN_NUM", { tooltip: "ignoreMinNum", min: 1 }),
            Number("MAX_SIZE", { tooltip: "maxBytes", unit: UNITS.byte, min: 1, max: 2000000 }),
        ),
        ArrayBox("ALLOW_EXT"),
        ArrayBox("IGNORE_FOLDERS"),
        handleSettingsBox,
    ],
    hotkeys: [
        pluginFullBasePropBox,
        TableBox(
            "CUSTOM_HOTKEYS",
            ["hotkey", "desc"],
            [
                UntitledBox(
                    { type: "switch", key: "enable", label: "$label.CUSTOM_HOTKEYS.enable" },
                    { type: "hotkey", key: "hotkey", label: "$label.CUSTOM_HOTKEYS.hotkey" },
                    { type: "text", key: "desc", label: "$label.CUSTOM_HOTKEYS.desc" },
                    { type: "text", key: "plugin", label: "$label.CUSTOM_HOTKEYS.plugin" },
                    { type: "text", key: "function", label: "$label.CUSTOM_HOTKEYS.function" },
                    { type: "text", key: "closestSelector", label: "$label.CUSTOM_HOTKEYS.closestSelector" },
                ),
                TitledBox("CUSTOM_HOTKEYS.evil", { type: "textarea", key: "evil", rows: 3 }),
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
            "hotkey",
            Hotkey("UPLOAD_ALL_HOTKEY"),
            Hotkey("UPLOAD_CNBLOG_HOTKEY"),
            Hotkey("UPLOAD_WORDPRESS_HOTKEY"),
            Hotkey("UPLOAD_CSDN_HOTKEY"),
        ),
        TitledBox(
            "upload",
            Switch("upload.reconfirm"),
            Switch("upload.selenium.headless"),
        ),
        TitledBox(
            "wordPress",
            Switch("upload.wordpress.enabled"),
            Text("upload.wordpress.hostname"),
            Text("upload.wordpress.loginUrl"),
            Text("upload.wordpress.username"),
            Text("upload.wordpress.password"),
        ),
        TitledBox(
            "cnblog",
            Switch("upload.cnblog.enabled"),
            Text("upload.cnblog.username"),
            Text("upload.cnblog.password"),
        ),
        TitledBox(
            "csdn",
            Switch("upload.csdn.enabled"),
            Text("upload.csdn.cookie"),
        ),
        UntitledBox(
            Action("viewArticleUploaderReadme"),
        ),
        handleSettingsBox,
    ],
    ripgrep: [
        pluginFullBasePropBox,
        TitledBox(
            "windowPosition",
            Range("TOP_PERCENT", { min: 0, max: 100, step: 1 }),
            Range("WIDTH_PERCENT", { min: 0, max: 100, step: 1 }),
        ),
        TitledBox(
            "interaction",
            Switch("BACKSPACE_TO_HIDE"),
        ),
        handleSettingsBox,
    ],
    cursor_history: [
        pluginLiteBasePropBox,
        TitledBox(
            "hotkey",
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
            "rpcServer",
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
            Text("PROXY"),
        ),
        TitledBox(
            "autoUpdate",
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
            "fence",
            Text("LANGUAGE", protectedAttrs),
            Switch("INTERACTIVE_MODE"),
            Switch("STRICT_MODE"),
        ),
        TitledBox(
            "kanbanStyle",
            Number("KANBAN_WIDTH", { unit: UNITS.pixel, min: 1 }),
            Number("KANBAN_MAX_HEIGHT", { unit: UNITS.pixel, min: 1 }),
            Number("KANBAN_TASK_DESC_MAX_HEIGHT", { tooltip: "lowerThenZero", unit: UNITS.em, min: -1 }),
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
            "fence",
            Text("LANGUAGE", protectedAttrs),
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
        handleSettingsBox,
    ],
    timeline: [
        customPluginLiteBasePropBox,
        langModeBox,
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
        handleSettingsBox,
    ],
    echarts: [
        customPluginLiteBasePropBox,
        langModeBox,
        chartStyleBox,
        TextareaBox("TEMPLATE"),
        TitledBox(
            "advanced",
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
            "fenceLanguageMode",
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
        ObjectBOX("VISUAL_OPTIONS", { rows: 5 }),
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
            "advanced",
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
                    { type: "text", key: "type", label: "$label.list.type" },
                    { type: "text", key: "icon", label: "$label.list.icon" },
                    { type: "text", key: "background_color", label: "$label.list.background_color" },
                    { type: "text", key: "left_line_color", label: "$label.list.left_line_color" },
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
                    { type: "switch", key: "enable", label: "$label.template_variables.enable" },
                    { type: "text", key: "name", label: "$label.template_variables.name" },
                ),
                TitledBox("template_variables.callback", { type: "textarea", key: "callback", rows: 5 }),
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
                UntitledBox({ type: "text", key: "name", label: "$label.template.name" }),
                TitledBox("template.text", { type: "textarea", key: "text", rows: 10 }),
            ],
            {
                name: "",
                text: "",
            },
        ),
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
                    { type: "text", key: "0", label: "$label.auto_pair_symbols.0" },
                    { type: "text", key: "1", label: "$label.auto_pair_symbols.1" },
                ),
            ],
            ["", ""],
        ),
        TableBox(
            "auto_swap_symbols",
            ["0", "1"],
            [
                UntitledBox(
                    { type: "text", key: "0", label: "$label.auto_swap_symbols.0" },
                    { type: "text", key: "1", label: "$label.auto_swap_symbols.1" },
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
            "tocStyle",
            Range("width_percent_when_pin_right", { min: 0, max: 100, step: 1 }),
            Text("toc_font_size"),
        ),
        TitledBox(
            "name",
            Text("show_name.fence"),
            Text("show_name.image"),
            Text("show_name.table"),
            Text("show_name.link"),
            Text("show_name.math"),
        ),
        TitledBox(
            "displayHeader",
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
            "style",
            Range("mask_background_opacity", { min: 0, max: 1, step: 0.05 }),
            Range("image_max_width", { min: 0, max: 100, step: 1 }),
            Range("image_max_height", { min: 0, max: 100, step: 1 }),
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
            Number("play_second", { unit: UNITS.second, min: 0 }),
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
                    { type: "hotkey", key: "0", label: "$label.hotkey_function.0" },
                    { type: "select", key: "1", label: "$label.hotkey_function.1", options: OPTIONS.imageReviewer.operations },
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
        handleSettingsBox,
    ],
    markdownLint: [
        customPluginFullBasePropBox,
        TitledBox(
            "detectAndFix",
            Switch("translate"),
            Select("columns", OPTIONS.markdownLint.columns, { minItems: 1 }),
            Select("result_order_by", OPTIONS.markdownLint.result_order_by),
            Select("tools", OPTIONS.markdownLint.tools, { minItems: 1 }),
            Hotkey("hotkey_fix_lint_error"),
        ),
        TitledBox(
            "square",
            Switch("use_button"),
            Text("button_width", { dependencies: { use_button: true } }),
            Text("button_height", { dependencies: { use_button: true } }),
            Text("pass_color", { dependencies: { use_button: true } }),
            Text("error_color", { dependencies: { use_button: true } }),
        ),
        ObjectBOX("rule_config", { rows: 10 }),
        ArrayBox("custom_rules"),
        UntitledBox(
            Action("viewMarkdownlintRules"),
            Action("viewCustomMarkdownlintRules"),
        ),
        handleSettingsBox,
    ],
    reopenClosedFiles: [
        customPluginFullBasePropBox,
        UntitledBox(
            Switch("auto_reopen_when_init"),
        ),
        handleSettingsBox,
    ],
    quickButton: [
        customPluginFullBasePropBox,
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
                    { type: "switch", key: "disable", label: "$label.buttons.disable" },
                    { type: "number", key: "coordinate.0", label: "$label.buttons.coordinate.0", tooltip: "$tooltip.buttons.coordinate.0" },
                    { type: "number", key: "coordinate.1", label: "$label.buttons.coordinate.1", tooltip: "$tooltip.buttons.coordinate.1" },
                    { type: "text", key: "icon", label: "$label.buttons.icon" },
                    { type: "text", key: "size", label: "$label.buttons.size" },
                    { type: "text", key: "color", label: "$label.buttons.color" },
                    { type: "text", key: "bgColor", label: "$label.buttons.bgColor" },
                    { type: "text", key: "hint", label: "$label.buttons.hint" },
                    { type: "text", key: "callback", label: "$label.buttons.callback", tooltip: "tooltip.exclusive" },
                ),
                TitledBox("buttons.evil", { type: "textarea", key: "evil", placeholder: "$placeholder.customCallback", rows: 5 }),
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

module.exports = {
    ...JSON.parse(JSON.stringify(SETTING_SCHEMAS))
}
