const { describe, it, beforeEach } = require("node:test")
const assert = require("node:assert")
const mockUtils = require("./mocks/utils.mock.js")
require("./mocks/dom.mock.js")

global.BasePlugin = class {
}

function resetGlobals() {
  global.File = {
    isNode: true,
    editor: {
      library: { toggleSidebar: () => undefined, openFileInNewWindow: () => undefined },
      nodeMap: { toc: { headers: [] } },
      sourceView: { inSourceMode: false },
      UserOp: { setClipboard: () => undefined },
      toggleFocusMode: () => undefined,
      toggleTypeWriterMode: () => undefined,
    },
    megaMenu: { togglePreferencePanel: () => undefined },
    toggleSourceMode: () => undefined,
  }
  global.JSBridge = {
    invoke: async (method) => {
      if (method === "setting.loadExports") return JSON.stringify([{}, {}])
      if (method === "window.toggleDevTools") return undefined
      if (method === "setting.getThemes") {
        return { all: ["github.css", "newsprint.css", "night.css", "pixyll.css", "whitey.css"], current: "github.css" }
      }
      return undefined
    },
  }
  global.ClientCommand = {
    export: () => undefined,
    refreshViewMenu: () => undefined,
    print: () => undefined,
    setTheme: () => undefined,
    pinWindow: () => undefined,
    unpinWindow: () => undefined,
  }
}

resetGlobals()

const { plugin: CommandPalettePlugin } = require("../../plugin/command_palette/index.js")
const buildProviders = require("../../plugin/command_palette/providers.js")

function makeUtilsMock(overrides = {}) {
  return {
    ...mockUtils,
    getAnchorNode: () => ({ id: "anchor" }),
    show: () => undefined,
    hide: () => undefined,
    isShown: () => false,
    getPlugin: () => undefined,
    getAllPlugins: () => ({}),
    updatePluginDynamicActions: () => [],
    updateAndCallPluginDynamicAction: () => undefined,
    getRecentFiles: async () => ({ files: [], folders: [] }),
    getFilePath: () => "/current/file.md",
    openFolder: () => undefined,
    openFile: () => undefined,
    scrollTo: () => undefined,
    scrollSourceView: () => undefined,
    settings: { openFolder: () => undefined },
    ...overrides,
  }
}

function makeDomEntities() {
  const overlay = document.createElement("div")
  overlay.className = "plugin-command-palette-overlay plugin-common-hidden"
  const panel = document.createElement("div")
  panel.className = "plugin-command-palette-panel"
  const input = document.createElement("input")
  input.id = "plugin-command-palette-input"
  const results = document.createElement("div")
  results.className = "plugin-command-palette-results"
  panel.appendChild(input)
  panel.appendChild(results)
  overlay.appendChild(panel)
  document.body.appendChild(overlay)
  return { overlay, input, results, panel }
}

function makeInstance({ utilsOverrides = {}, config = {} } = {}) {
  const instance = new CommandPalettePlugin()
  instance.utils = makeUtilsMock(utilsOverrides)
  instance.config = { HOTKEY: "ctrl+shift+p", DEBOUNCE_INTERVAL: 0, BACKSPACE_TO_HIDE: true, ...config }
  return instance
}

function dispatchKeydown(el, key, extra = {}) {
  const ev = new window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true })
  Object.assign(ev, extra)
  el.dispatchEvent(ev)
  return ev
}

describe("Store (via CommandPalettePlugin.init)", () => {
  let instance, entities

  beforeEach(() => {
    document.body.innerHTML = ""
    entities = makeDomEntities()
    instance = makeInstance()
    instance.init()
  })

  it("get() returns the initial default state", () => {
    const state = instance.store.get()
    assert.deepStrictEqual(state, { query: "", keywords: [], items: [], activeIndex: 0, loading: false, sessionId: 0 })
  })

  it("set() merges partial state without discarding untouched fields", () => {
    instance.store.set({ query: "abc" })
    const state = instance.store.get()
    assert.strictEqual(state.query, "abc")
    assert.strictEqual(state.loading, false) // untouched field preserved
  })

  it("set() notifies subscribers with (state, prevState)", () => {
    let received = null
    instance.store.subscribe((state, prevState) => received = { state, prevState })
    instance.store.set({ query: "x" })
    assert.strictEqual(received.state.query, "x")
    assert.strictEqual(received.prevState.query, "")
  })

  it("subscribe() returns an unsubscribe function that stops future notifications", () => {
    let count = 0
    const unsubscribe = instance.store.subscribe(() => count++)
    instance.store.set({ query: "a" })
    unsubscribe()
    instance.store.set({ query: "b" })
    assert.strictEqual(count, 1)
  })

  it("notifies multiple subscribers on set()", () => {
    let a = 0, b = 0
    instance.store.subscribe(() => a++)
    instance.store.subscribe(() => b++)
    instance.store.set({ query: "x" })
    assert.strictEqual(a, 1)
    assert.strictEqual(b, 1)
  })
})

