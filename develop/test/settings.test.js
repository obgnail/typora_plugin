const { describe, it, before } = require("node:test")
const assert = require("node:assert")
const fs = require("fs-extra")
const path = require("path")

let i18n
let basePluginSettings
let customPluginSettings
let pluginNames

const getSetting = (pluginName, isCustom = false) => {
    const settings = isCustom ? customPluginSettings : basePluginSettings
    const setting = settings[pluginName]
    assert.ok(setting, `[Configuration Error] Settings for plugin '${pluginName}' not found`)
    return setting
}

const assertHasProps = (obj, props, errorPrefix) => {
    assert.ok(obj, `${errorPrefix} is undefined or null`)
    for (const prop of props) {
        assert.ok(Object.hasOwn(obj, prop), `${errorPrefix} missing property: ${prop}`)
    }
}

const assertEvalFn = (str, errorMsg) => {
    assert.equal(typeof str, "string", `${errorMsg} (must be a string)`)
    assert.equal(typeof eval(str), "function", errorMsg)
}

before(async () => {
    ({ base: basePluginSettings, custom: customPluginSettings } = await require("./fixtures/settings.js").getDefaults())
    i18n = await require("./fixtures/i18n.js").get("zh-CN")
    pluginNames = [...Object.keys(basePluginSettings), ...Object.keys(customPluginSettings)]
})

describe("Plugin Core Structure", () => {
    it("base plugins should have valid 'ENABLE' and 'NAME' attributes", () => {
        for (const [fixedName, s] of Object.entries(basePluginSettings)) {
            assert.ok(
                typeof s.ENABLE === "boolean" && (typeof s.NAME === "string" || fixedName === "global"),
                `[Base Plugin] ${fixedName} is missing required attributes`
            )
        }
    })

    it("custom plugins should have valid 'enable', 'name', 'hide', and 'order' attributes", () => {
        for (const [fixedName, s] of Object.entries(customPluginSettings)) {
            assert.ok(
                typeof s.enable === "boolean" && typeof s.name === "string" && typeof s.hide === "boolean" && typeof s.order === "number",
                `[Custom Plugin] ${fixedName} is missing required attributes`
            )
        }
    })
})

describe("UI & Menus Configuration", () => {
    it("sidebar_enhance: SIDEBAR_ICONS should contain required fields and valid extensions", () => {
        const setting = getSetting("sidebar_enhance")
        assert.ok(Array.isArray(setting.SIDEBAR_ICONS), "SIDEBAR_ICONS must be an array")
        setting.SIDEBAR_ICONS.forEach((icon, index) => {
            assertHasProps(icon, ["enable", "extensions", "icon"], `SIDEBAR_ICONS[${index}]`)
            assert.ok(Array.isArray(icon.extensions), `SIDEBAR_ICONS[${index}].extensions must be an array`)
        })
    })

    it("right_click_menu: MENUS should be translated and properly reference active plugins", () => {
        const setting = getSetting("right_click_menu")
        assert.ok(Array.isArray(setting.MENUS), "MENUS must be an array")
        setting.MENUS.forEach((menu, index) => {
            assert.ok(menu.NAME, `MENUS[${index}] must have a NAME`)
            assert.ok(Object.hasOwn(i18n.data.settings, menu.NAME), `Menu NAME '${menu.NAME}' is missing from i18n translation`)
            assert.ok(Array.isArray(menu.LIST), `MENUS[${index}].LIST must be an array`)

            menu.LIST.forEach((pluginName, pluginIndex) => {
                if (pluginName === "---") return
                assert.match(pluginName, /^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)?$/, `Invalid format in MENUS[${index}]: ${pluginName}`)
                const basePluginName = pluginName.split(".")[0]
                assert.ok(pluginNames.includes(basePluginName), `MENUS[${index}] references non-existent plugin: ${basePluginName}`)
            })
        })
    })

    it("pie_menu: BUTTONS should target valid plugin callbacks", () => {
        const setting = getSetting("pie_menu")
        assert.ok(Array.isArray(setting.BUTTONS), "BUTTONS must be an array")
        setting.BUTTONS.forEach((btn, index) => {
            assert.ok(btn.ICON && btn.CALLBACK, `BUTTONS[${index}] must have ICON and CALLBACK`)
            assert.match(btn.CALLBACK, /^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)?$/, `Invalid CALLBACK format in BUTTONS[${index}]`)
            const basePluginName = btn.CALLBACK.split(".")[0]
            assert.ok(pluginNames.includes(basePluginName), `BUTTONS[${index}] references non-existent plugin: ${basePluginName}`)
        })
    })

    it("preferences: DEFAULT_MENU and HIDE_MENUS should reference valid plugins", () => {
        const setting = getSetting("preferences")
        assert.ok([...pluginNames, "__LAST__"].includes(setting.DEFAULT_MENU), "DEFAULT_MENU is invalid")
        assert.ok(Array.isArray(setting.HIDE_MENUS), "HIDE_MENUS must be an array")
        setting.HIDE_MENUS.forEach((menu, index) => {
            assert.ok(pluginNames.includes(menu), `HIDE_MENUS[${index}] contains invalid plugin name`)
        })
    })

    it("callouts: CALLOUTS should have required display properties", () => {
        const setting = getSetting("callouts")
        assert.ok(Array.isArray(setting.CALLOUTS), "CALLOUTS must be an array")
        setting.CALLOUTS.forEach((callout, index) => {
            assertHasProps(callout, ["type", "background_color", "left_line_color", "icon"], `CALLOUTS[${index}]`)
        })
    })
})

