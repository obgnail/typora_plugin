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
        getActualPath: async (file) => `actual_path/${file}`,
        getObjects: async (...files) => {
          return files.map(file => MockUtilsFactory.configs[file] || {})
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
    existingPlugins.forEach(pluginName => {
      MockUtilsFactory.initialTestPluginPaths.add(`./plugin/custom/plugins/${pluginName}.js`)
      MockUtilsFactory.initialTestPluginPaths.add(`./plugin/${pluginName}.js`)
    })

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
      "custom_plugin.default.toml": { customFileManager: { NAME: "customFileManager", ENABLE: true } },
      "custom_plugin.user.toml": { customFileManager: { NAME: "customFileManager", ENABLE: true, CUSTOM_OPTION: "custom" } },
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
  describe("Plugin Management", () => {
    it("deleteUselessPlugins should remove specified plugins and directories", async () => {
      const removeSpy = mock.method(mockUtils.Package.FsExtra, "remove")
      await migrate.deleteUselessPlugins()

      assert.ok(removeSpy.mock.callCount() > 0, "Should attempt to remove plugins")

      const removedPaths = removeSpy.mock.calls.map(call => call.arguments[0])
      const hasExpectedRemovals = removedPaths.some(path => path.includes("__modal_example"))
      assert.ok(hasExpectedRemovals, "Should remove deprecated plugins")
    })

    it("deleteUselessPlugins should handle file system errors gracefully", async () => {
      const errorMessage = "Permission denied"
      mockUtils.Package.FsExtra.remove = async () => {
        throw new Error(errorMessage)
      }

      await assert.rejects(
        () => migrate.deleteUselessPlugins(),
        new Error(errorMessage),
      )
    })
  })

  describe("Configuration Cleaning", () => {
    describe("cleanInvalidPlugins", () => {
      it("should preserve valid plugins and remove invalid ones", async () => {
        const mockFiles = [{
          configDefault: new PluginConfigBuilder()
            .withPlugin("fileManager")
            .withPlugin("markdownEnhancer")
            .build(),
          configUser: new PluginConfigBuilder()
            .withPlugin("fileManager")
            .withPlugin("markdownEnhancer")
            .withPlugin("orphanedConfig")
            .build(),
        }]

        await migrate.cleanInvalidPlugins(mockFiles)

        assert.ok(mockFiles[0].configUser.fileManager, "Should keep existing plugin")
        assert.ok(mockFiles[0].configUser.markdownEnhancer, "Should keep existing plugin")
        assert.ok(mockFiles[0].configUser.orphanedConfig === undefined, "Should remove invalid plugin")
      })

      it("should handle empty configuration files", async () => {
        const mockFiles = [{
          configDefault: {},
          configUser: {},
        }]

        await assert.doesNotReject(() => migrate.cleanInvalidPlugins(mockFiles))
      })

      it("should handle plugins with index.js files", async () => {
        mockUtils._addTestPath("./plugin/custom/plugins/indexedPlugin/index.js")

        const mockFiles = [{
          configDefault: {},
          configUser: { indexedPlugin: { NAME: "indexedPlugin", ENABLE: true } },
        }]

        await migrate.cleanInvalidPlugins(mockFiles)

        assert.ok(mockFiles[0].configUser.indexedPlugin, "Should keep plugin with index.js")
      })
    })

    describe("cleanPluginsAndKeys", () => {
      it("should remove redundant plugins and configurations", () => {
        const mockFiles = [{
          configDefault: {
            markdownEnhancer: { ENABLE: false, MODE: "basic" },
            fileManager: { ENABLE: true, OPTION: "default", TYPE: 1, ACT: "find" },
          },
          configUser: {
            markdownEnhancer: { ENABLE: false, MODE: "basic" },
            fileManager: { ENABLE: true, OPTION: "user", TYPE: 1, CUSTOM: "extra" },
            codeFormatter: { ENABLE: true, STYLE: "prettier" },
          },
        }]

        migrate.cleanPluginsAndKeys(mockFiles)

        assert.ok(
          mockFiles[0].configUser.markdownEnhancer === undefined,
          "Should remove redundant plugins",
        )
        assert.deepStrictEqual(
          mockFiles[0].configUser.fileManager,
          { OPTION: "user" },
          "Should remove redundant default values",
        )
        assert.deepStrictEqual(
          mockFiles[0].configUser.codeFormatter,
          { ENABLE: true, STYLE: "prettier" },
          "Should keep user-only configurations",
        )
      })

      it("should handle empty user configurations", () => {
        const mockFiles = [{
          configDefault: { testPlugin: { ENABLE: true } },
          configUser: {},
        }]

        migrate.cleanPluginsAndKeys(mockFiles)
        assert.deepStrictEqual(mockFiles[0].configUser, {}, "Should handle empty user config")
      })

      it("should remove empty configuration objects", () => {
        const mockFiles = [{
          configDefault: { plugin1: { ENABLE: true } },
          configUser: {
            plugin1: { ENABLE: true },
            plugin2: {},
          },
        }]

        migrate.cleanPluginsAndKeys(mockFiles)
        assert.deepStrictEqual(mockFiles[0].configUser, {}, "Should remove empty config objects")
      })
    })
  })

  describe("File Operations", () => {
    describe("getConfigs", () => {
      it("should load and merge configuration files", async () => {
        const files = await migrate.getConfigs()

        assert.strictEqual(files.length, 2, "Should load both settings files")
        assert.strictEqual(files[0].file, "settings.user.toml")
        assert.strictEqual(files[1].file, "custom_plugin.user.toml")

        files.forEach(file => {
          assert.ok(file.configDefault, "Should have default config")
          assert.ok(file.configUser, "Should have user config")
        })
      })

      it("should handle missing configuration files", async () => {
        mockUtils.settings.getObjects = async () => [null, null, null, null]

        const files = await migrate.getConfigs()

        assert.strictEqual(files.length, 2, "Should still return two file objects")
        files.forEach(file => {
          assert.deepStrictEqual(file.configDefault, null, "Should handle missing default config")
          assert.deepStrictEqual(file.configUser, {}, "Should handle missing user config")
        })
      })
    })

    describe("saveFiles", () => {
      it("should persist configurations", async () => {
        const mockFiles = [{
          file: "test_settings.toml",
          configUser: { fileManager: { ENABLE: true } },
        }]
        const writeFileSpy = mock.method(mockUtils, "writeFile")

        await migrate.saveFiles(mockFiles)

        assert.strictEqual(writeFileSpy.mock.callCount(), 1)
        const [path, content] = writeFileSpy.mock.calls[0].arguments
        assert.strictEqual(path, "actual_path/test_settings.toml")
        assert.ok(content.includes("fileManager"))
      })

      it("should handle write errors gracefully", async () => {
        const errorMessage = "Disk full"
        mockUtils.writeFile = async () => {
          throw new Error(errorMessage)
        }

        const mockFiles = [{ file: "test.toml", configUser: {} }]

        await assert.rejects(
          () => migrate.saveFiles(mockFiles),
          new Error(errorMessage),
        )
      })

      it("should handle empty file list", async () => {
        const writeFileSpy = mock.method(mockUtils, "writeFile")

        await migrate.saveFiles([])
        assert.strictEqual(writeFileSpy.mock.callCount(), 0, "Should not attempt to write files")
      })
    })
  })

  describe("Workflow Integration", () => {
    it("run should execute complete migration workflow", async () => {
      const workflowSpies = {
        deleteUselessPlugins: mock.method(migrate, "deleteUselessPlugins"),
        cleanInvalidPlugins: mock.method(migrate, "cleanInvalidPlugins"),
        cleanPluginsAndKeys: mock.method(migrate, "cleanPluginsAndKeys"),
        saveFiles: mock.method(migrate, "saveFiles"),
      }
      mock.method(console, "log", () => undefined)

      await migrate.run()

      assert.strictEqual(console.log.mock.calls.length, 1)
      Object.values(workflowSpies).forEach(spy => {
        assert.strictEqual(spy.mock.callCount(), 1, "Each step should be called once")
      })
    })

    it("run should handle workflow errors gracefully", async () => {
      const errorMessage = "Workflow failed"
      mock.method(migrate, "deleteUselessPlugins", async () => {
        throw new Error(errorMessage)
      })

      await assert.rejects(
        () => migrate.run(),
        new Error(errorMessage),
      )
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

      const mockFiles = [{
        configDefault: largeConfig,
        configUser: { ...largeConfig },
      }]

      assert.doesNotThrow(
        () => migrate.cleanPluginsAndKeys(mockFiles),
        "Should process large configs without throwing errors",
      )
      assert.deepStrictEqual(mockFiles[0].configUser, {}, "Should successfully clean large identical configs")
    })
  })
})
