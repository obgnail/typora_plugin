class resourceManagerPlugin extends BasePlugin {
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
        </fast-window>
    `

    init = () => {
        this.showWarnDialog = true
        this.entities = {
            content: this.utils.entities.eContent,
            window: document.querySelector("#plugin-resource-manager"),
            wrap: document.querySelector(".plugin-resource-manager-wrap"),
            fileTable: document.querySelector(".non-exist-in-file"),
            folderTable: document.querySelector(".non-exist-in-folder"),
        }
    }

    process = () => {
        this.entities.window.addEventListener("btn-click", ev => {
            const { action } = ev.detail
            const fn = this[action]
            if (fn) fn()
        })
        this.entities.fileTable.addEventListener("row-action", async ev => {
            const { action, rowData } = ev.detail
            if (action === "locate") {
                this.utils.showInFinder(rowData.src)
                return
            }
            if (action === "delete") {
                if (this.showWarnDialog) {
                    const checkboxLabel = this.i18n._t("global", "disableReminder")
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
                await this.utils.Package.Fs.promises.unlink(rowData.src)
                this.entities.fileTable.deleteRow("idx", rowData.idx)
                this.utils.notification.show(this.i18n._t("global", "success.deleted"))
            }
        })
    }

    call = async (action, meta) => {
        const dir = this.utils.getMountFolder()
        if (!dir) return

        const hideProcessing = this.utils.notification.show(this.i18n._t("global", "processing"), "info")
        const result = await this._runWithProgressBar(dir, 3 * 60 * 1000)
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

    _runWithProgressBar = async (dir, timeout) => this.utils.progressBar.fake({ task: () => new ResourceFinder(this).run(dir), timeout })

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
        const operationsRender = () => `<i class="fa fa-external-link action-icon" action="locate"></i><i class="fa fa-trash-o action-icon" action="delete"></i>`
        const isInPreview = this.entities.window.getAttribute("window-buttons").includes("fa-eye-slash")
        const columns = [
            { key: "idx", title: "No", width: "3em", sortable: true },
            { key: "src", title: "Resources", sortable: true },
            { key: "image", title: "Preview", sortable: true, ignore: !isInPreview, render: (rowData) => `<img src="${rowData.src}" />` },
            { key: "operations", title: "Operations", width: "5.2em", render: operationsRender }
        ]
        return { columns }
    }

    _getFolderTableSchema = () => {
        const columns = [
            { key: "idx", title: "No", width: "3em", sortable: true },
            { key: "src", title: "Resources", sortable: true },
        ]
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

class ResourceFinder {
    constructor(plugin) {
        this.plugin = plugin
        this.utils = plugin.utils
        this.config = plugin.config
        this.redirectPlugin = null

        // This regular expression is from `File.editor.brush.inline.rules.image`
        // Typora simplifies the image syntax from a context-free grammar to a regular grammar
        this.imgRegex = /(\!\[((?:\[[^\]]*\]|[^\[\]])*)\]\()(<?((?:\([^)]*\)|[^()])*?)>?[ \t]*((['"])((?:.|\n)*?)\6[ \t]*)?)(\)(?:\s*{([^{}\(\)]*)})?)/g
        this.imgTagRegex = /<img\s+[^>\n]*?src=(["'])([^"'\n]+)\1[^>\n]*>/gi

        this.resourceExts = new Set(this.config.RESOURCE_EXT)
        this.markdownExts = new Set(this.config.MARKDOWN_EXT)
    }

    run = async (dir = this.utils.getMountFolder()) => {
        this.redirectPlugin = this.utils.getCustomPlugin("redirectLocalRootUrl")

        const results = { resourcesInFolder: new Set(), resourcesInFile: new Set() }
        const callback = async ({ path, file, dir }) => {
            const ext = this.utils.Package.Path.extname(file).toLowerCase()
            if (this.resourceExts.has(ext)) {
                results.resourcesInFolder.add(path)
            } else if (this.markdownExts.has(ext)) {
                await this._handleMarkdownFile(path, dir, results)
            }
        }
        await this.utils.walkDir({
            dir,
            dirFilter: name => !this.config.IGNORE_FOLDERS.includes(name),
            callback,
            semaphore: this.config.CONCURRENCY_LIMIT,
            maxDepth: this.config.MAX_DEPTH,
        })

        const notInFile = [...results.resourcesInFolder].filter(x => !results.resourcesInFile.has(x))
        const notInFolder = [...results.resourcesInFile].filter(x => !results.resourcesInFolder.has(x))
        return { notInFile, notInFolder }
    }

    _handleMarkdownFile = async (path, dir, results) => {
        const { Package, isNetworkImage, isSpecialImage } = this.utils

        const data = await Package.Fs.promises.readFile(path)
        const content = data.toString()
        const images = this._findImages(content)
            .map(img => {
                try {
                    img = img.replace(/^\s*<\s*/, "").replace(/\s*>\s*$/, "")
                    img = decodeURIComponent(img).split("?")[0]
                    return img.replace(/^\s*([\\/])/, "")
                } catch (e) {
                    console.warn("error path:", img)
                }
            })
            .filter(img =>
                img
                && !isNetworkImage(img)
                && !isSpecialImage(img)
                && this.resourceExts.has(Package.Path.extname(img).toLowerCase())
            )
        if (images.length === 0) return

        const root = this._getCompatibleRootURI(path, content) || dir
        images.map(img => Package.Path.resolve(root, img))
            .forEach(img => results.resourcesInFile.add(img))
    }

    // Typora supports redirecting resource paths using the `typora-root-url` in front matter
    _getCompatibleRootURI = (filePath, content) => {
        const { yamlObject } = this.utils.splitFrontMatter(content)
        const redirectURL = yamlObject && yamlObject["typora-root-url"]
        if (redirectURL) {
            return redirectURL
        }
        // Compatibility for redirectLocalRootUrl plugin
        if (!this.redirectPlugin) return
        const ok = this.redirectPlugin.needRedirect(filePath)
        if (ok) {
            return this.redirectPlugin.config.root
        }
    }

    _findImages = (text) => {
        const types = this.config.RESOURCE_GRAMMARS
        const md = types.includes("markdown") ? this._findMarkdownImages(text) : []
        const html = types.includes("html") ? this._findHtmlImages(text) : []
        return [...md, ...html]
    }

    _findHtmlImages = (text) => [...text.matchAll(this.imgTagRegex)].map(m => m[2])
    _findMarkdownImages = (text) => text.split("\n").flatMap(e => [...e.matchAll(this.imgRegex)]).map(e => e[4])
}

module.exports = {
    plugin: resourceManagerPlugin,
}