describe("Text Processing & Regex", () => {
    it("md_padding: IGNORE_PATTERNS should be strictly valid Regular Expressions", () => {
        const setting = getSetting("md_padding")
        assert.ok(Array.isArray(setting.IGNORE_PATTERNS), "IGNORE_PATTERNS must be an array")
        setting.IGNORE_PATTERNS.forEach((p, index) => {
            assert.doesNotThrow(() => new RegExp(p), `IGNORE_PATTERNS[${index}] ('${p}') is not a valid Regex`)
        })
    })

    it("fence_enhance: HIGHLIGHT_PATTERN should be a valid Regular Expression", () => {
        const setting = getSetting("fence_enhance")
        const p = setting.HIGHLIGHT_PATTERN
        assert.doesNotThrow(() => new RegExp(p), `HIGHLIGHT_PATTERN ('${p}') is not a valid Regex`)
    })

    it("slash_commands: TRIGGER_REGEXP should be a valid Regular Expression", () => {
        const setting = getSetting("slash_commands")
        const p = setting.TRIGGER_REGEXP
        assert.doesNotThrow(() => new RegExp(p), `TRIGGER_REGEXP ('${p}') is not a valid Regex`)
    })

    it("cjk_symbol_pairing: symbols should be single-character strings", () => {
        const setting = getSetting("cjk_symbol_pairing")
        const requiredProps = ["enable", "input", "output"]

        for (const attr of ["AUTO_PAIR_SYMBOLS", "AUTO_CONVERT_SYMBOLS"]) {
            assert.ok(Array.isArray(setting[attr]), `${attr} must be an array`)
            setting[attr].forEach((sym, index) => {
                assertHasProps(sym, requiredProps, `${attr}[${index}]`)
                assert.ok(typeof sym.input === "string" && sym.input.length === 1, `${attr}[${index}].input must be a single character`)
                assert.ok(typeof sym.output === "string" && sym.output.length === 1, `${attr}[${index}].output must be a single character`)
            })
        }
    })
})