describe("Service", () => {
  let instance

  beforeEach(() => {
    document.body.innerHTML = ""
    makeDomEntities()
    instance = makeInstance()
    instance.init()
    // Wipe providers built from buildProviders and register controlled fakes instead.
    instance.service.providers = []
    instance.service.prefixes = []
  })

  it("registerProviders sorts prefixes by descending length", () => {
    instance.registerProviders(
      { prefix: ">", fetch: async () => [] },
      { prefix: ">>", fetch: async () => [] },
      { prefix: "#", fetch: async () => [] },
    )
    assert.deepStrictEqual(instance.service.prefixes, [">>", ">", "#"])
  })

  it("resolveInput strips the longest matching prefix first", () => {
    instance.registerProviders(
      { prefix: ">", fetch: async () => [] },
      { prefix: ">>", fetch: async () => [] },
    )
    const resolved = instance.service.resolveInput(">>hello")
    assert.strictEqual(resolved.prefix, ">>")
    assert.strictEqual(resolved.query, "hello")
  })

  it("resolveInput falls back to prefix '' when nothing matches", () => {
    instance.registerProviders({ prefix: "#", fetch: async () => [] })
    const resolved = instance.service.resolveInput("plain text")
    assert.strictEqual(resolved.prefix, "")
    assert.strictEqual(resolved.query, "plain text")
  })

  it("resolveInput trims whitespace around the raw input and the remaining query", () => {
    instance.registerProviders({ prefix: ">", fetch: async () => [] })
    const resolved = instance.service.resolveInput("  >  hello  ")
    assert.strictEqual(resolved.query, "hello")
  })

  it("parseKeywords lowercases, splits on whitespace, and filters empties", () => {
    const resolved = instance.service.resolveInput("  Foo   BAR\tbaz  ")
    assert.deepStrictEqual(resolved.keywords, ["foo", "bar", "baz"])
  })

  it("parseKeywords returns [] for an empty/whitespace-only query", () => {
    const resolved = instance.service.resolveInput("   ")
    assert.deepStrictEqual(resolved.keywords, [])
  })

  it("fetchItems only invokes providers whose prefix matches", async () => {
    const calledA = []
    const calledB = []
    instance.registerProviders(
      {
        prefix: ">", fetch: async () => {
          calledA.push(1)
          return [{ title: "a" }]
        },
      },
      {
        prefix: "#", fetch: async () => {
          calledB.push(1)
          return [{ title: "b" }]
        },
      },
    )
    await instance.service.fetchItems(">", "", [])
    assert.strictEqual(calledA.length, 1)
    assert.strictEqual(calledB.length, 0)
  })

  it("fetchItems skips keyword filtering for dynamic providers", async () => {
    instance.registerProviders({ prefix: ":", dynamic: true, fetch: async () => [{ title: "Go to line 5" }] })
    const items = await instance.service.fetchItems(":", "5", ["zzz-not-matching"])
    assert.strictEqual(items.length, 1)
  })

  it("fetchItems skips keyword filtering when keywords is empty", async () => {
    instance.registerProviders({ prefix: "", fetch: async () => [{ title: "Tab A" }, { title: "Tab B" }] })
    const items = await instance.service.fetchItems("", "", [])
    assert.strictEqual(items.length, 2)
  })

  it("fetchItems filters non-dynamic providers requiring ALL keywords to match (case-insensitively)", async () => {
    instance.registerProviders({
      prefix: "",
      fetch: async () => [{ title: "Alpha Beta" }, { title: "Alpha Only" }, { title: "Nothing" }],
    })
    const items = await instance.service.fetchItems("", "", ["alpha", "beta"])
    assert.deepStrictEqual(items.map(i => i.title), ["Alpha Beta"])
  })

  it("fetchItems flatMaps results across multiple providers sharing the same prefix", async () => {
    instance.registerProviders(
      { prefix: ">", fetch: async () => [{ title: "P1" }] },
      { prefix: ">", fetch: async () => [{ title: "P2" }] },
    )
    const items = await instance.service.fetchItems(">", "", [])
    assert.deepStrictEqual(items.map(i => i.title), ["P1", "P2"])
  })

  it("fetchItems propagates a rejection when a provider's fetch throws", async () => {
    instance.registerProviders({
      prefix: ">", fetch: async () => {
        throw new Error("boom")
      },
    })
    await assert.rejects(() => instance.service.fetchItems(">", "", []), /boom/)
  })
})

