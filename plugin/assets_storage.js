class AssetsStoragePlugin extends BasePlugin {
  static IMAGE_EXTENSIONS = new Set([
    "jpg", "jpeg", "png", "gif", "svg", "webp", "bmp", "tiff", "ico", "jfif",
  ])
  static MAX_NAME_COLLISION = 100

  process = () => {
    this.utils.entities.eWrite.addEventListener("paste", this._onPaste, { capture: true })
    this.utils.entities.eWrite.addEventListener("drop", this._onDrop, { capture: true })
  }

  _onPaste = (ev) => this._tryHandle(ev, ev.clipboardData?.files)
  _onDrop = (ev) => this._tryHandle(ev, ev.dataTransfer?.files)

  _tryHandle = (ev, fileList) => {
    if (!fileList || fileList.length === 0) return

    const all = Array.from(fileList)
    const files = all.filter(f => !this._isImage(f))
    if (files.length === 0) return

    // Reject mixed image + non-image batches. preventDefault would silently
    // swallow Typora's native image handling for the images in the same event,
    // and only processing the non-images would leave images on the floor. Tell
    // the user to split the batch.
    if (files.length !== all.length) {
      ev.preventDefault()
      ev.stopPropagation()
      this.utils.notification.show(this.i18n.t("notify.mixedNotSupported"), "warning")
      return
    }

    // Resolve targetFolder BEFORE preventDefault — if we can't determine a
    // folder (e.g. upload/ipic mode), bail out and let Typora handle the event.
    const targetFolder = this._getTargetFolder()
    if (!targetFolder) return

    ev.preventDefault()
    ev.stopPropagation()
    this._processFiles(files, targetFolder).catch(e =>
      console.error("[assets_storage] processing failed:", e),
    )
  }

  _processFiles = async (files, targetFolder) => {
    const { FsExtra, Path } = this.utils.Package
    await FsExtra.ensureDir(targetFolder)

    const parts = []
    let successCount = 0
    for (const file of files) {
      try {
        const sourcePath = this._getSourcePath(file)
        const destPath = await this._copyFile(file, targetFolder, sourcePath)
        parts.push(this._buildMarkdownLink(destPath))
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
      this.utils.notification.show(
        this.i18n.t("notify.copySuccessBatch", {
          count: successCount,
          folder: Path.basename(targetFolder),
        }),
        "success",
      )
      this.utils.insertText(null, parts.join("\n\n"))
    }
  }

  _buildMarkdownLink = (destPath) => {
    const { Path } = this.utils.Package
    const link = this._formatPath(destPath)
    const display = Path.basename(destPath, Path.extname(destPath))
    return `[${display.replace(/[\[\]()]/g, "\\$&")}](${link})`
  }

  // Mirror Typora's image path rules:
  //   1. When the destination sits inside the document's directory tree, emit
  //      a path relative to the document with a leading "./" prefix. This
  //      matches what Typora does for images it copies into defaultImageStorage
  //      — always relative, always "./"-prefixed, regardless of the
  //      useRelativePathForImg toggle.
  //   2. Outside the doc tree, defer to File.option.useRelativePathForImg
  //      (the result will start with "..", so no "./" prefix is needed).
  //   3. Apply File.option.autoEscapeImageURL when Typora has it enabled.
  _formatPath = (absolutePath) => {
    const { Path } = this.utils.Package
    const currentDir = this.utils.getCurrentDirPath()

    let display = absolutePath
    if (currentDir) {
      const relative = Path.relative(currentDir, absolutePath)
      const insideDocTree = relative && !Path.isAbsolute(relative) && !relative.startsWith("..")
      if (insideDocTree) {
        display = "./" + relative
      } else if (File?.option?.useRelativePathForImg && relative) {
        display = relative
      }
    }

    let result = display.replace(/\\/g, "/")
    if (File?.option?.autoEscapeImageURL) {
      result = result.split("/").map(encodeURIComponent).join("/")
    }
    return result
  }

  _isImage = (file) => {
    if (file.type && file.type.startsWith("image/")) return true
    const name = file.name || ""
    const idx = name.lastIndexOf(".")
    return idx !== -1
      && AssetsStoragePlugin.IMAGE_EXTENSIONS.has(name.substring(idx + 1).toLowerCase())
  }

  _getSourcePath = (file) => {
    if (file.path) return file.path
    try {
      const { webUtils } = reqnode("electron")
      return webUtils?.getPathForFile?.(file) || null
    } catch (_) {
      return null
    }
  }

  _copyFile = async (file, targetDir, sourcePath) => {
    const { FsExtra, Path } = this.utils.Package
    let destName = Path.basename(
      file.name || (sourcePath ? Path.basename(sourcePath) : `file-${Date.now()}`),
    )
    let destPath = Path.join(targetDir, destName)

    if (sourcePath && Path.resolve(sourcePath) === Path.resolve(destPath)) {
      return destPath
    }

    let counter = 1
    while (await this.utils.existPath(destPath)) {
      if (counter >= AssetsStoragePlugin.MAX_NAME_COLLISION) {
        throw new Error(this.i18n.t("notify.fileNameCollision", { name: destName }))
      }
      const ext = Path.extname(destName)
      const base = Path.basename(destName, ext)
      destName = `${base}-${counter}${ext}`
      destPath = Path.join(targetDir, destName)
      counter++
    }

    // Path traversal guard
    const resolvedTarget = Path.resolve(targetDir)
    const resolvedDest = Path.resolve(destPath)
    if (resolvedDest !== resolvedTarget && !resolvedDest.startsWith(resolvedTarget + Path.sep)) {
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
    if (!storage || storage === "upload" || storage === "ipic") return null

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
}

module.exports = {
  plugin: AssetsStoragePlugin,
}
