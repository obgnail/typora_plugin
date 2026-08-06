const { describe, it, before, beforeEach, afterEach, mock } = require("node:test")
const assert = require("node:assert")
const Migrate = require("../../plugin/global/core/utils/migrate")

class PluginConfigBuilder {
  constructor() {
    this.config = {}
  }

  withPlugin(name, enabled = true, options = {}) {
    this.config[name] = { NAME: name, ENABLE: enabled, ...options }
    return this
  }

  withPlugins(plugins) {
    plugins.forEach(({ name, enabled, options }) => this.withPlugin(name, enabled, options))
    return this
  }

  build() {
    return { ...this.config }
  }
}

class MockUtilsFactory {
  static create(customOverrides = {}) {
    const localTestPaths = new Set(MockUtilsFactory.initialTestPluginPaths)

    const defaultMocks = {
      joinPluginPath: (...paths) => paths.join("/"),
      Package: {
        FsExtra: {
          remove: async (path) => `removed:${path}`,
          access: async () => true,
        },
      },
      existPath: async (path) => localTestPaths.has(path),
      settings: {
        USER_TOML: "settings.user.toml",
        DEFAULT_TOML: "settings.default.toml",
        getUserTomlPath: async () => `actual_path/settings.user.toml`,
        getObjects: async () => {
          const { USER_TOML, DEFAULT_TOML } = defaultMocks.settings
          return [DEFAULT_TOML, USER_TOML, USER_TOML].map(file => MockUtilsFactory.configs[file] || {})
        },
      },
      stringifyToml: (obj) => `toml:${JSON.stringify(obj)}`,
      writeFile: async (path, content) => `written:${path}:${content}`,
      deepEqual: (a, b) => JSON.stringify(a) === JSON.stringify(b),
      merge: (a, b) => ({ ...a, ...b }),
      pickBy: (obj, predicate) => {
        const result = {}
        for (const [key, value] of Object.entries(obj)) {
          if (predicate(value)) {
            result[key] = value
          }
        }
        return result
      },
      _addTestPath: (path) => localTestPaths.add(path),
    }

    return { ...defaultMocks, ...customOverrides }
  }

  static initializeTestData() {
    const existingPlugins = ["fileManager", "markdownEnhancer", "codeFormatter"]
    const removedPlugins = ["oldPlugin", "deprecatedFeature"]
    const invalidPlugins = ["orphanedConfig", "missingImplementation"]

    MockUtilsFactory.initialTestPluginPaths = new Set()
    existingPlugins.forEach(pluginName => MockUtilsFactory.initialTestPluginPaths.add(`./plugin/${pluginName}.js`))

    const existingWithoutOptions = new PluginConfigBuilder()
      .withPlugins(existingPlugins.map(name => ({ name, enabled: true, options: { OPTION: "default" } })))
      .build()

    const existingWithOptions = new PluginConfigBuilder()
      .withPlugins(existingPlugins.map(name => ({ name, enabled: true, options: { OPTION: "user", CUSTOM: "customValue" } })))
      .build()

    const removed = new PluginConfigBuilder()
      .withPlugins(removedPlugins.map(name => ({ name, enabled: false })))
      .build()

    const invalid = new PluginConfigBuilder()
      .withPlugins(invalidPlugins.map(name => ({ name, enabled: true })))
      .build()

    MockUtilsFactory.configs = {
      "settings.default.toml": { ...existingWithoutOptions, ...removed },
      "settings.user.toml": { ...existingWithOptions, ...invalid },
    }
  }
}

let mockUtils
let migrate

before(() => {
  MockUtilsFactory.initializeTestData()
})

beforeEach(() => {
  mockUtils = MockUtilsFactory.create()
  migrate = new Migrate(mockUtils)
})

afterEach(() => {
  mock.restoreAll()
})

