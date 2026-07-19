const path = require("path")

const DATA_VERSION = 1
const SORT_MODES = new Set(["recent", "name", "path"])

class UnsupportedRepositoryVersionError extends Error {
  constructor(version) {
    super(`Unsupported repository data version: ${version}`)
    this.name = "UnsupportedRepositoryVersionError"
    this.version = version
  }
}

class RepositoryStore {
  constructor({
    storage,
    platform = process.platform,
    now = () => new Date(),
  } = {}) {
    if (!storage || typeof storage.get !== "function" || typeof storage.set !== "function") {
      throw new Error("RepositoryStore requires a storage adapter")
    }

    this.storage = storage
    this.platform = platform
    this.now = now
  }

  load = async () => {
    const result = this._read()
    if (result.needsWrite) this._write(result.data)
    return result
  }

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

  _mutate = async mutator => {
    const result = this._read()
    const changed = mutator(result.data)
    if (changed || result.needsWrite) this._write(result.data)
    return { ...result, changed: Boolean(changed) }
  }

  _read = () => {
    let raw
    try {
      raw = this.storage.get()
    } catch (error) {
      return this._recoverCorruptData(error)
    }
    if (raw == null) return { data: this._defaultData(), warnings: [], needsWrite: true }

    try {
      const data = this._validateData(raw)
      return { data, warnings: [], needsWrite: false }
    } catch (error) {
      if (error instanceof UnsupportedRepositoryVersionError) throw error
      return this._recoverCorruptData(error)
    }
  }

  _recoverCorruptData = error => {
    this.storage.remove?.()
    return {
      data: this._defaultData(),
      warnings: [{ code: "CORRUPT_DATA_RECOVERED", error: error.message }],
      needsWrite: true,
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

  _write = data => this.storage.set(data)
}

module.exports = {
  DATA_VERSION,
  RepositoryStore,
  UnsupportedRepositoryVersionError,
}
