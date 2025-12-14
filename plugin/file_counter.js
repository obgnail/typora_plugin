class FileCounterPlugin extends BasePlugin {
    styleTemplate = () => ({
        font_weight: this.config.FONT_WEIGHT,
        color: this.config.COLOR || "var(--active-file-text-color)",
        background_color: this.config.BACKGROUND_COLOR || "var(--active-file-bg-color)",
    })

    init = () => {
        this.abortController = new AbortController()
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
        this.fileTreeEl = document.getElementById("file-library-tree")
    }

    process = () => {
        this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.allPluginsHadInjected, () => setTimeout(() => {
            File.editor.library.refreshPanelCommand()
            this.countAllDirs()
        }, 500))

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

        this.observer.observe(this.fileTreeEl, { subtree: true, childList: true })
    }

    _getWalkOptions = () => {
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
            signal: this.abortController.signal,
            onFinished: (err) => {
                if (!err) return
                if (err.name === "QuotaExceededError") {
                    this.stop()
                } else if (err.name === "AbortError") {
                    console.warn("File-Counter Aborted")
                }
            },
        }
    }

    _setCount = async (node) => {
        let fileCount = 0
        await this.utils.walkDir({ ...this.walkOptions, dir: node.dataset.path, onFile: () => fileCount++ })

        const countEl = node.querySelector(":scope > .file-node-content")
        if (fileCount <= this.config.IGNORE_MIN_NUM) {
            countEl.removeAttribute("data-count")
        } else {
            countEl.setAttribute("data-count", fileCount)
        }
    }

    countDir = (node) => {
        if (!node) return
        this._setCount(node)
        const children = node.querySelectorAll(':scope > .file-node-children > .file-library-node[data-has-sub="true"]')
        children.forEach(this.countDir)
    }

    countAllDirs = () => {
        const node = this.fileTreeEl.querySelector(":scope > .file-library-node")
        this.countDir(node)
    }

    stop = () => {
        this.observer.disconnect()
        this.abortController?.abort(new DOMException("Stop File Counter", "AbortError"))

        document.querySelectorAll(".file-node-content[data-count]").forEach(el => el.removeAttribute("data-count"))
        const msg = this.i18n.t("error.tooManyFiles", { pluginName: this.pluginName })
        this.utils.notification.show(msg, "warning", 7000)
    }
}

module.exports = {
    plugin: FileCounterPlugin
}
