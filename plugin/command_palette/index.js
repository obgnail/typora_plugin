const buildProviders = require("./providers.js")

const sameItem = (a, b) => a != null && b != null && a.group === b.group && a.title === b.title

class State {
  listeners = new Set()

  query = ""
  keywords = []
  items = []
  active = null
  loading = false
  sessionId = 0

  subscribe(listener) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  _emit(patch) {
    const prev = { ...this, activeIndex: this.activeIndex }
    Object.assign(this, patch)
    this.listeners.forEach(listener => listener(this, prev))
  }

  get activeIndex() {
    return this.items.indexOf(this.active)
  }

  next(rawInput, keywords) {
    this._emit({ query: rawInput, keywords, loading: true, sessionId: this.sessionId + 1 })
  }

  commit(items) {
    const active = items.find(item => sameItem(item, this.active)) ?? items[0] ?? null
    this._emit({ items, active, loading: false })
  }

  discard() {
    this._emit({ items: [], active: null, loading: false })
  }

  moveActive(step) {
    if (this.items.length === 0) return
    const idx = this.activeIndex
    const active = idx === -1 ? this.items.at(step > 0 ? 0 : -1) : this.items.at((idx + step) % this.items.length)
    this._emit({ active })
  }

  select(item) {
    this._emit({ active: item })
  }

  reset() {
    this._emit({ query: "", keywords: [], items: [], active: null, loading: false, sessionId: this.sessionId + 1 })
  }
}

const MATCH_FIELDS = [["title", 3], ["subtitle", 2], ["hint", 1]]

const SCORERS = {
  ranked: (item, keywords) => {
    let total = 0
    for (const kw of keywords) {
      const scores = MATCH_FIELDS.map(([field, weight]) => {
        const text = item[field]?.toLowerCase()
        const pos = text?.indexOf(kw) ?? -1
        if (pos === -1) return 0
        const base = pos === 0 ? 100 : text[pos - 1] === " " ? 60 : Math.max(10, 40 - pos)
        return base * weight
      })
      const best = Math.max(...scores)
      if (best === 0) return -1
      total += best
    }
    return total
  },
  plain: (item, keywords) => {
    const text = MATCH_FIELDS.map(([field]) => item[field] || "").join(" ").toLowerCase()
    return keywords.every(kw => text.includes(kw)) ? 0 : -1
  },
}

class Service {
  providers = []

  constructor(providers, options = {}) {
    this.setScorer(options.scorer || SCORERS.plain)
    this.registerProviders(...providers)
  }

  setScorer(scorer) {
    this.scorer = scorer
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
    return activeProviders.flatMap((provider, idx) => {
      let items = results[idx]
      if (!provider.dynamic && keywords.length > 0) {
        items = items
          .map(item => ({ item, score: this.scorer(item, keywords) }))
          .filter(e => e.score >= 0)
          .sort((a, b) => b.score - a.score)
          .map(e => e.item)
      }
      return items.map(item => ({ group: provider.name, ...item }))
    })
  }
}

class View {
  constructor(entities, utils) {
    this.entities = entities
    this.utils = utils
  }

  render(state, prevState) {
    const activeIndex = state.activeIndex
    if (prevState && prevState.items === state.items && prevState.loading === state.loading) {
      const prevIndex = prevState.activeIndex
      if (prevIndex !== activeIndex) {
        this._updateActive(prevIndex, activeIndex)
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
      return header + this._renderItem(item, idx, idx === activeIndex, highlightRegex)
    }).join("")

    this.entities.results.querySelector(".active")?.scrollIntoView({ block: "nearest" })
  }

