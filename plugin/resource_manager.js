class resourceManagerPlugin extends BasePlugin {
    styleTemplate = () => true

    hotkey = () => [this.config.HOTKEY]

    html = () => `
        <div id="plugin-resource-manager" class="plugin-common-modal plugin-common-hidden">
            <div class="plugin-resource-manager-icon-group">
                <div class="plugin-resource-manager-icon ion-close" action="close" ty-hint="${this.i18n.t('func.close')}"></div>
                <div class="plugin-resource-manager-icon ion-arrow-move" action="move" ty-hint="${this.i18n.t('func.move')}"></div>
                <div class="plugin-resource-manager-icon ion-eye-disabled" action="togglePreview" ty-hint="${this.i18n.t('func.togglePreview')}"></div>
                <div class="plugin-resource-manager-icon ion-archive" action="download" ty-hint="${this.i18n.t('func.download')}"></div>
            </div>
            <img class="plugin-resource-manager-popup plugin-common-hidden">
            <div class="plugin-resource-manager-wrap"></div>
        </div>
    `

    init = () => {
        this.finder = new ResourceFinder(this)
        this.showWarnDialog = true
        this.entities = {
            modal: document.querySelector("#plugin-resource-manager"),
            wrap: document.querySelector(".plugin-resource-manager-wrap"),
            popup: document.querySelector(".plugin-resource-manager-popup"),
            iconGroup: document.querySelector(".plugin-resource-manager-icon-group"),
            move: document.querySelector('.plugin-resource-manager-icon-group [action="move"]'),
            $wrap: $(".plugin-resource-manager-wrap"),
        }
        this.results = {
            nonExistInFile: new Set(),
            nonExistInFolder: new Set(),
            init: (inFolder, inFile) => {
                this.results.nonExistInFile = new Set([...inFolder].filter(x => !inFile.has(x)))
                this.results.nonExistInFolder = new Set([...inFile].filter(x => !inFolder.has(x)))
            },
            clear: () => {
                this.results.nonExistInFile.clear()
                this.results.nonExistInFolder.clear()
            },
        }
    }

    process = () => {
        this.utils.dragFixedModal(this.entities.move, this.entities.modal, false)
        this.entities.iconGroup.addEventListener("click", ev => {
            const target = ev.target.closest("[action]")
            if (!target) return
            const action = target.getAttribute("action")
            const fn = this[action]
            if (fn) {
                fn(ev)
            }
        })
        this.entities.wrap.addEventListener("click", async ev => {
            const target = ev.target.closest("button[action]")
            if (!target) return
            const tr = target.closest("tr")
            if (!tr) return
            const img = tr.querySelector("img")
            if (!img) return

            const src = img.getAttribute("src")
            const action = target.getAttribute("action")
            if (action === "locate") {
                this.utils.showInFinder(src)
            } else if (action === "delete") {
                if (this.showWarnDialog) {
                    const checkboxLabel = this.i18n._t("global", "disableReminder")
                    const reconfirm = this.i18n.t("msgBox.reconfirmDeleteFile")
                    const filename = this.utils.getFileName(src, false)
                    const message = `${reconfirm} ${filename}`
                    const option = { type: "warning", message, checkboxLabel }
                    const { response, checkboxChecked } = await this.utils.showMessageBox(option)
                    if (response === 1) return
                    if (checkboxChecked) {
                        this.showWarnDialog = false
                    }
                }
                await this.utils.Package.Fs.promises.unlink(src)
                this.utils.removeElement(tr)
                this.results.nonExistInFile.delete(src)
            }
        })
    }

    call = async (action, meta) => {
        const dir = this.utils.getMountFolder()
        if (!dir) return

        this.utils.notification.show(this.i18n._t("global", "processing"))
        const { resourcesInFolder, resourcesInFile } = await this.finder.run(dir)
        this.results.init(resourcesInFolder, resourcesInFile)
        this._initModalRect()
        this._initModalTable()
        this.utils.show(this.entities.modal)
        this.utils.notification.hide()
    }

    close = () => {
        this.results.clear()
        this.entities.wrap.innerHTML = ""
        this.utils.hide(this.entities.modal)
        this.togglePreview(false)
    }

    togglePreview = force => {
        const icon = this.entities.iconGroup.querySelector('[action="togglePreview"]')
        const wantClose = force === false || icon.classList.contains("ion-eye")
        this.entities.wrap.querySelectorAll(".non-exist-in-file-table td:nth-of-type(3), .non-exist-in-file-table th:nth-of-type(3)")
            .forEach(e => e.classList.toggle("plugin-common-hidden", wantClose))
        const func = wantClose ? "off" : "on"
        const className = "img"
        this.entities.$wrap
            [func]("mouseover", className, this._showPopup)
            [func]("mousemove", className, this._showPopup)
            [func]("mouseout", className, this._hidePopup)
        icon.classList.toggle("ion-eye-disabled", wantClose)
        icon.classList.toggle("ion-eye", !wantClose)
    }

    download = async () => {
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

        let ext = this.utils.Package.Path.extname(filePath).toLowerCase()
        ext = (ext[0] === ".") ? ext.slice(1) : ext
        const fileContent = this._getOutput(ext)
        const ok = await this.utils.writeFile(filePath, fileContent)
        if (ok) {
            this.utils.showInFinder(filePath)
        }
    }

    _initModalRect = (resetLeft = true) => {
        const { left, width, height } = this.utils.entities.eContent.getBoundingClientRect()
        const { MODAL_LEFT_PERCENT: l, MODAL_WIDTH_PERCENT: w, MODAL_HEIGHT_PERCENT: h } = this.config
        const style = { width: `${width * w / 100}px`, height: `${height * h / 100}px` }
        if (resetLeft) {
            style.left = `${left + width * l / 100}px`
        }
        Object.assign(this.entities.modal.style, style)
    }

    _initModalTable = () => {
        const output = this.utils.pickBy(
            this._getOutput(),
            (_, key) => !["resource_non_exist_in_file", "resource_non_exist_in_folder"].includes(key),
        )
        const replacer = (key, value) => Array.isArray(value) ? value.join("|") : value
        const setting = JSON.stringify(output, replacer, "\t")
        const { nonExistInFile, nonExistInFolder } = this.results
        const I18N = {
            locate: this.i18n.t("func.locate"),
            delete: this.i18n.t("func.delete"),
            setting: this.i18n.t("title.setting"),
            nonExistInFile: this.i18n.t("title.nonExistInFile", { size: nonExistInFile.size }),
            nonExistInFolder: this.i18n.t("title.nonExistInFolder", { size: nonExistInFolder.size }),
        }

        const btnGroup = `
            <td>
                <div class="btn-group">
                    <button type="button" class="btn btn-default" action="locate">${I18N.locate}</button>
                    <button type="button" class="btn btn-default" action="delete">${I18N.delete}</button>
                </div>
            </td>`
        const nonExistInFileRows = [...nonExistInFile].map((row, idx) => {
            return `<tr><td>${idx + 1}</td><td>${row}</td><td class="plugin-common-hidden"><img src="${row}"/></td>${btnGroup}</tr>`
        })
        const nonExistInFolderRows = [...nonExistInFolder].map((row, idx) => {
            return `<tr><td>${idx + 1}</td><td>${row}</td></tr>`
        })
        const tbody1 = nonExistInFileRows.join("") || '<tr><td colspan="4" style="text-align: center">Empty</td></tr>'
        const tbody2 = nonExistInFolderRows.join("") || '<tr><td colspan="2" style="text-align: center">Empty</td></tr>'

        this.entities.wrap.innerHTML = `
            <table class="table non-exist-in-file-table">
                 <caption>${I18N.nonExistInFile}</caption>
                 <thead><tr><th>#</th><th>resource</th><th class="plugin-common-hidden">preview</th><th>operation</th></tr></thead>
                 <tbody>${tbody1}</tbody>
            </table>
            <table class="table">
                 <caption>${I18N.nonExistInFolder}</caption>
                 <thead><tr><th>#</th><th>resource</th></tr></thead>
                 <tbody>${tbody2}</tbody>
            </table>
            <div class="plugin-resource-manager-message">${I18N.setting}</div>
            <textarea rows="10" readonly>${setting}</textarea>
        `
    }

    _hidePopup = ev => this.utils.hide(this.entities.popup)
    _showPopup = ev => {
        const popup = this.entities.popup
        if (!popup) return

        popup.src = ev.target.getAttribute("src")
        const left = Math.min(window.innerWidth - 10 - popup.offsetWidth, ev.clientX + 10)
        const top = Math.min(window.innerHeight - 50 - popup.offsetHeight, ev.clientY + 20)
        popup.style.left = `${left}px`
        popup.style.top = `${top}px`
        this.utils.show(popup)
    }

    _getOutput = (format = "obj") => {
        const _obj = {
            search_folder: this.utils.getMountFolder(),
            resource_types: this.config.RESOURCE_GRAMMARS,
            ignore_folders: this.config.IGNORE_FOLDERS,
            resource_extensions: this.config.RESOURCE_EXT,
            markdown_extensions: this.config.MARKDOWN_EXT,
            resource_non_exist_in_file: [...this.results.nonExistInFile],
            resource_non_exist_in_folder: [...this.results.nonExistInFolder],
        }
        const obj = () => _obj
        const json = () => JSON.stringify(_obj, null, "\t")
        const yaml = () => this.utils.stringifyYaml(_obj)
        const toml = () => this.utils.stringifyToml(_obj)
        const fn = { obj, json, yaml, toml }[format] || json
        return fn()
    }
}

