const { describe, it, beforeEach, afterEach, mock } = require("node:test")
const assert = require("node:assert/strict")
const proxyquire = require("proxyquire")
const container = require("../../plugin/global/core/container.js")
const mockUtils = require("./mocks/utils.mock.js")
require("./mocks/dom.mock.js")

function createMockI18n() {
  return {
    init: mock.fn(() => undefined),
    bind: fixedName => ({ t: k => `${fixedName}.${k}`, link: a => a.join(" ") }),
    "@noCallThru": true,
  }
}

function resetGlobalFile() {
  global.File = {
    option: { wordsPerMinute: 300 },
    getMountFolder: () => null,
  }
}

beforeEach(() => {
  mock.method(console, "group", () => undefined)
  mock.method(console, "groupEnd", () => undefined)
  mock.method(console, "debug", () => undefined)
})

describe("plugin.js - IPlugin/BasePlugin contract", () => {
  let BasePlugin

  beforeEach(() => BasePlugin = proxyquire("../../plugin/global/core/plugin.js", { "./utils": { ...mockUtils, "@noCallThru": true } }))

  it("prefers config.NAME over i18n.t('pluginName')", () => {
    const i18n = { t: () => "i18nName" }
    const instance = new BasePlugin("myPlugin", { NAME: "Custom Name", ENABLE: true }, i18n)
    assert.equal(instance.fixedName, "myPlugin")
    assert.equal(instance.pluginName, "Custom Name")
    assert.equal(instance.i18n, i18n)
  })

  it("falls back to i18n.t('pluginName') when config.NAME is absent/empty", () => {
    const i18n = { t: mock.fn(key => (key === "pluginName" ? "Translated Name" : key)) }
    const instance = new BasePlugin("p", { ENABLE: true }, i18n)
    assert.equal(instance.pluginName, "Translated Name")
    assert.equal(i18n.t.mock.calls[0].arguments[0], "pluginName")
  })

  it("every instance shares the same injected utils reference", () => {
    const a = new BasePlugin("a", { ENABLE: true }, { t: () => "" })
    const b = new BasePlugin("b", { ENABLE: true }, { t: () => "" })
    assert.equal(a.utils, b.utils)
  })

  it("default lifecycle methods are no-ops; prepare() resolves undefined", async () => {
    const instance = new BasePlugin("p", { ENABLE: true }, { t: () => "" })
    assert.equal(await instance.prepare(), undefined)
    for (const m of ["style", "html", "hotkey", "init", "process", "postprocess"]) {
      assert.equal(instance[m](), undefined)
    }
  })

  it("BasePlugin adds a no-op call(action, meta); subclasses can override lifecycle + call", () => {
    class Sub extends BasePlugin {
      async prepare() {
        this.prepared = true
        return "x"
      }

      call(action, meta) {
        return { action, meta, self: this }
      }
    }

    const instance = new Sub("sub", { ENABLE: true }, { t: () => "" })
    const result = instance.call("doThing", { x: 1 })
    assert.equal(result.action, "doThing")
    assert.equal(result.self, instance)
  })
})

/** Loads the real index.js with only utils/i18n/plugin/polyfill/components
 *  redirected. serviceContainer is intentionally left un-stubbed. */
function loadEntry({ i18n = createMockI18n(), PluginExport = {} } = {}) {
  return proxyquire("../../plugin/global/core/index.js", {
    "./components": { "@noCallThru": true },
    "./i18n": i18n,
    "./utils": { ...mockUtils, "@noCallThru": true },
    "./plugin": Object.assign(PluginExport, { "@noCallThru": true }),
  })
}

/** Stubs utils.settings.read() to return a fixed config for one test. */
function stubSettingsRead(config) {
  return mock.method(mockUtils.settings, "read", async () => config)
}

