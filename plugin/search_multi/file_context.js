const FsExtra = require("fs-extra")

class FileContext {
  _contentPromise = null
  _cache = Object.create(null)

  constructor(path, file, dir, stats) {
    this.path = path
    this.file = file
    this.dir = dir
    this.stats = stats
  }

  getContent() {
    if (!this._contentPromise) {
      this._contentPromise = FsExtra.readFile(this.path, "utf-8")
    }
    return this._contentPromise
  }

  compute(key, fn) {
    if (!(key in this._cache)) {
      this._cache[key] = fn(this)
    }
    return this._cache[key]
  }
}

module.exports = FileContext
