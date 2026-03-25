const { describe, it, before, mock } = require("node:test")
const assert = require("node:assert")
const Migrate = require("../../plugin/global/core/utils/migrate")

function genPluginConfig(name, enabled = true, options = {}) {
    return { NAME: name, ENABLE: enabled, ...options }
}

let mockUtils
let migrate
let testPluginPaths
const PLUGIN_FIXTURES = {
    existingPlugins: ["fileManager", "markdownEnhancer", "codeFormatter"],
    removedPlugins: ["oldPlugin", "deprecatedFeature"],
    invalidPlugins: ["orphanedConfig", "missingImplementation"],
}

before(() => {
    testPluginPaths = new Set()
    PLUGIN_FIXTURES.existingPlugins.forEach(pluginName => {
        testPluginPaths.add(`./plugin/custom/plugins/${pluginName}.js`)
        testPluginPaths.add(`./plugin/${pluginName}.js`)
    })
})

before(async () => {
    mockUtils = {
        ...require("./mocks/utils.mock.js"),
        joinPluginPath: (...paths) => paths.join("/"),
        Package: { FsExtra: { remove: async (path) => `removed:${path}` } },
        existPath: async (path) => testPluginPaths.has(path),
        settings: {
            getActualPath: async (file) => `actual_path/${file}`,
            getObjects: async (...files) => {
                const existingWithoutOptions = Object.fromEntries(
                    PLUGIN_FIXTURES.existingPlugins.map(name => [name, genPluginConfig(name, true, { OPTION: "default" })])
                )
                const existingWithOptions = Object.fromEntries(
                    PLUGIN_FIXTURES.existingPlugins.map(name => [name, genPluginConfig(name, true, { OPTION: "user", CUSTOM: "customValue" })])
                )
                const removed = Object.fromEntries(
                    PLUGIN_FIXTURES.removedPlugins.map(name => [name, genPluginConfig(name, false)])
                )
                const invalid = Object.fromEntries(
                    PLUGIN_FIXTURES.invalidPlugins.map(name => [name, genPluginConfig(name, true)])
                )
                const configs = {
                    "settings.default.toml": { ...existingWithoutOptions, ...removed },
                    "settings.user.toml": { ...existingWithOptions, ...invalid },
                    "custom_plugin.default.toml": { customFileManager: genPluginConfig("customFileManager", true) },
                    "custom_plugin.user.toml": { customFileManager: genPluginConfig("customFileManager", true, { CUSTOM_OPTION: "custom" }) },
                }
                return files.map(file => configs[file] || {})
            },
        },
        stringifyToml: (obj) => `toml:${JSON.stringify(obj)}`,
        writeFile: async (path, content) => `written:${path}:${content}`
    }

    migrate = new Migrate(mockUtils)
})

describe("Migrate class functionality", () => {
    it("deleteUselessPlugins should remove specified plugins and directories", async () => {
        const removeSpy = mock.method(mockUtils.Package.FsExtra, "remove")
        await migrate.deleteUselessPlugins()
        assert.ok(removeSpy.mock.callCount() > 0, "Should attempt to remove plugins")

        const removedPaths = removeSpy.mock.calls.map(call => call.arguments[0])
        const hasExpectedRemovals = removedPaths.some(path => path.includes("__modal_example"))
        assert.ok(hasExpectedRemovals, "Should remove deprecated plugins")
    })

    it("cleanInvalidPlugins should preserve valid plugins and remove invalid ones", async () => {
        const mockFiles = [{
            configDefault: {
                fileManager: genPluginConfig("fileManager"),
                markdownEnhancer: genPluginConfig("markdownEnhancer"),
            },
            configUser: {
                fileManager: genPluginConfig("fileManager"),
                markdownEnhancer: genPluginConfig("markdownEnhancer"),
                orphanedConfig: genPluginConfig("orphanedConfig"),
            },
        }]
        await migrate.cleanInvalidPlugins(mockFiles)
        assert.ok(mockFiles[0].configUser.fileManager, "Should keep existing plugin")
        assert.ok(mockFiles[0].configUser.markdownEnhancer, "Should keep existing plugin")
        assert.ok(mockFiles[0].configUser.orphanedConfig === undefined, "Should remove invalid plugin")
    })

    it("cleanPluginsAndKeys should remove redundant plugins and configurations", async () => {
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
            "Should remove redundant plugins"
        )
        assert.deepStrictEqual(
            mockFiles[0].configUser.fileManager,
            { OPTION: "user" },
            "Should remove redundant default values"
        )
        assert.deepStrictEqual(
            mockFiles[0].configUser.codeFormatter,
            { ENABLE: true, STYLE: "prettier" },
            "Should keep user-only configurations"
        )
    })

    it("getConfigs should load and merge configuration files", async () => {
        const files = await migrate.getConfigs()
        assert.strictEqual(files.length, 2, "Should load both settings files")
        assert.strictEqual(files[0].file, "settings.user.toml")
        assert.strictEqual(files[1].file, "custom_plugin.user.toml")
        files.forEach(file => {
            assert.ok(file.configDefault, "Should have default config")
            assert.ok(file.configUser, "Should have user config")
        })
    })

    it("saveFiles should persist configurations", async () => {
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

    it("run should execute complete migration workflow", async () => {
        const workflowSpies = {
            deleteUselessPlugins: mock.method(migrate, "deleteUselessPlugins"),
            cleanInvalidPlugins: mock.method(migrate, "cleanInvalidPlugins"),
            cleanPluginsAndKeys: mock.method(migrate, "cleanPluginsAndKeys"),
            saveFiles: mock.method(migrate, "saveFiles")
        }
        mock.method(console, "log", () => undefined)
        await migrate.run()
        assert.strictEqual(console.log.mock.calls.length, 1)
        Object.values(workflowSpies).forEach(spy => {
            assert.strictEqual(spy.mock.callCount(), 1, "Each step should be called once")
        })
    })
})