describe("index.js - entry() gating", () => {
  beforeEach(resetGlobalFile)
  afterEach(() => mock.restoreAll())

  it("stops before reading settings when Typora version < 0.9.98", async () => {
    mock.method(mockUtils, "compareVersion", () => -1)
    const readSpy = stubSettingsRead({ global: { ENABLE: true } })
    await loadEntry()()
    assert.equal(readSpy.mock.callCount(), 0)
  })

  it("stops after reading settings when global.ENABLE is false, without calling container.connect", async () => {
    stubSettingsRead({ global: { ENABLE: false } })
    const connectSpy = mock.method(container, "connect")
    await loadEntry()()
    assert.equal(connectSpy.mock.callCount(), 0)
  })

  it("does not throw when settings.read() resolves null/undefined", async () => {
    stubSettingsRead(null)
    await assert.doesNotReject(() => loadEntry()())
  })

  it("on success: connects container, sets dark mode, inits i18n, exposes global.BasePlugin", async () => {
    mock.method(mockUtils, "setDarkMode")
    stubSettingsRead({ global: { ENABLE: true, DARK_MODE: true, LOCALE: "en" } })
    const i18n = createMockI18n()
    const FakePlugin = class {
    }
    const connectSpy = mock.method(container, "connect")

    await loadEntry({ i18n, PluginExport: FakePlugin })()

    assert.equal(connectSpy.mock.callCount(), 1)
    assert.equal(mockUtils.setDarkMode.mock.calls[0].arguments[0], true)
    assert.equal(i18n.init.mock.calls[0].arguments[0], "en")
  })
})

describe("index.js - 'global' settings key is excluded from plugin iteration", () => {
  beforeEach(resetGlobalFile)
  afterEach(() => mock.restoreAll())

  it("real container.setSettings() marks 'global' non-enumerable, so loadPlugins() never records it in any state bucket", async () => {
    stubSettingsRead({
      global: { ENABLE: true, DARK_MODE: false, LOCALE: "en" },
      realPlugin: { ENABLE: false },
    })
    const setPluginsSpy = mock.method(container, "setPlugins")

    await loadEntry()()

    const plugins = setPluginsSpy.mock.calls[0].arguments[0]
    for (const bucket of Object.values(plugins)) {
      assert.ok(!Object.keys(bucket).includes("global"), "'global' must never appear in any state bucket")
    }
    assert.deepEqual(plugins.disable, { realPlugin: { ENABLE: false } })
  })
})