describe("View", () => {
  let instance, entities

  beforeEach(() => {
    document.body.innerHTML = ""
    entities = makeDomEntities()
    instance = makeInstance()
    instance.init()
  })

  it("shows 'Searching...' when items is empty and loading is true", () => {
    instance.view.render({ items: [], loading: true, activeIndex: 0, keywords: [] }, null)
    assert.match(entities.results.innerHTML, /Searching\.\.\./)
  })

  it("shows 'No matching results' when items is empty and loading is false", () => {
    instance.view.render({ items: [], loading: false, activeIndex: 0, keywords: [] }, null)
    assert.match(entities.results.innerHTML, /No matching results/)
  })

  it("renders one .plugin-command-palette-item per item and marks the active one", () => {
    const state = { items: [{ title: "Foo" }, { title: "Bar" }], loading: false, activeIndex: 1, keywords: [] }
    instance.view.render(state, null)
    const nodes = entities.results.querySelectorAll(".plugin-command-palette-item")
    assert.strictEqual(nodes.length, 2)
    assert.strictEqual(nodes[1].classList.contains("active"), true)
    assert.strictEqual(nodes[0].classList.contains("active"), false)
  })

  it("HTML-escapes item titles", () => {
    const state = { items: [{ title: "<img src=x>" }], loading: false, activeIndex: 0, keywords: [] }
    instance.view.render(state, null)
    assert.ok(!entities.results.innerHTML.includes("<img"))
    assert.ok(entities.results.innerHTML.includes("&lt;img"))
  })

  it("highlights keyword matches with <b>, case-insensitively, and escapes regex special chars in keywords", () => {
    const state = { items: [{ title: "Alpha (Beta)" }], loading: false, activeIndex: 0, keywords: ["(beta)"] }
    instance.view.render(state, null)
    assert.match(entities.results.innerHTML, /<b>\(Beta\)<\/b>/)
  })

  it("sorts keywords by descending length before building the highlight regex", () => {
    const state = { items: [{ title: "abstract" }], loading: false, activeIndex: 0, keywords: ["ab", "abs"] }
    instance.view.render(state, null)
    // "abs" (longer) should be preferred/highlighted as a whole before "ab" would split it
    assert.match(entities.results.innerHTML, /<b>abs<\/b>tract/)
  })

  it("render() only updates active class (not full HTML) when items/loading are unchanged but activeIndex differs", () => {
    const items = [{ title: "Foo" }, { title: "Bar" }]
    const prevState = { items, loading: false, activeIndex: 0, keywords: [] }
    instance.view.render(prevState, null)
    const htmlBefore = entities.results.innerHTML
    const nextState = { items, loading: false, activeIndex: 1, keywords: [] }
    instance.view.render(nextState, prevState)
    const nodes = entities.results.querySelectorAll(".plugin-command-palette-item")
    assert.strictEqual(nodes[0].classList.contains("active"), false)
    assert.strictEqual(nodes[1].classList.contains("active"), true)
    // structure/text should be identical, only classes toggled
    assert.strictEqual(htmlBefore.replace(/active/g, "").replace(/\s/g, "").length, entities.results.innerHTML.replace(/active/g, "").replace(/\s/g, "").length)
  })

  it("getInputValue/setInputValue proxy to entities.input.value", () => {
    instance.view.setInputValue("hello")
    assert.strictEqual(entities.input.value, "hello")
    assert.strictEqual(instance.view.getInputValue(), "hello")
  })
})

