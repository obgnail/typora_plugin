class FileRulesPlugin extends BasePlugin {
  imageExtensions = new Set([
    "jpg", "jpeg", "png", "gif", "svg", "webp", "bmp", "tiff", "ico", "jfif",
  ])

  prepare = () => {
    if (!this.config.COPY_TO_ASSETS) {
      return this.utils.PLUGIN_LOAD_ABORT
    }
  }

  process = () => {
    // Images: leverage Typora's native defaultImageStorage mechanism.
    // Override the target folder so Typora handles copying & markdown insertion.
    const getImgEdit = () => File?.editor?.imgEdit
    this.utils.decorator.modifyReturn(getImgEdit, "getTargetImageStorageFolderFromSetting", (original) => {
      return this._getTargetFolder() || original
    })
    this.utils.decorator.modifyReturn(getImgEdit, "getTargetImageStorageFolder", (original) => {
      return this._getTargetFolder() || original
    })

    // Non-image files (pdf, exe, msi, etc.): Typora has no native storage
    // for these, so we handle paste/drop ourselves with the same folder rules.
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
    const files = Array.from(fileList)
    // If event contains ONLY images, let Typora handle them natively (decorator applies)
    const hasNonImage = files.some(f => !this._isImage(f))
    if (!hasNonImage) return

    // Resolve targetFolder BEFORE preventDefault — if we can't determine a
    // folder (e.g. upload/ipic mode), bail out and let Typora handle the event.
    const targetFolder = this._getTargetFolder()
    if (!targetFolder) return

    // When non-image files are present, we handle ALL files in the event.
    // preventDefault is necessary for non-images, but it also blocks Typora's
    // image handler — so we process images here too to avoid silent data loss.
    ev.preventDefault()
    ev.stopPropagation()

    const filePath = this.utils.getFilePath()
    if (!filePath) {
      this.utils.notification.show(this.i18n.t("notify.noFile"), "warning")
      return
    }

    const markdownParts = []
    let successCount = 0

    const { FsExtra, Path } = this.utils.Package
    await FsExtra.ensureDir(targetFolder)
    const currentDir = this.utils.getCurrentDirPath()

    for (const file of files) {
      try {
        const sourcePath = this._getFilePath(file)
        const isImage = this._isImage(file)

        const destPath = await this._copyFile(file, targetFolder, sourcePath, FsExtra, Path)
        let finalPath = File.option.useRelativePathForImg
          ? Path.relative(currentDir, destPath).replace(/\\/g, "/")
          : destPath
        if (File.option.autoEscapeImageURL) {
          finalPath = this._escapeUrl(finalPath)
        }

        const displayName = Path.basename(destPath, Path.extname(destPath))
        markdownParts.push(this._generateMarkdown(finalPath, displayName, isImage))
        successCount++
      } catch (e) {
        console.error("[file_rules]", e)
        this.utils.notification.show(
          this.i18n.t("notify.copyFailed", { error: e.message }),
          "error",
        )
      }
    }

    if (successCount > 0) {
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

  _isImage = (file) => {
    if (file.type && file.type.startsWith("image/")) return true
    const ext = this._getExtension(file).toLowerCase()
    return this.imageExtensions.has(ext)
  }

  _getFilePath = (file) => {
    if (file.path) return file.path
    try {
      const { webUtils } = reqnode("electron")
      const p = webUtils?.getPathForFile?.(file)
      if (p) return p
    } catch (_) {}
    return null
  }

  _copyFile = async (file, targetDir, sourcePath, FsExtra, Path) => {
    let destName = Path.basename(file.name || (sourcePath ? Path.basename(sourcePath) : `file-${Date.now()}`))

    let destPath = Path.join(targetDir, destName)
    if (sourcePath && Path.resolve(sourcePath) === Path.resolve(destPath)) {
      return destPath
    }

    let counter = 1
    while (await this.utils.existPath(destPath)) {
      if (counter >= 100) {
        throw new Error(this.i18n.t("notify.fileNameCollision", { name: destName }))
      }
      const ext = Path.extname(destName)
      const base = Path.basename(destName, ext)
      destName = `${base}-${counter}${ext}`
      destPath = Path.join(targetDir, destName)
      counter++
    }

    // Path traversal guard
    const resolved = Path.resolve(destPath)
    const resolvedTarget = Path.resolve(targetDir) + Path.sep
    if (resolved !== Path.resolve(targetDir) && !resolved.startsWith(resolvedTarget)) {
      throw new Error(this.i18n.t("notify.pathTraversal"))
    }

    if (sourcePath) {
      await FsExtra.copy(sourcePath, destPath)
    } else {
      const buffer = Buffer.from(await file.arrayBuffer())
      await FsExtra.writeFile(destPath, buffer)
    }
    return destPath
  }

  _getTargetFolder = () => {
    const filePath = this.utils.getFilePath()
    if (!filePath) return null

    const { Path } = this.utils.Package
    const currentDir = this.utils.getCurrentDirPath()
    const fileName = this.utils.getFileName(filePath, true)

    // Read Typora's native defaultImageStorage setting directly.
    // We CANNOT call getTargetImageStorageFolder() here — it's been decorated
    // by this plugin and would cause infinite recursion.
    const storage = File?.option?.defaultImageStorage
    if (!storage || storage === "upload" || storage === "ipic") {
      return null  // Let decorator fall through to original Typora behavior
    }

    if (storage === "folder") {
      return Path.normalize(currentDir.replace(/[\\/]$/, ""))
    }
    if (storage === "assert") {
      return Path.resolve(currentDir, "assets")
    }
    if (storage === "per-file-assert") {
      return Path.resolve(currentDir, `${fileName}.assets`)
    }
    // Custom path (may contain ${filename} placeholder)
    return Path.resolve(currentDir, storage.replace(/\${filename}/g, fileName))
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

  _generateMarkdown = (finalPath, displayName, isImage) => {
    const prefix = isImage ? "!" : ""
    const safeName = displayName.replace(/[\[\]()]/g, "\\$&")
    return `${prefix}[${safeName}](${finalPath})`
  }
}

module.exports = {
  plugin: FileRulesPlugin,
}
