const url = "url"
const regex = "regex"
const path = "path"
const required = "required"
const array = "array"
const notEqualZero = { $validator: "notEqual", $args: [0] }
const hotkey = { $validator: "pattern", $args: [/^((ctrl|shift|alt)\+)*\w+$/i] }
const fileExt = { $validator: "pattern", $args: [/^([a-zA-Z0-9]+)?$/] }
const hexColor = { $validator: "pattern", $args: [/^#([a-f0-9]{8}|[a-f0-9]{6}|[a-f0-9]{4}|[a-f0-9]{3})$/i] }

const requiredArray = { $each: required }
const fileExtArray = { $each: fileExt }
const hotkeyArray = { $each: [required, hotkey] }
const pathArray = { $each: [required, path] }
const regexArray = { $each: [required, regex] }
const hexColorArray = { $each: [required, hexColor] }
const hexColor2DArray = {
    $self: [required, array],
    $each: {
        $self: [required, array],
        $each: [required, hexColor]
    }
}

const chartStyles = {
    DEFAULT_FENCE_HEIGHT: required,
    DEFAULT_FENCE_BACKGROUND_COLOR: required,
    TEMPLATE: required,
}

module.exports = {
    window_tab: {
        TAB_MIN_WIDTH: required,
        TAB_MAX_WIDTH: required,
        MAX_TAB_NUM: notEqualZero,
        DRAG_NEW_WINDOW_THRESHOLD: notEqualZero,
        CLOSE_HOTKEY: hotkeyArray,
        SWITCH_PREVIOUS_TAB_HOTKEY: hotkeyArray,
        SWITCH_NEXT_TAB_HOTKEY: hotkeyArray,
        SORT_TABS_HOTKEY: hotkeyArray,
        COPY_PATH_HOTKEY: hotkeyArray,
        TOGGLE_TAB_BAR_HOTKEY: hotkeyArray,
    },
    search_multi: {
        ALLOW_EXT: fileExtArray,
        IGNORE_FOLDERS: requiredArray,
        HIGHLIGHT_COLORS: hexColorArray,
        TIMEOUT: notEqualZero,
        MAX_STATS: notEqualZero,
        MAX_DEPTH: notEqualZero,
    },
    md_padding: {
        IGNORE_WORDS: requiredArray,
        IGNORE_PATTERNS: regexArray,
    },
    markmap: {
        NODE_BORDER_WHEN_HOVER: required,
        "DEFAULT_TOC_OPTIONS.color": hexColorArray,
        CANDIDATE_COLOR_SCHEMES: hexColor2DArray,
        "DOWNLOAD_OPTIONS.FILENAME": required,
        "DOWNLOAD_OPTIONS.BACKGROUND_COLOR": [required, hexColor],
        "DOWNLOAD_OPTIONS.TEXT_COLOR": [required, hexColor],
        "DOWNLOAD_OPTIONS.OPEN_CIRCLE_COLOR": [required, hexColor],
        DEFAULT_FENCE_HEIGHT: required,
        DEFAULT_FENCE_BACKGROUND_COLOR: [required, hexColor],
        "DEFAULT_FENCE_OPTIONS.height": required,
        "DEFAULT_FENCE_OPTIONS.backgroundColor": [required, hexColor],
        "DEFAULT_FENCE_OPTIONS.color": hexColorArray,
        FENCE_TEMPLATE: required,
    },
    auto_number: {
        FONT_FAMILY: required,
    },
    fence_enhance: {
        BUTTON_SIZE: required,
        BUTTON_COLOR: required,
        BUTTON_MARGIN: required,
        BUTTON_TOP: required,
        BUTTON_RIGHT: required,
        HIGHLIGHT_PATTERN: [required, regex],
        HIGHLIGHT_LINE_COLOR: required,
    },
    text_stylize: {
        "DEFAULT_COLORS.FOREGROUND": [required, hexColor],
        "DEFAULT_COLORS.BACKGROUND": [required, hexColor],
        "DEFAULT_COLORS.BORDER": [required, hexColor],
        COLOR_TABLE: hexColor2DArray,
    },
    slash_commands: {
        TRIGGER_REGEXP: [required, regex]
    },
    file_counter: {
        ALLOW_EXT: fileExtArray,
        IGNORE_FOLDERS: requiredArray,
    },
    resource_manager: {
        MAX_STATS: notEqualZero,
        MAX_DEPTH: notEqualZero,
        IGNORE_FOLDERS: requiredArray,
        MARKDOWN_EXT: requiredArray,
    },
    editor_width_slider: {
        WIDTH_RATIO: notEqualZero,
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
        UPDATE_LOOP_INTERVAL: notEqualZero,
        START_UPDATE_INTERVAL: notEqualZero,
    },
    kanban: {
        KANBAN_TASK_DESC_MAX_HEIGHT: notEqualZero,
        KANBAN_COLOR: hexColorArray,
        TASK_COLOR: hexColorArray,
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
    wavedrom: chartStyles,
    calendar: chartStyles,
    abc: chartStyles,
    drawIO: {
        ...chartStyles,
        RESOURCE_URI: url,
    },
    marp: chartStyles,
    callouts: {
        font_family: required,
        network_icon_url: url,
        default_background_color: required,
        default_left_line_color: required,
        default_icon: required,
        template: required,
    },
    templater: {
        template_folders: pathArray,
    },
    toc: {
        toc_font_size: required,
    },
    imageReviewer: {
        thumbnail_height: required,
    },
    markdownLint: {
        button_width: required,
        button_height: required,
        pass_color: required,
        error_color: required,
        custom_rules_files: requiredArray,
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