describe("CommandPalettePlugin - lifecycle", () => {
  it("hotkey() binds the configured HOTKEY to call", () => {
    const instance = makeInstance({ config: { HOTKEY: "ctrl+p" } })
    const hotkeys = instance.hotkey()
    assert.strictEqual(hotkeys[0].hotkey, "ctrl+p")
    assert.strictEqual(hotkeys[0].callback, instance.call)
  })

  it("html() produces the overlay/input/results structure, initially hidden", () => {
    const instance = makeInstance()
    const html = instance.html()
    assert.match(html, /plugin-command-palette-overlay plugin-common-hidden/)
    assert.match(html, /id="plugin-command-palette-input"/)
    assert.match(html, /plugin-command-palette-results/)
  })

  it("style() returns true", () => {
    const instance = makeInstance()
    assert.strictEqual(instance.style(), true)
  })

  it("init() wires entities, store, service (with providers), and view; view is subscribed to store", () => {
    document.body.innerHTML = ""
    makeDomEntities()
    const instance = makeInstance()
    instance.init()
    assert.ok(instance.entities.overlay)
    assert.ok(instance.entities.input)
    assert.ok(instance.entities.results)
    assert.ok(instance.store)
    assert.ok(instance.service.providers.length > 0) // buildProviders() registered several
    assert.ok(instance.view)
    // Verify the store->view wiring by checking a set() triggers a render side-effect
    instance.store.set({ items: [{ title: "X" }], activeIndex: 0, loading: false })
    assert.match(instance.entities.results.innerHTML, /X/)
  })

  it("registerProviders() delegates to service.registerProviders()", () => {
    document.body.innerHTML = ""
    makeDomEntities()
    const instance = makeInstance()
    instance.init()
    const before = instance.service.providers.length
    instance.registerProviders({ prefix: "!", fetch: async () => [] })
    assert.strictEqual(instance.service.providers.length, before + 1)
  })
})

describe("CommandPalettePlugin - show/hide/call/doSearch", () => {
  let instance, entities

  beforeEach(() => {
    document.body.innerHTML = ""
    entities = makeDomEntities()
  })

  it("call() shows when hidden, hides when shown (based on utils.isShown)", async () => {
    let shown = false
    instance = makeInstance({
      utilsOverrides: {
        isShown: () => shown,
        show: () => shown = true,
        hide: () => shown = false,
      },
    })
    instance.init()
    instance.process()
    await instance.call() // was hidden -> show()
    assert.strictEqual(shown, true)
    await instance.call() // was shown -> hide()
    assert.strictEqual(shown, false)
  })

  it("show() saves selection, captures anchor, un-hides overlay, and defaults input to '>'", async () => {
    const calls = []
    instance = makeInstance({
      utilsOverrides: {
        getSelectionManager: () => ({ save: () => calls.push("save"), restore: () => undefined }),
        getAnchorNode: () => {
          calls.push("anchor")
          return { id: "n" }
        },
        show: () => calls.push("show"),
      },
    })
    instance.init()
    instance.process()
    await instance.show()
    assert.deepStrictEqual(calls, ["save", "anchor", "show"])
    assert.strictEqual(instance.view.getInputValue(), ">")
  })

  it("show() accepts a custom initial input", async () => {
    instance = makeInstance()
    instance.init()
    instance.process()
    await instance.show("#")
    assert.strictEqual(instance.view.getInputValue(), "#")
  })

  it("setInput() updates the view value, focuses input, and calls doSearch()", async () => {
    instance = makeInstance()
    instance.init()
    instance.process()
    let focused = false
    instance.entities.input.focus = () => focused = true
    await instance.setInput("abc")
    assert.strictEqual(instance.view.getInputValue(), "abc")
    assert.strictEqual(focused, true)
    assert.strictEqual(instance.store.get().query, "abc")
  })

  it("hide() hides overlay, clears input, resets state, and bumps sessionId", async () => {
    instance = makeInstance()
    instance.init()
    instance.process()
    await instance.setInput("hello")
    const sessionBefore = instance.store.get().sessionId
    instance.hide()
    const state = instance.store.get()
    assert.strictEqual(state.query, "")
    assert.deepStrictEqual(state.items, [])
    assert.strictEqual(state.loading, false)
    assert.ok(state.sessionId > sessionBefore)
    assert.strictEqual(instance.view.getInputValue(), "")
  })

  it("doSearch sets loading true immediately, then resolves items/activeIndex/loading", async () => {
    instance = makeInstance()
    instance.init()
    instance.process()
    instance.service.providers = []
    instance.service.prefixes = []
    let resolveFetch
    instance.registerProviders({
      prefix: "",
      dynamic: true,
      fetch: () => new Promise(res => resolveFetch = res),
    })
    const promise = instance.doSearch("hello")
    assert.strictEqual(instance.store.get().loading, true)
    resolveFetch([{ title: "Result" }])
    await promise
    const state = instance.store.get()
    assert.strictEqual(state.loading, false)
    assert.strictEqual(state.items.length, 1)
    assert.strictEqual(state.activeIndex, 0)
  })

  it("doSearch discards a stale (out-of-order) resolution when a newer search has already started", async () => {
    instance = makeInstance()
    instance.init()
    instance.process()
    instance.service.providers = []
    instance.service.prefixes = []
    let resolveFirst, resolveSecond
    let callCount = 0
    instance.registerProviders({
      prefix: "",
      fetch: () => {
        callCount++
        return callCount === 1
          ? new Promise(res => resolveFirst = res)
          : new Promise(res => resolveSecond = res)
      },
    })
    const firstSearch = instance.doSearch("first")
    const secondSearch = instance.doSearch("second") // bumps sessionId before first resolves
    resolveSecond([{ title: "Second Result" }])
    await secondSearch
    resolveFirst([{ title: "First Result (stale)" }])
    await firstSearch
    const state = instance.store.get()
    assert.strictEqual(state.items.length, 1)
    assert.strictEqual(state.items[0].title, "Second Result")
  })

  it("doSearch catches a rejected fetchItems and resets items to [] when still the current session", async () => {
    instance = makeInstance()
    instance.init()
    instance.process()
    instance.service.providers = []
    instance.service.prefixes = []
    instance.registerProviders({
      prefix: "", fetch: async () => {
        throw new Error("fail")
      },
    })
    const originalError = console.error
    let loggedArgs = null
    console.error = (...args) => loggedArgs = args
    try {
      await instance.doSearch("x")
    } finally {
      console.error = originalError
    }
    assert.ok(loggedArgs)
    const state = instance.store.get()
    assert.deepStrictEqual(state.items, [])
    assert.strictEqual(state.loading, false)
  })

  it("doSearch does not clobber newer state when a stale error resolves after a newer search started", async () => {
    instance = makeInstance()
    instance.init()
    instance.process()
    instance.service.providers = []
    instance.service.prefixes = []
    let rejectFirst
    let callCount = 0
    instance.registerProviders({
      prefix: "",
      dynamic: true,
      fetch: () => {
        callCount++
        if (callCount === 1) return new Promise((_, rej) => rejectFirst = rej)
        return Promise.resolve([{ title: "Fresh" }])
      },
    })
    const originalError = console.error
    console.error = () => undefined
    try {
      const firstSearch = instance.doSearch("first")
      const secondSearch = instance.doSearch("second")
      await secondSearch
      rejectFirst(new Error("stale failure"))
      await firstSearch.catch(() => undefined)
    } finally {
      console.error = originalError
    }
    const state = instance.store.get()
    assert.strictEqual(state.items.length, 1)
    assert.strictEqual(state.items[0].title, "Fresh")
  })
})