  _buildHighlightRegex(keywords) {
    if (keywords.length === 0) return null
    const pattern = keywords.toSorted((a, b) => b.length - a.length).map(kw => kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")
    return new RegExp(`(${pattern})`, "gi")
  }

  _highlight(text, regex) {
    return regex
      ? text.split(regex).map((part, i) => i % 2 === 1 ? `<b>${this.utils.escape(part)}</b>` : this.utils.escape(part)).join("")
      : this.utils.escape(text)
  }

  _renderItem(item, idx, isActive, regex) {
    const title = `<div class="plugin-command-palette-item-title">${this._highlight(item.title, regex)}</div>`
    const subtitle = item.subtitle ? `<div class="plugin-command-palette-item-subtitle">${this._highlight(item.subtitle, regex)}</div>` : ""
    const hint = item.hint ? `<div class="plugin-command-palette-item-hint">${this._highlight(item.hint, regex)}</div>` : ""
    const activeClass = isActive ? " active" : ""
    return `<div class="plugin-command-palette-item${activeClass}" data-index="${idx}">${title}${subtitle}${hint}</div>`
  }

  _updateActive(prevIndex, nextIndex) {
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

const getAnchorManager = (utils) => {
  let anchor
  return { save: () => anchor = utils.getAnchorNode(), get: () => anchor }
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

    this.selectionManager = this.utils.getSelectionManager()
    this.anchorManager = getAnchorManager(this.utils)
    const providers = buildProviders(this.utils, {
      getProviders: () => providers,
      getAnchor: () => this.anchorManager.get(),
      setQuery: input => this.setQuery(input),
    })
    this.state = new State()
    this.service = new Service(providers, { scorer: SCORERS[this.config.MATCH_STRATEGY] ?? SCORERS.plain })
    this.view = new View(this.entities, this.utils)
    this.state.subscribe((state, prevState) => this.view.render(state, prevState))
  }

  process = () => {
    this.inputHandler = this.utils.createSmartInputHandler(
      this.entities.input,
      val => this.doSearch(val),
      { debounceDelay: this.config.DEBOUNCE_INTERVAL },
    )

    this.entities.input.addEventListener("keydown", async ev => {
      if (this.inputHandler.isComposing()) return
      if (ev.key === "Escape" || (ev.key === "Backspace" && this.config.BACKSPACE_TO_HIDE && !this.view.getInputValue())) {
        this.hide()
        return
      }
      if (ev.key === "ArrowDown") {
        ev.preventDefault()
        this.state.moveActive(1)
        this.triggerPreview()
        return
      }
      if (ev.key === "ArrowUp") {
        ev.preventDefault()
        this.state.moveActive(-1)
        this.triggerPreview()
        return
      }
      if (ev.key === "Enter") {
        ev.stopPropagation()
        ev.preventDefault()
        const state = this.state
        if (state.items.length === 0 && !state.loading) return
        const currentValue = this.view.getInputValue()
        if (state.query !== currentValue || state.loading) {
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
      this.state.select(this.state.items[parseInt(itemEl.dataset.index, 10)])
      this.triggerAction()
    })

    this.entities.overlay.addEventListener("click", ev => {
      if (!ev.target.closest(".plugin-command-palette-panel")) this.hide()
    })
  }

  doSearch = async (rawInput) => {
    const { prefix, query, keywords } = this.service.resolveInput(rawInput)
    this.state.next(rawInput, keywords)
    const sessionId = this.state.sessionId
    try {
      const items = await this.service.fetchItems(prefix, query, keywords)
      if (this.state.sessionId !== sessionId) return
      this.state.commit(items)
      this.triggerPreview()
    } catch (err) {
      console.error("[Command Palette] Fetch Error:", err)
      if (this.state.sessionId === sessionId) {
        this.state.discard()
      }
    }
  }

  triggerPreview = () => {
    const state = this.state
    state.active?.preview?.({ ...state })
    this.entities.input.focus()
  }

  triggerAction = () => {
    const state = this.state
    this.selectionManager.restore()
    if (state.active?.action({ ...state }) !== false) {
      this.hide()
    }
  }

  setQuery = async (query) => {
    this.view.setInputValue(query)
    this.entities.input.focus()
    await this.doSearch(query)
  }

  show = async (input = this.config.DEFAULT_INPUT) => {
    this.selectionManager.save()
    this.anchorManager.save()
    this.utils.show(this.entities.overlay)
    await this.setQuery(input)
  }

  hide = () => {
    this.utils.hide(this.entities.overlay)
    this.view.setInputValue("")
    this.state.reset()
  }

  call = async () => this.utils.isShown(this.entities.overlay) ? this.hide() : await this.show()

  registerProviders = (...providers) => this.service.registerProviders(...providers)
}

module.exports = {
  plugin: CommandPalettePlugin,
}
