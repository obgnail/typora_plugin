const fs = require("fs")
const path = require("path")

const DATA_VERSION = 1
const SORT_MODES = new Set(["recent", "name", "path"])

const removeFile = async filePath => {
  try {
    await fs.promises.unlink(filePath)
  } catch (error) {
    if (error.code !== "ENOENT") throw error
  }
}

class UnsupportedRepositoryVersionError extends Error {
  constructor(version) {
    super(`Unsupported repository data version: ${version}`)
    this.name = "UnsupportedRepositoryVersionError"
    this.version = version
  }
}

class RepositoryStore {
  constructor({
    filePath,
    platform = process.platform,
    now = () => new Date(),
    lockTimeoutMs = 3000,
    staleLockMs = 10000,
    retryDelayMs = 30,
  } = {}) {
    if (!filePath) throw new Error("RepositoryStore requires filePath")

    this.filePath = path.resolve(filePath)
    this.lockPath = `${this.filePath}.lock`
    this.platform = platform
    this.now = now
    this.lockTimeoutMs = lockTimeoutMs
    this.staleLockMs = staleLockMs
    this.retryDelayMs = retryDelayMs
  }

  load = () => this._withLock(async () => {
    const result = await this._readUnlocked()
    if (result.needsWrite) await this._writeUnlocked(result.data)
    return result
  })

  upsert = folderPath => this._mutate(data => {
    const normalizedPath = this.normalizePath(folderPath)
    const key = this.canonicalKey(normalizedPath)
    const timestamp = this._nowISOString()
    const existing = data.repositories.find(item => this.canonicalKey(item.path) === key)

    if (existing) {
      existing.lastOpenedAt = timestamp
    } else {
      data.repositories.push({
        path: normalizedPath,
        alias: "",
        createdAt: timestamp,
        lastOpenedAt: timestamp,
      })
    }
    return true
  })

  rename = (folderPath, alias) => this._mutate(data => {
    const item = this._find(data, folderPath)
    if (!item) return false
    item.alias = String(alias || "").trim()
    return true
  })

  remove = folderPath => this._mutate(data => {
    const key = this.canonicalKey(folderPath)
    const index = data.repositories.findIndex(item => this.canonicalKey(item.path) === key)
    if (index === -1) return false
    data.repositories.splice(index, 1)
    return true
  })

  setSortBy = sortBy => {
    if (!SORT_MODES.has(sortBy)) throw new Error(`Unsupported sort mode: ${sortBy}`)
    return this._mutate(data => {
      if (data.preferences.sortBy === sortBy) return false
      data.preferences.sortBy = sortBy
      return true
    })
  }

  normalizePath = folderPath => {
    if (typeof folderPath !== "string" || !folderPath.trim()) {
      throw new Error("Repository path must be a non-empty string")
    }
    return path.resolve(folderPath.trim())
  }

  canonicalKey = folderPath => {
    const normalized = this.normalizePath(folderPath)
    return this.platform === "win32" ? normalized.toLocaleLowerCase("en-US") : normalized
  }

  _find = (data, folderPath) => {
    const key = this.canonicalKey(folderPath)
    return data.repositories.find(item => this.canonicalKey(item.path) === key)
  }

  _mutate = mutator => this._withLock(async () => {
    const result = await this._readUnlocked()
    const changed = await mutator(result.data)
    if (changed || result.needsWrite) await this._writeUnlocked(result.data)
    return { ...result, changed: Boolean(changed) }
  })

  _readUnlocked = async () => {
    let content
    try {
      content = await fs.promises.readFile(this.filePath, "utf8")
    } catch (error) {
      if (error.code === "ENOENT") {
        return { data: this._defaultData(), warnings: [], needsWrite: true }
      }
      throw error
    }

    try {
      const data = this._validateData(JSON.parse(content))
      return { data, warnings: [], needsWrite: false }
    } catch (error) {
      if (error instanceof UnsupportedRepositoryVersionError) throw error

      const backupPath = await this._backupCorruptFile()
      return {
        data: this._defaultData(),
        warnings: [{ code: "CORRUPT_DATA_RECOVERED", backupPath, error: error.message }],
        needsWrite: true,
      }
    }
  }