describe("CommandPalettePlugin - triggerPreview/triggerAction", () => {
  let instance

  beforeEach(() => {
    document.body.innerHTML = ""
    makeDomEntities()
    instance = makeInstance()
    instance.init()
    instance.process()
  })

  it("triggerPreview calls the active item's preview() with a state snapshot and re-focuses input", () => {
    let previewArg = null
    let focused = false
    instance.entities.input.focus = () => focused = true
    instance.store.set({ items: [{ title: "X", preview: (s) => previewArg = s }], activeIndex: 0 })
    instance.triggerPreview()
    assert.ok(previewArg)
    assert.strictEqual(focused, true)
  })

  it("triggerPreview does not throw when the active item has no preview()", () => {
    instance.store.set({ items: [{ title: "X" }], activeIndex: 0 })
    assert.doesNotThrow(() => instance.triggerPreview())
  })

  it("triggerAction restores selection, calls action(), and hides when action() does not return false", () => {
    let restored = false
    instance.selectionManager.restore = () => restored = true
    let actionCalled = false
    instance.store.set({ items: [{ title: "X", action: () => actionCalled = true }], activeIndex: 0 })
    let hidden = false
    instance.utils.hide = () => hidden = true
    instance.triggerAction()
    assert.strictEqual(restored, true)
    assert.strictEqual(actionCalled, true)
    assert.strictEqual(hidden, true)
  })

  it("triggerAction does NOT hide when action() explicitly returns false", () => {
    instance.store.set({ items: [{ title: "X", action: () => false }], activeIndex: 0 })
    let hidden = false
    instance.utils.hide = () => hidden = true
    instance.triggerAction()
    assert.strictEqual(hidden, false)
  })
})

