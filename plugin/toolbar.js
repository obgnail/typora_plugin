class ToolbarPlugin extends BasePlugin {
    beforeProcess = () => {
        this.toolController = new ToolController(this)
        const tools = [TabTool, PluginTool, RecentFileTool, OperationTool, ModeTool, ThemeTool, OutlineTool, MixTool]
        tools.forEach(tool => this.toolController.register(new tool()))

        if (!this.config.GROUP_SEARCH) {
            this.config.DEFAULT_GROUP = "all"
        }
    }

    hotkey = () => [{ hotkey: this.config.HOTKEY, callback: this.call }]

    styleTemplate = () => ({ topPercent: parseInt(this.config.TOOLBAR_TOP_PERCENT) + "%" })

    html = () => {
        const title = [...this.toolController.tools.keys()].map(name => `${name}：${this.i18n.t(`$option.DEFAULT_GROUP.${name}`)}`).join("\n")
        return `
            <div id="plugin-toolbar" class="plugin-common-modal plugin-common-hidden">
                <form id="plugin-toolbar-form"><input placeholder="plu image" title="${title}"></form>
                <div class="plugin-toolbar-result"></div>
            </div>`
    }

    init = () => {
        this.entities = {
            content: this.utils.entities.eContent,
            toolbar: document.querySelector("#plugin-toolbar"),
            form: document.querySelector("#plugin-toolbar-form"),
            input: document.querySelector("#plugin-toolbar-form input"),
            result: document.querySelector(".plugin-toolbar-result"),
        }

        this.search = this.utils.debounce(async () => {
            const result = await this.toolController.handleInput()
            const ok = result && result.matches && result.tool
            this.entities.result.innerHTML = ok ? this._newItems(result).join("") : ""
        }, this.config.DEBOUNCE_INTERVAL)
    }

    process = () => {
        this.entities.form.addEventListener("submit", ev => {
            ev.preventDefault()
            const item = this.entities.result.querySelector(".plugin-toolbar-item.active") || (this.entities.result.childElementCount === 1 && this.entities.result.firstChild)
            if (item) this._callTool(item)
        })
        this.entities.input.addEventListener("keydown", ev => {
            if (ev.key === "ArrowUp" || ev.key === "ArrowDown") {
                this.utils.scrollActiveItem(this.entities.result, ".plugin-toolbar-item.active", ev.key === "ArrowDown")
            } else if (ev.key === "Escape" || (ev.key === "Backspace" && this.config.BACKSPACE_TO_HIDE && !this.entities.input.value)) {
                this.hide()
            }
        })

        let canInput = true
        this.entities.input.addEventListener("input", () => canInput && this.search())
        this.entities.input.addEventListener("compositionstart", () => canInput = false, true)
        this.entities.input.addEventListener("compositionend", async () => {
            canInput = true
            await this.search()
        })

        this.entities.result.addEventListener("click", ev => {
            const target = ev.target.closest(".plugin-toolbar-item")
            if (target) this._callTool(target)
        })
    }

    call = () => {
        setTimeout(async () => {
            if (this.utils.isShown(this.entities.toolbar)) {
                this.hide()
            } else {
                await this.show()
            }
        })
    }

    _registerAutoHide = () => {
        document.addEventListener("click", ev => {
            if (this.utils.isHidden(this.entities.toolbar)) return
            if (ev.target.closest("#plugin-toolbar")) {
                this._registerAutoHide()
            } else {
                this.hide()
            }
        }, { once: true })
    }

    _callTool = (target) => {
        const { tool, value, meta } = target.dataset
        this.toolController.callback(tool, value, meta)
        this.hide()
    }

    _newItems = ({ tool, matches, keywords }) => {
        const toolName = tool.name()
        return matches.map(match => {
            const showName = match.showName || match
            const fixedName = match.fixedName || match
            const meta = match.meta || ""
            let content = this.utils.escape(showName)
            if (keywords[0]) {
                keywords.forEach(keyword => content = content.replace(new RegExp(keyword, "gi"), "<b>$&</b>"))
            }
            const metaContent = meta ? `data-meta="${meta}"` : ""
            return `<div class="plugin-toolbar-item" data-value="${fixedName}" data-tool="${toolName}" ${metaContent}>${content}</div>`
        })
    }

    show = async () => {
        this.toolController.setAnchorNode()
        const widthRatio = this.config.TOOLBAR_WIDTH_PERCENT / 100
        const { width, left } = this.entities.content.getBoundingClientRect()
        this.entities.toolbar.style.width = width * widthRatio + "px"
        this.entities.toolbar.style.left = left + width * (1 - widthRatio) / 2 + "px"
        this.utils.show(this.entities.toolbar)
        this.entities.input.select()
        await this.search()
        this._registerAutoHide()
    }

    hide = () => {
        this.utils.hide(this.entities.toolbar)
        this.entities.input.value = ""
        this.entities.result.innerHTML = ""
    }
}

