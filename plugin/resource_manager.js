class ResourceManagerPlugin extends BasePlugin {
    styleTemplate = () => true

    hotkey = () => [this.config.HOTKEY]

    html = () => `
        <fast-window
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
        this.showWarnDialog = true
        this.entities = {
            content: this.utils.entities.eContent,
            window: document.querySelector("#plugin-resource-manager"),
            wrap: document.querySelector(".plugin-resource-manager-wrap"),
            fileTable: document.querySelector(".non-exist-in-file"),
            folderTable: document.querySelector(".non-exist-in-folder"),
        }
        if (this.config.TIMEOUT <= 0) {
            this.config.TIMEOUT = 5 * 60 * 1000
        }
    }

    process = () => {
        this.entities.window.addEventListener("btn-click", ev => this[ev.detail.action]?.())
        this.entities.fileTable.addEventListener("row-action", async ev => {
            const { action, rowData } = ev.detail
            if (action === "locate") {
                this.utils.showInFinder(rowData.src)
            } else if (action === "delete") {
                if (this.showWarnDialog) {
                    const checkboxLabel = this.i18n.t("disableReminder")
                    const reconfirm = this.i18n.t("msgBox.reconfirmDeleteFile")
                    const filename = this.utils.getFileName(rowData.src, false)
                    const message = `${reconfirm} ${filename}`
                    const option = { type: "warning", message, checkboxLabel }
                    const { response, checkboxChecked } = await this.utils.showMessageBox(option)
                    if (response === 1) return
                    if (checkboxChecked) {
                        this.showWarnDialog = false
                    }
                }
                await this.utils.Package.FsExtra.remove(rowData.src)
                this.entities.fileTable.deleteRow("idx", rowData.idx)
                this.utils.notification.show(this.i18n.t("success.deleted"))
            }
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
        this._initModalContent(result)
        this._initModalRect()
        this.entities.window.show()
        hideProcessing()
    }

    close = () => {
        this.entities.window.hide()
        this.entities.fileTable.clear()
        this.entities.folderTable.clear()
    }

    togglePreview = () => {
        this.entities.window.updateButton("togglePreview", btn => btn.icon = (btn.icon === "fa-eye-slash") ? "fa-eye" : "fa-eye-slash")
        this.entities.fileTable.setSchema(this._getFileTableSchema())
    }

    download = async () => {
        const getOutput = (format) => {
            const _obj = {
                ...this._getConfig(),
                resources_non_exist_in_file: this.entities.fileTable.getProcessedData().map(e => e.src),
                resources_non_exist_in_folder: this.entities.folderTable.getProcessedData().map(e => e.src),
            }
            const json = () => JSON.stringify(_obj, null, "\t")
            const yaml = () => this.utils.stringifyYaml(_obj)
            const toml = () => this.utils.stringifyToml(_obj)
            const fn = { json, yaml, toml }[format] || json
            return fn()
        }

        let dir = this.utils.getCurrentDirPath()
        dir = (dir === ".") ? this.utils.getMountFolder() : dir
        dir = dir || this.utils.tempFolder

        const title = this.i18n.t("func.download")
        const defaultPath = this.utils.Package.Path.join(dir, "resource-report.json")
        const filters = [
            { name: "All", extensions: ["json", "yaml", "toml"] },
            { name: "JSON", extensions: ["json"] },
            { name: "YAML", extensions: ["yaml"] },
            { name: "TOML", extensions: ["toml"] },
        ]
        const op = { title, defaultPath, filters, properties: ["saveFile", "showOverwriteConfirmation"] }
        const { canceled, filePath } = await JSBridge.invoke("dialog.showSaveDialog", op)
        if (canceled) return

        const format = this.utils.Package.Path.extname(filePath).toLowerCase().replace(/^\./, "")
        const fileContent = getOutput(format)
        const ok = await this.utils.writeFile(filePath, fileContent)
        if (ok) {
            this.utils.showInFinder(filePath)
        }
    }

    _runWithProgressBar = async (dir) => {
        return this.utils.progressBar.fake({
            task: () => findResources(this, dir),
            timeout: this.config.TIMEOUT,
        })
    }

    _initModalRect = (resetLeft = true) => {
        const { left, width, height } = this.entities.content.getBoundingClientRect()
        const { MODAL_LEFT_PERCENT: l, MODAL_WIDTH_PERCENT: w, MODAL_HEIGHT_PERCENT: h } = this.config
        const style = { width: `${width * w / 100}px`, height: `${height * h / 100}px` }
        if (resetLeft) {
            style.left = `${left + width * l / 100}px`
        }
        Object.assign(this.entities.window.style, style)
    }

    _initModalContent = (result) => {
        const { notInFile, notInFolder } = result

        const replacer = (key, value) => Array.isArray(value) ? value.join("|") : value
        this.entities.wrap.querySelector("textarea").value = JSON.stringify(this._getConfig(), replacer, "\t")
        this.entities.wrap.querySelector(".non-exist-in-file-caption").textContent = this.i18n.t("title.nonExistInFile", { size: notInFile.length })
        this.entities.wrap.querySelector(".non-exist-in-folder-caption").textContent = this.i18n.t("title.nonExistInFolder", { size: notInFolder.length })
        this.entities.wrap.querySelector(".resource-manager-config-caption").textContent = this.i18n.t("title.setting")

        const toData = arr => arr.map((src, idx) => ({ idx: idx + 1, src }))
        this.entities.fileTable.configure(toData(notInFile), this._getFileTableSchema())
        this.entities.folderTable.configure(toData(notInFolder), this._getFolderTableSchema())
    }

    _getFileTableSchema = () => {
        const resourceRender = (rowData) => `<img src="${rowData.src}" />`
        const operationsRender = () => `<i class="fa fa-external-link action-icon" action="locate"></i><i class="fa fa-trash-o action-icon" action="delete"></i>`
        const isInPreview = this.entities.window.getAttribute("window-buttons").includes("fa-eye-slash")
        const columns = [
            { key: "idx", title: "No.", width: "3em", sortable: true },
            { key: "src", title: "Resources", sortable: true },
            { key: "image", title: "Preview", sortable: true, ignore: !isInPreview, render: resourceRender },
            { key: "operations", title: "Operations", width: "5.2em", render: operationsRender }
        ]
        return { columns }
    }

    _getFolderTableSchema = () => {
        const columns = [{ key: "idx", title: "No.", width: "3em", sortable: true }, { key: "src", title: "Resources", sortable: true }]
        return { columns }
    }

    _getConfig = () => ({
        search_folder: this.utils.getMountFolder(),
        resource_types: this.config.RESOURCE_GRAMMARS,
        ignore_folders: this.config.IGNORE_FOLDERS,
        resource_extensions: this.config.RESOURCE_EXT,
        markdown_extensions: this.config.MARKDOWN_EXT,
    })
}

const findResources = async (plugin, searchDir) => {
    const { utils, config } = plugin
    const dir = searchDir || utils.getMountFolder()

    const _resourceExt = new Set(config.RESOURCE_EXT)
    const _markdownExt = new Set(config.MARKDOWN_EXT)
    const isResourceExt = (ext) => _resourceExt.has(ext)
    const isMarkdownExt = (ext) => _markdownExt.has(ext)

    // This regular expression is from `File.editor.brush.inline.rules.image`
    // Typora simplifies the image syntax from a context-free grammar to a regular grammar
    const IMG_REGEX = /(\!\[((?:\[[^\]]*\]|[^\[\]])*)\]\()(<?((?:\([^)]*\)|[^()])*?)>?[ \t]*((['"])((?:.|\n)*?)\6[ \t]*)?)(\)(?:\s*{([^{}\(\)]*)})?)/g
    const IMG_TAG_REGEX = /<img\s+[^>\n]*?src=(["'])([^"'\n]+)\1[^>\n]*>/gi
    const _findHTML = config.RESOURCE_GRAMMARS.includes("html")
    const _findMD = config.RESOURCE_GRAMMARS.includes("markdown")
    const findImagesInText = (text) => {
        const md = _findMD ? [...text.matchAll(IMG_TAG_REGEX)].map(m => m[2]) : []
        const html = _findHTML ? text.split("\n").flatMap(e => [...e.matchAll(IMG_REGEX)]).map(e => e[4]) : []
        return [...md, ...html]
    }

    const _redirectPlugin = utils.getCustomPlugin("redirectLocalRootUrl")
    const getCompatibleRootURI = (mdPath, mdDir, md) => {
        // Typora supports redirecting resource paths using the `typora-root-url`
        const { yamlObject } = utils.splitFrontMatter(md)
        const redirectURL = yamlObject?.["typora-root-url"]
        if (redirectURL) {
            return redirectURL
        }
        // Compatibility for `redirectLocalRootUrl` plugin
        return _redirectPlugin?.needRedirect(mdPath) ? _redirectPlugin.config.root : mdDir
    }

    const { Package, isNetworkImage, isSpecialImage } = utils
    const findImagesInFile = async (mdPath, mdDir) => {
        const md = await Package.FsExtra.readFile(mdPath, "utf-8")
        const images = findImagesInText(md)
            .map(img => {
                try {
                    img = img.replace(/^\s*<\s*/, "").replace(/\s*>\s*$/, "")
                    img = decodeURIComponent(img).split("?")[0]
                    return img.replace(/^\s*([\\/])/, "")
                } catch (e) {
                    console.warn("error image path:", img)
                }
            })
            .filter(img => img
                && !isNetworkImage(img)
                && !isSpecialImage(img)
                && isResourceExt(Package.Path.extname(img).toLowerCase())
            )
        if (images.length === 0) return

        const root = getCompatibleRootURI(mdPath, mdDir, md)
        return images.map(img => Package.Path.resolve(root, img))
    }

    const resources = { inFolder: new Set(), inFile: new Set() }
    await utils.walkDir({
        dir,
        semaphore: config.CONCURRENCY_LIMIT,
        maxStats: config.MAX_STATS,
        maxDepth: config.MAX_DEPTH,
        followSymlinks: config.FOLLOW_SYMBOLIC_LINKS,
        strategy: config.TRAVERSE_STRATEGY,
        signal: AbortSignal.timeout(config.TIMEOUT),
        dirFilter: name => !config.IGNORE_FOLDERS.includes(name),
        onFile: async ({ path, file, dir }) => {
            const ext = utils.Package.Path.extname(file).toLowerCase()
            if (isResourceExt(ext)) {
                resources.inFolder.add(path)
            } else if (isMarkdownExt(ext)) {
                const images = await findImagesInFile(path, dir)
                if (images) images.forEach(img => resources.inFile.add(img))
            }
        },
        onFinished: (err) => {
            if (!err) return
            console.error(err)
            const msg = err.name === "TimeoutError" ? plugin.i18n.t("error.timeout") : err.toString()
            utils.notification.show(msg, "error")
        },
    })
    const notInFile = [...resources.inFolder].filter(x => !resources.inFile.has(x))
    const notInFolder = [...resources.inFile].filter(x => !resources.inFolder.has(x))
    return { notInFile, notInFolder }
}

module.exports = {
    plugin: ResourceManagerPlugin
}
