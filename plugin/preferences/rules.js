const self = (rules) => ({ $self: rules })
const each = (rules) => ({ $each: rules })
const row = (rules) => ({ $row: rules })

const url = "url"
const regex = "regex"
const path = "path"
const required = "required"
const array = "array"
const notZero = { name: "notEqual", args: 0 }
const hotkey = { name: "pattern", args: /^((ctrl|shift|alt)\+)*[\w`]+$/i }
const fileExt = { name: "pattern", args: /^([a-zA-Z0-9]+)?$/ }
const codingLang = { name: "pattern", args: /^[a-zA-Z0-9#+.\-]+$/ }
const hexColor = { name: "pattern", args: /^#([a-f0-9]{8}|[a-f0-9]{6}|[a-f0-9]{4}|[a-f0-9]{3})$/i }
const variable = { name: "pattern", args: /^[a-zA-Z_][a-zA-Z0-9_]*$/i }
const gestures = { name: "pattern", args: /^[↖↗↘↙←↑→↓]+$/u }

const minItems = (min) => ({ name: "minItems", args: min })
const maxItems = (max) => ({ name: "minItems", args: max })
const minLength = (min) => ({ name: "minLength", args: min })
const maxLength = (max) => ({ name: "maxLength", args: max })

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
    SAVE_TABS_HOTKEY: hotkeys,
    OPEN_SAVED_TABS_HOTKEY: hotkeys,
    COPY_PATH_HOTKEY: hotkeys,
    TOGGLE_TAB_BAR_HOTKEY: hotkeys,
  },
  search_multi: {
    ALLOW_EXT: each(fileExt),
    IGNORE_FOLDERS: each(required),
    HIGHLIGHT_COLORS: minItems(1),
    TIMEOUT: notZero,
    MAX_ENTITIES: notZero,
    MAX_DEPTH: notZero,
  },
  commander: {
    POST_SCRIPT: required,
    BUILTIN: row({
      name: required,
      cmd: required,
    }),
  },
  md_padding: {
    IGNORE_WORDS: each(required),
    IGNORE_PATTERNS: each([required, regex]),
  },
  markmap: {
    CANDIDATE_COLOR_SCHEMES: each([required, array]),
    "DEFAULT_TOC_OPTIONS.color": minItems(1),
    "DOWNLOAD_OPTIONS.FOLDER": path,
    "DOWNLOAD_OPTIONS.FILENAME": required,
    "DOWNLOAD_OPTIONS.BACKGROUND_COLOR": [required, hexColor],
    "DOWNLOAD_OPTIONS.TEXT_COLOR": [required, hexColor],
    "DOWNLOAD_OPTIONS.OPEN_CIRCLE_COLOR": [required, hexColor],
    DEFAULT_FENCE_HEIGHT: required,
    DEFAULT_FENCE_BACKGROUND_COLOR: [required, hexColor],
    "DEFAULT_FENCE_OPTIONS.height": required,
    "DEFAULT_FENCE_OPTIONS.backgroundColor": [required, hexColor],
    "DEFAULT_FENCE_OPTIONS.color": minItems(1),
    FENCE_TEMPLATE: required,
  },
  auto_number: {
    FONT_FAMILY: required,
    APPLY_EXPORT_HEADER_NUMBERING: required,
    LAYOUTS: row({
      name: required,
    }),
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
    CODE_TITLE_PATTERN: [required, regex],
    CUSTOM_BUTTONS: row({
      ICON: required,
      ON_CLICK: required,
    }),
    CUSTOM_HOTKEYS: row({
      HOTKEY: [required, hotkey],
      CALLBACK: required,
    }),
  },
  sidebar_enhance: {
    FONT_WEIGHT: required,
    HIDDEN_NODE_PATTERNS: each([required, regex]),
    COUNT_EXT: each(fileExt),
    IGNORE_FOLDERS: each(required),
    SIDEBAR_ICONS: row({
      icon: required,
      extensions: each([required, fileExt]),
    }),
  },
  text_stylize: {
    "DEFAULT_COLORS.FOREGROUND": [required, hexColor],
    "DEFAULT_COLORS.BACKGROUND": [required, hexColor],
    "DEFAULT_COLORS.BORDER": [required, hexColor],
    COLOR_TABLE: each([required, array]),
    ACTION_HOTKEYS: row({
      hotkey: [required, hotkey],
    }),
  },
  mouse_gestures: {
    GESTURES: row({
      path: [required, gestures],
      execute: required,
    }),
  },
  slash_commands: {
    TRIGGER_REGEXP: [required, regex],
    COMMANDS: row({
      icon: required,
      keyword: required,
      callback: required,
    }),
  },
  cjk_symbol_pairing: {
    AUTO_PAIR_SYMBOLS: row({
      input: [required, maxLength(1)],
      output: [required, maxLength(1)],
    }),
    AUTO_CONVERT_SYMBOLS: row({
      input: [required, maxLength(1)],
      output: [required, maxLength(1)],
    }),
  },
  right_click_menu: {
    MENUS: row({
      NAME: required,
    }),
  },
  hotkeys: {
    CUSTOM_HOTKEYS: row({
      hotkey: [required, hotkey],
    }),
  },
  resource_manager: {
    MAX_ENTITIES: notZero,
    MAX_DEPTH: notZero,
    IGNORE_FOLDERS: each(required),
  },
  pie_menu: {
    BUTTONS: row({
      CALLBACK: required,
    }),
  },
  preferences: {
    FORM_RENDERING_HOOK: required,
  },
  asset_root_redirect: {
    ROOT_PATH: required,
    IGNORE_GLOB_FILES: each(required),
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
  updater: {
    UPDATE_LOOP_INTERVAL: notZero,
    START_UPDATE_INTERVAL: notZero,
    PROXY: url,
  },
  kanban: {
    KANBAN_TASK_DESC_MAX_HEIGHT: notZero,
    KANBAN_COLOR: minItems(1),
    TASK_COLOR: minItems(1),
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
    SKIN_FOLDER: [required, path],
  },
  calendar: chartStyles,
  abc: chartStyles,
  drawIO: {
    ...chartStyles,
    RESOURCE_URI: [required, url],
    PROXY: url,
  },
  plantUML: {
    ...chartStyles,
    SERVER_URL: [required, url],
    PROXY: url,
  },
  marp: {
    TEMPLATE: required,
  },
  callouts: {
    FONT_FAMILY: required,
    NETWORK_ICON_URL: [required, url],
    CALLOUTS: row({
      type: [required, variable],
      icon: required,
      background_color: required,
      left_line_color: required,
    }),
    DEFAULT_BACKGROUND_COLOR: required,
    DEFAULT_LEFT_LINE_COLOR: required,
    DEFAULT_ICON: required,
    TEMPLATE: required,
  },
  templater: {
    TEMPLATE_VARIABLES: row({
      name: [required, variable],
      callback: required,
    }),
    TEMPLATE: row({
      name: required,
    }),
    TEMPLATE_FOLDERS: each([required, path]),
  },
  image_viewer: {
    THUMBNAIL_HEIGHT: required,
    HOTKEY_FUNCTION: row({
      hotkey: [required, hotkey],
    }),
  },
  markdownlint: {
    BUTTON_WIDTH: required,
    BUTTON_HEIGHT: required,
    BUTTON_RIGHT: required,
    BUTTON_BORDER_RADIUS: required,
    BUTTON_PASS_COLOR: required,
    BUTTON_ERROR_COLOR: required,
    CUSTOM_RULE_FILES: each([required, path]),
  },
  action_buttons: {
    BUTTON_SIZE: required,
    BUTTON_ICON_SIZE: required,
    BUTTON_BORDER_RADIUS: required,
    BUTTON_BOX_SHADOW: required,
    BUTTON_BOX_SHADOW_ON_HOVER: required,
    BUTTON_GAP: required,
    POSITION_RIGHT: required,
    POSITION_BOTTOM: required,
    BUTTONS: row({
      icon: required,
    }),
  },
}