class ToolController {
    constructor(plugin) {
        this.plugin = plugin
        this.utils = plugin.utils
        this.i18n = plugin.i18n
        this.tools = new Map()  // map[name]tool
        this.anchorNode = null
    }

    register = tool => {
        tool.controller = this
        tool.utils = this.utils
        tool.i18n = this.i18n
        tool.init()

        const short = tool.name()
        this.tools.set(short, tool)
    }

    unregister = name => this.tools.delete(name)

    callback = (toolName, fixedName, meta) => this.tools.get(toolName)?.callback(fixedName, meta)

    setAnchorNode = () => this.anchorNode = this.utils.getAnchorNode()

    intersect = arrays => {
        if (!Array.isArray(arrays) || arrays.length === 0 || arrays.some(el => !el)) return []
        if (arrays.length === 1) return arrays[0]

        const fn = (typeof arrays[0][0] === "string")
            ? e => arrays.every(arr => arr.includes(e))
            : e => arrays.every(arr => arr.some(item => item.showName === e.showName && item.fixedName === e.fixedName && item.meta === e.meta))
        return arrays[0].filter(fn)
    }

    // Add a prefix to distinguish object and string items
    toUniqueString = item => typeof item === "object" ? `object: ${item.showName}${item.fixedName}${item.meta}` : `string: ${item}`

    union = arrays => {
        if (!Array.isArray(arrays) || arrays.length === 0) return []
        if (arrays.length === 1) return arrays[0]

        const set = new Set()
        const result = []
        for (const array of arrays) {
            for (const item of array) {
                const value = this.toUniqueString(item)
                if (!set.has(value)) {
                    set.add(value)
                    result.push(item)
                }
            }
        }
        return result
    }

    difference = (array1, array2) => {
        if (!Array.isArray(array1) || !Array.isArray(array2) || array1.length === 0 || array2.length === 0) return array1

        const set = new Set(array2.map(this.toUniqueString))
        return array1.filter(item => !set.has(this.toUniqueString(item)))
    }

    parse = (input) => {
        const keywords = input.split(" ").filter(Boolean)
        const posKeywords = []
        const negKeywords = []
        keywords.forEach(keyword => {
            if (keyword.startsWith("-")) {
                const val = keyword.slice(1)
                if (val) negKeywords.push(val)
            } else {
                posKeywords.push(keyword)
            }
        })
        if (posKeywords.length === 0) posKeywords.push("")
        if (keywords.length === 0) keywords.push("")
        return { keywords, posKeywords, negKeywords }
    }

    matchWithNeg = async (tool, posKeywords, negKeywords) => {
        const [posList, negList] = await Promise.all([
            Promise.all(posKeywords.map(tool.search)),
            Promise.all(negKeywords.map(tool.search)),
        ])
        const posResult = this.intersect(posList)
        const negResult = this.union(negList)
        const matches = this.difference(posResult, negResult)
        return { keywords: posKeywords, matches }
    }

    matchWithoutNeg = async (tool, keywords) => {
        const results = await Promise.all(keywords.map(tool.search))
        const matches = this.intersect(results)
        return { keywords, matches }
    }

    match = async (tool, input) => {
        const { keywords, posKeywords, negKeywords } = this.parse(input)
        return this.plugin.config.USE_NEGATIVE_SEARCH
            ? this.matchWithNeg(tool, posKeywords, negKeywords)
            : this.matchWithoutNeg(tool, keywords)
    }

    dispatch = raw => {
        raw = raw.trimLeft()
        const { GROUP_SEARCH, DEFAULT_GROUP } = this.plugin.config
        if (GROUP_SEARCH) {
            const group = [...this.tools.keys()].find(group => raw.startsWith(group + " "))
            if (group) {
                return { tool: this.tools.get(group), input: raw.slice(group.length + 1).trim() }
            }
        }
        if (DEFAULT_GROUP) {
            return { tool: this.tools.get(DEFAULT_GROUP), input: raw.trim() }
        }
        return { tool: null, input: "" }
    }