  _validateData = raw => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new Error("Repository data must be an object")
    }
    if (raw.version !== DATA_VERSION) {
      throw new UnsupportedRepositoryVersionError(raw.version)
    }

    const sortBy = raw.preferences?.sortBy || "recent"
    if (!SORT_MODES.has(sortBy)) throw new Error(`Invalid sort mode: ${sortBy}`)
    if (!Array.isArray(raw.repositories)) throw new Error("repositories must be an array")

    const repositories = []
    const keys = new Set()
    for (const rawItem of raw.repositories) {
      if (!rawItem || typeof rawItem !== "object") throw new Error("Invalid repository item")
      const normalizedPath = this.normalizePath(rawItem.path)
      const key = this.canonicalKey(normalizedPath)
      if (keys.has(key)) continue
      keys.add(key)

      repositories.push({
        path: normalizedPath,
        alias: typeof rawItem.alias === "string" ? rawItem.alias.trim() : "",
        createdAt: this._normalizeTimestamp(rawItem.createdAt),
        lastOpenedAt: this._normalizeTimestamp(rawItem.lastOpenedAt),
      })
    }

    return {
      version: DATA_VERSION,
      preferences: { sortBy },
      repositories,
    }
  }

  _normalizeTimestamp = value => {
    const date = new Date(value)
    if (!value || Number.isNaN(date.getTime())) throw new Error(`Invalid timestamp: ${value}`)
    return date.toISOString()
  }

  _defaultData = () => ({
    version: DATA_VERSION,
    preferences: { sortBy: "recent" },
    repositories: [],
  })

  _nowISOString = () => {
    const value = this.now()
    const date = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(date.getTime())) throw new Error("now() returned an invalid date")
    return date.toISOString()
  }

  _backupCorruptFile = async () => {
    const suffix = this._nowISOString().replace(/[:.]/g, "-")
    const backupPath = `${this.filePath}.corrupt-${suffix}.json`
    await fs.promises.copyFile(this.filePath, backupPath)
    return backupPath
  }

  _writeUnlocked = async data => {
    await fs.promises.mkdir(path.dirname(this.filePath), { recursive: true })
    const tempPath = `${this.filePath}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`
    const content = `${JSON.stringify(data, null, 2)}\n`
    try {
      await fs.promises.writeFile(tempPath, content, "utf8")
      await fs.promises.rename(tempPath, this.filePath)
    } finally {
      await removeFile(tempPath).catch(() => undefined)
    }
  }

  _withLock = async action => {
    await fs.promises.mkdir(path.dirname(this.filePath), { recursive: true })
    const startedAt = Date.now()
    let handle

    while (!handle) {
      try {
        handle = await fs.promises.open(this.lockPath, "wx")
        try {
          await handle.writeFile(JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() }))
        } catch (error) {
          await handle.close().catch(() => undefined)
          handle = null
          await removeFile(this.lockPath).catch(() => undefined)
          throw error
        }
      } catch (error) {
        if (error.code !== "EEXIST") throw error
        await this._removeStaleLock()
        if (Date.now() - startedAt >= this.lockTimeoutMs) {
          throw new Error(`Timed out waiting for repository lock: ${this.lockPath}`)
        }
        await new Promise(resolve => setTimeout(resolve, this.retryDelayMs))
      }
    }

    try {
      return await action()
    } finally {
      await handle.close().catch(() => undefined)
      await removeFile(this.lockPath).catch(() => undefined)
    }
  }

  _removeStaleLock = async () => {
    try {
      const stat = await fs.promises.stat(this.lockPath)
      if (Date.now() - stat.mtimeMs > this.staleLockMs) {
        await removeFile(this.lockPath)
      }
    } catch (error) {
      if (error.code !== "ENOENT") throw error
    }
  }
}

module.exports = {
  DATA_VERSION,
  RepositoryStore,
  UnsupportedRepositoryVersionError,
}