describe("Migrate class functionality", () => {
  describe("Configuration Cleaning", () => {
    describe("cleanPlugins", () => {
      it("should preserve valid plugins and remove invalid ones", async () => {
        const mockFiles = {
          default: new PluginConfigBuilder()
            .withPlugin("fileManager")
            .withPlugin("markdownEnhancer")
            .build(),
          user: new PluginConfigBuilder()
            .withPlugin("fileManager")
            .withPlugin("markdownEnhancer")
            .withPlugin("orphanedConfig")
            .build(),
        }

        await migrate.cleanPlugins(mockFiles)

        assert.ok(mockFiles.user.fileManager, "Should keep existing plugin")
        assert.ok(mockFiles.user.markdownEnhancer, "Should keep existing plugin")
        assert.ok(mockFiles.user.orphanedConfig === undefined, "Should remove invalid plugin")
      })

      it("should handle empty configuration files", async () => {
        const mockFiles = { default: {}, user: {} }

        await assert.doesNotReject(() => migrate.cleanPlugins(mockFiles))
      })

      it("should handle plugins with index.js files", async () => {
        mockUtils._addTestPath("./plugin/indexedPlugin/index.js")

        const mockFiles = {
          default: {},
          user: { indexedPlugin: { NAME: "indexedPlugin", ENABLE: true } },
        }

        await migrate.cleanPlugins(mockFiles)

        assert.ok(mockFiles.user.indexedPlugin, "Should keep plugin with index.js")
      })
    })

    describe("cleanPluginKeys", () => {
      it("should remove redundant plugins and configurations", () => {
        const mockFiles = {
          default: {
            markdownEnhancer: { ENABLE: false, MODE: "basic" },
            fileManager: { ENABLE: true, OPTION: "default", TYPE: 1, ACT: "find" },
          },
          user: {
            markdownEnhancer: { ENABLE: false, MODE: "basic" },
            fileManager: { ENABLE: true, OPTION: "user", TYPE: 1, CUSTOM: "extra" },
            codeFormatter: { ENABLE: true, STYLE: "prettier" },
          },
        }

        migrate.cleanPluginKeys(mockFiles)

        assert.ok(
          mockFiles.user.markdownEnhancer === undefined,
          "Should remove redundant plugins",
        )
        assert.deepStrictEqual(
          mockFiles.user.fileManager,
          { OPTION: "user" },
          "Should remove redundant default values",
        )
        assert.deepStrictEqual(
          mockFiles.user.codeFormatter,
          { ENABLE: true, STYLE: "prettier" },
          "Should keep user-only configurations",
        )
      })

      it("should handle empty user configurations", () => {
        const mockFiles = {
          default: { testPlugin: { ENABLE: true } },
          user: {},
        }

        migrate.cleanPluginKeys(mockFiles)
        assert.deepStrictEqual(mockFiles.user, {}, "Should handle empty user config")
      })

      it("should remove empty configuration objects", () => {
        const mockFiles = {
          default: { plugin1: { ENABLE: true } },
          user: {
            plugin1: { ENABLE: true },
            plugin2: {},
          },
        }

        migrate.cleanPluginKeys(mockFiles)
        assert.deepStrictEqual(mockFiles.user, {}, "Should remove empty config objects")
      })
    })
  })

  describe("File Operations", () => {
    describe("getConfigs", () => {
      it("should load and merge configuration files", async () => {
        const conf = await migrate.getConfigs()
        assert.ok(conf.default, "Should have default config")
        assert.ok(conf.user, "Should have user config")
      })

      it("should handle missing configuration files", async () => {
        mockUtils.settings.getObjects = async () => [null, null, null]

        const conf = await migrate.getConfigs()
        assert.deepStrictEqual(conf.default, null, "Should handle missing default config")
        assert.deepStrictEqual(conf.user, {}, "Should handle missing user config")
      })
    })

    describe("saveConfigs", () => {
      it("should persist configurations", async () => {
        const mockFiles = { user: { fileManager: { ENABLE: true } } }
        const writeFileSpy = mock.method(mockUtils, "writeFile")

        await migrate.saveConfigs(mockFiles)

        assert.strictEqual(writeFileSpy.mock.callCount(), 1)
        const [path, content] = writeFileSpy.mock.calls[0].arguments
        assert.strictEqual(path, "actual_path/settings.user.toml")
        assert.ok(content.includes("fileManager"))
      })

      it("should handle write errors gracefully", async () => {
        const errorMessage = "Disk full"
        mockUtils.writeFile = async () => {
          throw new Error(errorMessage)
        }
        await assert.rejects(
          () => migrate.saveConfigs({ user: {} }),
          new Error(errorMessage),
        )
      })
    })
  })

  describe("Workflow Integration", () => {
    it("run should execute complete migration workflow", async () => {
      const workflowSpies = {
        cleanPlugins: mock.method(migrate, "cleanPlugins"),
        cleanPluginKeys: mock.method(migrate, "cleanPluginKeys"),
        saveConfigs: mock.method(migrate, "saveConfigs"),
      }
      mock.method(console, "log", () => undefined)

      await migrate.run()

      assert.strictEqual(console.log.mock.calls.length, 1)
      Object.values(workflowSpies).forEach(spy => {
        assert.strictEqual(spy.mock.callCount(), 1, "Each step should be called once")
      })
    })

    it("postprocess should delay execution", () => {
      mock.timers.enable({ apis: ["setTimeout"] })
      const runSpy = mock.method(migrate, "run", async () => null)
      migrate.postprocess()
      assert.strictEqual(runSpy.mock.callCount(), 0, "Should not call run immediately")
      mock.timers.tick(10000)
      assert.strictEqual(runSpy.mock.callCount(), 1, "Should call run after delay")
      mock.timers.reset()
    })
  })

  describe("Edge Cases", () => {
    it("should process very large configuration files without errors", () => {
      const largeConfig = {}
      for (let i = 0; i < 1000; i++) {
        largeConfig[`plugin${i}`] = { ENABLE: true, OPTION: `value${i}` }
      }

      const mockFiles = { default: largeConfig, user: { ...largeConfig } }

      assert.doesNotThrow(
        () => migrate.cleanPluginKeys(mockFiles),
        "Should process large configs without throwing errors",
      )
      assert.deepStrictEqual(mockFiles.user, {}, "Should successfully clean large identical configs")
    })
  })
})
