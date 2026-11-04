const buildProviders = require("./providers.js")

class Store {
  listeners = new Set()
  state = { query: "", keywords: [], items: [], activeIndex: 0, loading: false, sessionId: 0 }

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
  providers = []

  constructor(providers) {
    this.registerProviders(...providers)
  }

  registerProviders(...providers) {
    this.providers.push(...providers)
    this.patterns = this.providers
      .map(p => p.prefix)
      .filter(Boolean)
      .sort((p1, p2) => p2.length - p1.length)
      .map(p => ({ prefix: p, pattern: new RegExp(`^${p.replace(/\W/g, "\\$&")}${/\w$/.test(p) ? "\\b" : ""}`) }))
  }

  resolveInput(rawInput) {
    const raw = rawInput.trim()
    for (const { prefix, pattern } of this.patterns) {
      const matched = pattern.exec(raw)
      if (matched) {
        const query = raw.slice(matched[0].length).trim()
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
      const items = (p.dynamic || keywords.length === 0)
        ? providerItems
        : providerItems.filter(item => {
          const text = `${item.title} ${item.subtitle || ""} ${item.hint || ""}`.toLowerCase()
          return keywords.every(kw => text.includes(kw))
        })
      return items.map(item => ({ group: p.name, ...item }))
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
      const text = state.loading ? "Searching..." : "No matching results"
      this.entities.results.innerHTML = `<div class="plugin-command-palette-empty">${text}</div>`
      return
    }

    const highlightRegex = this._buildHighlightRegex(state.keywords)
    const showGroups = new Set(state.items.map(item => item.group)).size > 1
    let lastGroup = null
    this.entities.results.innerHTML = state.items.map((item, idx) => {
      const header = (showGroups && item.group && item.group !== lastGroup)
        ? `<div class="plugin-command-palette-group">${this.utils.escape(item.group)}</div>`
        : ""
      lastGroup = item.group
      return header + this._renderItem(item, idx, idx === state.activeIndex, highlightRegex)
    }).join("")

    this.entities.results.querySelector(".active")?.scrollIntoView({ block: "nearest" })
  }

  _buildHighlightRegex(keywords) {
    if (keywords.length === 0) return null
    const pattern = keywords.sort((a, b) => b.length - a.length).map(kw => kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")
    return new RegExp(`(${pattern})`, "gi")
  }

  _highlight(text, regex) {
    return regex
      ? text.split(regex).map((part, i) => i % 2 === 1 ? `<b>${this.utils.escape(part)}</b>` : this.utils.escape(part)).join("")
      : this.utils.escape(text)
  }

  _renderItem(item, idx, isActive, highlightRegex) {
    const title = this._highlight(item.title, highlightRegex)
    const subtitle = item.subtitle ? `<span class="plugin-command-palette-item-subtitle">${this._highlight(item.subtitle, highlightRegex)}</span>` : ""
    const hint = item.hint ? `<span class="plugin-command-palette-item-hint">${this._highlight(item.hint, highlightRegex)}</span>` : ""
    const activeClass = isActive ? " active" : ""
    return `<div class="plugin-command-palette-item${activeClass}" data-index="${idx}">${title}${subtitle}${hint}</div>`
  }

  _updateActiveIndex(prevIndex, nextIndex) {
    const items = this.entities.results.querySelectorAll(".plugin-command-palette-item")
    items[prevIndex]?.classList.remove("active")
    const nextEl = items[nextIndex]
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

  html = () =>
    `<div class="plugin-command-palette-overlay plugin-common-hidden">
      <div class="plugin-command-palette-panel">
        <input id="plugin-command-palette-input" type="text" placeholder="Type ? to see available commands">
        <div class="plugin-command-palette-results"></div>
      </div>
    </div>`

  style = () => true

  init = () => {
    this.entities = {
      overlay: document.querySelector(".plugin-command-palette-overlay"),
      input: document.querySelector("#plugin-command-palette-input"),
      results: document.querySelector(".plugin-command-palette-results"),
    }

    const providers = buildProviders(this.utils, {
      getProviders: () => providers,
      getAnchor: () => this.anchorNode,
      setInput: (input) => this.setInput(input),
    })
    this.store = new Store()
    this.service = new Service(providers)
    this.view = new View(this.entities, this.utils)
    this.store.subscribe((state, prevState) => this.view.render(state, prevState))
  }

  process = () => {
    this.selectionManager = this.utils.getSelectionManager()

    this.inputHandler = this.utils.createSmartInputHandler(
      this.entities.input,
      val => this.doSearch(val),
      { debounceDelay: this.config.DEBOUNCE_INTERVAL },
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
        ev.stopPropagation()
        ev.preventDefault()
        if (state.items.length === 0 && !state.loading) return
        const currentValue = this.view.getInputValue()
        const isSync = state.query === currentValue && !state.loading
        if (!isSync) {
          await this.doSearch(currentValue)
        }
        this.triggerAction()
      }
    })

    this.entities.results.addEventListener("click", ev => {
      const itemEl = ev.target.closest(".plugin-command-palette-item")
      if (!itemEl) return
      ev.stopPropagation()
      ev.preventDefault()
      this.store.set({ activeIndex: parseInt(itemEl.dataset.index, 10) })
      this.triggerAction()
    })

    this.entities.overlay.addEventListener("click", ev => {
      if (!ev.target.closest(".plugin-command-palette-panel")) this.hide()
    })
  }

  doSearch = async (rawInput) => {
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
    this.selectionManager.restore()
    if (activeItem?.action({ ...state }) !== false) {
      this.hide()
    }
  }

  setInput = async (input) => {
    this.view.setInputValue(input)
    this.entities.input.focus()
    await this.doSearch(input)
  }

  show = async (input = ">") => {
    this.selectionManager.save()
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
  plugin: CommandPalettePlugin,
}