describe("index.js - loadPlugin() lifecycle & state classification", () => {
  beforeEach(resetGlobalFile)
  afterEach(() => mock.restoreAll())

  /** Runs entry() with settings={ global, target: pluginConfig } and utils.require
   *  wired to resolve PluginClass for fixedName "target". Returns the setPlugins() payload. */
  async function runWithPlugin(pluginConfig, PluginClass) {
    mock.method(mockUtils, "compareVersion", () => 1)
    mock.method(mockUtils, "setDarkMode")
    mock.method(mockUtils, "insertElements")
    mock.method(mockUtils, "insertStyle")
    mock.method(mockUtils.hotkeyHub, "register")
    mock.method(mockUtils.styleManager, "register", () => undefined)
    stubSettingsRead({ global: { ENABLE: true, LOCALE: "en" }, target: pluginConfig })
    mock.method(mockUtils, "require", () => ({ plugin: PluginClass }))
    const setPluginsSpy = mock.method(container, "setPlugins")

    await loadEntry()()
    return setPluginsSpy.mock.calls[0].arguments[0]
  }

  it("'unconfigure': falsy config recorded without calling utils.require", async () => {
    mock.method(mockUtils, "setDarkMode")
    stubSettingsRead({ global: { ENABLE: true, LOCALE: "en" }, target: null })
    const requireSpy = mock.method(mockUtils, "require")
    const setPluginsSpy = mock.method(container, "setPlugins")

    await loadEntry()()

    assert.deepEqual(setPluginsSpy.mock.calls[0].arguments[0].unconfigure, { target: "target" })
    assert.equal(requireSpy.mock.callCount(), 0)
  })

  it("'disable': config.ENABLE === false recorded without instantiating the plugin", async () => {
    stubSettingsRead({ global: { ENABLE: true, LOCALE: "en" }, target: { ENABLE: false, NAME: "Off" } })
    const requireSpy = mock.method(mockUtils, "require")
    const setPluginsSpy = mock.method(container, "setPlugins")

    await loadEntry()()

    assert.deepEqual(setPluginsSpy.mock.calls[0].arguments[0].disable, { target: { ENABLE: false, NAME: "Off" } })
    assert.equal(requireSpy.mock.callCount(), 0)
  })

  it("'error': exception in any lifecycle stage is caught, logged, and does not propagate", async () => {
    mock.method(console, "error", () => undefined)

    class Throws {
      prepare() {
        throw new Error("boom")
      }

      style() {
      }

      html() {
      }

      hotkey() {
      }

      init() {
      }

      process() {
      }

      postprocess() {
      }
    }

    const plugins = await runWithPlugin({ ENABLE: true, NAME: "Bad" }, Throws)
    assert.equal(plugins.error.target.message, "boom")
  })

  it("'abort': prepare() returning utils.PLUGIN_LOAD_ABORT (the real Symbol) stops before style()", async () => {
    let styleCalled = false

    class Aborts {
      async prepare() {
        return mockUtils.PLUGIN_LOAD_ABORT
      }

      style() {
        styleCalled = true
      }

      html() {
      }

      hotkey() {
      }

      init() {
      }

      process() {
      }

      postprocess() {
      }
    }

    const plugins = await runWithPlugin({ ENABLE: true, NAME: "A" }, Aborts)
    assert.deepEqual(plugins.abort, { target: null })
    assert.equal(styleCalled, false)
  })

  it("'enable': full lifecycle runs; html()/hotkey() results are forwarded correctly", async () => {
    class Happy {
      style() {
        return "body{}"
      }

      html() {
        return "<div/>"
      }

      hotkey() {
        return [{ hotkey: "ctrl+a", callback: () => undefined }]
      }

      prepare() {
      }

      init() {
      }

      process() {
      }

      postprocess() {
      }
    }

    const plugins = await runWithPlugin({ ENABLE: true, NAME: "Happy" }, Happy)
    assert.ok(plugins.enable.target instanceof Happy)
    assert.equal(mockUtils.insertElements.mock.calls[0].arguments[0], "<div/>")
    assert.equal(mockUtils.hotkeyHub.register.mock.callCount(), 1)
    assert.equal(mockUtils.insertStyle.mock.callCount(), 1) // string style -> insertStyle branch
  })

  it("loadStyle: string -> insertStyle; object -> styleManager.register; falsy -> neither", async () => {
    const cases = [
      { styleReturn: "css-string", insertStyleCalls: 1, registerCalls: 0 },
      { styleReturn: { css: "x" }, insertStyleCalls: 0, registerCalls: 1 },
      { styleReturn: undefined, insertStyleCalls: 0, registerCalls: 0 },
    ]
    for (const { styleReturn, insertStyleCalls, registerCalls } of cases) {
      mock.restoreAll()

      class P {
        style() {
          return styleReturn
        }

        prepare() {
        }

        html() {
        }

        hotkey() {
        }

        init() {
        }

        process() {
        }

        postprocess() {
        }
      }

      await runWithPlugin({ ENABLE: true, NAME: "P" }, P)
      assert.equal(mockUtils.insertStyle.mock.callCount(), insertStyleCalls)
      assert.equal(mockUtils.styleManager.register.mock.callCount(), registerCalls)
    }
  })

  it("'error': utils.require() resolving no plugin class throws 'Plugin not found: <fixedName>'", async () => {
    mock.method(console, "error", () => undefined)
    const plugins = await runWithPlugin({ ENABLE: true, NAME: "Missing" }, undefined)
    assert.equal(plugins.error.target.message, "Plugin not found: target")
  })

  it("i18n injected into the plugin constructor is bound to its fixedName", async () => {
    let captured

    class Capture {
      constructor(fixedName, config, i18n) {
        captured = i18n
      }

      prepare() {
      }

      style() {
      }

      html() {
      }

      hotkey() {
      }

      init() {
      }

      process() {
      }

      postprocess() {
      }
    }

    await runWithPlugin({ ENABLE: true, NAME: "C" }, Capture)
    assert.equal(captured.t("pluginName"), "target.pluginName")
  })

  it("one failing plugin does not affect another enabled plugin loaded in the same settings batch", async () => {
    mock.method(console, "error", () => undefined)

    class Good {
      prepare() {
      }

      style() {
      }

      html() {
      }

      hotkey() {
      }

      init() {
      }

      process() {
      }

      postprocess() {
      }
    }

    class Bad {
      prepare() {
        throw new Error("bad")
      }

      style() {
      }

      html() {
      }

      hotkey() {
      }

      init() {
      }

      process() {
      }

      postprocess() {
      }
    }

    mock.method(mockUtils, "insertElements")
    mock.method(mockUtils, "insertStyle")
    mock.method(mockUtils.hotkeyHub, "register")
    stubSettingsRead({
      global: { ENABLE: true, LOCALE: "en" },
      good: { ENABLE: true, NAME: "Good" },
      bad: { ENABLE: true, NAME: "Bad" },
    })
    mock.method(mockUtils, "require", (_, fixedName) => ({ plugin: fixedName === "bad" ? Bad : Good }))
    const setPluginsSpy = mock.method(container, "setPlugins")

    await loadEntry()()

    const plugins = setPluginsSpy.mock.calls[0].arguments[0]
    assert.ok(plugins.enable.good instanceof Good)
    assert.ok(plugins.error.bad instanceof Error)
  })
})

