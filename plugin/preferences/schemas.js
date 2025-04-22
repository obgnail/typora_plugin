const PROTECTED_TOOLTIP = "危险操作，禁止修改，如需请修改配置文件"

const untitledBox = (...fields) => ({ title: undefined, fields })
const titledBox = (title, ...fields) => ({ title, fields })
const subtitledBox = (title, subtitle, ...fields) => ({ title, subtitle, fields })
const arrayBox = (title, key) => titledBox(title, { type: "array", key })
const jsonBox = (title, key, rows = 10) => titledBox(title, { type: "json", key, rows })
const textareaBox = (title, key, rows = 10) => titledBox(title, { type: "textarea", key, rows })

const textField = (key, label) => ({ type: "text", key, label })
const actionField = (act, label) => ({ type: "action", act, label })
const switchField = (key, label) => ({ type: "switch", key, label })
const staticField = (key, label) => ({ type: "static", key, label })
const hotkeyField = (key, label) => ({ type: "hotkey", key, label })
const numberField = (key, unit, label) => ({ type: "number", key, unit, label })
const rangeField = (key, min, max, step, label) => ({ type: "range", key, min, max, step, label })
const selectField = (key, options, label) => ({ type: "select", key, options, label })

const PLUGIN_PROP_ENABLE = switchField("ENABLE", "启用")
const PLUGIN_PROP_NAME = { key: "NAME", type: "text", label: "名称", placeholder: "为空则使用默认名" }
const PLUGIN_PROP_HOTKEY = hotkeyField("HOTKEY", "快捷键")
const PLUGIN_PROP_ENABLE_PROTECTED = { key: "ENABLE", type: "switch", label: "启用", tooltip: PROTECTED_TOOLTIP, disabled: true }
const CUSTOM_PLUGIN_PROP_ENABLE = switchField("enable", "启用")
const CUSTOM_PLUGIN_PROP_NAME = { key: "name", type: "text", label: "名称", placeholder: "为空则使用默认名" }
const CUSTOM_PLUGIN_PROP_HIDE = switchField("hide", "隐藏")
const CUSTOM_PLUGIN_BASE_ORDER = numberField("order", undefined, "排序")
const CUSTOM_PLUGIN_BASE_HOTKEY = hotkeyField("hotkey", "快捷键")

const PLUGIN_LITE_BASE_PROP_BOX = untitledBox(PLUGIN_PROP_ENABLE, PLUGIN_PROP_NAME)
const PLUGIN_FULL_BASE_PROP_BOX = untitledBox(PLUGIN_PROP_ENABLE, PLUGIN_PROP_NAME, PLUGIN_PROP_HOTKEY)
const PLUGIN_LITE_BASE_PROP_PROTECTED_BOX = untitledBox(PLUGIN_PROP_ENABLE_PROTECTED, PLUGIN_PROP_NAME)
const PLUGIN_FULL_BASE_PROP_PROTECTED_BOX = untitledBox(PLUGIN_PROP_ENABLE_PROTECTED, PLUGIN_PROP_NAME, PLUGIN_PROP_HOTKEY)
const CUSTOM_PLUGIN_LITE_BASE_PROP_BOX = untitledBox(CUSTOM_PLUGIN_PROP_ENABLE, CUSTOM_PLUGIN_PROP_HIDE, CUSTOM_PLUGIN_PROP_NAME, CUSTOM_PLUGIN_BASE_ORDER)
const CUSTOM_PLUGIN_FULL_BASE_PROP_BOX = untitledBox(CUSTOM_PLUGIN_PROP_ENABLE, CUSTOM_PLUGIN_PROP_HIDE, CUSTOM_PLUGIN_PROP_NAME, CUSTOM_PLUGIN_BASE_ORDER, CUSTOM_PLUGIN_BASE_HOTKEY)

const TEMPLATE_BOX = textareaBox("模板", "TEMPLATE")
const RESTORE_SETTINGS_BOX = untitledBox(actionField("restoreSettings", "恢复默认"))

const LANGUAGE_MODE_BOX = titledBox(
    "代码块",
    textField("LANGUAGE", "语言"),
    switchField("INTERACTIVE_MODE", "交互模式"),
)

const CHART_STYLE_BOX = titledBox(
    "图表样式",
    textField("DEFAULT_FENCE_HEIGHT", "默认高度"),
    textField("DEFAULT_FENCE_BACKGROUND_COLOR", "背景色"),
)

const OPTIONS = {
    global: {
        LOCALE: { auto: "AUTO", en: "English", "zh-CN": "简体中文", "zh-TW": "繁體中文" },
        EXIT_INTERACTIVE_MODE: { click_exit_button: "点击按钮", ctrl_click_fence: "Ctrl+Click" },
    },
    window_tab: {
        CONTEXT_MENU: {
            closeTab: "关闭标签",
            closeOtherTabs: "关闭其他标签",
            closeLeftTabs: "关闭左侧所有标签",
            closeRightTabs: "关闭右侧所有标签",
            copyPath: "复制当前文件路径",
            showInFinder: "在文件资源管理器中打开",
            openInNewWindow: "在新窗口中打开",
            sortTabs: "排序标签",
        },
        NEW_TAB_POSITION: { right: "当前标签右侧", end: "标签栏最右侧" },
        TAB_SWITCH_ON_CLOSE: { left: "激活左侧标签", right: "激活右侧标签", latest: "激活最近浏览标签" },
        LAST_TAB_CLOSE_ACTION: { blankPage: "显示空白页", reconfirm: "弹出确认对话框", exit: "退出" },
    },
    commander: {
        QUICK_RUN_DISPLAY: { echo: "立即弹窗并回显输出", always: "执行结束后弹窗并显示输出", error: "仅在错误时弹窗并显示输出", silent: "静默执行，不显示任何输出" },
        COMMIT_RUN_DISPLAY: { echo: "立即回显输出", always: "执行结束后显示输出" },
    },
    blur: {
        BLUR_TYPE: { blur: "模糊", hide: "隐藏" },
    },
    toolbar: {
        DEFAULT_TOOL: { "": "无", plu: "插件", tab: "标签", his: "最近文件", ops: "常用操作", mode: "文件模式", theme: "主题", out: "文档大纲", func: "功能列表", all: "混合查找" },
    },
    resize_image: {
        IMAGE_ALIGN: { center: "居中对齐", left: "左对齐", right: "右对齐" },
    },
    auto_number: {
        ALIGN: { left: "在元素左侧", right: "在元素右侧", center: "在元素中间" },
        POSITION_TABLE: { before: "先于表格出现", after: "后于表格出现" },
    },
    text_stylize: {
        TOOLBAR: {
            weight: "加粗",
            italic: "斜体",
            underline: "下划线",
            throughline: "中划线",
            overline: "上划线",
            superScript: "上标",
            subScript: "下标",
            emphasis: "强调符号",
            blur: "模糊",
            title: "标题尺寸",
            increaseSize: "增大尺寸",
            decreaseSize: "减小尺寸",
            increaseLetterSpacing: "增大字符间距",
            decreaseLetterSpacing: "减小字符间距",
            family: "字体",
            foregroundColor: "前景色",
            backgroundColor: "背景色",
            borderColor: "边框颜色",
            erase: "移除格式",
            blank: "占位",
            setBrush: "设置格式刷",
            useBrush: "使用格式刷",
            move: "移动工具栏",
            close: "关闭工具栏",
        },
    },
    slash_commands: {
        SUGGESTION_TIMING: { on_input: "立即显示命令列表", debounce: "400 毫秒后显示命令列表" },
        MATCH_STRATEGY: { prefix: "前缀", substr: "子串", abbr: "缩写" },
        ORDER_STRATEGY: { predefined: "预定义", lexicographic: "字典序", length_based: "长度序", earliest_hit: "最早命中" },
    },
    echarts: {
        RENDERER: { canvas: "Canvas", svg: "SVG" },
        EXPORT_TYPE: { png: "PNG", jpg: "JPG", svg: "SVG" },
    },
    imageReviewer: {
        operations: {
            close: "关闭",
            download: "下载",
            scroll: "定位到文档",
            play: "轮播",
            location: "打开图片路径",
            nextImage: "下一张图",
            previousImage: "上一张图",
            firstImage: "第一张图",
            lastImage: "最后一张图",
            thumbnailNav: "显示/隐藏缩略图列表",
            waterFall: "显示/隐藏瀑布流",
            zoomIn: "放大图片",
            zoomOut: "缩小图片",
            rotateLeft: "向左旋转",
            rotateRight: "向右旋转",
            hFlip: "水平翻转",
            vFlip: "垂直翻转",
            translateLeft: "向左移动",
            translateRight: "向右移动",
            translateUp: "向上移动",
            translateDown: "向下移动",
            incHSkew: "增大水平倾斜",
            decHSkew: "减小水平倾斜",
            incVSkew: "增大垂直倾斜",
            decVSkew: "减小垂直倾斜",
            originSize: "还原尺寸",
            fixScreen: "适配屏幕",
            autoSize: "调整图片大小",
            restore: "还原",
            info: "功能提示",
            dummy: "无功能",
        },
        tool_position: { bottom: "底部", top: "顶部" },
        show_message: { index: "图片索引", title: "图片名称", size: "图片大小" },
        first_image_strategies: { inViewBoxImage: "当前视图中首张图片", closestViewBoxImage: "离当前视图中心最近的图片", firstImage: "文档中首张图片" },
        thumbnail_object_fit: { fill: "拉伸适配", contain: "保持比例缩放", cover: "保持原有尺寸，裁剪超出部分", "scale-down": "保持比例缩放，当图片小于容器时图片不放大" },
    },
    markdownLint: {
        tools: { info: "检测信息", locate: "定位", fix: "修复" },
        result_order_by: { lineNumber: "按行排序", ruleName: "按检测规则排序" },
    }
}