class ResourceFinder {
    constructor(plugin) {
        this.plugin = plugin
        this.utils = plugin.utils
        this.config = plugin.config

        // This regular expression is from `File.editor.brush.inline.rules.image`
        // Typora simplifies the image syntax from a context-free grammar to a regular grammar
        this.imgRegex = /(\!\[((?:\[[^\]]*\]|[^\[\]])*)\]\()(<?((?:\([^)]*\)|[^()])*?)>?[ \t]*((['"])((?:.|\n)*?)\6[ \t]*)?)(\)(?:\s*{([^{}\(\)]*)})?)/g
        this.imgTagRegex = /<img\s+[^>\n]*?src=(["'])([^"'\n]+)\1[^>\n]*>/gi

        this.resourceExts = new Set(this.config.RESOURCE_EXT)
        this.markdownExts = new Set(this.config.MARKDOWN_EXT)

        this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.allPluginsHadInjected, () => {
            this.redirectPlugin = this.utils.getCustomPlugin("redirectLocalRootUrl")
        })
    }

    run = async (dir = this.utils.getMountFolder()) => {
        const results = { resourcesInFolder: new Set(), resourcesInFile: new Set() }
        const fileFilter = () => true
        const dirFilter = name => !this.config.IGNORE_FOLDERS.includes(name)
        const paramsBuilder = (path, file, dir, stats) => ({ path, file, dir })
        const callback = async ({ path, file, dir }) => {
            const ext = this.utils.Package.Path.extname(file).toLowerCase()
            if (this.resourceExts.has(ext)) {
                results.resourcesInFolder.add(path)
            } else if (this.markdownExts.has(ext)) {
                await this._handleMarkdownFile(path, dir, results)
            }
        }
        await this.utils.walkDir(dir, fileFilter, dirFilter, paramsBuilder, callback)
        return results
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