describe("index.js - bootstrap() eventHub + mount-folder re-emit", () => {
  beforeEach(resetGlobalFile)
  afterEach(() => mock.restoreAll())

  function stubBootstrapDeps(extraSettings = {}) {
    mock.method(mockUtils, "require", () => ({ plugin: undefined }))
    stubSettingsRead({ global: { ENABLE: true, LOCALE: "en" }, ...extraSettings })
  }

  it("emits eventHub.eventType.allPluginsHadInjected exactly once, after container.setPlugins()", async () => {
    stubBootstrapDeps()
    const setPluginsSpy = mock.method(container, "setPlugins")
    const emitSpy = mock.method(mockUtils.eventHub, "emit")

    await loadEntry()()

    assert.equal(emitSpy.mock.callCount(), 1)
    assert.equal(emitSpy.mock.calls[0].arguments[0], mockUtils.eventHub.eventType.allPluginsHadInjected)
    assert.ok(setPluginsSpy.mock.callCount() === 1, "setPlugins must run before/alongside the injected event")
  })

  it("when a folder is mounted, re-emits fence/openFile events 80ms after bootstrap finishes", async () => {
    stubBootstrapDeps()
    global.File.getMountFolder = () => "/mounted"
    global.File.editor = { fences: { queue: { cid1: {} }, addCodeBlock: mock.fn() }, library: { openFile: mock.fn() } }
    mock.method(mockUtils, "getFilePath", () => "/mounted/file.md")

    mock.timers.enable({ apis: ["setTimeout"] })
    await loadEntry()()
    mock.timers.tick(80)
    mock.timers.reset()

    assert.equal(global.File.editor.fences.addCodeBlock.mock.calls[0].arguments[0], "cid1")
    assert.equal(global.File.editor.library.openFile.mock.calls[0].arguments[0], "/mounted/file.md")
  })

  it("does nothing when File.getMountFolder() returns null (no timer scheduled)", async () => {
    stubBootstrapDeps()
    global.File.getMountFolder = () => null
    const setTimeoutSpy = mock.method(global, "setTimeout")

    await loadEntry()()

    assert.equal(setTimeoutSpy.mock.callCount(), 0)
  })
})
