class FileCounterPlugin extends BasePlugin {
    styleTemplate = () => ({
        font_weight: this.config.FONT_WEIGHT,
        color: this.config.COLOR || "var(--active-file-text-color)",
        background_color: this.config.BACKGROUND_COLOR || "var(--active-file-bg-color)",
    })

    init = () => {
        this.entities = {
            fileTree: document.querySelector("#file-library-tree"),
            get fileTreeRoot() {
                return document.querySelector("#file-library-tree > .file-library-root")  // rootNode may be dynamic
            },
        }

        this.walkOptions = this._getWalkOptions()
        this.observer = new MutationObserver(mutations => {
            if (mutations.length === 1) {
                const added = mutations[0].addedNodes[0]
                if (added?.classList?.contains("file-library-node")) {
                    this.countDir(added)
                    return
                }
            }
            this.countAllDirs()
        })
    }

    process = () => {
        this.utils.eventHub.once(this.utils.eventHub.eventType.fileOpened, () => {
            File.editor.library.refreshPanelCommand()
            this.countAllDirs()
        })

        this.observer.observe(this.entities.fileTree, { subtree: true, childList: true })
    }

    _getWalkOptions = () => {
        const abortController = new AbortController()
        const allowedExt = new Set(this.config.ALLOW_EXT.map(ext => {
            const prefix = (ext !== "" && !ext.startsWith(".")) ? "." : ""
            return prefix + ext.toLowerCase()
        }))
        const verifyExt = name => allowedExt.has(this.utils.Package.Path.extname(name).toLowerCase())
        const verifySize = stat => 0 > this.config.MAX_SIZE || stat.size < this.config.MAX_SIZE
        return {
            fileFilter: (name, filepath, stat) => verifySize(stat) && verifyExt(name),
            dirFilter: name => !this.config.IGNORE_FOLDERS.includes(name),
            fileParamsGetter: this.utils.identity,
            maxStats: this.config.MAX_STATS,
            semaphore: this.config.CONCURRENCY_LIMIT,
            followSymlinks: this.config.FOLLOW_SYMBOLIC_LINKS,
            signal: abortController.signal,
            onFinished: (err) => {
                if (!err) return
                if (err.name === "AbortError") {
                    console.warn("File-Counter Aborted")
                } else if (err.name === "QuotaExceededError") {
                    this.observer.disconnect()
                    abortController.abort(new DOMException("Stop File-Counter", "AbortError"))
                    document.querySelectorAll(".file-node-content[data-count]").forEach(el => el.removeAttribute("data-count"))
                    const msg = this.i18n.t("error.tooManyFiles", { pluginName: this.pluginName })
                    this.utils.notification.show(msg, "warning", 7000)
                }
            },
        }
    }

    _setCount = async (node) => {
        let fileCount = 0
        await this.utils.walkDir({ ...this.walkOptions, dir: node.dataset.path, onFile: () => fileCount++ })

        const displayEl = node.querySelector(":scope > .file-node-content")
        if (fileCount <= this.config.IGNORE_MIN_NUM) {
            displayEl.removeAttribute("data-count")
        } else {
            displayEl.setAttribute("data-count", fileCount)
        }
    }

    countDir = (node) => {
        if (!node) return
        this._setCount(node)
        node.querySelectorAll(':scope > .file-node-children > .file-library-node[data-has-sub="true"]').forEach(this.countDir)
    }

    countAllDirs = () => this.countDir(this.entities.fileTreeRoot)
}

module.exports = {
    plugin: FileCounterPlugin
}
