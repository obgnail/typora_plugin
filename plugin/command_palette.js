const buildProviders = (utils, context) => [
    {
        prefix: "",
        name: "Tab",
        fetch: async () => {
            const plugin = utils.getBasePlugin("window_tab")
            return (plugin?.tab?.tabs || []).map(t => ({ title: t.path, action: () => plugin.tab.switchByPath(t.path) }))
        }
    },
    {
        prefix: "#",
        name: "Recent Files",
        fetch: async () => {
            if (!File.isNode) return []
            const { files, folders } = await utils.getRecentFiles()
            const current = utils.getFilePath()
            const mapEntity = (isFolder) => (ent) => {
                if (!ent.path || ent.path === current) return null
                return { title: ent.path, action: () => isFolder ? utils.openFolder(ent.path) : utils.openFile(ent.path) }
            }
            return [
                ...(folders || []).map(mapEntity(true)),
                ...(files || []).map(mapEntity(false)),
            ].filter(Boolean)
        }
    },
    {
        prefix: ">",
        name: "Plugin",
        fetch: async () => {
            const anchor = context.getAnchor()
            const plugins = Object.entries(utils.getAllBasePlugins()).filter(([_, p]) => p.call)
            return plugins.flatMap(([fixedName, plugin]) => {
                const staticActions = plugin.staticActions || []
                const dynamicActions = utils.updatePluginDynamicActions(fixedName, anchor, true) || []
                const actions = [...staticActions, ...dynamicActions].filter(act => !act.act_disabled && !act.act_hidden)
                if (actions.length === 0) {
                    return [{ title: plugin.pluginName || fixedName, action: () => utils.updateAndCallPluginDynamicAction(fixedName, undefined, anchor) }]
                }
                return actions.map(act => ({
                    title: `${plugin.pluginName || fixedName} - ${act.act_name}`,
                    action: () => utils.updateAndCallPluginDynamicAction(fixedName, act.act_value, anchor)
                }))
            })
        }
    },
    {
        prefix: ">",
        name: "Operation",
        fetch: async () => {
            const doExport = async (name) => {
                const [htmlLike, others] = JSON.parse(await JSBridge.invoke("setting.loadExports"))
                ClientCommand.export(htmlLike[name])
            }
            const outlineView = () => {
                File.editor.library.toggleSidebar()
                if (File.isNode) ClientCommand.refreshViewMenu()
            }
            const { all: allThemes } = await JSBridge.invoke("setting.getThemes")
            return [
                { title: "Open in Explorer", action: () => utils.showInFinder(utils.getFilePath()) },
                { title: "Open File In New Window", action: () => File.editor.library.openFileInNewWindow(utils.getFilePath(), false) },
                { title: "Copy File Path", action: () => File.editor.UserOp.setClipboard(null, null, utils.getFilePath()) },
                { title: "Toggle Preference Panel", action: () => File.megaMenu.togglePreferencePanel() },
                { title: "Toggle Pin Window", action: () => ClientCommand[document.body.classList.contains("always-on-top") ? "unpinWindow" : "pinWindow"]() },
                { title: "Open Setting Folder", action: () => utils.settings.openFolder() },
                { title: "Print", action: () => ClientCommand.print() },
                { title: "Export: HTML", action: () => doExport("html") },
                { title: "Export: HTML-plain", action: () => doExport("html-plain") },
                { title: "Export: Image", action: () => doExport("image") },
                { title: "Export: PDF", action: () => doExport("pdf") },
                { title: "Mode: Outline View", action: outlineView },
                { title: "Mode: Source Code", action: () => File.toggleSourceMode() },
                { title: "Mode: Focus", action: () => File.editor.toggleFocusMode() },
                { title: "Mode: Typewriter", action: () => File.editor.toggleTypeWriterMode() },
                { title: "Mode: Debug", action: () => JSBridge.invoke("window.toggleDevTools") },
                ...allThemes.map(theme => ({ title: `Theme: ${theme.replace(/\.css$/gi, "")}`, action: () => ClientCommand.setTheme(theme) })),
            ]
        }
    },
    {
        prefix: "@",
        name: "Outline",
        fetch: async () => {
            const headers = File?.editor?.nodeMap?.toc?.headers || []
            return headers.reduce((acc, h) => {
                if (h?.attributes && h?.cid) {
                    const jump = () => utils.scroll(h.cid)
                    acc.push({
                        title: h.attributes.pattern.replace("{0}", h.attributes.text),
                        action: jump,
                        // preview: jump,
                    })
                }
                return acc
            }, [])
        }
    },
    {
        prefix: ":",
        name: "Go to Line",
        dynamic: true,
        fetch: async (query) => {
            const line = parseInt(query, 10)
            if (isNaN(line) || line <= 0) {
                return [{ title: "Type a line number to navigate", action: () => undefined }]
            }
            const jump = () => {
                if (!File.editor.sourceView.inSourceMode) File.toggleSourceMode()
                utils.scrollSourceView(line)
            }
            return [{
                title: `Go to line ${line}`,
                action: jump,
                // preview: jump,
            }]
        }
    },
    {
        prefix: "?",
        name: "Help",
        fetch: async () => {
            const helps = [
                { title: "> Show and Run Commands", prefix: ">" },
                { title: "@ Go to Symbol in Editor", prefix: "@" },
                { title: "# Search Recent Files", prefix: "#" },
                { title: ": Go to Line", prefix: ":" },
                { title: "? Help", prefix: "?" },
                { title: "Search Open Tabs", prefix: "" }
            ]
            return helps.map(h => ({
                title: h.title,
                action: () => {
                    context.setInput(h.prefix)
                    return false
                }
            }))
        }
    },
]

