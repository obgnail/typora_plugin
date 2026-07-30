class UpdaterPlugin extends BasePlugin {
  hotkey = () => [{ hotkey: this.config.HOTKEY, callback: this.call }]

  process = () => {
    if (!this.config.AUTO_UPDATE) return
    const start = Math.min(this.config.START_UPDATE_INTERVAL, 1000 * 60)
    const loop = Math.min(this.config.UPDATE_LOOP_INTERVAL, 1000 * 60 * 60)
    if (start > 0) setTimeout(this.silentUpdate, start)
    if (loop > 0) setInterval(this.silentUpdate, loop)
  }

  call = async (action, meta) => {
    if (this.config.PROXY) {
      await this.manualUpdate()
      return
    }
    const { response, data } = await this.utils.formDialog.modal({
      title: this.pluginName,
      schema: ({ Controls }) => [
        Controls.Hint().HintHeader(this.i18n.t("hintHeader.PROXY")).HintDetail(this.i18n.t("hintDetail.PROXY")),
        Controls.Text("proxy").Label(this.i18n.t("$label.PROXY")).Placeholder("http://127.0.0.1:7890"),
      ],
      data: { proxy: await this.getProxy() },
    })
    if (response === 1) {
      await this.manualUpdate(data.proxy)
    }
  }

  silentUpdate = async proxy => {
    console.log("Start silent update...")
    const updater = await this.getUpdater(proxy)
    await updater.run()
  }

  manualUpdate = async proxy => {
    const timeout = Math.max(this.config.NETWORK_REQUEST_TIMEOUT, 30 * 1000)
    const I18N = {
      pleaseWait: this.i18n.t("update.pleaseWait"),
      success: this.i18n.t("update.success"),
      noNeed: this.i18n.t("update.noNeed"),
      failed: this.i18n.t("update.failed"),
      unknownError: this.i18n.t("error.unknown"),
    }

    const close = this.utils.notification.show(I18N.pleaseWait)
    const updater = await this.getUpdater(proxy, timeout)
    const { state, info } = await updater.runWithProgressBar()
    close()

    let msg, msgType, detail
    if (state === "UPDATED") {
      msg = I18N.success
      msgType = "success"
      detail = JSON.stringify(info, null, "  ")
    } else if (state === "NO_NEED") {
      msg = I18N.noNeed
      msgType = "success"
      detail = JSON.stringify(info, null, "  ")
    } else if (state instanceof Error) {
      msg = I18N.failed
      msgType = "error"
      detail = state.stack
    } else {
      msg = I18N.failed
      msgType = "error"
      detail = I18N.unknownError
    }
    this.utils.notification.show(msg, msgType, 10000)
    await this.utils.formDialog.modal({
      title: this.pluginName,
      schema: ({ Controls }) => [Controls.Code("detail")],
      data: { detail },
    })
  }

  getProxy = async (userProxy) => {
    let proxy = (userProxy || this.config.PROXY || await getSysProxy() || "").trim()
    if (proxy && !/^https?:\/\//i.test(proxy)) {
      proxy = "http://" + proxy
    }
    return proxy
  }

  getUpdater = async (userProxy, timeout) => {
    const url = "https://api.github.com/repos/obgnail/typora_plugin/releases/latest"
    const proxy = await this.getProxy(userProxy)
    return new Updater(this.utils, url, proxy, timeout)
  }
}

class Updater {
  latestVersionInfo = null
  currentVersionInfo = null
  relpaths = {
    rootDir: "./plugin",
  }
  userFiles = [
    "./plugin/global/user_space",
    "./plugin/global/user_styles",
    "./plugin/global/settings/settings.user.toml",
  ]

  constructor(utils, latestReleaseUrl, proxy, timeout) {
    this.utils = utils
    this.latestReleaseUrl = latestReleaseUrl
    this.requestOption = { proxy, timeout }

    this.fs = this.utils.Package.FsExtra
    this.path = this.utils.Package.Path

    this.paths = {
      stagingDir: "",
      versionFile: this.utils.joinPluginPath("./plugin/bin/version.json"),
      workDir: this.path.join(this.utils.tempFolder, "typora-plugin-updater"),
      backupDir: this.path.join(this.utils.tempFolder, "typora-plugin-updater-backup"),
    }
  }

