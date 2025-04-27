const Label = (key) => key ? `$label.${key}` : undefined
const Tooltip = (tooltip) => tooltip ? `$tooltip.${tooltip}` : undefined
const Placeholder = (placeholder) => placeholder ? `$placeholder.${placeholder}` : undefined

const Switch = (key, tooltip, disabled) => {
    const label = Label(key)
    tooltip = Tooltip(tooltip)
    return { type: "switch", key, label, tooltip, disabled }
}
const Text = (key, tooltip, placeholder, disabled) => {
    const label = Label(key)
    tooltip = Tooltip(tooltip)
    placeholder = Placeholder(placeholder)
    return { type: "text", key, label, tooltip, placeholder, disabled }
}
const Hotkey = (key, tooltip, placeholder, disabled) => {
    const label = Label(key)
    tooltip = Tooltip(tooltip)
    placeholder = Placeholder(placeholder)
    return { type: "hotkey", key, label, tooltip, placeholder, disabled }
}
const Select = (key, options, tooltip, minItems, maxItems) => {
    const label = Label(key)
    tooltip = Tooltip(tooltip)
    return { type: "select", key, label, tooltip, options, minItems, maxItems }
}
const Action = (act) => {
    const label = Label(act)
    return { type: "action", act, label }
}
const Static = (key) => {
    const label = Label(key)
    return { type: "static", key, label }
}
const Number = (key, tooltip, unit, min, max, step) => {
    const label = Label(key)
    tooltip = Tooltip(tooltip)
    return { type: "number", key, unit, min, max, step, label, tooltip }
}
const Range = (key, tooltip, min, max, step) => {
    const label = Label(key)
    tooltip = Tooltip(tooltip)
    return { type: "range", key, min, max, step, label, tooltip }
}

const UntitledBox = (...fields) => ({ title: undefined, fields })
const TitledBox = (title, ...fields) => ({ title: `$title.${title}`, fields })
const ArrayBox = (key) => TitledBox(key, { type: "array", key })
const ObjectBOX = (key, rows = 10) => TitledBox(key, { type: "object", key, rows })
const TextareaBox = (key, rows = 10) => TitledBox(key, { type: "textarea", key, rows })
const TableBox = (key, ths) => TitledBox(key, {
    type: "table",
    key,
    thMap: Object.fromEntries(ths.map(th => [th, `$th.${key}.${th}`]))
})

const prop_ENABLE = Switch("ENABLE")
const prop_NAME = Text("NAME", undefined, "defaultIfEmpty")
const prop_HOTKEY = Hotkey("HOTKEY")
const prop_enable = Switch("enable")
const prop_hide = Switch("hide")
const prop_name = Text("name", undefined, "defaultIfEmpty")
const prop_order = Number("order")
const prop_hotkey = Hotkey("hotkey")

const pluginLiteBasePropBox = UntitledBox(prop_ENABLE, prop_NAME)
const pluginFullBasePropBox = UntitledBox(prop_ENABLE, prop_NAME, prop_HOTKEY)
const customPluginLiteBasePropBox = UntitledBox(prop_enable, prop_hide, prop_name, prop_order)
const customPluginFullBasePropBox = UntitledBox(prop_enable, prop_hide, prop_name, prop_order, prop_hotkey)

const restoreSettingsBox = UntitledBox(Action("restoreSettings"))
const langModeBox = TitledBox("fenceLanguageMode", Text("LANGUAGE"), Switch("INTERACTIVE_MODE"))
const chartStyleBox = TitledBox("diagramStyle", Text("DEFAULT_FENCE_HEIGHT"), Text("DEFAULT_FENCE_BACKGROUND_COLOR"))

