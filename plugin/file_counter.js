class fileCounterPlugin extends BasePlugin {
    styleTemplate = () => ({
        font_weight: this.config.FONT_WEIGHT,
        color: this.config.COLOR || "var(--active-file-text-color)",
        background_color: this.config.BACKGROUND_COLOR || "var(--active-file-bg-color)",
    })

    init = () => {
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

        new MutationObserver(mutationList => {
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
        }).observe(this.libraryTreeEl, { subtree: true, childList: true })
    }

    verifyExt = path => this.allowedExtensions.has(this.utils.Package.Path.extname(path).toLowerCase())
    verifySize = stat => 0 > this.config.MAX_SIZE || stat.size < this.config.MAX_SIZE
    fileFilter = (filepath, stat) => this.verifySize(stat) && this.verifyExt(filepath)
    dirFilter = path => !this.config.IGNORE_FOLDERS.includes(path)

    countFiles = async (dir) => {
        let count = 0
        await this.utils.walkDir({
            dir,
            fileFilter: this.fileFilter,
            dirFilter: this.dirFilter,
            paramsBuilder: this.utils.identity,
            callback: () => count++,
            semaphore: this.config.CONCURRENCY_LIMIT,
            maxDepth: this.config.MAX_DEPTH,
        })
        return count
    }

    _countDir = async (node) => {
        const dir = node.dataset.path
        const fileCount = await this.countFiles(dir)
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
        const titleNode = node.querySelector(".file-node-title")
        if (titleNode) {
            titleNode.style.setProperty("overflow-x", "hidden", "important")
        }
    }

    countDir = (tree) => {
        this._countDir(tree)
        const children = tree.querySelectorAll(':scope > .file-node-children > [data-has-sub="true"]')
        children.forEach(this.countDir)
    }

    countAllDirs = () => {
        const root = this.libraryTreeEl.querySelector(":scope > .file-library-node")
        if (root) {
            console.debug(`[${this.fixedName}]: count all dirs`)
            this.countDir(root)
        }
    }
}

module.exports = {
    plugin: fileCounterPlugin
}