describe("CommandPalettePlugin - keyboard/click handling", () => {
  let instance

  beforeEach(async () => {
    document.body.innerHTML = ""
    makeDomEntities()
    instance = makeInstance()
    instance.init()
    instance.process()
    instance.service.providers = []
    instance.service.prefixes = []
    instance.registerProviders({
      prefix: "",
      fetch: async () => [{ title: "Item A", action: () => undefined }, { title: "Item B", action: () => undefined }],
    })
    await instance.doSearch("")
  })

  it("ArrowDown cycles activeIndex forward (wrapping) and triggers preview", () => {
    assert.strictEqual(instance.store.get().activeIndex, 0)
    dispatchKeydown(instance.entities.input, "ArrowDown")
    assert.strictEqual(instance.store.get().activeIndex, 1)
    dispatchKeydown(instance.entities.input, "ArrowDown")
    assert.strictEqual(instance.store.get().activeIndex, 0) // wraps
  })

  it("ArrowUp cycles activeIndex backward (wrapping)", () => {
    dispatchKeydown(instance.entities.input, "ArrowUp")
    assert.strictEqual(instance.store.get().activeIndex, 1) // wraps to last
  })

  it("ArrowDown/ArrowUp are no-ops when items is empty", async () => {
    instance.store.set({ items: [], activeIndex: 0 })
    dispatchKeydown(instance.entities.input, "ArrowDown")
    assert.strictEqual(instance.store.get().activeIndex, 0)
  })

  it("Escape hides the palette", () => {
    let hidden = false
    instance.utils.hide = () => hidden = true
    dispatchKeydown(instance.entities.input, "Escape")
    assert.strictEqual(hidden, true)
  })

  it("Backspace on empty input hides only when BACKSPACE_TO_HIDE is true", () => {
    instance.view.setInputValue("")
    let hidden = false
    instance.utils.hide = () => hidden = true
    dispatchKeydown(instance.entities.input, "Backspace")
    assert.strictEqual(hidden, true)
  })

  it("Backspace on empty input does nothing when BACKSPACE_TO_HIDE is false", () => {
    instance.config.BACKSPACE_TO_HIDE = false
    instance.view.setInputValue("")
    let hidden = false
    instance.utils.hide = () => hidden = true
    dispatchKeydown(instance.entities.input, "Backspace")
    assert.strictEqual(hidden, false)
  })

  it("Enter with items present and query in sync triggers action directly (no re-search)", async () => {
    let actionCalled = false
    instance.store.set({
      items: [{ title: "Item A", action: () => actionCalled = true }],
      activeIndex: 0,
      query: instance.view.getInputValue(),
      loading: false,
    })
    dispatchKeydown(instance.entities.input, "Enter")
    await Promise.resolve()
    assert.strictEqual(actionCalled, true)
  })

  it("Enter with items.length === 0 and not loading is a no-op", () => {
    instance.store.set({ items: [], loading: false })
    let hidden = false
    instance.utils.hide = () => hidden = true
    dispatchKeydown(instance.entities.input, "Enter")
    assert.strictEqual(hidden, false)
  })

  it("all keydown handling is skipped while inputHandler.isComposing() is true", () => {
    instance.inputHandler.isComposing = () => true
    let hidden = false
    instance.utils.hide = () => hidden = true
    dispatchKeydown(instance.entities.input, "Escape")
    assert.strictEqual(hidden, false)
  })

  it("clicking a .plugin-command-palette-item sets activeIndex and triggers action", () => {
    let actionCalled = false
    let capturedIndex = null
    instance.store.set({
      items: [
        { title: "Item A", action: () => undefined },
        {
          title: "Item B",
          action: (state) => {
            actionCalled = true
            capturedIndex = state.activeIndex
            return false
          },
        },
      ],
      activeIndex: 0,
    })
    const itemEl = instance.entities.results.querySelectorAll(".plugin-command-palette-item")[1]
    itemEl.dispatchEvent(new window.MouseEvent("click", { bubbles: true }))
    assert.strictEqual(actionCalled, true)
    assert.strictEqual(capturedIndex, 1)
    assert.strictEqual(instance.store.get().activeIndex, 1)
  })

  it("clicking the overlay outside the panel hides; clicking inside the panel does not", () => {
    let hidden = false
    instance.utils.hide = () => hidden = true
    instance.entities.overlay.dispatchEvent(new window.MouseEvent("click", { bubbles: true }))
    assert.strictEqual(hidden, true)

    hidden = false
    const panel = instance.entities.overlay.querySelector(".plugin-command-palette-panel")
    panel.dispatchEvent(new window.MouseEvent("click", { bubbles: true }))
    assert.strictEqual(hidden, false)
  })
})