const OPTIONS = {
    global: {
        LOCALE: ["auto", "en", "zh-CN", "zh-TW"],
        EXIT_INTERACTIVE_MODE: ["click_exit_button", "ctrl_click_fence"],
    },
    window_tab: {
        CONTEXT_MENU: ["closeTab", "closeOtherTabs", "closeLeftTabs", "closeRightTabs", "copyPath", "showInFinder", "openInNewWindow", "sortTabs"],
        NEW_TAB_POSITION: ["right", "end"],
        TAB_SWITCH_ON_CLOSE: ["left", "right", "latest"],
        LAST_TAB_CLOSE_ACTION: ["blankPage", "reconfirm", "exit"]
    },
    commander: {
        QUICK_RUN_DISPLAY: ["echo", "always", "error", "silent"],
        COMMIT_RUN_DISPLAY: ["echo", "always"]
    },
    blur: {
        BLUR_TYPE: ["blur", "hide"]
    },
    toolbar: {
        DEFAULT_TOOL: ["", "plu", "tab", "his", "ops", "mode", "theme", "out", "func", "all"]
    },
    resize_image: {
        IMAGE_ALIGN: ["center", "left", "right"]
    },
    auto_number: {
        ALIGN: ["left", "right", "center"],
        POSITION_TABLE: ["before", "after"]
    },
    text_stylize: {
        TOOLBAR: ["weight", "italic", "underline", "throughline", "overline", "superScript", "subScript", "emphasis", "blur", "title", "increaseSize", "decreaseSize", "increaseLetterSpacing", "decreaseLetterSpacing", "family", "foregroundColor", "backgroundColor", "borderColor", "erase", "blank", "setBrush", "useBrush", "move", "close"]
    },
    slash_commands: {
        SUGGESTION_TIMING: ["on_input", "debounce"],
        MATCH_STRATEGY: ["prefix", "substr", "abbr"],
        ORDER_STRATEGY: ["predefined", "lexicographic", "length_based", "earliest_hit"]
    },
    preferences: {
        OBJECT_SETTINGS_FORMAT: ["JSON", "TOML", "YAML"]
    },
    echarts: {
        RENDERER: ["canvas", "svg"],
        EXPORT_TYPE: ["png", "jpg", "svg"]
    },
    imageReviewer: {
        operations: ["close", "download", "scroll", "play", "location", "nextImage", "previousImage", "firstImage", "lastImage", "thumbnailNav", "waterFall", "zoomIn", "zoomOut", "rotateLeft", "rotateRight", "hFlip", "vFlip", "translateLeft", "translateRight", "translateUp", "translateDown", "incHSkew", "decHSkew", "incVSkew", "decVSkew", "originSize", "fixScreen", "autoSize", "restore", "info", "dummy"],
        tool_position: ["bottom", "top"],
        show_message: ["index", "title", "size"],
        first_image_strategies: ["inViewBoxImage", "closestViewBoxImage", "firstImage"],
        thumbnail_object_fit: ["fill", "contain", "cover", "scale-down"]
    },
    markdownLint: {
        tools: ["info", "locate", "fix"],
        result_order_by: ["lineNumber", "ruleName"]
    }
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
    piece: "$unit.piece",
    line: "$unit.line",
    percent: "$unit.percent",
    degree: "$unit.degree",
    em: "$unit.em",
}

