const TYPES = Object.freeze({
  consoleError: "CONSOLE_ERROR",
  unhandledPromise: "UNHANDLED_PROMISE",
  uncaughtException: "UNCAUGHT_EXCEPTION",
})

class Logger {
  maxSize = 5 * 1024 * 1024
  flushInterval = 3000
  maxBufferSize = 50
  buffer = []
  timer = null
  logDirPath = null
  logFilePath = null
  originConsoleError = null
  isFlushing = false
  isStarted = false

  constructor(utils) {
    this.utils = utils
  }

  process() {
    this.logDirPath = this.utils.Package.Path.join(this.utils.tempFolder, "typora-plugin-logs")
    this.logFilePath = this.utils.Package.Path.join(this.logDirPath, "errors.log")

    if (this.utils.getSetting("global", "LOGGING")) this.start()
  }

  start() {
    if (this.isStarted) return

    this.ensureDir()

    window.addEventListener("error", this._onWindowError)
    window.addEventListener("unhandledrejection", this._onPromiseRejection)

    this.originConsoleError = console.error
    console.error = (...args) => {
      this._write(TYPES.consoleError, ...args)
      this.originConsoleError.apply(console, args)
    }

    this.timer = setInterval(() => this._flush(), this.flushInterval)

    this.isStarted = true
  }

  stop() {
    if (!this.isStarted) return

    window.removeEventListener("error", this._onWindowError)
    window.removeEventListener("unhandledrejection", this._onPromiseRejection)

    if (this.originConsoleError) {
      console.error = this.originConsoleError
      this.originConsoleError = null
    }
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }

    this._flush(true)

    this.isStarted = false
  }

  ensureDir = () => this.utils.Package.FsExtra.ensureDirSync(this.logDirPath)
  showInFinder = () => this.utils.showInFinder(this.logDirPath)

  _onWindowError = (ev) => this._write(TYPES.uncaughtException, ev.error || `${ev.message} at ${ev.filename}:${ev.lineno}`)
  _onPromiseRejection = (ev) => this._write(TYPES.unhandledPromise, ev.reason)

  _write(type, ...args) {
    const logLine = `[${new Date().toISOString()}] [${type}] ${this.utils.Package.Util.format(...args)}\n`
    this.buffer.push(logLine)
    if (type === TYPES.uncaughtException || type === TYPES.unhandledPromise) {
      this._flush(true)
    } else if (this.buffer.length >= this.maxBufferSize) {
      this._flush()
    }
  }

  async _flush(forceSync = false) {
    if (this.buffer.length === 0) return
    if (this.isFlushing && !forceSync) return

    const logsToWrite = this.buffer.join("")
    this.buffer = []

    this._rotateLogIfNeeded()

    const fs = this.utils.Package.FsExtra
    try {
      if (forceSync) {
        fs.appendFileSync(this.logFilePath, logsToWrite, "utf8")
      } else {
        this.isFlushing = true
        await fs.appendFile(this.logFilePath, logsToWrite, "utf8")
      }
    } catch (err) {
      this.originConsoleError?.("[Logger] Flush failed:", err)
    } finally {
      if (!forceSync) this.isFlushing = false
    }
  }

  _rotateLogIfNeeded() {
    const fs = this.utils.Package.FsExtra
    try {
      if (fs.existsSync(this.logFilePath)) {
        const stats = fs.statSync(this.logFilePath)
        if (stats.size > this.maxSize) {
          const oldFilePath = this.utils.Package.Path.join(this.logDirPath, "errors.old.log")
          fs.moveSync(this.logFilePath, oldFilePath, { overwrite: true })
        }
      }
    } catch (err) {
      this.originConsoleError?.("[Logger] Rotate failed:", err)
    }
  }
}

module.exports = Logger

