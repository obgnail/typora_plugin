class AssetsStoragePlugin extends BasePlugin {
  imageExtensions = new Set([
    "jpg", "jpeg", "png", "gif", "svg", "webp", "bmp", "tiff", "ico", "jfif",
  ])

  process = () => {
    this.utils.entities.eWrite.addEventListener("paste", this._handlePaste, { capture: true })
    this.utils.entities.eWrite.addEventListener("drop", this._handleDrop, { capture: true })
  }

  _handlePaste = (ev) => {
    const files = ev.clipboardData?.files
    if (!files || files.length === 0) return
    this._processFiles(files, ev).catch(e => console.error("[assets_storage] paste error:", e))
  }

  _handleDrop = (ev) => {
    const files = ev.dataTransfer?.files
    if (!files || files.length === 0) return
    this._processFiles(files, ev).catch(e => console.error("[assets_storage] drop error:", e))
  }

  _processFiles = async (fileList, ev) => {
    const files = Array.from(fileList)

    // Resolve targetFolder BEFORE preventDefault — if we can't determine a
    // folder (e.g. upload/ipic mode), bail out and let Typora handle the event.
    const targetFolder = this._getTargetFolder()
    if (!targetFolder) return

    ev.preventDefault()
    ev.stopPropagation()

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
        console.error("[assets_storage]", e)
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
    if (file.name) {
      const idx = file.name.lastIndexOf(".")
      if (idx !== -1) {
        return this.imageExtensions.has(file.name.substring(idx + 1).toLowerCase())
      }
    }
    if (file.type) {
      const subtype = file.type.split("/")[1]
      if (subtype) return this.imageExtensions.has(subtype.toLowerCase())
    }
    return false
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
    const storage = File?.option?.defaultImageStorage
    if (!storage || storage === "upload" || storage === "ipic") {
      return null
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
  plugin: AssetsStoragePlugin,
}