  async run() {
    try {
      const state = await this._performUpdate()
      if (state === "NO_NEED") return "NO_NEED"
      console.log(`Updated successfully! Version: ${this.latestVersionInfo.tag_name}`)
      return "UPDATED"
    } catch (error) {
      console.error("Update failed:", error)
      return error
    } finally {
      await this.cleanup()
    }
  }

  async force(url) {
    try {
      await this._performUpdate({ url, force: true })
      console.log(`Force updated successfully!`)
      return "UPDATED"
    } catch (error) {
      console.error("Force update failed:", error)
      throw error
    } finally {
      await this.cleanup()
    }
  }

  async _performUpdate(options = {}) {
    const { url, force = false } = options
    await this.prepare()
    if (!force) {
      const need = await this.checkNeedUpdate(url)
      if (!need) return "NO_NEED"
    }
    const buffer = await this.downloadLatestVersion(url)
    await this.unzip(buffer)
    await this.migrateUserFiles()
    await this.atomicSync()
    await this.utils.migrate.run()
    return "UPDATED"
  }

  async runWithProgressBar() {
    const result = await this.utils.runWithFakeProgressBar(() => this.run(), this.requestOption.timeout)
    return { state: result, info: this.latestVersionInfo }
  }

  async prepare() {
    console.log("[1/6] Prepare: cleaning workspace")
    await Promise.all([this.fs.emptyDir(this.paths.workDir), this.fs.remove(this.paths.backupDir)])
    await this.chmod(this.utils.joinPluginPath(this.relpaths.rootDir))
  }

  async cleanup() {
    try {
      await this.fs.remove(this.paths.workDir)
      await this.fs.remove(this.paths.backupDir)
    } catch (e) {
      console.warn("Cleanup warning:", e.message)
    }
  }

  async chmod(dir) {
    try {
      await this.fs.chmod(dir, 0o777)
    } catch (e) {
      console.debug(`Cannot chmod ${dir}:`, e.message)
    }
  }

  async checkNeedUpdate(url = this.latestReleaseUrl) {
    console.log("[2/6] Checking for updates...")
    const [latest, current] = await Promise.all([this._fetchJson(url), this._readLocalVersion()])
    this.latestVersionInfo = latest
    this.currentVersionInfo = current
    if (!latest) throw new Error("Fetch latest version failed")
    if (!current) return true
    return this.utils.compareVersion(latest.tag_name, current.tag_name) !== 0
  }

  async _fetchJson(url) {
    try {
      const resp = await this.utils.fetch(url, this.requestOption)
      return resp.json()
    } catch (e) {
      console.error("Fetch version failed:", e)
      return null
    }
  }

  async _readLocalVersion() {
    return this.fs.readJson(this.paths.versionFile).catch(() => null)
  }

  getDownloadURL() {
    if (!this.latestVersionInfo) return null
    return this.latestVersionInfo.assets?.[0]?.browser_download_url || this.latestVersionInfo.zipball_url
  }

  async downloadLatestVersion(url) {
    const downloadUrl = url || this.getDownloadURL()
    if (!downloadUrl) throw new Error("No download URL found")
    console.log(`[3/6] Downloading: ${downloadUrl}`)
    const resp = await this.utils.fetch(downloadUrl, this.requestOption)
    if (!resp.ok) throw new Error(`Download failed: HTTP ${resp.status}`)
    return resp.buffer()
  }

  async unzip(buffer) {
    console.log("[4/6] Unzipping...")
    const targetDirName = this.path.basename(this.relpaths.rootDir)
    const zipFiles = await this.utils.unzip(buffer, this.paths.workDir)
    const pluginDir = zipFiles.find(f => this.path.basename(f) === targetDirName)
    if (!pluginDir) throw new Error(`Invalid zip structure: '${targetDirName}' folder not found`)
    this.paths.stagingDir = this.path.dirname(pluginDir)
  }