describe("Scripts, Actions & File IO", () => {
    it("commander: BUILTIN scripts should have complete definitions and valid shells", () => {
        const setting = getSetting("commander")
        assert.ok(Array.isArray(setting.BUILTIN), "BUILTIN must be an array")
        const validTypes = ["cmd/bash", "powershell", "gitbash", "wsl"]
        setting.BUILTIN.forEach((built, index) => {
            assertHasProps(built, ["name", "disable", "shell", "cmd"], `BUILTIN[${index}]`)
            assert.ok(validTypes.includes(built.shell), `BUILTIN[${index}].shell must be one of: ${validTypes.join(", ")}`)
        })
    })

    it("action_buttons: BUTTONS should have valid coordinates and valid executable callbacks", () => {
        const setting = getSetting("action_buttons")
        assert.ok(Array.isArray(setting.BUTTONS), "BUTTONS must be an array")
        setting.BUTTONS.forEach((btn, index) => {
            assertHasProps(btn, ["enable", "coordinate", "icon"], `BUTTONS[${index}]`)
            assert.ok(Array.isArray(btn.coordinate) && btn.coordinate.length === 2, `BUTTONS[${index}].coordinate must be an array of length 2`)
            assert.ok(btn.coordinate.every(c => Number.isInteger(c) && c >= 0), `BUTTONS[${index}].coordinate elements must be non-negative integers`)

            if (btn.callback && !btn.evil) {
                assert.match(btn.callback, /^[a-zA-Z_][a-zA-Z0-9_]*\.[a-zA-Z_][a-zA-Z0-9_]*$/, `Invalid format in BUTTONS[${index}].callback`)
                const pluginName = btn.callback.split(".")[0]
                assert.ok(pluginNames.includes(pluginName), `BUTTONS[${index}].callback references non-existent plugin: ${pluginName}`)
            }
            if (btn.evil) assertEvalFn(btn.evil, `BUTTONS[${index}].evil must be a valid function`)
        })
    })

    it("hotkeys & shortcuts: should correctly map custom keys to existing actions or valid eval strings", () => {
        const textStylize = getSetting("text_stylize")
        assert.ok(Array.isArray(textStylize.ACTION_HOTKEYS), "ACTION_HOTKEYS must be an array")
        textStylize.ACTION_HOTKEYS.forEach((hotkey, index) => {
            assertHasProps(hotkey, ["hotkey", "action"], `text_stylize.ACTION_HOTKEYS[${index}]`)
        })

        const fenceEnhance = getSetting("fence_enhance")
        fenceEnhance.CUSTOM_HOTKEYS.forEach((hotkey, index) => {
            assertHasProps(hotkey, ["DISABLE", "HOTKEY", "CALLBACK"], `fence_enhance.CUSTOM_HOTKEYS[${index}]`)
            assertEvalFn(hotkey.CALLBACK, `fence_enhance.CUSTOM_HOTKEYS[${index}].CALLBACK must be a function`)
        })

        const hotkeysPlugin = getSetting("hotkeys")
        hotkeysPlugin.CUSTOM_HOTKEYS.forEach((hotkey, index) => {
            assertHasProps(hotkey, ["enable", "hotkey"], `hotkeys.CUSTOM_HOTKEYS[${index}]`)
            if (hotkey.hotkey !== "-" && hotkey.evil) {
                assertEvalFn(hotkey.evil, `hotkeys.CUSTOM_HOTKEYS[${index}].evil must be a function`)
            }
            if (hotkey.plugin && hotkey.function) {
                assert.ok(basePluginSettings[hotkey.plugin], `hotkeys.CUSTOM_HOTKEYS[${index}] references non-existent plugin`)
            }
        })
    })

    it("templater & execution: dynamic hooks and template callbacks should evaluate to valid functions", () => {
        const autoNumber = getSetting("auto_number")
        assertEvalFn(autoNumber.APPLY_EXPORT_HEADER_NUMBERING, "auto_number hook must be a function")

        const prefs = getSetting("preferences")
        assertEvalFn(prefs.FORM_RENDERING_HOOK, "preferences hook must be a function")

        const templater = getSetting("templater")
        assert.ok(Array.isArray(templater.TEMPLATE_VARIABLES), "TEMPLATE_VARIABLES must be an array")
        templater.TEMPLATE_VARIABLES.forEach((variable, index) => {
            assertHasProps(variable, ["enable", "name", "callback"], `TEMPLATE_VARIABLES[${index}]`)
            assertEvalFn(variable.callback, `TEMPLATE_VARIABLES[${index}].callback must be a function`)
        })

        const fenceEnhance = getSetting("fence_enhance")
        assert.ok(Array.isArray(fenceEnhance.CUSTOM_BUTTONS), "CUSTOM_BUTTONS must be an array")
        fenceEnhance.CUSTOM_BUTTONS.forEach((btn, index) => {
            assertHasProps(btn, ["DISABLE", "ICON", "HINT", "ON_INIT", "ON_RENDER", "ON_CLICK"], `CUSTOM_BUTTONS[${index}]`)
            assertEvalFn(btn.ON_CLICK, `CUSTOM_BUTTONS[${index}].ON_CLICK must be a function`)
            assertEvalFn(btn.ON_INIT, `CUSTOM_BUTTONS[${index}].ON_INIT must be a function`)
            assertEvalFn(btn.ON_RENDER, `CUSTOM_BUTTONS[${index}].ON_RENDER must be a function`)
        })
    })

    it("templater: TEMPLATE should contain required name and text properties", () => {
        const setting = getSetting("templater")
        assert.ok(Array.isArray(setting.TEMPLATE), "TEMPLATE must be an array")
        setting.TEMPLATE.forEach((tpl, index) => {
            assertHasProps(tpl, ["name", "text"], `TEMPLATE[${index}]`)
        })
    })

    it("slash_commands: COMMANDS should specify correct scopes and actionable callbacks", () => {
        const setting = getSetting("slash_commands")
        setting.COMMANDS.forEach((cmd, index) => {
            assertHasProps(cmd, ["enable", "type", "icon", "keyword", "callback"], `COMMANDS[${index}]`)
            assert.ok(["snippet", "command", "gen-snp"].includes(cmd.type), `Invalid command type in COMMANDS[${index}]`)
            if (cmd.scope) assert.ok(["plain", "inline_math"].includes(cmd.scope), `Invalid scope in COMMANDS[${index}]`)

            if (cmd.type === "snippet") {
                assert.equal(typeof cmd.callback, "string", `COMMANDS[${index}] snippet callback must be a string`)
            } else if (cmd.callback) {
                assertEvalFn(cmd.callback, `COMMANDS[${index}] non-snippet callback must be a function`)
            }
        })
    })

    it("file system assets: configured external files and templater folders must exist on disk", async () => {
        const mdLint = getSetting("markdownlint")
        assert.ok(Array.isArray(mdLint.CUSTOM_RULE_FILES), "CUSTOM_RULE_FILES must be an array")
        mdLint.CUSTOM_RULE_FILES.forEach((file, index) => {
            assert.doesNotThrow(() => require(`../../${file}`), `${file} in CUSTOM_RULE_FILES[${index}] could not be resolved`)
        })

        const templater = getSetting("templater")
        const folders = templater.TEMPLATE_FOLDERS
        assert.ok(Array.isArray(folders), "TEMPLATE_FOLDERS must be an array")
        for (let i = 0; i < folders.length; i++) {
            const absPath = path.resolve(__dirname, "../../", folders[i])
            const exist = await fs.access(absPath).then(() => true).catch(() => false)
            assert.ok(exist, `Directory '${folders[i]}' mapped in TEMPLATE_FOLDERS does not exist on disk`)
        }
    })
})
