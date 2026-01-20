module.exports = (plugin) => {
    const { utils, i18n } = plugin
    const _disableControl = (field, tooltip = i18n._t("settings", "$tooltip.lowVersion")) => {
        field.disabled = true
        field.tooltip = tooltip
    }
    const _enableControl = (field, deleteTooltip = false) => {
        field.disabled = false
        if (deleteTooltip) delete field.tooltip
    }
    const _disableSwitch = (field, data, tooltip) => {
        _disableControl(field, tooltip)
        data[field.key] = false
    }
    const _disableOptions = (field, ...options) => field.disabledOptions = options
    return {
        global: {
            pluginVersion: async (field, data) => {
                if (!data[field.key]) {
                    let version = "Unknown"
                    try {
                        const file = utils.joinPath("./plugin/bin/version.json")
                        const json = await utils.Package.FsExtra.readJson(file)
                        version = json.tag_name
                    } catch (e) {
                        console.error(e)
                    }
                    data[field.key] = version
                }
            },
        },
        window_tab: {
            LAST_TAB_CLOSE_ACTION: (field, data) => {
                if (utils.isBetaVersion) {
                    const invalidOption = "blankPage"
                    _disableOptions(field, invalidOption)
                    if (data[field.key] === invalidOption) {
                        data[field.key] = "reconfirm"
                    }
                }
            },
        },
        read_only: {
            REMAIN_AVAILABLE_MENU_KEY: (field) => {
                if (!field.options) {
                    const entries = [...document.querySelectorAll(".context-menu:not(.ext-context-menu) [data-key]")].map(op => {
                        const key = op.dataset.key
                        if (!key) return
                        const hint = op.classList.contains("menu-style-btn")
                            ? op.getAttribute("ty-hint")?.split("\t")[0]
                            : op.querySelector('[data-lg="Menu"]')?.textContent.trim()
                        return [key, hint || key]
                    }).filter(Boolean)
                    field.options = Object.fromEntries(entries)
                }
            },
        },
        fence_enhance: {
            ENABLE_INDENT: (field, data) => {
                if (utils.isBetaVersion) {
                    _disableSwitch(field, data)
                }
            },
            PRELOAD_ALL_FENCES: (field, data) => {
                if (!File.hasOwnProperty("loadFile")) {
                    _disableSwitch(field, data)
                }
            },
        },
        blur: {
            ENABLE: (field, data) => {
                if (!utils.supportHasSelector) {
                    _disableSwitch(field, data)
                }
            },
        },
        export_enhance: {
            ENABLE: (field, data) => {
                if (!utils.exportHelper.isAsync) {
                    _disableSwitch(field, data)
                }
            },
        },
        sidebar_enhance: {
            DISPLAY_NON_MARKDOWN_FILES: (field, data) => {
                if (!File.SupportedFiles) {
                    _disableSwitch(field, data)
                }
            },
            OUTLINE_FOLD_STATE: (field) => {
                if (!File.option.hasOwnProperty("canCollapseOutlinePanel")) {
                    _disableControl(field)
                } else if (!File.option.canCollapseOutlinePanel) {
                    const text = i18n._t("sidebar_enhance", "$tooltip.canCollapseOutlinePanel")
                    const tooltip = { action: "togglePreferencePanel", icon: "fa fa-gear", text }
                    _disableControl(field, tooltip)
                } else {
                    _enableControl(field, true)
                }
            },
        },
        markmap: {
            AUTO_COLLAPSE_PARAGRAPH_WHEN_FOLD: (field, data) => {
                if (!utils.getBasePlugin("collapse_paragraph")) {
                    _disableSwitch(field, data, i18n._t("markmap", "$tooltip.experimental"))
                } else {
                    _enableControl(field)
                }
            },
        },
        right_click_menu: {
            MENUS: (field) => {
                const subField = field.nestedBoxes.find(box => box.fields.some(field => field.key === "LIST"))?.fields[0]
                if (!subField?.options) {
                    const allBasePlugins = Object.fromEntries(
                        Object.entries(utils.getAllBasePluginSettings()).map(([name, p]) => {
                            const pluginName = p.NAME || i18n._t(name, "pluginName")
                            return [name, pluginName]
                        })
                    )
                    allBasePlugins["---"] = "--- DIVIDER ---"
                    subField.options = allBasePlugins
                }
            },
        },
        preferences: {
            DEFAULT_MENU: (field) => {
                if (!field.options) {
                    field.options = { __LAST__: i18n.t("lastUsed"), ...plugin._getAllPlugins() }
                }
            },
            HIDE_MENUS: (field) => {
                if (!field.options) {
                    field.options = plugin._getAllPlugins()
                    _disableOptions(field, "global", "preferences")
                }
            },
        },
        chineseSymbolAutoPairer: {
            enable: (field, data) => {
                if (File.option.noPairingMatch) {
                    const text = i18n._t("chineseSymbolAutoPairer", "$tooltip.enablePairing")
                    const tooltip = { action: "togglePreferencePanel", icon: "fa fa-gear", text }
                    _disableSwitch(field, data, tooltip)
                } else {
                    _enableControl(field, true)
                }
            },
        },
        markdownLint: {
            rule_config: (field, data, box) => {
                if (utils.getCustomPlugin("markdownLint")) {
                    box.title = undefined
                    box.fields[0] = { type: "action", key: "invokeMarkdownLintSettings", tooltip: box.tooltip, label: i18n._t("markdownLint", "$label.invokeMarkdownLintSettings") }
                }
            },
        },
    }
}