    handleInput = async () => {
        const raw = this.plugin.entities.input.value
        let { tool, input } = this.dispatch(raw)
        if (!tool) return

        const { keywords, matches } = await this.match(tool, input)
        if (matches?.length) {
            return { tool, keywords, matches }
        }
    }
}

class BaseTool {
    name = () => ""
    icon = () => "🎯"
    init = () => null
    search = async input => null  // Return []string or [{ showName:"", fixedName:"", meta:"" }]
    callback = (fixedName, meta) => null
    baseSearch = (input, candidates, searchFields) => {
        if (input === "") return candidates
        input = input.toLowerCase()
        const fn = searchFields
            ? item => searchFields.some(field => item[field].toLowerCase().includes(input))
            : item => item.toLowerCase().includes(input)
        return candidates.filter(fn)
    }
}

class TabTool extends BaseTool {
    name = () => "tab"
    icon = () => "📖"
    init = () => {
        const callback = () => this.windowTabPlugin = this.utils.getBasePlugin("window_tab")
        this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.allPluginsHadInjected, callback)
    }
    search = async input => {
        if (!this.windowTabPlugin) return
        const current = this.utils.getFilePath()
        const paths = this.windowTabPlugin.tabUtil.tabs.filter(tab => tab.path !== current).map(tab => tab.path)
        return this.baseSearch(input, paths)
    }
    callback = fixedName => this.windowTabPlugin.switchTabByPath(fixedName)
}

class PluginTool extends BaseTool {
    name = () => "plu"
    icon = () => "🔌"
    collectAll = () => {
        return Object.entries(this.utils.getAllBasePlugins())
            .filter(([_, plugin]) => plugin.call)
            .flatMap(([fixedName, plugin]) => {
                const chineseName = plugin.pluginName
                const staticActions = plugin.staticActions || []
                const dynamicActions = this.utils.updatePluginDynamicActions(fixedName, this.controller.anchorNode, true) || []
                const actions = [...staticActions, ...dynamicActions]
                return actions.length === 0
                    ? [{ showName: chineseName, fixedName: fixedName }]
                    : actions
                        .filter(act => !act.act_disabled && !act.act_hidden)
                        .map(act => ({ showName: `${chineseName} - ${act.act_name}`, fixedName: fixedName, meta: act.act_value }))
            })
            .map(plugin => {
                plugin.showName += (plugin.meta) ? ` （ ${plugin.fixedName} - ${plugin.meta} ）` : ` （ ${plugin.fixedName} ）`
                return plugin
            })
    }
    search = async input => {
        const plugins = this.collectAll()
        return this.baseSearch(input, plugins, ["showName"])
    }
    callback = (fixedName, action) => {
        this.utils.updateAndCallPluginDynamicAction(fixedName, action, this.controller.anchorNode)
    }
}

class RecentFileTool extends BaseTool {
    name = () => "his"
    icon = () => "🕖"
    getRecentFiles = async () => {
        if (!File.isNode) return

        const result = []
        const { files, folders } = await this.utils.getRecentFiles()
        const add = (entities, meta) => {
            for (const ent of entities) {
                const p = ent.path
                if (p) {
                    result.push({ showName: p, fixedName: p, meta })
                }
            }
        }
        add(folders, "folder")
        add(files, "file")
        return result
    }
    search = async input => {
        let files = await this.getRecentFiles()
        if (!files || files.length === 0) return

        const current = this.utils.getFilePath()
        files = files.filter(file => file.fixedName !== current)  // remove the current file
        return this.baseSearch(input, files, ["showName"])
    }
    callback = (fixedName, meta) => {
        if (meta === "file") {
            this.utils.openFile(fixedName)
        } else if (meta === "folder") {
            this.utils.openFolder(fixedName)
        }
    }
}

class OperationTool extends BaseTool {
    name = () => "ops"
    icon = () => "🔨"
    init = () => {
        this.ops = [
            { fixedName: "explorer", callback: () => this.utils.showInFinder(this.utils.getFilePath()) },
            { fixedName: "copyPath", callback: () => File.editor.UserOp.setClipboard(null, null, this.utils.getFilePath()) },
            { fixedName: "togglePreferencePanel", callback: () => File.megaMenu.togglePreferencePanel() },
            { fixedName: "togglePinWindow", callback: () => ClientCommand[document.body.classList.contains("always-on-top") ? "unpinWindow" : "pinWindow"]() },
            { fixedName: "openFileInNewWindow", callback: () => File.editor.library.openFileInNewWindow(this.utils.getFilePath(), false) },
            { fixedName: "openSettingFolder", callback: () => this.utils.settings.openFolder() },
        ].map(op => ({ ...op, showName: `${this.i18n.t(`tool.ops.${op.fixedName}`)} - ${op.fixedName}` }))
    }
    search = async input => this.baseSearch(input, this.ops, ["showName"])
    callback = (fixedName, meta) => this.ops.find(el => el.fixedName === fixedName)?.callback(meta)
}