describe("buildProviders", () => {
  beforeEach(() => resetGlobals())

  function getProvider(providers, name) {
    return providers.find(p => p.name === name)
  }

  it("Tabs provider returns [] when window_tab plugin/tab manager is absent", async () => {
    const utils = makeUtilsMock({ getPlugin: () => undefined })
    const providers = buildProviders(utils, {})
    const items = await getProvider(providers, "Tabs").fetch()
    assert.deepStrictEqual(items, [])
  })

  it("Tabs provider maps tabs to {title, action} and action() calls switchByPath", async () => {
    let switched = null
    const utils = makeUtilsMock({
      getPlugin: () => ({ tab: { tabs: [{ path: "/a.md" }, { path: "/b.md" }], switchByPath: (p) => switched = p } }),
    })
    const providers = buildProviders(utils, {})
    const items = await getProvider(providers, "Tabs").fetch()
    assert.strictEqual(items.length, 2)
    items[1].action()
    assert.strictEqual(switched, "/b.md")
  })

  it("Recent Files provider returns [] when File.isNode is false", async () => {
    global.File.isNode = false
    const utils = makeUtilsMock()
    const providers = buildProviders(utils, {})
    const items = await getProvider(providers, "Recent Files").fetch()
    assert.deepStrictEqual(items, [])
  })

  it("Recent Files provider excludes the current file and separates folder/file actions", async () => {
    let opened = null
    const utils = makeUtilsMock({
      getFilePath: () => "/current.md",
      getRecentFiles: async () => ({
        folders: [{ path: "/dir1" }, { path: null }],
        files: [{ path: "/current.md" }, { path: "/other.md" }],
      }),
      openFolder: (p) => opened = ["folder", p],
      openFile: (p) => opened = ["file", p],
    })
    const providers = buildProviders(utils, {})
    const items = await getProvider(providers, "Recent Files").fetch()
    const titles = items.map(i => i.title)
    assert.ok(titles.includes("/dir1"))
    assert.ok(!titles.includes("/current.md"))
    assert.ok(titles.includes("/other.md"))

    items.find(i => i.title === "/dir1").action()
    assert.deepStrictEqual(opened, ["folder", "/dir1"])
    items.find(i => i.title === "/other.md").action()
    assert.deepStrictEqual(opened, ["file", "/other.md"])
  })

  it("Plugins provider only includes plugins that expose a call() method", async () => {
    const utils = makeUtilsMock({
      getAllPlugins: () => ({
        p1: { call: () => undefined, pluginName: "P1" },
        p2: { pluginName: "P2" }, // no call -> excluded
      }),
      updatePluginDynamicActions: () => [],
    })
    const providers = buildProviders(utils, { getAnchor: () => null })
    const items = await getProvider(providers, "Plugins").fetch()
    assert.strictEqual(items.length, 1)
    assert.match(items[0].title, /P1/)
  })

  it("Plugins provider emits a fallback item when a plugin has no actions", async () => {
    const utils = makeUtilsMock({
      getAllPlugins: () => ({ p1: { call: () => undefined, pluginName: "P1" } }),
      updatePluginDynamicActions: () => [],
    })
    const providers = buildProviders(utils, { getAnchor: () => null })
    const items = await getProvider(providers, "Plugins").fetch()
    assert.strictEqual(items.length, 1)
    assert.match(items[0].title, /P1 \( p1 \)/)
  })

  it("Plugins provider emits one item per action, filtering act_disabled/act_hidden, with correct action call", async () => {
    let calledWith = null
    const utils = makeUtilsMock({
      getAllPlugins: () => ({
        p1: {
          call: () => undefined,
          pluginName: "P1",
          staticActions: [{ act_name: "Static1", act_value: "s1" }],
        },
      }),
      updatePluginDynamicActions: () => [
        { act_name: "Dyn1", act_value: "d1" },
        { act_name: "Dyn2", act_value: "d2", act_disabled: true },
      ],
      updateAndCallPluginDynamicAction: (fixedName, actValue, anchor) => calledWith = [fixedName, actValue, anchor],
    })
    const providers = buildProviders(utils, { getAnchor: () => "ANCHOR" })
    const items = await getProvider(providers, "Plugins").fetch()
    assert.strictEqual(items.length, 2) // Static1 + Dyn1 (Dyn2 filtered out)
    items[0].action()
    assert.deepStrictEqual(calledWith, ["p1", "s1", "ANCHOR"])
  })

  it("Commands provider returns the fixed command list plus one item per theme", async () => {
    global.JSBridge.invoke = async (method) => {
      if (method === "setting.getThemes") return { all: ["theme1.css", "theme2.css"] }
      if (method === "setting.loadExports") return JSON.stringify([{}, {}])
      return undefined
    }
    const utils = makeUtilsMock()
    const providers = buildProviders(utils, {})
    const items = await getProvider(providers, "Commands").fetch()
    const titles = items.map(i => i.title)
    assert.ok(titles.includes("Open in Explorer"))
    assert.ok(titles.includes("Theme: theme1"))
    assert.ok(titles.includes("Theme: theme2"))
  })

  it("Commands provider's 'Copy File Path' action writes the current file path to the clipboard", async () => {
    let clipboardValue = null
    global.File.editor.UserOp.setClipboard = (a, b, val) => clipboardValue = val
    const utils = makeUtilsMock({ getFilePath: () => "/foo/bar.md" })
    const providers = buildProviders(utils, {})
    const items = await getProvider(providers, "Commands").fetch()
    items.find(i => i.title === "Copy File Path").action()
    assert.strictEqual(clipboardValue, "/foo/bar.md")
  })

  it("Commands provider's 'Mode: Source Code' action calls File.toggleSourceMode", async () => {
    let toggled = false
    global.File.toggleSourceMode = () => toggled = true
    const utils = makeUtilsMock()
    const providers = buildProviders(utils, {})
    const items = await getProvider(providers, "Commands").fetch()
    items.find(i => i.title === "Mode: Source Code").action()
    assert.strictEqual(toggled, true)
  })

  it("Outline provider skips headers without attributes/cid and builds titles from pattern+text", async () => {
    let scrolledTo = null
    global.File.editor.nodeMap.toc.headers = [
      { attributes: { pattern: "H1: {0}", text: "Intro" }, cid: "c1" },
      { attributes: null, cid: "c2" }, // skipped: no attributes
      { attributes: { pattern: "H2: {0}", text: "NoCid" } }, // skipped: no cid
    ]
    const utils = makeUtilsMock({ scrollTo: (cid) => scrolledTo = cid })
    const providers = buildProviders(utils, {})
    const items = await getProvider(providers, "Outline").fetch()
    assert.strictEqual(items.length, 1)
    assert.strictEqual(items[0].title, "H1: Intro")
    items[0].action()
    assert.strictEqual(scrolledTo, "c1")
  })

  it("Go to Line provider returns a placeholder no-op item for non-numeric/<=0 input", async () => {
    const utils = makeUtilsMock()
    const providers = buildProviders(utils, {})
    const provider = getProvider(providers, "Go to Line")
    assert.strictEqual(provider.dynamic, true)
    const items1 = await provider.fetch("abc")
    assert.match(items1[0].title, /Type a line number/)
    const items2 = await provider.fetch("-5")
    assert.match(items2[0].title, /Type a line number/)
  })

  it("Go to Line provider returns a navigable item for a valid positive integer, toggling source mode first if needed", async () => {
    let toggledSourceMode = false
    let scrolledLine = null
    global.File.editor.sourceView.inSourceMode = false
    global.File.toggleSourceMode = () => {
      toggledSourceMode = true
      global.File.editor.sourceView.inSourceMode = true
    }
    const utils = makeUtilsMock({ scrollSourceView: (line) => scrolledLine = line })
    const providers = buildProviders(utils, {})
    const provider = getProvider(providers, "Go to Line")
    const items = await provider.fetch("42")
    assert.strictEqual(items[0].title, "Go to line 42")
    items[0].action()
    assert.strictEqual(toggledSourceMode, true)
    assert.strictEqual(scrolledLine, 42)
  })

  it("Go to Line provider's action does not re-toggle source mode when already in source mode", async () => {
    let toggleCalls = 0
    global.File.editor.sourceView.inSourceMode = true
    global.File.toggleSourceMode = () => toggleCalls++
    const utils = makeUtilsMock({ scrollSourceView: () => undefined })
    const providers = buildProviders(utils, {})
    const provider = getProvider(providers, "Go to Line")
    const items = await provider.fetch("7")
    items[0].action()
    assert.strictEqual(toggleCalls, 0)
  })

  it("Help provider returns the fixed help list; each action() calls context.setInput(prefix) and returns false", async () => {
    let setInputArg = null
    const utils = makeUtilsMock()
    const providers = buildProviders(utils, { setInput: (v) => setInputArg = v })
    const items = await getProvider(providers, "Help").fetch()
    assert.ok(items.length >= 5)
    const result = items[0].action()
    assert.strictEqual(result, false)
    assert.strictEqual(setInputArg, ">")
  })
})
