class FileRulesPlugin extends BasePlugin {
  rule = null
  imageExtensions = new Set([
    "jpg", "jpeg", "png", "gif", "svg", "webp", "bmp", "tiff", "ico", "jfif",
  ])

  prepare = () => {
    const { COPY_TO_ASSETS, USE_RELATIVE_PATH, ESCAPE_URL, TARGET_FOLDER } = this.config

    const hasRule = COPY_TO_ASSETS || USE_RELATIVE_PATH || ESCAPE_URL
    if (hasRule) {
      this.rule = {
        copy_to_assets: COPY_TO_ASSETS,
        use_relative_path: USE_RELATIVE_PATH,
        escape_url: ESCAPE_URL,
        target_folder: TARGET_FOLDER,
      }
    }

    if (!this.rule) {
      return this.utils.PLUGIN_LOAD_ABORT
    }
  }

  process = () => {
    this.utils.entities.eWrite.addEventListener("paste", this._handlePaste, { capture: true })
    this.utils.entities.eWrite.addEventListener("drop", this._handleDrop, { capture: true })
  }

  _handlePaste = (ev) => {
    const files = ev.clipboardData?.files
    if (!files || files.length === 0) return
    this._processFiles(files, ev).catch(e => console.error("[file_rules] paste error:", e))
  }

  _handleDrop = (ev) => {
    const files = ev.dataTransfer?.files
    if (!files || files.length === 0) return
    this._processFiles(files, ev).catch(e => console.error("[file_rules] drop error:", e))
  }

  _processFiles = async (fileList, ev) => {
    if (!this.rule || fileList.length === 0) return

    // Immediately prevent default to stop Typora's built-in handler
    ev.preventDefault()
    ev.stopPropagation()

    const markdownParts = []
    let successCount = 0
    let targetFolder = ""
    for (const file of fileList) {
      try {
        const result = await this._processFile(file)
        if (result) {
          markdownParts.push(result.markdown)
          successCount++
          if (!targetFolder && result.targetFolder) {
            targetFolder = result.targetFolder
          }
        }
      } catch (e) {
        console.error("[file_rules]", e)
        this.utils.notification.show(
          this.i18n.t("notify.copyFailed", { error: e.message }),
          "error",
        )
      }
    }

    if (successCount > 0 && targetFolder) {
      const { Path } = this.utils.Package
      const folderName = Path.basename(targetFolder)
      this.utils.notification.show(
        this.i18n.t("notify.copySuccessBatch", { count: successCount, folder: folderName }),
        "success",
      )
    }

    if (markdownParts.length > 0) {
      this.utils.insertText(null, markdownParts.join("\n\n"))
    }
  }

  _processFile = async (file) => {
    const filePath = this.utils.getFilePath()
    if (!filePath) {
      this.utils.notification.show(this.i18n.t("notify.noFile"), "warning")
      return null
    }

    const currentDir = this.utils.getCurrentDirPath()
    const fileName = this.utils.getFileName(filePath, true)
    const rule = this.rule
    const targetDir = this._resolveTargetFolder(rule, currentDir, fileName)

    const { FsExtra, Path } = this.utils.Package

    let destPath
    if (rule.copy_to_assets) {
      await FsExtra.ensureDir(targetDir)
      const ext = this._getExtension(file)
      const originalName = file.name || `file-${this._timestamp()}.${ext}`
      destPath = await this._copyFile(file, targetDir, originalName, FsExtra, Path)
      if (!destPath) return null
    } else {
      destPath = file.path
      if (!destPath) {
        console.error("[file_rules] Cannot use original file: file.path is not available")
        throw new Error(this.i18n.t("notify.noOriginalPath"))
      }
    }

    let finalPath
    if (rule.use_relative_path) {
      finalPath = Path.relative(currentDir, destPath)
      finalPath = finalPath.replace(/\\/g, "/")
    } else {
      finalPath = destPath
    }

    if (rule.escape_url) {
      finalPath = this._escapeUrl(finalPath)
    }

    const ext = this._getExtension(file)
    const isImage = this.imageExtensions.has(ext.toLowerCase())
    const displayName = Path.basename(destPath, Path.extname(destPath))
    const markdown = this._generateMarkdown(finalPath, displayName, isImage)

    return {
      markdown,
      targetFolder: rule.copy_to_assets ? targetDir : null,
    }
  }

  _resolveTargetFolder = (rule, currentDir, fileName) => {
    const { Path } = this.utils.Package
    if (rule.target_folder) {
      return Path.resolve(currentDir, rule.target_folder)
    }
    return Path.resolve(currentDir, `${fileName}.assets`)
  }

  _copyFile = async (file, targetDir, originalName, FsExtra, Path) => {
    let destName = Path.basename(originalName)
    if (destName.includes("/") || destName.includes("\\") || destName === "..") {
      console.error("[file_rules] Path traversal attempt blocked:", originalName)
      throw new Error(this.i18n.t("notify.pathTraversal"))
    }

    let destPath = Path.join(targetDir, destName)

    if (file.path && Path.resolve(file.path) === Path.resolve(destPath)) {
      return destPath
    }

    let counter = 1
    const maxAttempts = 100
    while (await this.utils.existPath(destPath)) {
      if (counter >= maxAttempts) {
        throw new Error(
          this.i18n.t("notify.fileNameCollision", { name: destName })
        )
      }
      const ext = Path.extname(destName)
      const base = Path.basename(destName, ext)
      destName = `${base}-${counter}${ext}`
      destPath = Path.join(targetDir, destName)
      counter++
    }

    const resolvedPath = Path.resolve(targetDir, destName)
    const resolvedTarget = Path.resolve(targetDir) + Path.sep
    if (resolvedPath !== Path.resolve(targetDir) && !resolvedPath.startsWith(resolvedTarget)) {
      console.error("[file_rules] Path traversal blocked after resolution:", resolvedPath)
      throw new Error(this.i18n.t("notify.pathTraversal"))
    }

    if (file.path) {
      await FsExtra.copy(file.path, destPath)
    } else {
      const buffer = Buffer.from(await file.arrayBuffer())
      await FsExtra.writeFile(destPath, buffer)
    }

    return destPath
  }

  _getExtension = (file) => {
    if (file.name) {
      const idx = file.name.lastIndexOf(".")
      if (idx !== -1) return file.name.substring(idx + 1)
    }
    if (file.type) {
      const subtype = file.type.split("/")[1]
      if (subtype) return subtype
    }
    return ""
  }

  _escapeUrl = (path) => {
    return path
      .split("/")
      .map(segment => encodeURIComponent(segment))
      .join("/")
  }

  _generateMarkdown = (relativePath, displayName, isImage) => {
    const prefix = isImage ? "!" : ""
    const safeName = displayName.replace(/[\[\]()]/g, "\\$&")
    return `${prefix}[${safeName}](${relativePath})`
  }

  _timestamp = () => {
    const now = new Date()
    const pad = n => String(n).padStart(2, "0")
    return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  }
}

module.exports = {
  plugin: FileRulesPlugin,
}