class ModeTool extends BaseTool {
    name = () => "mode"
    icon = () => "🌗"
    init = () => {
        const outlineView = () => {
            File.editor.library.toggleSidebar()
            if (File.isNode) ClientCommand.refreshViewMenu()
        }
        this.modes = [
            { fixedName: "outlineView", callback: outlineView },
            { fixedName: "sourceMode", callback: () => File.toggleSourceMode() },
            { fixedName: "focusMode", callback: () => File.editor.toggleFocusMode() },
            { fixedName: "typewriterMode", callback: () => File.editor.toggleTypeWriterMode() },
            { fixedName: "debugMode", callback: () => JSBridge.invoke("window.toggleDevTools") },
        ]
        this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.allPluginsHadInjected, () => {
            const pluginConfig = [
                { name: "read_only", fixedName: "readOnlyMode" },
                { name: "blur", fixedName: "blurMode" },
                { name: "dark", fixedName: "dark" },
                { name: "image_viewer", fixedName: "image_viewer" },
                { name: "no_image", fixedName: "no_image" },
            ]
            pluginConfig.forEach(({ name, fixedName }) => {
                const plugin = this.utils.getBasePlugin(name)
                if (plugin) this.modes.push({ fixedName, callback: () => plugin.call() })
            })
            this.modes.forEach(mode => {
                const name = this.i18n.t("tool.mode." + mode.fixedName)
                mode.showName = `${name} - ${mode.fixedName}`
            })
        })
    }
    search = async input => this.baseSearch(input, this.modes, ["showName"])
    callback = (fixedName, meta) => this.modes.find(el => el.fixedName === fixedName)?.callback(meta)
}

class ThemeTool extends BaseTool {
    name = () => "theme"
    icon = () => "🎨"
    setThemeForever = theme => ClientCommand.setTheme(theme)
    // setThemeTemp = theme => File.setTheme(theme)
    search = async input => {
        const { all, current } = await JSBridge.invoke("setting.getThemes")
        const list = all.map(theme => ({ showName: theme.replace(/\.css$/gi, ""), fixedName: theme }))
        return this.baseSearch(input, list, ["showName"])
    }
    callback = fixedName => this.setThemeForever(fixedName)
}

class OutlineTool extends BaseTool {
    name = () => "out"
    icon = () => "🧷"
    getAll = () => {
        const headers = File?.editor?.nodeMap?.toc?.headers
        if (!headers) return []
        return headers.flatMap(header => {
            const { attributes, cid } = header || {}
            return (attributes && cid)
                ? [{ showName: attributes.pattern.replace("{0}", attributes.text), fixedName: cid }]
                : []
        })
    }
    search = async input => this.baseSearch(input, this.getAll(), ["showName"])
    callback = fixedName => this.utils.scrollByCid(fixedName)
}

class MixTool extends BaseTool {
    name = () => "all"
    icon = () => "🔱"
    search = async input => {
        const toolName = this.name()
        const blank = "\u00A0".repeat(3)
        const promises = [...this.controller.tools.entries()]
            .filter(([name]) => name !== toolName)
            .map(async ([name, tool]) => {
                const result = await tool.search(input)
                if (!result) {
                    return []
                }
                const icon = tool.icon()
                return result.map(el => {
                    const meta = `${name}@${el.meta || ""}`
                    const item = typeof el === "string" ? { showName: el, fixedName: el, meta } : { ...el, meta }
                    item.showName = `${icon}${blank}${item.showName}`
                    return item
                })
            })
        const toolResult = await Promise.all(promises)
        return toolResult.flat().filter(Boolean)
    }
    callback = (fixedName, meta) => {
        const [tool, realMeta] = meta.split("@", 2)
        this.controller.tools.get(tool)?.callback(fixedName, realMeta)
    }
}

module.exports = {
    plugin: ToolbarPlugin
}