  async migrateUserFiles() {
    console.log("[5/6] Migrating user files...")
    const filesToMigrate = new Set(this.userFiles)
    const oldPluginDir = this.utils.joinPluginPath(this.relpaths.rootDir)
    const newPluginDir = this.path.join(this.paths.stagingDir, this.relpaths.rootDir)
    const normalizeName = (dirent) => {
      const name = dirent.name
      return (dirent.isFile() && this.path.extname(name) === ".js")
        ? this.path.basename(name, ".js")
        : name
    }
    if (await this.utils.existPath(oldPluginDir) && await this.utils.existPath(newPluginDir)) {
      const [oldDirents, newDirents] = await Promise.all([
        this.fs.readdir(oldPluginDir, { withFileTypes: true }),
        this.fs.readdir(newPluginDir, { withFileTypes: true }),
      ])
      const newPluginKeys = new Set(newDirents.map(normalizeName))
      for (const oldEnt of oldDirents) {
        const oldPluginKey = normalizeName(oldEnt)
        if (!newPluginKeys.has(oldPluginKey)) {
          const relPath = this.path.join(this.relpaths.rootDir, oldEnt.name)
          filesToMigrate.add(relPath)
        }
      }
    }
    await Promise.all(Array.from(filesToMigrate).map(async relPath => {
      const oldPath = this.utils.joinPluginPath(relPath)
      const newPath = this.path.join(this.paths.stagingDir, relPath)
      if (await this.utils.existPath(oldPath)) {
        await this.fs.copy(oldPath, newPath, { overwrite: true })
      }
    }))
  }

  async atomicSync() {
    console.log("[6/6] Syncing directories (Atomic Mode)...")
    const src = this.path.join(this.paths.stagingDir, this.relpaths.rootDir)
    const dst = this.utils.joinPluginPath(this.relpaths.rootDir)
    const backup = this.paths.backupDir
    if (this.latestVersionInfo) {
      await this.fs.outputJson(this.path.join(src, "bin/version.json"), this.latestVersionInfo)
    }
    if (!(await this.utils.existPath(dst))) {
      throw new Error("Target plugin directory does not exist")
    }

    const moveContent = async (fromDir, toDir) => {
      await this.fs.ensureDir(toDir)
      const items = await this.fs.readdir(fromDir)
      for (const item of items) {
        const srcPath = this.path.join(fromDir, item)
        const destPath = this.path.join(toDir, item)
        await this.fs.move(srcPath, destPath, { overwrite: true })
      }
    }

    await this.fs.emptyDir(backup)
    try {
      await moveContent(dst, backup)
    } catch (err) {
      console.error("Backup failed", err)
      try {
        await moveContent(backup, dst)
      } catch (restoreErr) {
        console.error("Failed to restore partial backup", restoreErr)
      }
      throw err
    }

    try {
      await this.fs.copy(src, dst, { overwrite: true, preserveTimestamps: true })
    } catch (error) {
      console.error("Critical Error during sync! Rolling back...", error)
      try {
        await this.fs.emptyDir(dst)
        await moveContent(backup, dst)
        console.log("Rollback successful.")
      } catch (rollbackError) {
        console.error("FATAL: Rollback failed!", rollbackError)
        throw rollbackError
      }
      throw error
    }
  }
}

const getSysProxy = () => {
  const env = process.env
  const envProxy = env.http_proxy || env.HTTP_PROXY || env.https_proxy || env.HTTPS_PROXY
  if (envProxy) return envProxy
  if (File.isLinux) {
    return new Promise(resolve => {
      require("fs").readFile("/etc/environment", "utf8", (err, data) => {
        const result = err ? null : data.match(/http_proxy=(.+)/i)?.[1]
        resolve(result || null)
      })
    })
  }
  const _get = (cmd, func) => new Promise(resolve => {
    require("child_process").exec(cmd, (err, stdout, stderr) => {
      const result = (err || stderr) ? null : func(stdout)
      resolve(result)
    })
  })
  if (File.isWin) {
    return _get(
      `reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" | findstr /i "ProxyEnable proxyserver"`,
      stdout => {
        const groups = stdout.match(/ProxyEnable.+?0x(?<enable>\d)\r\n.+?ProxyServer\s+REG_SZ\s+(?<proxy>.*)/i)?.groups
        return (groups?.enable === "1") ? groups.proxy : null
      },
    )
  }
  if (File.isMac) {
    return _get(`networksetup -getwebproxy "Wi-Fi"`, stdout => {
      const [_, enable, server, port] = stdout.match(/Enabled: (.+)\nServer: (.+)\nPort: (.+)\n/i) || []
      return (enable === "Yes" && server && port) ? `${server}:${port}` : null
    })
  }
  return null
}

module.exports = {
  plugin: UpdaterPlugin,
  Updater,
}
