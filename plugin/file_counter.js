class FileCounterPlugin extends BasePlugin {
    styleTemplate = () => ({
        font_weight: this.config.FONT_WEIGHT,
        color: this.config.COLOR || "var(--active-file-text-color)",
        background_color: this.config.BACKGROUND_COLOR || "var(--active-file-bg-color)",
    })

    init = () => {
        this.abortController = new AbortController()
        this.className = "plugin-file-counter"
        this.libraryTreeEl = document.getElementById("file-library-tree")
        this.allowedExtensions = new Set(this.config.ALLOW_EXT.map(ext => {
            const prefix = (ext !== "" && !ext.startsWith(".")) ? "." : ""
            return prefix + ext.toLowerCase()
        }))
    }

    process = () => {
        this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.allPluginsHadInjected, () => {
            File.editor.library.refreshPanelCommand()
            this.countAllDirs()
        })

        if (this.config.CTRL_WHEEL_TO_SCROLL_SIDEBAR_MENU) {
            document.querySelector("#file-library").addEventListener("wheel", ev => {
                const target = ev.target.closest("#file-library")
                if (target && this.utils.metaKeyPressed(ev)) {
                    target.scrollLeft += ev.deltaY * 0.2
                    ev.stopPropagation()
                    ev.preventDefault()
                }
            }, { passive: false, capture: true })
        }

        this.observer = new MutationObserver(mutationList => {
            if (mutationList.length === 1) {
                const add = mutationList[0].addedNodes[0]
                if (add && add.classList && add.classList.contains("file-library-node")) {
                    this.countDir(add)
                    return
                }
            }
            const needCountAllDirs = mutationList.some(mutation => {
                const { target } = mutation
                const add = mutation.addedNodes[0]
                const t = target && target.classList && target.classList.contains(this.className)
                const a = add && add.classList && add.classList.contains(this.className)
                return !(t || a)
            })
            if (needCountAllDirs) {
                this.countAllDirs()
            }
        })
        this.observer.observe(this.libraryTreeEl, { subtree: true, childList: true })
    }

    _verifyExt = name => this.allowedExtensions.has(this.utils.Package.Path.extname(name).toLowerCase())
    _verifySize = stat => 0 > this.config.MAX_SIZE || stat.size < this.config.MAX_SIZE
    _fileFilter = (name, filepath, stat) => this._verifySize(stat) && this._verifyExt(name)
    _dirFilter = name => !this.config.IGNORE_FOLDERS.includes(name)

    _onFinished = (err) => {
        if (!err) return
        if (err.name === "QuotaExceededError") {
            this.stopPlugin()
        } else if (err.name === "AbortError") {
            console.warn("file_counter aborted")
        }
    }

    _countFiles = async (dir) => {
        let count = 0
        await this.utils.walkDir({
            dir,
            fileFilter: this._fileFilter,
            dirFilter: this._dirFilter,
            fileParamsGetter: this.utils.identity,
            onFile: () => count++,
            maxStats: this.config.MAX_STATS,
            semaphore: this.config.CONCURRENCY_LIMIT,
            followSymlinks: this.config.FOLLOW_SYMBOLIC_LINKS,
            signal: this.abortController.signal,
            onFinished: this._onFinished,
        })
        return count
    }

    _countDir = async (node) => {
        const dir = node.dataset.path
        const fileCount = await this._countFiles(dir)
        let countDiv = node.querySelector(`:scope > .${this.className}`)
        if (fileCount <= this.config.IGNORE_MIN_NUM) {
            this.utils.removeElement(countDiv)
            return
        }
        if (!countDiv) {
            countDiv = document.createElement("div")
            countDiv.classList.add(this.className)
            const background = node.querySelector(".file-node-background")
            node.insertBefore(countDiv, background.nextElementSibling)
        }
        countDiv.innerText = this.config.BEFORE_TEXT + fileCount
    }

    countDir = (tree) => {
        this._countDir(tree)
        const children = tree.querySelectorAll(':scope > .file-node-children > [data-has-sub="true"]')
        children.forEach(this.countDir)
    }

    countAllDirs = () => {
        const root = this.libraryTreeEl.querySelector(":scope > .file-library-node")
        if (root) {
            this.countDir(root)
        }
    }

    stopPlugin = () => {
        document.querySelectorAll(".plugin-file-counter").forEach(this.utils.removeElement)
        const msg = this.i18n.t("error.tooManyFiles", { pluginName: this.pluginName })
        this.utils.notification.show(msg, "warning", 7000)
        this.observer.disconnect()
        this.abortController.abort(new DOMException("Stop Plugin", "AbortError"))
        this.abortController = null
    }
}

module.exports = {
    plugin: FileCounterPlugin
}
