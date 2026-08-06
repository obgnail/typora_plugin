global.BasePlugin = class {
}

const { describe, it, beforeEach, afterEach, mock } = require("node:test")
const assert = require("node:assert/strict")
const mockUtils = require("./mocks/utils.mock.js")
const { Updater } = require("../../plugin/updater.js")

describe("Updater", () => {
  let updater

  beforeEach(() => {
    updater = new Updater(mockUtils, "https://api.example.com/latest", "http://proxy", 5000)

    mock.method(console, "log", () => undefined)
    mock.method(console, "error", () => undefined)

    updater.fs = {
      emptyDir: mock.fn(async () => undefined),
      remove: mock.fn(async () => undefined),
      chmod: mock.fn(async () => undefined),
      readJson: mock.fn(async () => ({ tag_name: "1.0.0" })),
      outputJson: mock.fn(async () => undefined),
      readdir: mock.fn(async () => []),
      copy: mock.fn(async () => undefined),
      ensureDir: mock.fn(async () => undefined),
      move: mock.fn(async () => undefined),
    }

    updater.path = {
      join: mock.fn((...args) => args.filter(Boolean).join("/").replace(/\/+/g, "/")),
      basename: mock.fn((p, ext) => {
        const base = p.split("/").pop()
        if (ext && base.endsWith(ext)) return base.slice(0, -ext.length)
        return base
      }),
      extname: mock.fn((p) => {
        const match = p.match(/\.[^.]+$/)
        return match ? match[0] : ""
      }),
      dirname: mock.fn((p) => p.split("/").slice(0, -1).join("/") || "."),
    }
    updater.utils.fetch = mock.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ tag_name: "2.0.0", assets: [{ browser_download_url: "https://dl.url" }] }),
      buffer: async () => Buffer.from("mock-zip-data"),
    }))
    updater.utils.unzip = mock.fn(async () => [
      `${updater.paths.workDir}/plugin/main.js`,
      `${updater.paths.workDir}/plugin`,
    ])
    updater.utils.joinPluginPath = mock.fn((p) => `/app/plugin/${p}`)
    updater.utils.existPath = mock.fn(async () => true)
    updater.utils.compareVersion = mock.fn((a, b) => (a === b ? 0 : 1))
    updater.utils.migrate = {
      run: mock.fn(async () => undefined),
    }
    updater.utils.runWithFakeProgressBar = mock.fn(async (cb) => cb())
  })

  afterEach(() => mock.restoreAll())

  describe("Constructor", () => {
    it("should initialize correct properties", () => {
      assert.equal(updater.latestReleaseUrl, "https://api.example.com/latest")
      assert.deepEqual(updater.requestOption, { proxy: "http://proxy", timeout: 5000 })
      assert.ok(updater.paths.versionFile.includes("version.json"))
    })

    it("should handle empty proxy and timeout", () => {
      const u = new Updater(mockUtils, "url", null, null)
      assert.deepEqual(u.requestOption, { proxy: null, timeout: null })
    })
  })

  describe("prepare", () => {
    it("should clean workspace and change permissions", async () => {
      await updater.prepare()
      assert.equal(updater.fs.emptyDir.mock.calls.length, 1)
      assert.equal(updater.fs.remove.mock.calls.length, 1)
      assert.equal(updater.fs.chmod.mock.calls.length, 1)
      assert.deepEqual(updater.fs.chmod.mock.calls[0].arguments, ["/app/plugin/./plugin", 0o777])
    })
  })

  describe("cleanup", () => {
    it("should remove workDir and backupDir", async () => {
      await updater.cleanup()
      assert.equal(updater.fs.remove.mock.calls.length, 2)
    })

    it("should not throw if remove fails", async () => {
      updater.fs.remove = mock.fn(async () => {
        throw new Error("Mock error")
      })
      await assert.doesNotReject(() => updater.cleanup())
      assert.equal(updater.fs.remove.mock.calls.length, 1)
    })
  })

  describe("chmod", () => {
    it("should not throw if chmod fails", async () => {
      updater.fs.chmod = mock.fn(async () => {
        throw new Error("EPERM")
      })
      await assert.doesNotReject(() => updater.chmod("/path"))
    })
  })

  describe("_fetchJson", () => {
    it("should return parsed json", async () => {
      const res = await updater._fetchJson("url")
      assert.equal(res.tag_name, "2.0.0")
    })

    it("should return null on failure", async () => {
      updater.utils.fetch = mock.fn(async () => {
        throw new Error("Network Error")
      })
      const res = await updater._fetchJson("url")
      assert.equal(res, null)
    })
  })

  describe("_readLocalVersion", () => {
    it("should return null on failure", async () => {
      updater.fs.readJson = mock.fn(async () => {
        throw new Error("ENOENT")
      })
      const res = await updater._readLocalVersion()
      assert.equal(res, null)
    })
  })

  describe("checkNeedUpdate", () => {
    it("should return true when versions mismatch", async () => {
      const result = await updater.checkNeedUpdate()
      assert.equal(result, true)
      assert.equal(updater.latestVersionInfo.tag_name, "2.0.0")
      assert.equal(updater.currentVersionInfo.tag_name, "1.0.0")
    })

    it("should return false when versions are identical", async () => {
      updater.utils.compareVersion = mock.fn(() => 0)
      const result = await updater.checkNeedUpdate()
      assert.equal(result, false)
    })

    it("should return true when local version is missing", async () => {
      updater.fs.readJson = mock.fn(async () => null)
      const result = await updater.checkNeedUpdate()
      assert.equal(result, true)
      assert.equal(updater.currentVersionInfo, null)
    })

    it("should throw when fetch fails completely", async () => {
      updater._fetchJson = mock.fn(async () => null)
      await assert.rejects(
        () => updater.checkNeedUpdate(),
        /Fetch latest version failed/,
      )
    })
  })

  describe("getDownloadURL", () => {
    it("should return browser_download_url if available", () => {
      updater.latestVersionInfo = { assets: [{ browser_download_url: "https://dl.url" }] }
      assert.equal(updater.getDownloadURL(), "https://dl.url")
    })

    it("should fallback to zipball_url if assets are empty", () => {
      updater.latestVersionInfo = { assets: [], zipball_url: "https://zip.url" }
      assert.equal(updater.getDownloadURL(), "https://zip.url")
    })

    it("should return null if latestVersionInfo is null", () => {
      updater.latestVersionInfo = null
      assert.equal(updater.getDownloadURL(), null)
    })
  })

  describe("downloadLatestVersion", () => {
    it("should fetch buffer from valid URL", async () => {
      updater.latestVersionInfo = { assets: [{ browser_download_url: "https://dl.url" }] }
      const buffer = await updater.downloadLatestVersion()
      assert.deepEqual(buffer, Buffer.from("mock-zip-data"))
      assert.equal(updater.utils.fetch.mock.calls[0].arguments[0], "https://dl.url")
    })

    it("should throw when response is not ok", async () => {
      updater.latestVersionInfo = { zipball_url: "https://zip.url" }
      updater.utils.fetch = mock.fn(async () => ({ ok: false, status: 404 }))
      await assert.rejects(
        () => updater.downloadLatestVersion(),
        /Download failed: HTTP 404/,
      )
    })

    it("should throw when no download URL is available", async () => {
      updater.latestVersionInfo = {}
      await assert.rejects(
        () => updater.downloadLatestVersion(),
        /No download URL found/,
      )
    })
  })

  describe("unzip", () => {
    it("should set stagingDir correctly", async () => {
      await updater.unzip(Buffer.from("dummy"))
      assert.equal(updater.utils.unzip.mock.calls.length, 1)
      assert.equal(updater.paths.stagingDir, `${updater.paths.workDir}`)
    })

    it("should throw if target directory is missing in zip", async () => {
      updater.utils.unzip = mock.fn(async () => ["/tmp/wrong_folder"])
      await assert.rejects(
        () => updater.unzip(Buffer.from("dummy")),
        /Invalid zip structure: 'plugin' folder not found/,
      )
    })
  })

  describe("migrateUserFiles", () => {
    beforeEach(() => {
      updater.paths.stagingDir = "/tmp/staging"
    })

    it("should migrate default userFiles even if directories are empty", async () => {
      updater.fs.readdir = mock.fn(async () => [])
      await updater.migrateUserFiles()

      const copyCalls = updater.fs.copy.mock.calls
      assert.equal(copyCalls.length, 3)
      assert.ok(copyCalls.some(c => c.arguments[0].includes("user_space")))
      assert.ok(copyCalls.some(c => c.arguments[0].includes("user_styles")))
      assert.ok(copyCalls.some(c => c.arguments[0].includes("settings.user.toml")))
    })

    it("should not migrate files that do not exist physically", async () => {
      updater.fs.readdir = mock.fn(async () => [])
      updater.utils.existPath = mock.fn(async (p) => p.includes("user_space"))
      await updater.migrateUserFiles()

      const copyCalls = updater.fs.copy.mock.calls
      assert.equal(copyCalls.length, 1)
      assert.ok(copyCalls[0].arguments[0].includes("user_space"))
    })

    it("should migrate unknown legacy files and skip identical files", async () => {
      const oldDirents = [
        { name: "legacy_config.json", isFile: () => true },
        { name: "shared_style.css", isFile: () => true },
        { name: "old_folder", isFile: () => false },
      ]
      const newDirents = [
        { name: "shared_style.css", isFile: () => true },
      ]

      updater.fs.readdir = mock.fn(async (dir) => dir.includes("staging") ? newDirents : oldDirents)
      await updater.migrateUserFiles()

      const copiedPaths = updater.fs.copy.mock.calls.map(c => c.arguments[0])
      assert.ok(copiedPaths.some(p => p.includes("legacy_config.json")))
      assert.ok(copiedPaths.some(p => p.includes("old_folder")))
      assert.ok(!copiedPaths.some(p => p.includes("shared_style.css")))
    })

    it("should handle old single .js file replaced by identically named directory", async () => {
      const oldDirents = [{ name: "feature.js", isFile: () => true }]
      const newDirents = [{ name: "feature", isFile: () => false }]

      updater.fs.readdir = mock.fn(async (dir) => dir.includes("staging") ? newDirents : oldDirents)
      await updater.migrateUserFiles()

      const copiedPaths = updater.fs.copy.mock.calls.map(c => c.arguments[0])
      assert.ok(!copiedPaths.some(p => p.includes("feature.js")))
    })

    it("should handle old directory replaced by identically named .js file", async () => {
      const oldDirents = [{ name: "feature", isFile: () => false }]
      const newDirents = [{ name: "feature.js", isFile: () => true }]

      updater.fs.readdir = mock.fn(async (dir) => dir.includes("staging") ? newDirents : oldDirents)
      await updater.migrateUserFiles()

      const copiedPaths = updater.fs.copy.mock.calls.map(c => c.arguments[0])
      assert.ok(!copiedPaths.some(p => p.includes("feature")))
    })

    it("should migrate .js file if new version does not have it", async () => {
      const oldDirents = [{ name: "custom_script.js", isFile: () => true }]
      const newDirents = [{ name: "core.js", isFile: () => true }]

      updater.fs.readdir = mock.fn(async (dir) => dir.includes("staging") ? newDirents : oldDirents)
      await updater.migrateUserFiles()

      const copiedPaths = updater.fs.copy.mock.calls.map(c => c.arguments[0])
      assert.ok(copiedPaths.some(p => p.includes("custom_script.js")))
    })

    it("should skip dynamic calculation if oldPluginDir does not exist", async () => {
      updater.utils.existPath = mock.fn(async (p) => !p.includes("/app/plugin/./plugin"))
      await updater.migrateUserFiles()
      assert.equal(updater.fs.readdir.mock.calls.length, 0)
    })

    it("should skip dynamic calculation if newPluginDir does not exist", async () => {
      updater.utils.existPath = mock.fn(async (p) => !p.includes("staging"))
      await updater.migrateUserFiles()
      assert.equal(updater.fs.readdir.mock.calls.length, 0)
    })

    it("should avoid duplicate paths in filesToMigrate", async () => {
      const oldDirents = [{ name: "global", isFile: () => false }]
      const newDirents = []

      updater.fs.readdir = mock.fn(async (dir) => dir.includes("staging") ? newDirents : oldDirents)
      updater.userFiles = ["./plugin/global"]

      await updater.migrateUserFiles()

      const copiedPaths = updater.fs.copy.mock.calls.map(c => c.arguments[0])
      assert.equal(copiedPaths.length, 1)
    })
  })

  describe("atomicSync", () => {
    beforeEach(() => {
      updater.paths.stagingDir = "/tmp/staging"
      updater.latestVersionInfo = { tag_name: "3.0.0" }
    })

    it("should execute backup, clean backup, and copy successfully", async () => {
      updater.fs.readdir = mock.fn(async () => ["a.js", "b.js"])
      await updater.atomicSync()

      assert.equal(updater.fs.outputJson.mock.calls.length, 1)
      assert.ok(updater.fs.outputJson.mock.calls[0].arguments[0].includes("version.json"))

      const moveCalls = updater.fs.move.mock.calls
      assert.equal(moveCalls.length, 2)
      assert.ok(moveCalls[0].arguments[0].includes("/app/plugin/./plugin"))
      assert.ok(moveCalls[0].arguments[1].includes("backup"))

      assert.equal(updater.fs.emptyDir.mock.calls.length, 1)
      assert.equal(updater.fs.copy.mock.calls.length, 1)
      assert.ok(updater.fs.copy.mock.calls[0].arguments[0].includes("staging"))
    })

    it("should skip writing version json if latestVersionInfo is null", async () => {
      updater.latestVersionInfo = null
      updater.fs.readdir = mock.fn(async () => [])
      await updater.atomicSync()
      assert.equal(updater.fs.outputJson.mock.calls.length, 0)
    })

    it("should throw if target plugin directory does not exist", async () => {
      updater.utils.existPath = mock.fn(async () => false)
      await assert.rejects(() => updater.atomicSync(), /Target plugin directory does not exist/)
    })

    it("should attempt restore if backup moveContent fails", async () => {
      updater.fs.readdir = mock.fn(async () => ["file1.js", "file2.js"])
      let moveCallCount = 0
      updater.fs.move = mock.fn(async () => {
        moveCallCount++
        if (moveCallCount === 2) throw new Error("Permission denied during backup")
      })

      await assert.rejects(() => updater.atomicSync(), /Permission denied/)

      const ensureDirCalls = updater.fs.ensureDir.mock.calls
      assert.ok(ensureDirCalls.some(c => c.arguments[0].includes("backup")))
      assert.ok(ensureDirCalls.some(c => c.arguments[0].includes("/app/plugin/./plugin")))

      assert.equal(moveCallCount, 4)
    })

    it("should swallow restore error if restoring partial backup fails", async () => {
      updater.fs.readdir = mock.fn(async () => ["f1", "f2"])
      let moveCount = 0
      updater.fs.move = mock.fn(async () => {
        moveCount++
        if (moveCount === 2) throw new Error("Backup failed")
        if (moveCount === 3) throw new Error("Restore failed")
      })

      await assert.rejects(() => updater.atomicSync(), /Backup failed/)
      assert.equal(moveCount, 3)
    })

    it("should rollback completely if final copy fails", async () => {
      updater.fs.readdir = mock.fn(async () => ["core1", "core2"])
      updater.fs.copy = mock.fn(async () => {
        throw new Error("Disk full during copy")
      })

      await assert.rejects(() => updater.atomicSync(), /Disk full during copy/)

      const emptyDirCalls = updater.fs.emptyDir.mock.calls
      assert.equal(emptyDirCalls.length, 2)
      assert.ok(emptyDirCalls[1].arguments[0].includes("/app/plugin/./plugin"))

      const moveCalls = updater.fs.move.mock.calls
      assert.equal(moveCalls.length, 4)
    })

    it("should throw rollback error if rollback process throws", async () => {
      updater.fs.readdir = mock.fn(async () => ["data1"])
      updater.fs.copy = mock.fn(async () => {
        throw new Error("Initial copy crash")
      })

      let emptyDirCount = 0
      updater.fs.emptyDir = mock.fn(async () => {
        emptyDirCount++
        if (emptyDirCount === 2) throw new Error("Cannot empty target dir for rollback")
      })

      await assert.rejects(() => updater.atomicSync(), /Cannot empty target dir for rollback/)
    })
  })

  describe("Integration: _performUpdate", () => {
    it("should process normally when force is true", async () => {
      updater.checkNeedUpdate = mock.fn()
      await updater._performUpdate({ url: "mock", force: true })
      assert.equal(updater.checkNeedUpdate.mock.calls.length, 0)
      assert.equal(updater.fs.copy.mock.calls.length, 4)
    })

    it("should skip update if not needed", async () => {
      updater.checkNeedUpdate = mock.fn(async () => false)
      const res = await updater._performUpdate()
      assert.equal(res, "NO_NEED")
      assert.equal(updater.fs.copy.mock.calls.length, 0)
    })
  })

  describe("Integration: run and force", () => {
    it("run should exit early if NO_NEED", async () => {
      updater.utils.compareVersion = mock.fn(() => 0)
      const result = await updater.run()
      assert.equal(result, "NO_NEED")
      assert.equal(updater.fs.copy.mock.calls.length, 0)
    })

    it("run should execute full pipeline and return UPDATED", async () => {
      const result = await updater.run()
      assert.equal(result, "UPDATED")
      assert.equal(updater.utils.migrate.run.mock.calls.length, 1)
    })

    it("run should catch error and return it", async () => {
      const err = new Error("run failed")
      updater._performUpdate = mock.fn(async () => {
        throw err
      })
      const result = await updater.run()
      assert.equal(result, err)
    })

    it("force should execute pipeline bypassing checkNeedUpdate", async () => {
      updater.checkNeedUpdate = mock.fn(async () => false)
      const result = await updater.force("https://force.url")
      assert.equal(result, "UPDATED")
      assert.equal(updater.checkNeedUpdate.mock.calls.length, 0)
      assert.equal(updater.utils.migrate.run.mock.calls.length, 1)
    })

    it("force should throw on error", async () => {
      const err = new Error("force failed")
      updater._performUpdate = mock.fn(async () => {
        throw err
      })
      await assert.rejects(() => updater.force("url"), /force failed/)
    })
  })

  describe("runWithProgressBar", () => {
    it("should return state and info", async () => {
      updater.latestVersionInfo = { tag_name: "1.2.3" }
      updater.run = mock.fn(async () => "UPDATED")
      const result = await updater.runWithProgressBar()
      assert.deepEqual(result, { state: "UPDATED", info: { tag_name: "1.2.3" } })
      assert.equal(updater.utils.runWithFakeProgressBar.mock.calls.length, 1)
    })
  })
})