const SETTING_SCHEMAS = {
    global: [
        UntitledBox(
            Switch("ENABLE", "protected", true),
            Select("LOCALE", OPTIONS.global.LOCALE),
            Select("EXIT_INTERACTIVE_MODE", OPTIONS.global.EXIT_INTERACTIVE_MODE, undefined, 1),
        ),
        UntitledBox(
            Action("openSettingsFolder"),
            Action("backupSettings"),
            Action("restoreSettings"),
            Action("restoreAllSettings"),
        ),
        UntitledBox(
            Action("visitRepo"),
            Action("updatePlugin"),
            Static("pluginVersion"),
        )
    ],
    window_tab: [
        pluginLiteBasePropBox,
        TitledBox(
            "appearance",
            Switch("SHOW_TAB_CLOSE_BUTTON"),
            Switch("TRIM_FILE_EXT"),
            Switch("SHOW_DIR_ON_DUPLICATE"),
            Switch("HIDE_WINDOW_TITLE_BAR", "hideTitleBar"),
            Text("TAB_MIN_WIDTH"),
            Text("TAB_MAX_WIDTH"),
            Number("MAX_TAB_NUM", "minusOne"),
            Select("CONTEXT_MENU", OPTIONS.window_tab.CONTEXT_MENU),
        ),
        TitledBox(
            "behavior",
            Select("NEW_TAB_POSITION", OPTIONS.window_tab.NEW_TAB_POSITION),
            Select("TAB_SWITCH_ON_CLOSE", OPTIONS.window_tab.TAB_SWITCH_ON_CLOSE),
            Select("LAST_TAB_CLOSE_ACTION", OPTIONS.window_tab.LAST_TAB_CLOSE_ACTION),
        ),
        ArrayBox("CLOSE_HOTKEY"),
        ArrayBox("SWITCH_PREVIOUS_TAB_HOTKEY"),
        ArrayBox("SWITCH_NEXT_TAB_HOTKEY"),
        ArrayBox("SORT_TABS_HOTKEY"),
        ArrayBox("COPY_PATH_HOTKEY"),
        ArrayBox("TOGGLE_TAB_BAR_HOTKEY"),
        TitledBox(
            "mouseInteraction",
            Switch("CTRL_CLICK_TO_NEW_WINDOW"),
            Switch("CTRL_WHEEL_TO_SWITCH"),
            Switch("MIDDLE_CLICK_TO_CLOSE"),
            Switch("SHOW_FULL_PATH_WHEN_HOVER"),
            Switch("JETBRAINS_DRAG_STYLE"),
            Switch("LOCK_DRAG_Y_AXIS"),
            Switch("LIMIT_TAB_Y_AXIS_WHEN_DRAG"),
            Number("Y_AXIS_LIMIT_THRESHOLD", "noVerticalMovement", undefined, 0.1, 3, 0.1),
            Number("DRAG_NEW_WINDOW_THRESHOLD", "newWindow"),
        ),
        restoreSettingsBox,
    ],
    search_multi: [
        pluginFullBasePropBox,
        TitledBox(
            "searchResult",
            Switch("RELATIVE_PATH"),
            Switch("SHOW_EXT"),
            Switch("SHOW_MTIME"),
            Switch("REMOVE_BUTTON_HINT"),
            Number("MAX_HITS"),
        ),
        TitledBox(
            "search",
            Switch("CASE_SENSITIVE"),
            Switch("OPTIMIZE_SEARCH", "blockOrder"),
            Number("MAX_SIZE", undefined, UNITS.byte),
        ),
        TitledBox(
            "windowInteraction",
            Switch("AUTO_HIDE"),
            Switch("BACKSPACE_TO_HIDE"),
            Switch("ALLOW_DRAG"),
        ),
        ArrayBox("ALLOW_EXT"),
        ArrayBox("IGNORE_FOLDERS"),
        ArrayBox("HIGHLIGHT_COLORS"),
        restoreSettingsBox,
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
            Switch("ALLOW_DRAG"),
        ),
        ObjectBOX("BUILTIN"),
        // // todo
        // TableBox(
        //     "BUILTIN",
        //     ["name", "shell", "cmd"],
        // ),
        restoreSettingsBox,
    ],
    md_padding: [
        pluginFullBasePropBox,
        ArrayBox("IGNORE_WORDS"),
        ArrayBox("IGNORE_PATTERNS"),
        restoreSettingsBox,
    ],
    read_only: [
        pluginFullBasePropBox,
        TitledBox(
            "underReadOnly",
            Switch("READ_ONLY_DEFAULT"),
            Switch("NO_EXPAND_WHEN_READ_ONLY"),
            Switch("REMOVE_EXPAND_WHEN_READ_ONLY"),
            Switch("CLICK_HYPERLINK_TO_OPEN_WHEN_READ_ONLY"),
            Switch("DISABLE_CONTEXT_MENU_WHEN_READ_ONLY"),
            Text("SHOW_TEXT"),
        ),
        ArrayBox("REMAIN_AVAILABLE_MENU_KEY"),
        restoreSettingsBox,
    ],
    blur: [
        pluginFullBasePropBox,
        UntitledBox(
            Switch("BLUR_DEFAULT"),
            Switch("RESTORE_WHEN_HOVER"),
            Select("BLUR_TYPE", OPTIONS.blur.BLUR_TYPE),
            Number("BLUR_LEVEL", undefined, UNITS.pixel),
        ),
        restoreSettingsBox,
    ],
    dark: [
        pluginFullBasePropBox,
        UntitledBox(
            Switch("DARK_DEFAULT")
        ),
        restoreSettingsBox,
    ],
    no_image: [
        pluginFullBasePropBox,
        UntitledBox(
            Switch("DEFAULT_NO_IMAGE_MODE"),
            Switch("RESHOW_WHEN_HOVER"),
            Number("TRANSITION_DURATION", undefined, UNITS.millisecond),
            Number("TRANSITION_DELAY", undefined, UNITS.millisecond),
        ),
        restoreSettingsBox,
    ],
    toolbar: [
        pluginFullBasePropBox,
        TitledBox(
            "searchBarPosition",
            Range("TOOLBAR_TOP_PERCENT", undefined, 0, 100, 1),
            Range("TOOLBAR_WIDTH_PERCENT", undefined, 0, 100, 1),
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
            Switch("PAUSE_ON_COMPOSITION", "pauseOnComposition"),
            Number("DEBOUNCE_INTERVAL", undefined, UNITS.millisecond),
        ),
        restoreSettingsBox,
    ],
    resize_image: [
        pluginLiteBasePropBox,
        TitledBox(
            "picture",
            Switch("RECORD_RESIZE"),
            Switch("ALLOW_EXCEED_LIMIT"),
            Select("IMAGE_ALIGN", OPTIONS.resize_image.IMAGE_ALIGN),
        ),
        TitledBox(
            "modificationKeys",
            Hotkey("MODIFIER_KEY.TEMPORARY", "modifyKeyExample"),
            Hotkey("MODIFIER_KEY.PERSISTENT"),
        ),
        restoreSettingsBox,
    ],
    resize_table: [
        pluginLiteBasePropBox,
        UntitledBox(
            Switch("RECORD_RESIZE"),
            Switch("REMOVE_MIN_CELL_WIDTH"),
            Number("DRAG_THRESHOLD", undefined, UNITS.pixel),
        ),
        restoreSettingsBox,
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
            Number("PAGE_LENGTH", undefined, UNITS.piece),
        ),
        restoreSettingsBox,
    ],
    go_top: [
        pluginLiteBasePropBox,
        UntitledBox(
            Hotkey("HOTKEY_GO_TOP"),
            Hotkey("HOTKEY_GO_BOTTOM"),
        ),
        restoreSettingsBox,
    ],
    markmap: [
        pluginLiteBasePropBox,
        TitledBox(
            "mindmapDiagram",
            Switch("ENABLE_TOC_MARKMAP"),
            Hotkey("TOC_HOTKEY"),
            Switch("FIX_ERROR_LEVEL_HEADER"),
            Switch("AUTO_UPDATE"),
            Switch("AUTO_FIT_WHEN_RESIZE"),
            Switch("AUTO_FIT_WHEN_UPDATE"),
            Switch("KEEP_FOLD_STATE_WHEN_UPDATE"),
            Switch("CLICK_TO_POSITIONING"),
            Switch("AUTO_COLLAPSE_PARAGRAPH_WHEN_FOLD", "experimental"),
            Range("POSITIONING_VIEWPORT_HEIGHT", undefined, 0.1, 0.95, 0.01),
            Range("WIDTH_PERCENT_WHEN_INIT", undefined, 20, 95, 1),
            Range("HEIGHT_PERCENT_WHEN_INIT", undefined, 20, 95, 1),
            Range("HEIGHT_PERCENT_WHEN_PIN_TOP", undefined, 20, 95, 1),
            Range("WIDTH_PERCENT_WHEN_PIN_RIGHT", undefined, 20, 95, 1),
            Text("NODE_BORDER_WHEN_HOVER"),
        ),
        TitledBox(
            "mindmapDiagramDefaultOptions",
            Switch("DEFAULT_TOC_OPTIONS.zoom"),
            Switch("DEFAULT_TOC_OPTIONS.pan"),
            Switch("DEFAULT_TOC_OPTIONS.autoFit"),
            Range("DEFAULT_TOC_OPTIONS.initialExpandLevel", undefined, 1, 6, 1),
            Range("DEFAULT_TOC_OPTIONS.colorFreezeLevel", undefined, 1, 6, 1),
            Range("DEFAULT_TOC_OPTIONS.fitRatio", undefined, 0.5, 1, 0.01),
            Number("DEFAULT_TOC_OPTIONS.maxWidth", "zero", UNITS.pixel, 0, 100, 5),
            Number("DEFAULT_TOC_OPTIONS.spacingHorizontal", undefined, UNITS.pixel, 0, 100, 5),
            Number("DEFAULT_TOC_OPTIONS.spacingVertical", undefined, UNITS.pixel, 0, 100, 5),
            Number("DEFAULT_TOC_OPTIONS.paddingX", undefined, UNITS.pixel, 0, 100, 5),
            Number("DEFAULT_TOC_OPTIONS.duration", undefined, UNITS.millisecond, 0, 1000, 10),
        ),
        ArrayBox("DEFAULT_TOC_OPTIONS.color"),
        ObjectBOX("CANDIDATE_COLOR_SCHEMES"),
        TitledBox(
            "mindmapDiagramExport",
            Switch("DOWNLOAD_OPTIONS.KEEP_ALPHA_CHANNEL"),
            Switch("DOWNLOAD_OPTIONS.REMOVE_USELESS_CLASSES"),
            Switch("DOWNLOAD_OPTIONS.REMOVE_FOREIGN_OBJECT"),
            Switch("DOWNLOAD_OPTIONS.SHOW_PATH_INQUIRY_DIALOG"),
            Switch("DOWNLOAD_OPTIONS.SHOW_IN_FINDER"),
            Range("DOWNLOAD_OPTIONS.IMAGE_QUALITY", undefined, 0.01, 1, 0.01),
            Number("DOWNLOAD_OPTIONS.PADDING_HORIZONTAL", undefined, UNITS.pixel, 1, 1000, 1),
            Number("DOWNLOAD_OPTIONS.PADDING_VERTICAL", undefined, UNITS.pixel, 1, 1000, 1),
            Text("DOWNLOAD_OPTIONS.FILENAME"),
            Text("DOWNLOAD_OPTIONS.FOLDER"),
            Text("DOWNLOAD_OPTIONS.BACKGROUND_COLOR"),
            Text("DOWNLOAD_OPTIONS.TEXT_COLOR"),
            Text("DOWNLOAD_OPTIONS.OPEN_CIRCLE_COLOR"),
        ),
        TitledBox(
            "fence",
            Switch("ENABLE_FENCE_MARKMAP"),
            Switch("INTERACTIVE_MODE"),
            Hotkey("FENCE_HOTKEY"),
            Text("FENCE_LANGUAGE"),
            Text("DEFAULT_FENCE_HEIGHT"),
            Text("DEFAULT_FENCE_BACKGROUND_COLOR"),
        ),
        TitledBox(
            "fenceDiagramDefaultOptions",
            Switch("DEFAULT_FENCE_OPTIONS.zoom"),
            Switch("DEFAULT_FENCE_OPTIONS.pan"),
            Range("DEFAULT_FENCE_OPTIONS.initialExpandLevel", undefined, 1, 6, 1),
            Range("DEFAULT_FENCE_OPTIONS.colorFreezeLevel", undefined, 1, 6, 1),
            Range("DEFAULT_FENCE_OPTIONS.fitRatio", undefined, 0.5, 1, 0.01),
            Number("DEFAULT_FENCE_OPTIONS.maxWidth", "zero", UNITS.pixel, 0, 1000, 10),
            Number("DEFAULT_FENCE_OPTIONS.spacingHorizontal", undefined, UNITS.pixel, 0, 200, 1),
            Number("DEFAULT_FENCE_OPTIONS.spacingVertical", undefined, UNITS.pixel, 0, 100, 1),
            Number("DEFAULT_FENCE_OPTIONS.paddingX", undefined, UNITS.pixel, 0, 100, 1),
            Number("DEFAULT_FENCE_OPTIONS.duration", undefined, UNITS.millisecond, 0, 1000, 10),
            Text("DEFAULT_FENCE_OPTIONS.height"),
            Text("DEFAULT_FENCE_OPTIONS.backgroundColor"),
        ),
        ArrayBox("DEFAULT_FENCE_OPTIONS.color"),
        TextareaBox("FENCE_TEMPLATE"),
        restoreSettingsBox,
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
            Switch("SHOW_IMAGE_NAME"),
            Select("ALIGN", OPTIONS.auto_number.ALIGN),
            Select("POSITION_TABLE", OPTIONS.auto_number.POSITION_TABLE),
            Text("FONT_FAMILY"),
        ),
        ObjectBOX("LAYOUTS"),
        TitledBox(
            "advanced",
            Switch("ENABLE_WHEN_EXPORT"),
        ),
        restoreSettingsBox,
    ],
    fence_enhance: [
        pluginLiteBasePropBox,
        TitledBox(
            "buttonStyle",
            Switch("ENABLE_BUTTON"),
            Switch("AUTO_HIDE"),
            Switch("REMOVE_BUTTON_HINT"),
            Range("BUTTON_OPACITY", undefined, 0, 1, 0.05),
            Range("BUTTON_OPACITY_HOVER", undefined, 0, 1, 0.05),
            Text("BUTTON_SIZE"),
            Text("BUTTON_COLOR"),
            Text("BUTTON_MARGIN"),
            Text("BUTTON_TOP"),
            Text("BUTTON_RIGHT"),
            Number("WAIT_RECOVER_INTERVAL", undefined, UNITS.millisecond, 500, undefined, 100),
        ),
        TitledBox(
            "buttons",
            Switch("ENABLE_COPY"),
            Switch("ENABLE_INDENT"),
            Switch("ENABLE_FOLD"),
            Switch("DEFAULT_FOLD"),
            Number("DEFAULT_FOLD_THRESHOLD", undefined, UNITS.line, 0, undefined, 1),
        ),
        TitledBox(
            "buttonHotkeys",
            Switch("ENABLE_HOTKEY"),
            Text("SWAP_PREVIOUS_LINE", "codeMirrorStyle"),
            Text("SWAP_NEXT_LINE"),
            Text("COPY_PREVIOUS_LINE"),
            Text("COPY_NEXT_LINE"),
            Text("INSERT_LINE_PREVIOUS"),
            Text("INSERT_LINE_NEXT"),
        ),
        ObjectBOX("CUSTOM_BUTTONS"),
        TitledBox(
            "advanced",
            Switch("ENABLE_LANGUAGE_FOLD"),
            Switch("INDENTED_WRAPPED_LINE"),
            Switch("HIGHLIGHT_BY_LANGUAGE"),
            Switch("HIGHLIGHT_WHEN_HOVER"),
            Text("HIGHLIGHT_LINE_COLOR"),
        ),
        restoreSettingsBox,
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
            Hotkey("MODIFIER_KEY.COLLAPSE_SINGLE", "modifierKeyExample"),
            Hotkey("MODIFIER_KEY.COLLAPSE_SIBLINGS"),
            Hotkey("MODIFIER_KEY.COLLAPSE_ALL_SIBLINGS"),
            Hotkey("MODIFIER_KEY.COLLAPSE_RECURSIVE"),
        ),
        restoreSettingsBox,
    ],
    collapse_list: [
        pluginLiteBasePropBox,
        UntitledBox(
            Switch("RECORD_COLLAPSE"),
            Text("TRIANGLE_COLOR"),
        ),
        restoreSettingsBox,
    ],
    collapse_table: [
        pluginLiteBasePropBox,
        UntitledBox(
            Switch("RECORD_COLLAPSE"),
        ),
        restoreSettingsBox,
    ],
    truncate_text: [
        pluginLiteBasePropBox,
        TitledBox(
            "hotkey",
            Hotkey("HIDE_FRONT_HOTKEY"),
            Hotkey("SHOW_ALL_HOTKEY"),
            Hotkey("HIDE_BASE_VIEW_HOTKEY"),
            Number("REMAIN_LENGTH"),
        ),
        restoreSettingsBox,
    ],
    export_enhance: [
        pluginLiteBasePropBox,
        TitledBox(
            "networkImage",
            Switch("DOWNLOAD_NETWORK_IMAGE"),
            Number("DOWNLOAD_THREADS"),
        ),
        restoreSettingsBox,
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
            Select("TOOLBAR", OPTIONS.text_stylize.TOOLBAR),
        ),
        TitledBox(
            "buttonDefaultOptions",
            Text("DEFAULT_COLORS.FOREGROUND"),
            Text("DEFAULT_COLORS.BACKGROUND"),
            Text("DEFAULT_COLORS.BORDER"),
            Text("DEFAULT_FORMAT_BRUSH", "brushExample"),
        ),
        ObjectBOX("COLOR_TABLE"),
        ObjectBOX("ACTION_HOTKEYS"),
        restoreSettingsBox,
    ],
    cipher: [
        pluginLiteBasePropBox,
        UntitledBox(
            Hotkey("ENCRYPT_HOTKEY"),
            Hotkey("DECRYPT_HOTKEY"),
        ),
        UntitledBox(
            Switch("SHOW_HINT_MODAL"),
        ),
        restoreSettingsBox,
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
        restoreSettingsBox,
    ],
    custom: [
        UntitledBox(
            Switch("ENABLE", "protected", true),
            prop_NAME
        ),
        UntitledBox(
            Switch("HIDE_DISABLE_PLUGINS"),
        ),
        restoreSettingsBox,
    ],
    slash_commands: [
        pluginLiteBasePropBox,
        TitledBox(
            "trigger",
            Text("TRIGGER_REGEXP"),
            Text("FUNC_PARAM_SEPARATOR", "protected", undefined, true),
            Select("SUGGESTION_TIMING", OPTIONS.slash_commands.SUGGESTION_TIMING),
            Select("MATCH_STRATEGY", OPTIONS.slash_commands.MATCH_STRATEGY),
            Select("ORDER_STRATEGY", OPTIONS.slash_commands.ORDER_STRATEGY),
        ),
        ObjectBOX("COMMANDS"),
        restoreSettingsBox,
    ],
    right_click_menu: [
        UntitledBox(
            Switch("ENABLE", "protected", true),
            prop_NAME
        ),
        TitledBox(
            "style",
            Switch("SHOW_PLUGIN_HOTKEY"),
            Switch("SHOW_ACTION_OPTIONS_ICON"),
            Switch("DO_NOT_HIDE"),
            Switch("HIDE_OTHER_OPTIONS"),
            Text("MENU_MIN_WIDTH"),
        ),
        ObjectBOX("MENUS"),
        TitledBox(
            "advanced",
            Switch("FIND_LOST_PLUGIN")
        ),
        restoreSettingsBox,
    ],
    pie_menu: [
        pluginFullBasePropBox,
        UntitledBox(
            Hotkey("MODIFIER_KEY", "example")
        ),
        ObjectBOX("BUTTONS"),
        restoreSettingsBox,
    ],
    preferences: [
        UntitledBox(
            Switch("ENABLE", "protected", true),
            prop_NAME,
            prop_HOTKEY
        ),
        UntitledBox(
            Switch("SEARCH_PLUGIN_FIXEDNAME"),
            Select("OBJECT_SETTINGS_FORMAT", OPTIONS.preferences.OBJECT_SETTINGS_FORMAT),
            Text("DEFAULT_MENU"),
        ),
        restoreSettingsBox,
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
            Number("IGNORE_MIN_NUM", "ignoreMinNum"),
            Number("MAX_SIZE", undefined, UNITS.byte),
        ),
        ArrayBox("ALLOW_EXT"),
        ArrayBox("IGNORE_FOLDERS"),
        restoreSettingsBox,
    ],
    hotkeys: [
        pluginFullBasePropBox,
        ObjectBOX("CUSTOM_HOTKEYS"),
        restoreSettingsBox,
    ],
    help: [
        pluginLiteBasePropBox,
        restoreSettingsBox,
    ],
    editor_width_slider: [
        pluginLiteBasePropBox,
        UntitledBox(
            Number("WIDTH_RATIO", "minusOneMeansDisable", UNITS.percent, undefined, 100, 1),
        ),
        restoreSettingsBox,
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
            Action("articleUploaderReadme"),
        ),
        restoreSettingsBox,
    ],
    ripgrep: [
        pluginFullBasePropBox,
        TitledBox(
            "windowPosition",
            Range("TOP_PERCENT", undefined, 0, 100, 1),
            Range("WIDTH_PERCENT", undefined, 0, 100, 1),
        ),
        TitledBox(
            "interaction",
            Switch("BACKSPACE_TO_HIDE"),
        ),
        restoreSettingsBox,
    ],
    json_rpc: [
        pluginLiteBasePropBox,
        TitledBox(
            "rpcServer",
            Switch("SERVER_OPTIONS.strict"),
            Text("SERVER_OPTIONS.host"),
            Number("SERVER_OPTIONS.port", undefined, undefined, 0, 65535, 1),
            Text("SERVER_OPTIONS.path"),
        ),
        restoreSettingsBox,
    ],
    updater: [
        pluginFullBasePropBox,
        UntitledBox(
            Text("PROXY"),
        ),
        TitledBox(
            "autoUpdate",
            Switch("AUTO_UPDATE"),
            Number("UPDATE_LOOP_INTERVAL", "loopInterval", UNITS.millisecond),
            Number("START_UPDATE_INTERVAL", "waitInterval", UNITS.millisecond),
        ),
        restoreSettingsBox,
    ],
    test: [
        pluginLiteBasePropBox,
        restoreSettingsBox,
    ],
    kanban: [
        customPluginLiteBasePropBox,
        TitledBox(
            "fence",
            Text("LANGUAGE"),
            Switch("INTERACTIVE_MODE"),
            Switch("STRICT_MODE"),
        ),
        TitledBox(
            "kanbanStyle",
            Number("KANBAN_WIDTH", undefined, UNITS.pixel),
            Number("KANBAN_MAX_HEIGHT", undefined, UNITS.pixel),
            Number("KANBAN_TASK_DESC_MAX_HEIGHT", "lowerThenZero", UNITS.em),
            Switch("HIDE_DESC_WHEN_EMPTY"),
            Switch("WRAP"),
            Switch("CTRL_WHEEL_TO_SWITCH"),
            Switch("ALLOW_MARKDOWN_INLINE_STYLE"),
        ),
        ArrayBox("KANBAN_COLOR"),
        ArrayBox("TASK_COLOR"),
        TextareaBox("TEMPLATE"),
        restoreSettingsBox,
    ],
    chat: [
        customPluginLiteBasePropBox,
        TitledBox(
            "fence",
            Text("LANGUAGE"),
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
        restoreSettingsBox,
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
        restoreSettingsBox,
    ],
    echarts: [
        customPluginLiteBasePropBox,
        langModeBox,
        chartStyleBox,
        TextareaBox("TEMPLATE"),
        TitledBox(
            "advanced",
            Select("RENDERER", OPTIONS.echarts.RENDERER),
            Select("EXPORT_TYPE", OPTIONS.echarts.EXPORT_TYPE),
        ),
        restoreSettingsBox,
    ],
    chart: [
        customPluginLiteBasePropBox,
        langModeBox,
        chartStyleBox,
        TextareaBox("TEMPLATE"),
        restoreSettingsBox,
    ],
    wavedrom: [
        customPluginLiteBasePropBox,
        TitledBox(
            "fenceLanguageMode",
            Text("LANGUAGE"),
            Switch("INTERACTIVE_MODE"),
            Switch("SAFE_MODE"),
        ),
        chartStyleBox,
        TextareaBox("TEMPLATE"),
        restoreSettingsBox,
    ],
    calendar: [
        customPluginLiteBasePropBox,
        langModeBox,
        chartStyleBox,
        TextareaBox("TEMPLATE"),
        restoreSettingsBox,
    ],
    abc: [
        customPluginLiteBasePropBox,
        langModeBox,
        chartStyleBox,
        TextareaBox("TEMPLATE"),
        ObjectBOX("VISUAL_OPTIONS", 6),
        restoreSettingsBox,
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
        restoreSettingsBox,
    ],
    marp: [
        customPluginLiteBasePropBox,
        langModeBox,
        TextareaBox("TEMPLATE"),
        restoreSettingsBox,
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
            Switch("use_network_icon_when_exporting", "messingFont"),
            Text("network_icon_url"),
        ),
        TitledBox(
            "defaultOptions",
            Text("default_background_color"),
            Text("default_left_line_color"),
            Text("default_icon"),
        ),
        ObjectBOX("list"),
        TextareaBox("template"),
        restoreSettingsBox,
    ],
    templater: [
        customPluginFullBasePropBox,
        UntitledBox(
            Switch("auto_open"),
        ),
        ObjectBOX("template_variables"),
        ObjectBOX("template"),
        restoreSettingsBox,
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
        ObjectBOX("auto_pair_symbols"),
        ObjectBOX("auto_swap_symbols"),
        restoreSettingsBox,
    ],
    toc: [
        customPluginFullBasePropBox,
        UntitledBox(
            Switch("default_show_toc"),
            Switch("escape_header"),
            Switch("right_click_outline_button_to_toggle"),
        ),
        TitledBox(
            "tocStyle",
            Range("width_percent_when_pin_right", undefined, 0, 100, 1),
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
        restoreSettingsBox,
    ],
    resourceOperation: [
        customPluginFullBasePropBox,
        TitledBox(
            "windowPosition",
            Range("modal_height_percent", undefined, 0, 100, 1),
            Range("modal_width_percent", undefined, 0, 100, 1),
            Range("modal_left_percent", undefined, 0, 100, 1),
        ),
        UntitledBox(
            Switch("ignore_img_html_element"),
        ),
        ArrayBox("resource_suffix"),
        UntitledBox(
            Switch("collect_file_without_suffix"),
        ),
        ArrayBox("markdown_suffix"),
        ArrayBox("ignore_folders"),
        restoreSettingsBox,
    ],
    scrollBookmarker: [
        customPluginFullBasePropBox,
        UntitledBox(
            Hotkey("modifier_key", "modifierKeyExample"),
            Switch("auto_popup_modal"),
            Switch("persistence"),
        ),
        restoreSettingsBox,
    ],
    imageReviewer: [
        customPluginFullBasePropBox,
        TitledBox(
            "style",
            Range("mask_background_opacity", undefined, 0, 1, 0.05),
            Range("image_max_width", undefined, 0, 100, 1),
            Range("image_max_height", undefined, 0, 100, 1),
            Text("thumbnail_height"),
            Number("blur_level", undefined, UNITS.pixel),
            Number("thumbnail_scroll_padding_count", undefined, undefined, 0),
            Number("water_fall_columns", undefined, undefined, 0),
        ),
        TitledBox(
            "component",
            Switch("show_thumbnail_nav"),
            Select("tool_position", OPTIONS.imageReviewer.tool_position),
            Select("show_message", OPTIONS.imageReviewer.show_message),
            Select("tool_function", OPTIONS.imageReviewer.operations, undefined, 1)
        ),
        TitledBox(
            "behavior",
            Switch("filter_error_image"),
            Select("first_image_strategies", OPTIONS.imageReviewer.first_image_strategies, undefined, 1),
            Select("thumbnail_object_fit", OPTIONS.imageReviewer.thumbnail_object_fit),
            Number("play_second", undefined, UNITS.second),
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
        ObjectBOX("hotkey_function"),
        TitledBox(
            "adjustScale",
            Number("zoom_scale", undefined, UNITS.percent),
            Number("rotate_scale", undefined, UNITS.degree),
            Number("skew_scale", undefined, UNITS.degree),
            Number("translate_scale", undefined, UNITS.pixel),
        ),
        restoreSettingsBox,
    ],
    markdownLint: [
        customPluginFullBasePropBox,
        TitledBox(
            "windowStyle",
            Text("modal_width"),
            Text("modal_max_height"),
            Text("modal_font_size"),
            Number("modal_line_height", undefined, UNITS.em),
        ),
        TitledBox(
            "cube",
            Switch("use_button"),
            Text("button_width"),
            Text("button_height"),
            Text("pass_color"),
            Text("error_color"),
        ),
        TitledBox(
            "detectAndFix",
            Switch("translate"),
            Select("tools", OPTIONS.markdownLint.tools, undefined, 1),
            Select("result_order_by", OPTIONS.markdownLint.result_order_by),
            Hotkey("hotkey_fix_lint_error"),
        ),
        ObjectBOX("rule_config", 15),
        ArrayBox("custom_rules"),
        restoreSettingsBox,
    ],
    reopenClosedFiles: [
        customPluginFullBasePropBox,
        UntitledBox(
            Switch("auto_reopen_when_init"),
        ),
        restoreSettingsBox,
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
        ObjectBOX("buttons"),
        restoreSettingsBox,
    ],
    blockSideBySide: [
        customPluginFullBasePropBox,
        restoreSettingsBox,
    ],
    redirectLocalRootUrl: [
        customPluginLiteBasePropBox,
        UntitledBox(
            Text("root"),
            Text("filter_regexp"),
        ),
        restoreSettingsBox,
    ],
}

module.exports = {
    ...JSON.parse(JSON.stringify(SETTING_SCHEMAS))
}