const UNITS = {
    byte: "字节",
    pixel: "像素",
    millisecond: "毫秒",
    second: "秒",
    piece: "条",
    line: "行",
    paragraph: "段",
    percent: "%",
    degree: "度",
    em: "em",
}

const SETTING_SCHEMAS = {
    global: [
        untitledBox(
            { key: "ENABLE", type: "switch", label: "总开关", tooltip: PROTECTED_TOOLTIP, disabled: true },
            selectField("LOCALE", OPTIONS.global.LOCALE, "语言"),
            { key: "EXIT_INTERACTIVE_MODE", type: "select", label: "图表退出交互模式方式", minItems: 1, options: OPTIONS.global.EXIT_INTERACTIVE_MODE }
        ),
        untitledBox(
            actionField("openSettingsFolder", "配置目录"),
            actionField("backupSettings", "备份配置"),
            actionField("restoreSettings", "恢复默认"),
            actionField("restoreAllSettings", "恢复所有默认"),
        ),
        untitledBox(
            actionField("visitRepo", "GitHub"),
            staticField("pluginVersion", "Version"),
        )
    ],
    window_tab: [
        PLUGIN_LITE_BASE_PROP_BOX,
        titledBox(
            "标签外观",
            switchField("SHOW_TAB_CLOSE_BUTTON", "关闭按钮"),
            switchField("TRIM_FILE_EXT", "文件扩展名"),
            switchField("SHOW_DIR_ON_DUPLICATE", "同名文件显示目录名"),
            { key: "HIDE_WINDOW_TITLE_BAR", type: "switch", label: "隐藏标题栏", tooltip: "开启一体化窗口选项后，隐藏标题栏" },
            textField("TAB_MIN_WIDTH", "最小宽度"),
            textField("TAB_MAX_WIDTH", "最大宽度"),
            { key: "MAX_TAB_NUM", type: "number", label: "最大数量", tooltip: "-1 表示无限制" },
            selectField("CONTEXT_MENU", OPTIONS.window_tab.CONTEXT_MENU, "右键菜单选项"),
        ),
        titledBox(
            "标签行为",
            selectField("NEW_TAB_POSITION", OPTIONS.window_tab.NEW_TAB_POSITION, "新建标签位置"),
            selectField("TAB_SWITCH_ON_CLOSE", OPTIONS.window_tab.TAB_SWITCH_ON_CLOSE, "关闭标签后"),
            selectField("LAST_TAB_CLOSE_ACTION", OPTIONS.window_tab.LAST_TAB_CLOSE_ACTION, "关闭最后的标签后"),
        ),
        arrayBox("快捷键：关闭标签", "CLOSE_HOTKEY"),
        arrayBox("快捷键：上一个标签", "SWITCH_PREVIOUS_TAB_HOTKEY"),
        arrayBox("快捷键：下一个标签", "SWITCH_NEXT_TAB_HOTKEY"),
        arrayBox("快捷键：排序标签", "SORT_TABS_HOTKEY"),
        arrayBox("快捷键：复制当前文件路径", "COPY_PATH_HOTKEY"),
        arrayBox("快捷键：临时显示/隐藏标签栏", "TOGGLE_TAB_BAR_HOTKEY"),
        titledBox(
            "鼠标交互",
            switchField("CTRL_CLICK_TO_NEW_WINDOW", "Ctrl+Click 新窗口打开"),
            switchField("CTRL_WHEEL_TO_SWITCH", "Ctrl+Wheel 切换标签"),
            switchField("MIDDLE_CLICK_TO_CLOSE", "中键关闭标签"),
            switchField("SHOW_FULL_PATH_WHEN_HOVER", "鼠标悬停显示文件路径"),
            switchField("JETBRAINS_DRAG_STYLE", "JetBrains 风格的拖拽方式"),
            switchField("LOCK_DRAG_Y_AXIS", "禁止垂直拖拽"),
            switchField("LIMIT_TAB_Y_AXIS_WHEN_DRAG", "限制竖直拖拽"),
            { key: "Y_AXIS_LIMIT_THRESHOLD", type: "number", label: "限制竖直拖拽幅度", explain: "拖拽垂直距离少于 X 倍标签高度，视为无垂直移动", min: 0.1, max: 3, step: 0.1 },
            { key: "DRAG_NEW_WINDOW_THRESHOLD", type: "number", label: "拖拽以新建窗口", explain: "拖拽垂直距离超过 X 倍标签高度，视为新建窗口", tooltip: "-1 表示不启用" },
        ),
        RESTORE_SETTINGS_BOX,
    ],
    search_multi: [
        PLUGIN_FULL_BASE_PROP_BOX,
        titledBox(
            "搜索结果",
            switchField("RELATIVE_PATH", "使用相对路径"),
            switchField("SHOW_EXT", "显示文件扩展名"),
            switchField("SHOW_MTIME", "显示文件最后修改时间"),
            switchField("REMOVE_BUTTON_HINT", "隐藏按钮提示"),
            numberField("MAX_HITS", undefined, "高亮最大数量"),
        ),
        titledBox(
            "搜索",
            switchField("CASE_SENSITIVE", "区分大小写"),
            { key: "OPTIMIZE_SEARCH", type: "switch", label: "搜索优化", explain: "副作用：影响高亮块顺序" },
            numberField("MAX_SIZE", UNITS.byte, "允许最大文件"),
        ),
        titledBox(
            "窗口交互",
            switchField("AUTO_HIDE", "输入框为空且失去焦点时，隐藏窗口"),
            switchField("BACKSPACE_TO_HIDE", "输入框为空且键入退格键时，隐藏窗口"),
            switchField("ALLOW_DRAG", "Ctrl+鼠标拖拽输入框以移动窗口"),
        ),
        arrayBox("允许文件扩展名", "ALLOW_EXT"),
        arrayBox("忽略搜索的文件夹", "IGNORE_FOLDERS"),
        arrayBox("高亮颜色列表", "HIGHLIGHT_COLORS"),
        RESTORE_SETTINGS_BOX,
    ],
    commander: [
        PLUGIN_FULL_BASE_PROP_BOX,
        titledBox(
            "命令显示方式",
            selectField("QUICK_RUN_DISPLAY", OPTIONS.commander.QUICK_RUN_DISPLAY, "通过快捷方式执行命令时"),
            selectField("COMMIT_RUN_DISPLAY", OPTIONS.commander.COMMIT_RUN_DISPLAY, "通过命令框执行命令时"),
        ),
        titledBox(
            "窗口交互",
            switchField("BACKSPACE_TO_HIDE", "输入框为空且键入退格键时，隐藏窗口"),
            switchField("ALLOW_DRAG", "Ctrl+Ctrl+鼠标拖拽输入框以移动窗口"),
        ),
        jsonBox("预设的常用命令列表", "BUILTIN"),
        RESTORE_SETTINGS_BOX,
    ],
    md_padding: [
        PLUGIN_FULL_BASE_PROP_BOX,
        arrayBox("忽略词组", "IGNORE_WORDS"),
        arrayBox("忽略正则表达式", "IGNORE_PATTERNS"),
        RESTORE_SETTINGS_BOX,
    ],
    read_only: [
        PLUGIN_FULL_BASE_PROP_BOX,
        titledBox(
            "只读状态",
            switchField("READ_ONLY_DEFAULT", "默认开启"),
            switchField("NO_EXPAND_WHEN_READ_ONLY", "单击图片和行内公式不会自动展开"),
            switchField("REMOVE_EXPAND_WHEN_READ_ONLY", "展开的图片和行内公式自动收缩"),
            switchField("CLICK_HYPERLINK_TO_OPEN_WHEN_READ_ONLY", "单击超链接即可跳转"),
            switchField("DISABLE_CONTEXT_MENU_WHEN_READ_ONLY", "禁用部分右键菜单选项"),
            textField("SHOW_TEXT", "提示文字"),
        ),
        arrayBox("只读状态下保持可用的右键菜单选项", "REMAIN_AVAILABLE_MENU_KEY"),
        RESTORE_SETTINGS_BOX,
    ],
    blur: [
        PLUGIN_FULL_BASE_PROP_BOX,
        untitledBox(
            switchField("BLUR_DEFAULT", "默认开启"),
            switchField("RESTORE_WHEN_HOVER", "鼠标悬停恢复可见"),
            selectField("BLUR_TYPE", OPTIONS.blur.BLUR_TYPE, "模糊类型"),
            numberField("BLUR_LEVEL", UNITS.pixel, "模糊等级"),
        ),
        RESTORE_SETTINGS_BOX,
    ],
    dark: [
        PLUGIN_FULL_BASE_PROP_BOX,
        untitledBox(switchField("DARK_DEFAULT", "默认开启")),
        RESTORE_SETTINGS_BOX,
    ],
    no_image: [
        PLUGIN_FULL_BASE_PROP_BOX,
        untitledBox(
            switchField("DEFAULT_NO_IMAGE_MODE", "默认开启"),
            switchField("RESHOW_WHEN_HOVER", "鼠标悬停恢复可见"),
            numberField("TRANSITION_DURATION", UNITS.millisecond, "动画持续时间"),
            numberField("TRANSITION_DELAY", UNITS.millisecond, "动画延迟时间"),
        ),
        RESTORE_SETTINGS_BOX,
    ],
    toolbar: [
        PLUGIN_FULL_BASE_PROP_BOX,
        titledBox(
            "搜索栏位置",
            rangeField("TOOLBAR_TOP_PERCENT", 0, 100, 1, "垂直定位"),
            rangeField("TOOLBAR_WIDTH_PERCENT", 0, 100, 1, "宽度"),
        ),
        titledBox(
            "窗口交互",
            switchField("AUTO_HIDE", "输入框为空且失去焦点时，隐藏窗口"),
            switchField("BACKSPACE_TO_HIDE", "输入框为空且键入退格键时，隐藏窗口"),
        ),
        titledBox(
            "输入",
            selectField("DEFAULT_TOOL", OPTIONS.toolbar.DEFAULT_TOOL, "默认搜索工具"),
            switchField("USE_NEGATIVE_SEARCH", "启用负向查询"),
            { key: "PAUSE_ON_COMPOSITION", type: "switch", label: "输入法优化", explain: "等待输入法输入完毕再执行搜索，减少无效搜索" },
            numberField("DEBOUNCE_INTERVAL", UNITS.millisecond, "输入防抖"),
        ),
        RESTORE_SETTINGS_BOX,
    ],
    resize_image: [
        PLUGIN_LITE_BASE_PROP_BOX,
        titledBox(
            "图片",
            switchField("RECORD_RESIZE", "记忆放缩状态"),
            switchField("ALLOW_EXCEED_LIMIT", "允许超出边界"),
            selectField("IMAGE_ALIGN", OPTIONS.resize_image.IMAGE_ALIGN, "对齐方式"),
        ),
        titledBox(
            "鼠标滚轮的修饰键",
            { key: "MODIFIER_KEY.TEMPORARY", type: "text", label: "临时修改图片大小", explain: "举例：填入 alt，则 Alt+Wheel 临时调整图片大小" },
            { key: "MODIFIER_KEY.PERSISTENT", type: "text", label: "永久修改图片大小（转为 HTML 语法）", explain: "举例：填入 alt，则 Alt+Wheel 永久修改图片大小" },
        ),
        RESTORE_SETTINGS_BOX,
    ],
    resize_table: [
        PLUGIN_LITE_BASE_PROP_BOX,
        titledBox(
            "表格",
            switchField("RECORD_RESIZE", "记忆放缩状态"),
            switchField("REMOVE_MIN_CELL_WIDTH", "移除单元格最小宽度限制"),
            numberField("DRAG_THRESHOLD", UNITS.pixel, "可拖拽识别范围"),
        ),
        RESTORE_SETTINGS_BOX,
    ],
    datatables: [
        PLUGIN_LITE_BASE_PROP_BOX,
        titledBox(
            "增强表格",
            switchField("ORDERING", "启用排序"),
            switchField("DEFAULT_ORDER", "默认排序"),
            switchField("SEARCHING", "启用搜索"),
            switchField("REGEX", "启用正则表达式搜索"),
            switchField("CASE_INSENSITIVE", "搜索区分大小写"),
            switchField("SCROLL_COLLAPSE", "允许表格减少高度"),
            switchField("PAGING", "启用分页"),
            numberField("PAGE_LENGTH", UNITS.piece, "单页数据量"),
        ),
        RESTORE_SETTINGS_BOX,
    ],
    go_top: [
        PLUGIN_LITE_BASE_PROP_BOX,
        titledBox(
            "快捷键",
            hotkeyField("HOTKEY_GO_TOP", "至顶"),
            hotkeyField("HOTKEY_GO_BOTTOM", "至底"),
        ),
        RESTORE_SETTINGS_BOX,
    ],
    markmap: [
        PLUGIN_LITE_BASE_PROP_BOX,
        titledBox(
            "思维导图",
            switchField("ENABLE_TOC_MARKMAP", "启用"),
            hotkeyField("TOC_HOTKEY", "快捷键"),
            switchField("FIX_ERROR_LEVEL_HEADER", "兼容跳级标题"),
            switchField("AUTO_UPDATE", "大纲变化后自动更新"),
            switchField("AUTO_FIT_WHEN_RESIZE", "调整窗口后自动适配"),
            switchField("AUTO_FIT_WHEN_UPDATE", "更新图形后自动适配"),
            switchField("KEEP_FOLD_STATE_WHEN_UPDATE", "更新图形后保持节点折叠状态"),
            switchField("CLICK_TO_POSITIONING", "点击节点跳转到文档对应章节"),
            { key: "AUTO_COLLAPSE_PARAGRAPH_WHEN_FOLD", type: "switch", label: "折叠节点后自动折叠章节内容", explain: "实验性特性，仅当「章节折叠」插件开启时可用" },
            rangeField("POSITIONING_VIEWPORT_HEIGHT", 0.1, 0.95, 0.01, "定位视口高度"),
            rangeField("WIDTH_PERCENT_WHEN_INIT", 20, 95, 1, "初始窗口宽度"),
            rangeField("HEIGHT_PERCENT_WHEN_INIT", 20, 95, 1, "初始窗口高度"),
            rangeField("HEIGHT_PERCENT_WHEN_PIN_TOP", 20, 95, 1, "固定顶部的窗口高度"),
            rangeField("WIDTH_PERCENT_WHEN_PIN_RIGHT", 20, 95, 1, "固定右侧的窗口宽度"),
            textField("NODE_BORDER_WHEN_HOVER", "鼠标悬停节点边框样式"),
        ),
        titledBox(
            "思维导图默认图形",
            switchField("DEFAULT_TOC_OPTIONS.zoom", "允许缩放"),
            switchField("DEFAULT_TOC_OPTIONS.pan", "允许平移"),
            switchField("DEFAULT_TOC_OPTIONS.autoFit", "折叠/展开节点后，图形自动适配窗口"),
            rangeField("DEFAULT_TOC_OPTIONS.initialExpandLevel", 1, 6, 1, "首次渲染分支展开等级"),
            rangeField("DEFAULT_TOC_OPTIONS.colorFreezeLevel", 1, 6, 1, "固定颜色的分支等级"),
            rangeField("DEFAULT_TOC_OPTIONS.fitRatio", 0.5, 1, 0.01, "窗口填充率"),
            { key: "DEFAULT_TOC_OPTIONS.maxWidth", type: "number", label: "节点最大长度", tooltip: "0 表示无限制", min: 0, max: 1000, step: 10, unit: UNITS.pixel },
            { key: "DEFAULT_TOC_OPTIONS.spacingHorizontal", type: "number", label: "节点水平间距", min: 0, max: 200, step: 1, unit: UNITS.pixel },
            { key: "DEFAULT_TOC_OPTIONS.spacingVertical", type: "number", label: "节点垂直间距", min: 0, max: 100, step: 1, unit: UNITS.pixel },
            { key: "DEFAULT_TOC_OPTIONS.paddingX", type: "number", label: "节点内部边距", min: 0, max: 100, step: 1, unit: UNITS.pixel },
            { key: "DEFAULT_TOC_OPTIONS.duration", type: "number", label: "动画持续时间", min: 0, max: 1000, step: 10, unit: UNITS.millisecond },
        ),
        arrayBox("思维导图默认配色方案", "DEFAULT_TOC_OPTIONS.color"),
        jsonBox("思维导图的预设配色方案列表", "CANDIDATE_COLOR_SCHEMES"),
        titledBox(
            "思维导图导出",
            switchField("DOWNLOAD_OPTIONS.KEEP_ALPHA_CHANNEL", "保留透明通道"),
            switchField("DOWNLOAD_OPTIONS.REMOVE_USELESS_CLASSES", "删除无用的类名"),
            switchField("DOWNLOAD_OPTIONS.REMOVE_FOREIGN_OBJECT", "移除 &lt;foreignObject&gt; 标签，并替换为 &lt;text&gt; 标签"),
            switchField("DOWNLOAD_OPTIONS.SHOW_PATH_INQUIRY_DIALOG", "导出前显示文件保存路径选择对话框"),
            switchField("DOWNLOAD_OPTIONS.SHOW_IN_FINDER", "导出完成后自动打开文件所在的目录"),
            rangeField("DOWNLOAD_OPTIONS.IMAGE_QUALITY", 0.01, 1, 0.01, "图片质量"),
            { key: "DOWNLOAD_OPTIONS.PADDING_HORIZONTAL", type: "number", label: "水平内边距", min: 1, max: 1000, step: 1, unit: UNITS.pixel },
            { key: "DOWNLOAD_OPTIONS.PADDING_VERTICAL", type: "number", label: "垂直内边距", min: 1, max: 1000, step: 1, unit: UNITS.pixel },
            textField("DOWNLOAD_OPTIONS.FILENAME", "文件名"),
            textField("DOWNLOAD_OPTIONS.FOLDER", "目录路径"),
            textField("DOWNLOAD_OPTIONS.BACKGROUND_COLOR", "背景颜色"),
            textField("DOWNLOAD_OPTIONS.TEXT_COLOR", "字体颜色"),
            textField("DOWNLOAD_OPTIONS.OPEN_CIRCLE_COLOR", "展开节点的颜色"),
        ),
        titledBox(
            "代码块",
            switchField("ENABLE_FENCE_MARKMAP", "启用"),
            switchField("INTERACTIVE_MODE", "交互模式"),
            hotkeyField("FENCE_HOTKEY", "快捷键"),
            textField("FENCE_LANGUAGE", "代码块语言"),
            textField("DEFAULT_FENCE_HEIGHT", "图表默认高度"),
            textField("DEFAULT_FENCE_BACKGROUND_COLOR", "图表默认背景颜色"),
        ),
        titledBox(
            "代码块默认图形",
            switchField("DEFAULT_FENCE_OPTIONS.zoom", "允许缩放图形"),
            switchField("DEFAULT_FENCE_OPTIONS.pan", "允许平移图形"),
            rangeField("DEFAULT_FENCE_OPTIONS.initialExpandLevel", 1, 6, 1, "首次渲染分支展开等级"),
            rangeField("DEFAULT_FENCE_OPTIONS.colorFreezeLevel", 1, 6, 1, "固定颜色的分支等级"),
            rangeField("DEFAULT_FENCE_OPTIONS.fitRatio", 0.5, 1, 0.01, "窗口填充率"),
            { key: "DEFAULT_FENCE_OPTIONS.maxWidth", type: "number", label: "节点最大长度", tooltip: "0 表示无限制", min: 0, max: 1000, step: 10, unit: UNITS.pixel },
            { key: "DEFAULT_FENCE_OPTIONS.spacingHorizontal", type: "number", label: "节点水平间距", min: 0, max: 200, step: 1, unit: UNITS.pixel },
            { key: "DEFAULT_FENCE_OPTIONS.spacingVertical", type: "number", label: "节点垂直间距", min: 0, max: 100, step: 1, unit: UNITS.pixel },
            { key: "DEFAULT_FENCE_OPTIONS.paddingX", type: "number", label: "节点内部边距", min: 0, max: 100, step: 1, unit: UNITS.pixel },
            { key: "DEFAULT_FENCE_OPTIONS.duration", type: "number", label: "动画的持续时间", min: 0, max: 1000, step: 10, unit: UNITS.millisecond },
            textField("DEFAULT_FENCE_OPTIONS.height", "图形高度"),
            textField("DEFAULT_FENCE_OPTIONS.backgroundColor", "图形背景颜色"),
        ),
        arrayBox("代码块图形默认配色方案", "DEFAULT_FENCE_OPTIONS.color"),
        textareaBox("模板", "FENCE_TEMPLATE"),
        RESTORE_SETTINGS_BOX,
    ],
    auto_number: [
        PLUGIN_LITE_BASE_PROP_BOX,
        titledBox(
            "自动编号",
            switchField("ENABLE_OUTLINE", "大纲"),
            switchField("ENABLE_CONTENT", "正文"),
            switchField("ENABLE_TOC", "TOC"),
            switchField("ENABLE_TABLE", "表格"),
            switchField("ENABLE_IMAGE", "图片"),
            switchField("ENABLE_FENCE", "代码块"),
        ),
        titledBox(
            "样式",
            switchField("SHOW_IMAGE_NAME", "图片编号同时显示别名"),
            selectField("ALIGN", OPTIONS.auto_number.ALIGN, "编号下标位置"),
            selectField("POSITION_TABLE", OPTIONS.auto_number.POSITION_TABLE, "表格编号位置"),
            textField("FONT_FAMILY", "编号字体"),
        ),
        jsonBox("预设的编号格式列表", "LAYOUTS"),
        titledBox(
            "高级",
            switchField("ENABLE_WHEN_EXPORT", "导出为 HTML、PDF 时保留编号"),
        ),
        RESTORE_SETTINGS_BOX,
    ],
    fence_enhance: [
        PLUGIN_LITE_BASE_PROP_BOX,
        titledBox(
            "按钮样式",
            switchField("ENABLE_BUTTON", "启用"),
            switchField("AUTO_HIDE", "自动隐藏"),
            switchField("REMOVE_BUTTON_HINT", "隐藏功能提示"),
            rangeField("BUTTON_OPACITY", 0, 1, 0.05, "不透明度"),
            rangeField("BUTTON_OPACITY_HOVER", 0, 1, 0.05, "鼠标悬停不透明度"),
            textField("BUTTON_SIZE", "大小"),
            textField("BUTTON_COLOR", "颜色"),
            textField("BUTTON_MARGIN", "间距"),
            textField("BUTTON_TOP", "到顶部距离"),
            textField("BUTTON_RIGHT", "到右侧距离"),
            { key: "WAIT_RECOVER_INTERVAL", type: "number", label: "提示的保持时间", min: 500, step: 100, unit: UNITS.millisecond },
        ),
        titledBox(
            "功能按钮",
            switchField("ENABLE_COPY", "复制按钮"),
            switchField("ENABLE_INDENT", "调整缩进按钮"),
            switchField("ENABLE_FOLD", "折叠按钮"),
            switchField("DEFAULT_FOLD", "默认折叠代码块"),
            { key: "DEFAULT_FOLD_THRESHOLD", type: "number", label: "代码块折叠阈值", min: 0, step: 1, unit: UNITS.line },
        ),
        titledBox(
            "代码块快捷键",
            switchField("ENABLE_HOTKEY", "启用"),
            textField("SWAP_PREVIOUS_LINE", "与上一行互换"),
            textField("SWAP_NEXT_LINE", "与下一行互换"),
            textField("COPY_PREVIOUS_LINE", "复制到上一行"),
            textField("COPY_NEXT_LINE", "复制到下一行"),
            textField("INSERT_LINE_PREVIOUS", "在上方插入一行"),
            textField("INSERT_LINE_NEXT", "在下方插入一行"),
        ),
        titledBox(
            "高级功能",
            switchField("ENABLE_LANGUAGE_FOLD", "代码可折叠"),
            switchField("INDENTED_WRAPPED_LINE", "自动对齐缩进"),
            switchField("HIGHLIGHT_BY_LANGUAGE", "通过语言栏高亮代码行"),
            switchField("HIGHLIGHT_WHEN_HOVER", "鼠标悬停高亮代码行"),
            textField("HIGHLIGHT_LINE_COLOR", "代码行高亮颜色"),
        ),
        jsonBox("自定义按钮", "CUSTOM_BUTTONS"),
        RESTORE_SETTINGS_BOX,
    ],
    collapse_paragraph: [
        PLUGIN_LITE_BASE_PROP_BOX,
        titledBox(
            "模式",
            switchField("RECORD_COLLAPSE", "记忆折叠状态"),
            switchField("STRICT_MODE", "严格模式"),
            switchField("STRICT_MODE_IN_CONTEXT_MENU", "在右键菜单中使用严格模式"),
        ),
        titledBox(
            "功能修饰键",
            { key: "MODIFIER_KEY.COLLAPSE_SINGLE", type: "text", label: "折叠/展开单个章节", explain: "举例：填入 ctrl，则 Clt+Click 将折叠/展开单个章节" },
            textField("MODIFIER_KEY.COLLAPSE_SIBLINGS", "折叠/展开父章节下所有同级的章节"),
            textField("MODIFIER_KEY.COLLAPSE_ALL_SIBLINGS", "折叠/展开当前文件所有同级的章节"),
            textField("MODIFIER_KEY.COLLAPSE_RECURSIVE", "递归折叠/展开当前章节"),
        ),
        RESTORE_SETTINGS_BOX,
    ],
    collapse_list: [
        PLUGIN_LITE_BASE_PROP_BOX,
        titledBox(
            "列表",
            switchField("RECORD_COLLAPSE", "记忆折叠状态"),
            textField("TRIANGLE_COLOR", "缩放标志颜色"),
        ),
        RESTORE_SETTINGS_BOX,
    ],
    collapse_table: [
        PLUGIN_LITE_BASE_PROP_BOX,
        titledBox(
            "表格",
            switchField("RECORD_COLLAPSE", "记忆折叠状态"),
        ),
        RESTORE_SETTINGS_BOX,
    ],
    truncate_text: [
        PLUGIN_LITE_BASE_PROP_BOX,
        titledBox(
            "快捷键",
            hotkeyField("HIDE_FRONT_HOTKEY", "只保留最后若干段"),
            hotkeyField("SHOW_ALL_HOTKEY", "重新显示所有内容"),
            hotkeyField("HIDE_BASE_VIEW_HOTKEY", "根据当前可视范围显示"),
            numberField("REMAIN_LENGTH", UNITS.paragraph, "保留显示的文本段数量"),
        ),
        RESTORE_SETTINGS_BOX,
    ],
    export_enhance: [
        PLUGIN_LITE_BASE_PROP_BOX,
        titledBox(
            "网络图片",
            switchField("DOWNLOAD_NETWORK_IMAGE", "下载并转换为 Base64 编码"),
            numberField("DOWNLOAD_THREADS", undefined, "下载线程数"),
        ),
        RESTORE_SETTINGS_BOX,
    ],
    text_stylize: [
        untitledBox(
            PLUGIN_PROP_ENABLE,
            PLUGIN_PROP_NAME,
            hotkeyField("SHOW_MODAL_HOTKEY", "快捷键"),
        ),
        titledBox(
            "工具栏",
            textField("MODAL_BACKGROUND_COLOR", "背景色"),
            selectField("TOOLBAR", OPTIONS.text_stylize.TOOLBAR, "按钮"),
        ),
        titledBox(
            "按钮的默认值",
            textField("DEFAULT_COLORS.FOREGROUND", "前景色"),
            textField("DEFAULT_COLORS.BACKGROUND", "背景色"),
            textField("DEFAULT_COLORS.BORDER", "边框颜色"),
            { key: "DEFAULT_FORMAT_BRUSH", type: "text", label: "格式刷", explain: "例如：color:#FFF; font-weight:bold;" },
        ),
        jsonBox("颜色按钮的预设列表", "COLOR_TABLE"),
        jsonBox("快捷键映射的预设列表", "ACTION_HOTKEYS"),
        RESTORE_SETTINGS_BOX,
    ],
    cipher: [
        PLUGIN_LITE_BASE_PROP_BOX,
        titledBox(
            "快捷键",
            hotkeyField("ENCRYPT_HOTKEY", "加密"),
            hotkeyField("DECRYPT_HOTKEY", "解密"),
        ),
        titledBox(
            "提示弹窗",
            switchField("SHOW_HINT_MODAL", "加解密后弹出提示窗口"),
        ),
        RESTORE_SETTINGS_BOX,
    ],
    easy_modify: [
        PLUGIN_LITE_BASE_PROP_BOX,
        titledBox(
            "快捷键",
            hotkeyField("HOTKEY_COPY_FULL_PATH", "复制当前光标所在标题路径"),
            hotkeyField("HOTKEY_INCREASE_HEADERS_LEVEL", "提升选中文段的标题等级"),
            hotkeyField("HOTKEY_DECREASE_HEADERS_LEVEL", "降低选中文段的标题等级"),
            hotkeyField("HOTKEY_EXTRACT_RANGE_TO_NEW_FILE", "提取选区文字到新文件"),
            hotkeyField("HOTKEY_INSERT_MERMAID_MINDMAP", "插入思维导图 (mindmap)"),
            hotkeyField("HOTKEY_INSERT_MERMAID_GRAPH", "插入思维导图 (graph)"),
            hotkeyField("HOTKEY_CONVERT_CRLF_TO_LF", "换行符 CRLF 替换为 LF"),
            hotkeyField("HOTKEY_CONVERT_LF_TO_CRLF", "换行符 LF 替换为 CRLF"),
            hotkeyField("HOTKEY_FILTER_INVISIBLE_CHARACTERS", "移除不可见字符"),
            hotkeyField("HOTKEY_TRAILING_WHITE_SPACE", "添加结尾空格"),
        ),
        RESTORE_SETTINGS_BOX,
    ],
    custom: [
        PLUGIN_LITE_BASE_PROP_PROTECTED_BOX,
        untitledBox(
            switchField("HIDE_DISABLE_PLUGINS", "隐藏右键菜单中临时不可用的二级插件"),
        ),
        RESTORE_SETTINGS_BOX,
    ],
    slash_commands: [
        PLUGIN_LITE_BASE_PROP_BOX,
        titledBox(
            "命令触发",
            textField("TRIGGER_REGEXP", "触发文本的正则表达式"),
            { key: "FUNC_PARAM_SEPARATOR", type: "text", label: "命令参数分离标识符", disabled: true, tooltip: PROTECTED_TOOLTIP },
            selectField("SUGGESTION_TIMING", OPTIONS.slash_commands.SUGGESTION_TIMING, "键入触发文本后"),
        ),
        titledBox(
            "命令策略",
            selectField("MATCH_STRATEGY", OPTIONS.slash_commands.MATCH_STRATEGY, "匹配策略"),
            selectField("ORDER_STRATEGY", OPTIONS.slash_commands.ORDER_STRATEGY, "排序策略"),
        ),
        jsonBox("预设的命令列表", "COMMANDS"),
        RESTORE_SETTINGS_BOX,
    ],
    right_click_menu: [
        PLUGIN_LITE_BASE_PROP_PROTECTED_BOX,
        titledBox(
            "样式",
            switchField("SHOW_PLUGIN_HOTKEY", "显示选项快捷键"),
            switchField("SHOW_ACTION_OPTIONS_ICON", "动作选项添加 ⌘ 图标"),
            switchField("DO_NOT_HIDE", "失焦不再自动隐藏"),
            switchField("HIDE_OTHER_OPTIONS", "只显示插件选项"),
            textField("MENU_MIN_WIDTH", "二、三级菜单的最小宽度"),
        ),
        jsonBox("自定义右键菜单", "MENUS"),
        titledBox(
            "高级",
            switchField("FIND_LOST_PLUGIN", "自动寻找丢失插件")
        ),
        RESTORE_SETTINGS_BOX,
    ],
    pie_menu: [
        PLUGIN_FULL_BASE_PROP_BOX,
        untitledBox(
            { label: "右键修饰键", explain: "举例：填入 ctrl，则 Ctrl+RClick 弹出菜单", type: "text", key: "MODIFIER_KEY" },
        ),
        jsonBox("圆盘菜单", "BUTTONS"),
        RESTORE_SETTINGS_BOX,
    ],
    preferences: [
        PLUGIN_FULL_BASE_PROP_PROTECTED_BOX,
        untitledBox(
            switchField("SEARCH_PLUGIN_FIXEDNAME", "配置页支持搜索插件英文名"),
            textField("DEFAULT_MENU", "默认的插件配置页"),
        ),
        RESTORE_SETTINGS_BOX,
    ],
    file_counter: [
        PLUGIN_LITE_BASE_PROP_BOX,
        titledBox(
            "文本样式",
            textField("FONT_WEIGHT", "字宽"),
            textField("COLOR", "颜色"),
            textField("BACKGROUND_COLOR", "背景色"),
            textField("BEFORE_TEXT", "前缀"),
        ),
        titledBox(
            "鼠标交互",
            switchField("CTRL_WHEEL_TO_SCROLL_SIDEBAR_MENU", "Ctrl+Wheel 横向滚动侧边栏"),
        ),
        titledBox(
            "搜索",
            { key: "IGNORE_MIN_NUM", type: "number", label: "目录下最小文件数", explain: "忽略所含文件数少于 X 的目录" },
            numberField("MAX_SIZE", UNITS.byte, "最大文件"),
        ),
        arrayBox("允许文件扩展名", "ALLOW_EXT"),
        arrayBox("忽略目录名", "IGNORE_FOLDERS"),
        RESTORE_SETTINGS_BOX,
    ],
    hotkeys: [
        PLUGIN_FULL_BASE_PROP_BOX,
        jsonBox("自定义快捷键列表", "CUSTOM_HOTKEYS"),
        RESTORE_SETTINGS_BOX,
    ],
    help: [
        PLUGIN_LITE_BASE_PROP_BOX,
        RESTORE_SETTINGS_BOX,
    ],
    editor_width_slider: [
        PLUGIN_LITE_BASE_PROP_BOX,
        untitledBox(
            { key: "WIDTH_RATIO", type: "number", label: "宽度百分比", max: 100, step: 1, tooltip: "-1 表示不启用", unit: UNITS.percent },
        ),
        RESTORE_SETTINGS_BOX,
    ],
    article_uploader: [
        PLUGIN_LITE_BASE_PROP_BOX,
        untitledBox(
            switchField("HIDE", "隐藏右键菜单上传选项"),
        ),
        titledBox(
            "上传文章快捷键",
            hotkeyField("UPLOAD_ALL_HOTKEY", "全部"),
            hotkeyField("UPLOAD_CNBLOG_HOTKEY", "博客园"),
            hotkeyField("UPLOAD_WORDPRESS_HOTKEY", "WordPress"),
            hotkeyField("UPLOAD_CSDN_HOTKEY", "CSDN"),
        ),
        titledBox(
            "上传选项",
            switchField("upload.reconfirm", "上传前弹出确认框"),
            switchField("upload.selenium.headless", "Headless 模式"),
        ),
        titledBox(
            "WordPress",
            switchField("upload.wordpress.enabled", "启用"),
            textField("upload.wordpress.hostname", "域名/IP"),
            textField("upload.wordpress.loginUrl", "登录 URL"),
            textField("upload.wordpress.username", "用户名"),
            textField("upload.wordpress.password", "密码"),
        ),
        titledBox(
            "博客园",
            switchField("upload.cnblog.enabled", "启用"),
            textField("upload.cnblog.username", "用户名"),
            textField("upload.cnblog.password", "密码"),
        ),
        titledBox(
            "CSDN",
            switchField("upload.csdn.enabled", "启用"),
            textField("upload.csdn.cookie", "Cookie"),
        ),
        RESTORE_SETTINGS_BOX,
    ],
    ripgrep: [
        PLUGIN_FULL_BASE_PROP_BOX,
        titledBox(
            "窗口位置",
            rangeField("TOP_PERCENT", 0, 100, 1, "垂直定位"),
            rangeField("WIDTH_PERCENT", 0, 100, 1, "宽度"),
        ),
        titledBox(
            "交互",
            switchField("BACKSPACE_TO_HIDE", "输入框为空且键入退格键时，隐藏窗口"),
        ),
        RESTORE_SETTINGS_BOX,
    ],
    json_rpc: [
        PLUGIN_LITE_BASE_PROP_BOX,
        titledBox(
            "RPC Server",
            switchField("SERVER_OPTIONS.strict", "严格模式"),
            textField("SERVER_OPTIONS.host", "主机"),
            { key: "SERVER_OPTIONS.port", type: "number", label: "端口", min: 0, max: 65535, step: 1 },
            textField("SERVER_OPTIONS.path", "路径"),
        ),
        RESTORE_SETTINGS_BOX,
    ],
    updater: [
        PLUGIN_FULL_BASE_PROP_BOX,
        untitledBox(
            textField("PROXY", "代理 URL"),
        ),
        titledBox(
            "自动升级",
            switchField("AUTO_UPDATE", "启用"),
            { key: "UPDATE_LOOP_INTERVAL", type: "number", label: "轮询时间", explain: "轮询指定时间执行升级流程", unit: UNITS.millisecond },
            { key: "START_UPDATE_INTERVAL", type: "number", label: "等待时间", explain: "软件启动后等待指定时间执行升级流程", unit: UNITS.millisecond },
        ),
        RESTORE_SETTINGS_BOX,
    ],
    test: [
        PLUGIN_LITE_BASE_PROP_BOX,
        RESTORE_SETTINGS_BOX,
    ],
    kanban: [
        CUSTOM_PLUGIN_LITE_BASE_PROP_BOX,
        titledBox(
            "代码块",
            textField("LANGUAGE", "语言"),
            switchField("INTERACTIVE_MODE", "交互模式"),
            switchField("STRICT_MODE", "严格模式"),
        ),
        titledBox(
            "看板样式",
            numberField("KANBAN_WIDTH", UNITS.pixel, "宽度"),
            numberField("KANBAN_MAX_HEIGHT", UNITS.pixel, "最大高度"),
            { key: "KANBAN_TASK_DESC_MAX_HEIGHT", type: "number", label: "任务描述框最大高度", tooltip: "0 表示显示全部", unit: UNITS.em },
            switchField("HIDE_DESC_WHEN_EMPTY", "任务描述为空时隐藏描述框"),
            switchField("WRAP", "看板换行显示"),
            switchField("CTRL_WHEEL_TO_SWITCH", "Ctrl+Wheel 切换看板"),
            switchField("ALLOW_MARKDOWN_INLINE_STYLE", "支持 Markdown 语法"),
        ),
        arrayBox("看板颜色", "KANBAN_COLOR"),
        arrayBox("任务颜色", "TASK_COLOR"),
        TEMPLATE_BOX,
        RESTORE_SETTINGS_BOX,
    ],
    chat: [
        CUSTOM_PLUGIN_LITE_BASE_PROP_BOX,
        titledBox(
            "代码块",
            textField("LANGUAGE", "语言"),
            switchField("INTERACTIVE_MODE", "交互模式"),
            switchField("DEFAULT_OPTIONS.useStrict", "严格模式"),
        ),
        titledBox(
            "默认选项",
            switchField("DEFAULT_OPTIONS.showNickname", "昵称"),
            switchField("DEFAULT_OPTIONS.showAvatar", "头像"),
            switchField("DEFAULT_OPTIONS.notAllowShowTime", "不显示时间"),
            switchField("DEFAULT_OPTIONS.allowMarkdown", "支持 Markdown 语法"),
            textField("DEFAULT_OPTIONS.senderNickname", "发送者昵称"),
            textField("DEFAULT_OPTIONS.timeNickname", "时间昵称"),
        ),
        TEMPLATE_BOX,
        RESTORE_SETTINGS_BOX,
    ],
    timeline: [
        CUSTOM_PLUGIN_LITE_BASE_PROP_BOX,
        LANGUAGE_MODE_BOX,
        titledBox(
            "图表样式",
            textField("BACKGROUND_COLOR", "背景颜色"),
            textField("TITLE_COLOR", "标题字体颜色"),
            textField("TITLE_FONT_SIZE", "标题字体大小"),
            textField("TITLE_FONT_WEIGHT", "标题字宽"),
            textField("LINE_COLOR", "左侧时间线颜色"),
            textField("LINE_WIDTH", "左侧时间线宽度"),
            textField("CIRCLE_COLOR", "时间圆点颜色"),
            textField("CIRCLE_DIAMETER", "时间圆点直径"),
            textField("TIME_COLOR", "时间的字体颜色"),
            textField("CIRCLE_TOP", "时间圆点顶部位置"),
        ),
        TEMPLATE_BOX,
        RESTORE_SETTINGS_BOX,
    ],
    echarts: [
        CUSTOM_PLUGIN_LITE_BASE_PROP_BOX,
        LANGUAGE_MODE_BOX,
        CHART_STYLE_BOX,
        TEMPLATE_BOX,
        titledBox(
            "高级",
            selectField("RENDERER", OPTIONS.echarts.RENDERER, "渲染器"),
            selectField("EXPORT_TYPE", OPTIONS.echarts.EXPORT_TYPE, "导出格式"),
        ),
        RESTORE_SETTINGS_BOX,
    ],
    chart: [
        CUSTOM_PLUGIN_LITE_BASE_PROP_BOX,
        LANGUAGE_MODE_BOX,
        CHART_STYLE_BOX,
        TEMPLATE_BOX,
        RESTORE_SETTINGS_BOX,
    ],
    wavedrom: [
        CUSTOM_PLUGIN_LITE_BASE_PROP_BOX,
        titledBox(
            "代码块",
            textField("LANGUAGE", "语言"),
            switchField("INTERACTIVE_MODE", "交互模式"),
            switchField("SAFE_MODE", "安全模式"),
        ),
        CHART_STYLE_BOX,
        TEMPLATE_BOX,
        RESTORE_SETTINGS_BOX,
    ],
    calendar: [
        CUSTOM_PLUGIN_LITE_BASE_PROP_BOX,
        LANGUAGE_MODE_BOX,
        CHART_STYLE_BOX,
        TEMPLATE_BOX,
        RESTORE_SETTINGS_BOX,
    ],
    abc: [
        CUSTOM_PLUGIN_LITE_BASE_PROP_BOX,
        LANGUAGE_MODE_BOX,
        CHART_STYLE_BOX,
        TEMPLATE_BOX,
        jsonBox("可视化选项", "VISUAL_OPTIONS", 6),
        RESTORE_SETTINGS_BOX,
    ],
    drawIO: [
        CUSTOM_PLUGIN_LITE_BASE_PROP_BOX,
        LANGUAGE_MODE_BOX,
        CHART_STYLE_BOX,
        TEMPLATE_BOX,
        titledBox(
            "高级",
            textField("RESOURCE_URI", "Viewer URL"),
        ),
        RESTORE_SETTINGS_BOX,
    ],
    marp: [
        CUSTOM_PLUGIN_LITE_BASE_PROP_BOX,
        LANGUAGE_MODE_BOX,
        TEMPLATE_BOX,
        RESTORE_SETTINGS_BOX,
    ],
    callouts: [
        CUSTOM_PLUGIN_LITE_BASE_PROP_BOX,
        titledBox(
            "样式",
            switchField("set_title_color", "高亮标题"),
            textField("box_shadow", "阴影"),
        ),
        titledBox(
            "鼠标悬停",
            switchField("hover_to_show_fold_callout", "展开 Fold Callout"),
        ),
        titledBox(
            "默认值",
            textField("font_family", "图标字体"),
            textField("default_background_color", "左边线颜色"),
            textField("default_left_line_color", "背景颜色"),
            textField("default_icon", "图标"),
        ),
        jsonBox("预设的 Callouts 列表", "list"),
        textareaBox("模板", "template"),
        RESTORE_SETTINGS_BOX,
    ],
    templater: [
        CUSTOM_PLUGIN_FULL_BASE_PROP_BOX,
        untitledBox(
            switchField("auto_open", "创建并自动打开新文件"),
        ),
        jsonBox("自定义模板变量列表", "template_variables"),
        jsonBox("自定义模板列表", "template"),
        RESTORE_SETTINGS_BOX,
    ],
    chineseSymbolAutoPairer: [
        CUSTOM_PLUGIN_LITE_BASE_PROP_BOX,
        titledBox(
            "功能选项",
            switchField("auto_skip", "自动跳过配对符号"),
            switchField("auto_delete_pair", "成对删除符号"),
            switchField("auto_swap", "连续全角转为半角"),
            switchField("auto_surround_pair", "自动包裹选区"),
            switchField("auto_select_after_surround", "自动选中包裹内容"),
        ),
        jsonBox("自动补全的符号", "auto_pair_symbols"),
        jsonBox("自动转换的符号", "auto_swap_symbols"),
        RESTORE_SETTINGS_BOX,
    ],
    toc: [
        CUSTOM_PLUGIN_FULL_BASE_PROP_BOX,
        untitledBox(
            switchField("default_show_toc", "默认开启"),
            switchField("escape_header", "转义标题内容"),
            switchField("right_click_outline_button_to_toggle", "快捷方式：右击侧边栏大纲按钮"),
        ),
        titledBox(
            "大纲目录样式",
            rangeField("width_percent_when_pin_right", 0, 100, 1, "固定到右侧的宽度"),
            textField("toc_font_size", "字体大小"),
        ),
        titledBox(
            "名称",
            textField("show_name.fence", "代码块"),
            textField("show_name.image", "图片"),
            textField("show_name.table", "表格"),
            textField("show_name.link", "链接"),
            textField("show_name.math", "公式块"),
        ),
        titledBox(
            "目录中显示标题",
            switchField("include_headings.fence", "代码块"),
            switchField("include_headings.image", "图片"),
            switchField("include_headings.table", "表格"),
            switchField("include_headings.link", "链接"),
            switchField("include_headings.math", "公式块"),
        ),
        RESTORE_SETTINGS_BOX,
    ],
    resourceOperation: [
        CUSTOM_PLUGIN_FULL_BASE_PROP_BOX,
        titledBox(
            "窗口位置",
            rangeField("modal_height_percent", 0, 100, 1, "高度"),
            rangeField("modal_width_percent", 0, 100, 1, "宽度"),
            rangeField("modal_left_percent", 0, 100, 1, "左边框定位"),
        ),
        titledBox(
            "搜索",
            switchField("ignore_img_html_element", "忽略 &lt;IMG&gt; 标签"),
        ),
        arrayBox("资源文件扩展名", "resource_suffix"),
        untitledBox(
            switchField("collect_file_without_suffix", "无扩展名文件视为资源"),
        ),
        arrayBox("检索文件扩展名", "markdown_suffix"),
        arrayBox("忽略检索目录名", "ignore_folders"),
        RESTORE_SETTINGS_BOX,
    ],
    scrollBookmarker: [
        CUSTOM_PLUGIN_FULL_BASE_PROP_BOX,
        untitledBox(
            { label: "左键修饰键", explain: "举例：填入 alt，则 Alt+LClick 标注书签", type: "text", key: "modifier_key" },
            switchField("auto_popup_modal", "标注书签的同时弹出管理窗口"),
            switchField("persistence", "持久化书签数据"),
        ),
        RESTORE_SETTINGS_BOX,
    ],
    imageReviewer: [
        CUSTOM_PLUGIN_FULL_BASE_PROP_BOX,
        titledBox(
            "样式",
            rangeField("mask_background_opacity", 0, 1, 0.05, "遮罩层不透明度"),
            rangeField("image_max_width", 0, 100, 1, "图片最大宽度"),
            rangeField("image_max_height", 0, 100, 1, "图片最大高度"),
            textField("thumbnail_height", "缩略图高度"),
            numberField("blur_level", UNITS.pixel, "背景模糊等级"),
            { key: "thumbnail_scroll_padding_count", type: "number", label: "缩略图额外预览图片数量", min: 0 },
            { key: "water_fall_columns", type: "number", label: "瀑布流列数", min: 0 },
        ),
        titledBox(
            "组件",
            switchField("show_thumbnail_nav", "缩略图导航"),
            selectField("tool_position", OPTIONS.imageReviewer.tool_position, "工具栏位置"),
            selectField("show_message", OPTIONS.imageReviewer.show_message, "工具栏左侧展示"),
            { key: "tool_function", type: "select", label: "工具栏按钮", minItems: 1, options: OPTIONS.imageReviewer.operations },
        ),
        titledBox(
            "行为",
            switchField("filter_error_image", "跳过加载失败的图片"),
            { key: "first_image_strategies", type: "select", label: "首张图片的选择策略", minItems: 1, options: OPTIONS.imageReviewer.first_image_strategies },
            selectField("thumbnail_object_fit", OPTIONS.imageReviewer.thumbnail_object_fit, "缩略图的容器适应策略"),
            numberField("play_second", UNITS.second, "轮播停留时间"),
        ),
        titledBox(
            "鼠标事件",
            switchField("click_mask_to_exit", "点击空白处退出"),
            selectField("mousedown_function.0", OPTIONS.imageReviewer.operations, "LClick"),
            selectField("mousedown_function.1", OPTIONS.imageReviewer.operations, "MClick"),
            selectField("mousedown_function.2", OPTIONS.imageReviewer.operations, "RClick"),
            selectField("ctrl_mousedown_function.0", OPTIONS.imageReviewer.operations, "Ctrl+LClick"),
            selectField("ctrl_mousedown_function.1", OPTIONS.imageReviewer.operations, "Ctrl+MClick"),
            selectField("ctrl_mousedown_function.2", OPTIONS.imageReviewer.operations, "Ctrl+RClick"),
            selectField("shift_mousedown_function.0", OPTIONS.imageReviewer.operations, "Shift+LClick"),
            selectField("shift_mousedown_function.1", OPTIONS.imageReviewer.operations, "Shift+MClick"),
            selectField("shift_mousedown_function.2", OPTIONS.imageReviewer.operations, "Shift+RClick"),
            selectField("alt_mousedown_function.0", OPTIONS.imageReviewer.operations, "Alt+LClick"),
            selectField("alt_mousedown_function.1", OPTIONS.imageReviewer.operations, "Alt+MClick"),
            selectField("alt_mousedown_function.2", OPTIONS.imageReviewer.operations, "Alt+RClick"),
            selectField("wheel_function.0", OPTIONS.imageReviewer.operations, "WheelUp"),
            selectField("wheel_function.1", OPTIONS.imageReviewer.operations, "WheelDown"),
            selectField("ctrl_wheel_function.0", OPTIONS.imageReviewer.operations, "Ctrl+WheelUp"),
            selectField("ctrl_wheel_function.1", OPTIONS.imageReviewer.operations, "Ctrl+WheelDown"),
            selectField("shift_wheel_function.0", OPTIONS.imageReviewer.operations, "Shift+WheelUp"),
            selectField("shift_wheel_function.1", OPTIONS.imageReviewer.operations, "Shift+WheelDown"),
            selectField("alt_wheel_function.0", OPTIONS.imageReviewer.operations, "Alt+WheelUp"),
            selectField("alt_wheel_function.1", OPTIONS.imageReviewer.operations, "Alt+WheelDown"),
        ),
        jsonBox("预设的快捷键列表", "hotkey_function"),
        titledBox(
            "单次调整幅度",
            numberField("zoom_scale", UNITS.percent, "缩放比率"),
            numberField("rotate_scale", UNITS.degree, "旋转角度"),
            numberField("skew_scale", UNITS.degree, "倾斜角度"),
            numberField("translate_scale", UNITS.pixel, "移动距离"),
        ),
        RESTORE_SETTINGS_BOX,
    ],
    markdownLint: [
        CUSTOM_PLUGIN_FULL_BASE_PROP_BOX,
        titledBox(
            "窗口样式",
            textField("modal_width", "宽度"),
            textField("modal_max_height", "最大高度"),
            textField("modal_font_size", "字体大小"),
            numberField("modal_line_height", UNITS.em, "文字行高"),
        ),
        titledBox(
            "状态指示方块",
            switchField("use_button", "启用"),
            textField("button_width", "宽度"),
            textField("button_height", "高度"),
            textField("pass_color", "检测通过颜色"),
            textField("error_color", "检测未通过颜色"),
        ),
        titledBox(
            "检测与修复",
            switchField("translate", "翻译检测规则"),
            { key: "tools", type: "select", label: "启用工具", minItems: 1, options: OPTIONS.markdownLint.tools },
            selectField("result_order_by", OPTIONS.markdownLint.result_order_by, "排序检测结果"),
            hotkeyField("hotkey_fix_lint_error", "快捷键：修复"),
        ),
        jsonBox("检测规则", "rule_config", 15),
        arrayBox("自定义检测规则文件", "custom_rules"),
        RESTORE_SETTINGS_BOX,
    ],
    reopenClosedFiles: [
        CUSTOM_PLUGIN_FULL_BASE_PROP_BOX,
        untitledBox(
            switchField("auto_reopen_when_init", "自动恢复未关闭标签"),
        ),
        RESTORE_SETTINGS_BOX,
    ],
    quickButton: [
        CUSTOM_PLUGIN_FULL_BASE_PROP_BOX,
        titledBox(
            "按钮样式",
            textField("button_size", "大小"),
            textField("button_border_radius", "圆角半径"),
            textField("button_box_shadow", "阴影"),
            textField("button_gap", "间距"),
            textField("position_right", "距右边框"),
            textField("position_bottom", "距底边框"),
        ),
        untitledBox(
            switchField("support_right_click", "支持右键点击"),
            switchField("hide_button_hint", "隐藏提示信息"),
        ),
        jsonBox("预设的按钮列表", "buttons"),
        RESTORE_SETTINGS_BOX,
    ],
    blockSideBySide: [
        CUSTOM_PLUGIN_FULL_BASE_PROP_BOX,
        RESTORE_SETTINGS_BOX,
    ],
    redirectLocalRootUrl: [
        CUSTOM_PLUGIN_LITE_BASE_PROP_BOX,
        untitledBox(
            textField("root", "资源根目录"),
            textField("filter_regexp", "过滤正则表达式"),
        ),
        RESTORE_SETTINGS_BOX,
    ],
}

module.exports = {
    ...SETTING_SCHEMAS
}
