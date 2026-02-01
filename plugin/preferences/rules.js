const self = (rules) => ({ $self: rules })
const each = (rules) => ({ $each: rules })

const url = "url"
const regex = "regex"
const path = "path"
const required = "required"
const array = "array"
const notZero = { name: "notEqual", args: [0] }
const hotkey = { name: "pattern", args: [/^((ctrl|shift|alt)\+)*\w+$/i] }
const fileExt = { name: "pattern", args: [/^([a-zA-Z0-9]+)?$/] }
const codingLang = { name: "pattern", args: [/^[a-zA-Z0-9#+.\-]+$/] }
const hexColor = { name: "pattern", args: [/^#([a-f0-9]{8}|[a-f0-9]{6}|[a-f0-9]{4}|[a-f0-9]{3})$/i] }

const minItems = (min) => ({ name: "minItems", args: [min] })
const maxItems = (max) => ({ name: "minItems", args: [max] })

const hotkeys = each([required, hotkey])

const chartStyles = {
    DEFAULT_FENCE_HEIGHT: required,
    DEFAULT_FENCE_BACKGROUND_COLOR: required,
    TEMPLATE: required,
}

module.exports = {
    window_tab: {
        TAB_MIN_WIDTH: required,
        TAB_MAX_WIDTH: required,
        MAX_TAB_NUM: notZero,
        DRAG_NEW_WINDOW_THRESHOLD: notZero,
        CLOSE_HOTKEY: hotkeys,
        SWITCH_PREVIOUS_TAB_HOTKEY: hotkeys,
        SWITCH_NEXT_TAB_HOTKEY: hotkeys,
        SWITCH_LAST_ACTIVE_TAB_HOTKEY: hotkeys,
        SORT_TABS_HOTKEY: hotkeys,
        COPY_PATH_HOTKEY: hotkeys,
        TOGGLE_TAB_BAR_HOTKEY: hotkeys,
    },
    search_multi: {
        ALLOW_EXT: each(fileExt),
        IGNORE_FOLDERS: each(required),
        TIMEOUT: notZero,
        MAX_STATS: notZero,
        MAX_DEPTH: notZero,
    },
    md_padding: {
        IGNORE_WORDS: each(required),
        IGNORE_PATTERNS: each([required, regex]),
    },
    markmap: {
        CANDIDATE_COLOR_SCHEMES: each([required, array]),
        "DOWNLOAD_OPTIONS.FOLDER": path,
        "DOWNLOAD_OPTIONS.FILENAME": required,
        "DOWNLOAD_OPTIONS.BACKGROUND_COLOR": [required, hexColor],
        "DOWNLOAD_OPTIONS.TEXT_COLOR": [required, hexColor],
        "DOWNLOAD_OPTIONS.OPEN_CIRCLE_COLOR": [required, hexColor],
        DEFAULT_FENCE_HEIGHT: required,
        DEFAULT_FENCE_BACKGROUND_COLOR: [required, hexColor],
        "DEFAULT_FENCE_OPTIONS.height": required,
        "DEFAULT_FENCE_OPTIONS.backgroundColor": [required, hexColor],
        FENCE_TEMPLATE: required,
    },
    auto_number: {
        FONT_FAMILY: required,
    },
    fence_enhance: {
        BUTTON_SIZE: required,
        BUTTON_COLOR: required,
        BUTTON_PADDING: required,
        BUTTON_TOP: required,
        BUTTON_RIGHT: required,
        EXCLUDE_LANGUAGE_ON_INDENT: each(codingLang),
        HIGHLIGHT_PATTERN: [required, regex],
        HIGHLIGHT_LINE_COLOR_BY_LANGUAGE: required,
        HIGHLIGHT_LINE_COLOR_ON_HOVER: required,
        HIGHLIGHT_LINE_COLOR_ON_FOCUS: required,
    },
    sidebar_enhance: {
        HIDDEN_NODE_PATTERNS: each([required, regex]),
        COUNT_EXT: each(fileExt),
        IGNORE_FOLDERS: each(required),
    },
    text_stylize: {
        "DEFAULT_COLORS.FOREGROUND": [required, hexColor],
        "DEFAULT_COLORS.BACKGROUND": [required, hexColor],
        "DEFAULT_COLORS.BORDER": [required, hexColor],
        COLOR_TABLE: each([required, array]),
    },
    slash_commands: {
        TRIGGER_REGEXP: [required, regex]
    },
    resource_manager: {
        MAX_STATS: notZero,
        MAX_DEPTH: notZero,
        IGNORE_FOLDERS: each(required),
    },
    editor_width_slider: {
        WIDTH_RATIO: notZero,
    },
    article_uploader: {
        "upload.wordpress.hostname": required,
        "upload.wordpress.loginUrl": required,
        "upload.wordpress.username": required,
        "upload.wordpress.password": required,
        "upload.cnblog.username": required,
        "upload.cnblog.password": required,
        "upload.csdn.cookie": required,
    },
    json_rpc: {
        "SERVER_OPTIONS.host": required,
        "SERVER_OPTIONS.path": required,
    },
    updater: {
        UPDATE_LOOP_INTERVAL: notZero,
        START_UPDATE_INTERVAL: notZero,
    },
    kanban: {
        KANBAN_TASK_DESC_MAX_HEIGHT: notZero,
        TEMPLATE: required,
    },
    chat: {
        "DEFAULT_OPTIONS.senderNickname": required,
        "DEFAULT_OPTIONS.timeNickname": required,
        TEMPLATE: required,
    },
    timeline: {
        BACKGROUND_COLOR: required,
        TITLE_COLOR: required,
        TITLE_FONT_SIZE: required,
        TITLE_FONT_WEIGHT: required,
        LINE_COLOR: required,
        LINE_WIDTH: required,
        CIRCLE_COLOR: required,
        CIRCLE_DIAMETER: required,
        TIME_COLOR: required,
        CIRCLE_TOP: required,
        TEMPLATE: required,
    },
    echarts: chartStyles,
    chart: chartStyles,
    wavedrom: {
        ...chartStyles,
        SKIN_FILES: each([required, path]),
    },
    calendar: chartStyles,
    abc: chartStyles,
    drawIO: {
        ...chartStyles,
        RESOURCE_URI: [required, url],
    },
    plantUML: {
        ...chartStyles,
        SERVER_URL: [required, url],
    },
    marp: chartStyles,
    callouts: {
        font_family: required,
        network_icon_url: [required, url],
        default_background_color: required,
        default_left_line_color: required,
        default_icon: required,
        template: required,
    },
    templater: {
        template_folders: each([required, path]),
    },
    imageReviewer: {
        thumbnail_height: required,
    },
    markdownLint: {
        button_width: required,
        button_height: required,
        button_right: required,
        button_border_radius: required,
        pass_color: required,
        error_color: required,
        custom_rule_files: each([required, path]),
    },
    quickButton: {
        button_size: required,
        button_border_radius: required,
        button_box_shadow: required,
        button_gap: required,
        position_right: required,
        position_bottom: required,
    },
    redirectLocalRootUrl: {
        root: required,
        filter_regexp: regex,
    },
}