class Store {
    constructor() {
        this.state = { query: "", keywords: [], items: [], activeIndex: 0, loading: false, sessionId: 0 }
        this.listeners = new Set()
    }

    get() {
        return this.state
    }

    set(partialState) {
        const prevState = this.state
        this.state = { ...this.state, ...partialState }
        this.notify(prevState)
    }

    notify(prevState) {
        this.listeners.forEach(listener => listener(this.state, prevState))
    }

    subscribe(listener) {
        this.listeners.add(listener)
        return () => this.listeners.delete(listener)
    }
}

class Service {
    constructor(providers) {
        this.providers = []
        this.registerProviders(...providers)
    }

    registerProviders(...providers) {
        this.providers.push(...providers)
        this.prefixes = this.providers.map(p => p.prefix).filter(Boolean).sort((a, b) => b.length - a.length)
    }

    resolveInput(rawInput) {
        const raw = rawInput.trim()
        for (const prefix of this.prefixes) {
            if (raw.startsWith(prefix)) {
                const query = raw.slice(prefix.length).trim()
                return { prefix, query, keywords: this.parseKeywords(query) }
            }
        }
        return { prefix: "", query: raw, keywords: this.parseKeywords(raw) }
    }

    parseKeywords(query) {
        return query.toLowerCase().split(/\s+/).filter(Boolean)
    }

    async fetchItems(prefix, query, keywords) {
        const activeProviders = this.providers.filter(p => p.prefix === prefix)
        const results = await Promise.all(activeProviders.map(p => p.fetch(query, keywords)))

        return activeProviders.flatMap((p, index) => {
            const providerItems = results[index]
            if (p.dynamic || keywords.length === 0) {
                return providerItems
            }
            return providerItems.filter(item => {
                const title = item.title.toLowerCase()
                return keywords.every(kw => title.includes(kw))
            })
        })
    }
}

class View {
    constructor(entities, utils) {
        this.entities = entities
        this.utils = utils
    }

    render(state, prevState) {
        if (prevState && prevState.items === state.items && prevState.loading === state.loading) {
            if (prevState.activeIndex !== state.activeIndex) {
                this._updateActiveIndex(prevState.activeIndex, state.activeIndex)
            }
            return
        }
        if (state.items.length === 0) {
            this.entities.results.innerHTML = state.loading
                ? `<div class="plugin-command-palette-empty">Searching...</div>`
                : `<div class="plugin-command-palette-empty">No matching results</div>`
            return
        }

        let highlightRegex = null
        if (state.keywords.length > 0) {
            const pattern = state.keywords
                .sort((a, b) => b.length - a.length)
                .map(kw => kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
                .join("|")
            highlightRegex = new RegExp(`(${pattern})`, "gi")
        }

        this.entities.results.innerHTML = state.items.map((item, idx) => {
            const title = highlightRegex
                ? item.title.split(highlightRegex).map((part, i) => i % 2 === 1 ? `<b>${this.utils.escape(part)}</b>` : this.utils.escape(part)).join("")
                : this.utils.escape(item.title)
            const activeClass = idx === state.activeIndex ? "active" : ""
            return `<div class="plugin-command-palette-item ${activeClass}" data-index="${idx}">${title}</div>`
        }).join("")

        this.entities.results.querySelector(".active")?.scrollIntoView({ block: "nearest" })
    }

    _updateActiveIndex(prevIndex, nextIndex) {
        const children = this.entities.results.children
        const prevEl = children[prevIndex]
        const nextEl = children[nextIndex]
        prevEl?.classList.remove("active")
        nextEl?.classList.add("active")
        nextEl?.scrollIntoView({ block: "nearest" })
    }

    getInputValue() {
        return this.entities.input.value
    }

    setInputValue(val) {
        this.entities.input.value = val
    }
}

class CommandPalettePlugin extends BasePlugin {
    hotkey = () => [{ hotkey: this.config.HOTKEY, callback: this.call }]

