const buildResourceScanner = ({ utils, config, i18n }) => {
  const { Package, isNetworkImage, isSpecialImage } = utils

  // This regular expression is from `File.editor.brush.inline.rules.image`
  // Typora simplifies the image syntax from a context-free grammar to a regular grammar
  const MD_IMG_REGEX = /(\!\[((?:\[[^\]]*\]|[^\[\]])*)\]\()(<?((?:\([^)]*\)|[^()])*?)>?[ \t]*((['"])((?:.|\n)*?)\6[ \t]*)?)(\)(?:\s*{([^{}\(\)]*)})?)/g
  const HTML_IMG_REGEX = /<img\s+[^>\n]*?src=(["'])([^"'\n]+)\1[^>\n]*>/gi
  const extractImages = (text) => {
    const findHtml = config.RESOURCE_GRAMMARS.includes("html")
    const findMd = config.RESOURCE_GRAMMARS.includes("markdown")
    const htmlImages = findHtml ? [...text.matchAll(HTML_IMG_REGEX)].map(m => m[2]) : []
    const mdImages = findMd ? [...text.matchAll(MD_IMG_REGEX)].map(m => m[4]) : []
    return [...htmlImages, ...mdImages]
  }

  const processMarkdownFile = async (mdPath, mdDir, redirectPlugin) => {
    const md = await Package.FsExtra.readFile(mdPath, "utf-8")
    const images = extractImages(md)
      .map(img => {
        try {
          img = img.replace(/^\s*<\s*/, "").replace(/\s*>\s*$/, "")
          img = decodeURIComponent(img).split("?")[0]
          return img.replace(/^\s*([\\/])/, "")
        } catch (e) {
          console.warn(`[ResourceManager] Error parsing image path: ${img}`, e)
          return null
        }
      })
      .filter(img =>
        img &&
        !isNetworkImage(img) &&
        !isSpecialImage(img) &&
        config.RESOURCE_EXT.includes(Package.Path.extname(img).toLowerCase()),
      )
    if (images.length === 0) return []

    const root = redirectPlugin?.getRootURL(md, mdPath, mdDir) ?? mdDir
    return images.map(img => Package.Path.resolve(root, img))
  }

  const scan = async (dir) => {
    dir = dir || utils.getMountFolder()
    const redirectPlugin = utils.getPlugin("asset_root_redirect")
    const resources = { inFolder: new Set(), inFile: new Set() }
    const resourceExts = new Set(config.RESOURCE_EXT)
    const markdownExts = new Set(config.MARKDOWN_EXT)
    await utils.walkDir({
      dir,
      semaphore: config.CONCURRENCY_LIMIT,
      maxEntities: config.MAX_ENTITIES,
      maxDepth: config.MAX_DEPTH,
      followSymlinks: config.FOLLOW_SYMBOLIC_LINKS,
      strategy: config.TRAVERSE_STRATEGY,
      signal: AbortSignal.timeout(config.TIMEOUT),
      dirFilter: name => !config.IGNORE_FOLDERS.includes(name),
      onFile: async ({ path, file, dir: fileDir }) => {
        const ext = Package.Path.extname(file).toLowerCase()
        if (resourceExts.has(ext)) {
          resources.inFolder.add(path)
        } else if (markdownExts.has(ext)) {
          const images = await processMarkdownFile(path, fileDir, redirectPlugin)
          images.forEach(img => resources.inFile.add(img))
        }
      },
      onFinished: (err) => {
        if (!err) return
        console.error("[ResourceManager] Scan failed:", err)
        const msg = err.name === "TimeoutError" ? i18n.t("error.timeout") : err.toString()
        utils.notification.show(msg, "error")
      },
    })

    return {
      notInFile: [...resources.inFolder].filter(x => !resources.inFile.has(x)),
      notInFolder: [...resources.inFile].filter(x => !resources.inFolder.has(x)),
    }
  }

  return { scan }
}

const buildExportEngine = ({ utils, i18n }) => {
  const exportReport = async (reportData, defaultDir) => {
    const serializers = {
      json: () => JSON.stringify(reportData, null, "  "),
      yaml: () => utils.stringifyYaml(reportData),
      toml: () => utils.stringifyToml(reportData),
    }
    const { canceled, filePath } = await JSBridge.invoke("dialog.showSaveDialog", {
      title: i18n.t("func.download"),
      defaultPath: utils.Package.Path.join(defaultDir, "resource-report.json"),
      properties: ["saveFile", "showOverwriteConfirmation"],
      filters: [
        { name: "All", extensions: ["json", "yaml", "toml"] },
        { name: "JSON", extensions: ["json"] },
        { name: "YAML", extensions: ["yaml"] },
        { name: "TOML", extensions: ["toml"] },
      ],
    })
    if (canceled) return
    const format = utils.Package.Path.extname(filePath).toLowerCase().replace(/^\./, "")
    const serializeFn = serializers[format] || serializers.json
    const fileContent = serializeFn()
    const ok = await utils.writeFile(filePath, fileContent)
    if (ok) utils.showInFinder(filePath)
  }
  return { exportReport }
}

const buildTableActionController = ({ utils, i18n }) => {
  let showWarnDialog = true
  const handleAction = async (action, rowData, tableEntity) => {
    if (action === "locate") {
      utils.showInFinder(rowData.path)
      return
    }
    if (action === "delete") {
      if (showWarnDialog) {
        const reconfirm = i18n.t("msgBox.reconfirmDeleteFile")
        const filename = utils.getFileName(rowData.path, false)
        const { response, checkboxChecked } = await utils.showMessageBox({
          type: "warning",
          message: `${reconfirm} ${filename}`,
          checkboxLabel: i18n.t("disableReminder"),
        })
        if (response === 1) return
        if (checkboxChecked) showWarnDialog = false
      }
      await utils.Package.FsExtra.remove(rowData.path)
      tableEntity.deleteRow("idx", rowData.idx)
      utils.notification.show(i18n.t("success.deleted"))
    }
  }

  return { handleAction }
}

class ResourceManagerPlugin extends BasePlugin {
  ctx = { utils: this.utils, config: this.config, i18n: this.i18n }
  scannerEngine = buildResourceScanner(this.ctx)
  exportEngine = buildExportEngine(this.ctx)
  tableController = buildTableActionController(this.ctx)

  style = () => true

  hotkey = () => [{ hotkey: this.config.HOTKEY, callback: this.call }]

  html = () =>
    `<fast-window
      id="plugin-resource-manager"
      hidden
      window-title="${this.pluginName}"
      window-buttons="download|fa-download|${this.i18n.t("func.download")};
                      togglePreview|fa-eye|${this.i18n.t("func.togglePreview")};
                      close|fa-times|${this.i18n.t("func.close")}">
      <div class="plugin-resource-manager-wrap">
        <div class="non-exist-in-file-caption"></div>
        <fast-table class="non-exist-in-file"></fast-table>
        <div class="non-exist-in-folder-caption"></div>
        <fast-table class="non-exist-in-folder"></fast-table>
        <div class="resource-manager-config-caption"></div>
        <textarea rows="10" readonly></textarea>
      </div>
    </fast-window>`

  init = () => {
    this.entities = {
      content: this.utils.entities.eContent,
      panel: document.querySelector("#plugin-resource-manager"),
      wrap: document.querySelector(".plugin-resource-manager-wrap"),
      fileTable: document.querySelector(".non-exist-in-file"),
      folderTable: document.querySelector(".non-exist-in-folder"),
    }
    if (this.config.TIMEOUT <= 0) {
      this.config.TIMEOUT = 5 * 60 * 1000
    }
  }

  process = () => {
    this.entities.panel.addEventListener("btn-click", ev => this[ev.detail.action]?.())
    this.entities.fileTable.addEventListener("row-action", ev => {
      const { action, rowData } = ev.detail
      this.tableController.handleAction(action, rowData, this.entities.fileTable)
    })
  }

  call = async (action, meta) => {
    const dir = this.utils.getMountFolder()
    if (!dir) return

    const hideProcessing = this.utils.notification.show(this.i18n.t("processing"), "info")
    const result = await this._runWithProgressBar(dir)
    if (result instanceof Error) {
      this.utils.notification.show(result.toString(), "error")
      return
    }
    this._initPanelContent(result)
    this._initPanelRect()
    this.entities.panel.show()
    hideProcessing()
  }

  close = () => {
    this.entities.panel.hide()
    this.entities.fileTable.clear()
    this.entities.folderTable.clear()
  }

  togglePreview = () => {
    this.entities.panel.updateButton("togglePreview", btn => btn.icon = (btn.icon === "fa-eye-slash") ? "fa-eye" : "fa-eye-slash")
    this.entities.fileTable.setSchema(this._getFileTableSchema())
  }

  download = async () => {
    const reportData = {
      ...this._getConfig(),
      resources_non_exist_in_file: this.entities.fileTable.getProcessedData().map(e => e.src),
      resources_non_exist_in_folder: this.entities.folderTable.getProcessedData().map(e => e.src),
    }
    let defaultDir = this.utils.getCurrentDirPath()
    defaultDir = (defaultDir === ".") ? this.utils.getMountFolder() : defaultDir
    defaultDir = defaultDir || this.utils.tempFolder
    await this.exportEngine.exportReport(reportData, defaultDir)
  }

  _runWithProgressBar = async (dir) => {
    return this.utils.runWithFakeProgressBar(() => this.scannerEngine.scan(dir), this.config.TIMEOUT)
  }

  _initPanelRect = (resetLeft = true) => {
    const { left, width, height } = this.entities.content.getBoundingClientRect()
    const { PANEL_WIDTH_PERCENT: w, PANEL_HEIGHT_PERCENT: h } = this.config
    const style = { width: `${width * w / 100}px`, height: `${height * h / 100}px` }
    if (resetLeft) {
      style.left = `${left + width * (100 - w) / 200}px`
    }
    Object.assign(this.entities.panel.style, style)
  }

  _initPanelContent = (result) => {
    const { notInFile, notInFolder } = result

    const replacer = (key, value) => Array.isArray(value) ? value.join("|") : value
    this.entities.wrap.querySelector("textarea").value = JSON.stringify(this._getConfig(), replacer, "  ")
    this.entities.wrap.querySelector(".non-exist-in-file-caption").textContent = this.i18n.t("title.nonExistInFile", { size: notInFile.length })
    this.entities.wrap.querySelector(".non-exist-in-folder-caption").textContent = this.i18n.t("title.nonExistInFolder", { size: notInFolder.length })
    this.entities.wrap.querySelector(".resource-manager-config-caption").textContent = this.i18n.t("title.setting")

    const toData = arr => arr.map((path, idx) => ({ idx: idx + 1, path, src: this.utils.toFileProtocol(path) }))
    this.entities.fileTable.configure(toData(notInFile), this._getFileTableSchema())
    this.entities.folderTable.configure(toData(notInFolder), this._getFolderTableSchema())
  }

  _getFileTableSchema = () => {
    const resourceRender = (rowData) => `<img src="${rowData.src}" />`
    const operationsRender = () => `<i class="fa fa-external-link action-icon" action="locate"></i><i class="fa fa-trash-o action-icon" action="delete"></i>`
    const isInPreview = this.entities.panel.getAttribute("window-buttons").includes("fa-eye-slash")
    const columns = [
      { key: "idx", title: "No.", width: "max-content", sortable: true },
      { key: "path", title: "Resources", sortable: true },
      { key: "image", title: "Preview", sortable: true, ignore: !isInPreview, render: resourceRender },
      { key: "operations", title: "Operations", width: "max-content", render: operationsRender },
    ]
    return { columns }
  }

  _getFolderTableSchema = () => ({
    columns: [{ key: "idx", title: "No.", width: "max-content", sortable: true }, { key: "path", title: "Resources", sortable: true }],
  })

  _getConfig = () => ({
    search_folder: this.utils.getMountFolder(),
    resource_types: this.config.RESOURCE_GRAMMARS,
    ignore_folders: this.config.IGNORE_FOLDERS,
    resource_extensions: this.config.RESOURCE_EXT,
    markdown_extensions: this.config.MARKDOWN_EXT,
  })
}

module.exports = {
  plugin: ResourceManagerPlugin,
}
