const assert = require("node:assert/strict")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const test = require("node:test")

const {
  RepositoryStore,
  UnsupportedRepositoryVersionError,
} = require("../../plugin/repository/store")

const makeFixture = async () => {
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "typora-repository-"))
  const filePath = path.join(dir, "repository.json")
  return {
    dir,
    filePath,
    cleanup: () => fs.promises.rm(dir, { recursive: true, force: true }),
  }
}

test("initializes an empty versioned data file and reloads it", async t => {
  const fixture = await makeFixture()
  t.after(fixture.cleanup)
  const store = new RepositoryStore({ filePath: fixture.filePath })

  const first = await store.load()
  const second = await store.load()

  assert.deepEqual(first.data, {
    version: 1,
    preferences: { sortBy: "recent" },
    repositories: [],
  })
  assert.deepEqual(second.data, first.data)
  assert.equal(await fs.promises.readFile(fixture.filePath, "utf8").then(Boolean), true)
})

test("normalizes and deduplicates paths while refreshing lastOpenedAt", async t => {
  const fixture = await makeFixture()
  t.after(fixture.cleanup)
  const timestamps = [
    new Date("2026-01-01T00:00:00.000Z"),
    new Date("2026-01-02T00:00:00.000Z"),
  ]
  const store = new RepositoryStore({ filePath: fixture.filePath, now: () => timestamps.shift() })
  const folder = path.join(fixture.dir, "notes")

  await store.upsert(path.join(folder, "."))
  const result = await store.upsert(folder)

  assert.equal(result.data.repositories.length, 1)
  assert.equal(result.data.repositories[0].path, path.resolve(folder))
  assert.equal(result.data.repositories[0].createdAt, "2026-01-01T00:00:00.000Z")
  assert.equal(result.data.repositories[0].lastOpenedAt, "2026-01-02T00:00:00.000Z")
})

test("persists aliases, alias resets, removals, and sort preference", async t => {
  const fixture = await makeFixture()
  t.after(fixture.cleanup)
  const store = new RepositoryStore({ filePath: fixture.filePath })
  const folder = path.join(fixture.dir, "notes")

  await store.upsert(folder)
  await store.rename(folder, "  工作笔记  ")
  await store.setSortBy("name")
  let result = await store.load()
  assert.equal(result.data.repositories[0].alias, "工作笔记")
  assert.equal(result.data.preferences.sortBy, "name")

  await store.rename(folder, "   ")
  result = await store.load()
  assert.equal(result.data.repositories[0].alias, "")

  await store.remove(folder)
  result = await store.load()
  assert.equal(result.data.repositories.length, 0)
})

test("deduplicates Windows paths without regard to case", async t => {
  if (process.platform !== "win32") return t.skip("Windows-specific path semantics")
  const fixture = await makeFixture()
  t.after(fixture.cleanup)
  const store = new RepositoryStore({ filePath: fixture.filePath, platform: "win32" })
  const folder = path.join(fixture.dir, "Notes")

  await store.upsert(folder)
  const result = await store.upsert(folder.toUpperCase())

  assert.equal(result.data.repositories.length, 1)
  assert.equal(result.data.repositories[0].path, path.resolve(folder))
})

test("backs up corrupt JSON and recovers with empty data", async t => {
  const fixture = await makeFixture()
  t.after(fixture.cleanup)
  await fs.promises.writeFile(fixture.filePath, "{broken", "utf8")
  const store = new RepositoryStore({
    filePath: fixture.filePath,
    now: () => new Date("2026-01-03T04:05:06.000Z"),
  })

  const result = await store.load()

  assert.equal(result.warnings[0].code, "CORRUPT_DATA_RECOVERED")
  assert.equal(result.data.repositories.length, 0)
  assert.equal(await fs.promises.readFile(result.warnings[0].backupPath, "utf8"), "{broken")
})

test("rejects unknown versions without overwriting the source file", async t => {
  const fixture = await makeFixture()
  t.after(fixture.cleanup)
  const original = JSON.stringify({ version: 99, repositories: [] })
  await fs.promises.writeFile(fixture.filePath, original, "utf8")
  const store = new RepositoryStore({ filePath: fixture.filePath })

  await assert.rejects(store.load(), UnsupportedRepositoryVersionError)
  assert.equal(await fs.promises.readFile(fixture.filePath, "utf8"), original)
})

test("serializes concurrent mutations from separate store instances", async t => {
  const fixture = await makeFixture()
  t.after(fixture.cleanup)
  const first = new RepositoryStore({ filePath: fixture.filePath })
  const second = new RepositoryStore({ filePath: fixture.filePath })
  const folderA = path.join(fixture.dir, "a")
  const folderB = path.join(fixture.dir, "b")

  await Promise.all([first.upsert(folderA), second.upsert(folderB)])
  const result = await first.load()

  assert.deepEqual(
    result.data.repositories.map(item => item.path).sort(),
    [path.resolve(folderA), path.resolve(folderB)].sort(),
  )
})