    html = () => `
        <div class="plugin-command-palette-overlay plugin-common-hidden">
            <div class="plugin-command-palette-modal">
                <input id="plugin-command-palette-input" type="text" placeholder="Type ? to see available commands">
                <div class="plugin-command-palette-results"></div>
            </div>
        </div>`

    styleTemplate = () => true

    init = () => {
        this.entities = {
            overlay: document.querySelector(".plugin-command-palette-overlay"),
            input: document.querySelector("#plugin-command-palette-input"),
            results: document.querySelector(".plugin-command-palette-results"),
        }

        const providers = buildProviders(this.utils, {
            getAnchor: () => this.anchorNode,
            setInput: (input) => this.setInput(input),
        })
        this.store = new Store()
        this.service = new Service(providers)
        this.view = new View(this.entities, this.utils)
        this.store.subscribe((state, prevState) => this.view.render(state, prevState))
        this.inputHandler = null
    }

    process = () => {
        this.inputHandler = this.utils.createSmartInputHandler(
            this.entities.input,
            val => this.executeSearch(val),
            { debounceDelay: this.config.DEBOUNCE_INTERVAL }
        )

        this.entities.input.addEventListener("keydown", async ev => {
            if (this.inputHandler.isComposing()) return
            const state = this.store.get()
            if (ev.key === "ArrowDown") {
                ev.preventDefault()
                if (state.items.length === 0) return
                const nextIndex = (state.activeIndex + 1) % state.items.length
                this.store.set({ activeIndex: nextIndex })
                this.triggerPreview()
                return
            }
            if (ev.key === "ArrowUp") {
                ev.preventDefault()
                if (state.items.length === 0) return
                const prevIndex = (state.activeIndex - 1 + state.items.length) % state.items.length
                this.store.set({ activeIndex: prevIndex })
                this.triggerPreview()
                return
            }
            if (ev.key === "Escape" || (ev.key === "Backspace" && this.config.BACKSPACE_TO_HIDE && !this.view.getInputValue())) {
                this.hide()
                return
            }
            if (ev.key === "Enter") {
                ev.preventDefault()
                if (state.items.length === 0 && !state.loading) return
                const currentValue = this.view.getInputValue()
                const isSync = state.query === currentValue && !state.loading
                if (!isSync) {
                    await this.executeSearch(currentValue)
                }
                this.triggerAction()
            }
        })

        this.entities.results.addEventListener("click", ev => {
            const itemEl = ev.target.closest(".plugin-command-palette-item")
            if (itemEl) {
                const index = parseInt(itemEl.dataset.index, 10)
                this.store.set({ activeIndex: index })
                this.triggerAction()
            }
        })

        this.entities.overlay.addEventListener("click", ev => {
            if (!ev.target.closest(".plugin-command-palette-modal")) this.hide()
        })
    }

    executeSearch = async (rawInput) => {
        const currentSessionId = this.store.get().sessionId + 1
        const { prefix, query, keywords } = this.service.resolveInput(rawInput)
        this.store.set({ query: rawInput, keywords, loading: true, sessionId: currentSessionId })
        try {
            const items = await this.service.fetchItems(prefix, query, keywords)
            if (this.store.get().sessionId !== currentSessionId) return
            this.store.set({ items, activeIndex: 0, loading: false })
            this.triggerPreview()
        } catch (error) {
            console.error("[Command Palette] Fetch Error:", error)
            if (this.store.get().sessionId === currentSessionId) {
                this.store.set({ items: [], activeIndex: 0, loading: false })
            }
        }
    }

    triggerPreview = () => {
        const state = this.store.get()
        const activeItem = state.items[state.activeIndex]
        activeItem?.preview?.({ ...state })
        this.entities.input.focus()
    }

    triggerAction = () => {
        const state = this.store.get()
        const activeItem = state.items[state.activeIndex]
        if (activeItem?.action({ ...state }) !== false) {
            this.hide()
        }
    }

    setInput = async (input) => {
        this.view.setInputValue(input)
        this.entities.input.focus()
        await this.executeSearch(input)
    }

    show = async (input = ">") => {
        this.anchorNode = this.utils.getAnchorNode()
        this.utils.show(this.entities.overlay)
        await this.setInput(input)
    }

    hide = () => {
        const nextSessionId = this.store.get().sessionId + 1
        this.utils.hide(this.entities.overlay)
        this.view.setInputValue("")
        this.store.set({ query: "", keywords: [], items: [], activeIndex: 0, loading: false, sessionId: nextSessionId })
    }

    call = async () => this.utils.isShown(this.entities.overlay) ? this.hide() : this.show()

    registerProviders = (...providers) => this.service.registerProviders(...providers)
}

module.exports = {
    plugin: CommandPalettePlugin
}
