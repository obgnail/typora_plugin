const assert = require("node:assert/strict")
const path = require("node:path")
const test = require("node:test")

const {
  RepositoryStore,
  UnsupportedRepositoryVersionError,
} = require("../../plugin/repository/store")

const createStorage = initialValue => {
  let raw = initialValue === undefined ? null : JSON.stringify(initialValue)
  return {
    set: value => raw = JSON.stringify(value),
    get: () => raw == null ? null : JSON.parse(raw),
    exist: () => raw != null,
    remove: () => raw = null,
    getRaw: () => raw,
    setRaw: value => raw = value,
  }
}

const fixturePath = name => path.join(process.cwd(), "repository-fixtures", name)

test("initializes empty versioned data in the storage adapter and reloads it", async () => {
  const storage = createStorage()
  const store = new RepositoryStore({ storage })

  const first = await store.load()
  const second = await store.load()

  assert.deepEqual(first.data, {
    version: 1,
    preferences: { sortBy: "recent" },
    repositories: [],
  })
  assert.deepEqual(second.data, first.data)
  assert.equal(storage.exist(), true)
})

test("normalizes and deduplicates paths while refreshing lastOpenedAt", async () => {
  const timestamps = [
    new Date("2026-01-01T00:00:00.000Z"),
    new Date("2026-01-02T00:00:00.000Z"),
  ]
  const store = new RepositoryStore({ storage: createStorage(), now: () => timestamps.shift() })
  const folder = fixturePath("notes")

  await store.upsert(path.join(folder, "."))
  const result = await store.upsert(folder)

  assert.equal(result.data.repositories.length, 1)
  assert.equal(result.data.repositories[0].path, path.resolve(folder))
  assert.equal(result.data.repositories[0].createdAt, "2026-01-01T00:00:00.000Z")
  assert.equal(result.data.repositories[0].lastOpenedAt, "2026-01-02T00:00:00.000Z")
})

test("persists aliases, alias resets, removals, and sort preference", async () => {
  const store = new RepositoryStore({ storage: createStorage() })
  const folder = fixturePath("notes")

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

test("deduplicates Windows paths without regard to case", async () => {
  const store = new RepositoryStore({ storage: createStorage(), platform: "win32" })
  const folder = fixturePath("Notes")

  await store.upsert(folder)
  const result = await store.upsert(folder.toUpperCase())

  assert.equal(result.data.repositories.length, 1)
  assert.equal(result.data.repositories[0].path, path.resolve(folder))
})

test("removes corrupt storage data and recovers with empty data", async () => {
  const storage = createStorage()
  storage.setRaw("{broken")
  const store = new RepositoryStore({ storage })

  const result = await store.load()

  assert.equal(result.warnings[0].code, "CORRUPT_DATA_RECOVERED")
  assert.equal(result.data.repositories.length, 0)
  assert.deepEqual(storage.get(), result.data)
})

test("rejects unknown versions without overwriting stored data", async () => {
  const original = { version: 99, repositories: [] }
  const storage = createStorage(original)
  const raw = storage.getRaw()
  const store = new RepositoryStore({ storage })

  await assert.rejects(store.load(), UnsupportedRepositoryVersionError)
  assert.equal(storage.getRaw(), raw)
})

test("applies concurrent mutations without a file lock", async () => {
  const storage = createStorage()
  const first = new RepositoryStore({ storage })
  const second = new RepositoryStore({ storage })
  const folderA = fixturePath("a")
  const folderB = fixturePath("b")

  await Promise.all([first.upsert(folderA), second.upsert(folderB)])
  const result = await first.load()

  assert.deepEqual(
    result.data.repositories.map(item => item.path).sort(),
    [path.resolve(folderA), path.resolve(folderB)].sort(),
  )
})
