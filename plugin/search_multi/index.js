const { Searcher } = require("./searcher")
const { Highlighter } = require("./highlighter")

class searchMultiPlugin extends BasePlugin {
    styleTemplate = () => {
        const colors_style = this.config.HIGHLIGHT_COLORS
            .map((color, idx) => `.cm-plugin-highlight-hit-${idx} { background-color: ${color} !important; }`)
            .join("\n")
        return { colors_style }
    }

    html = () => `
        <fast-window
            id="plugin-search-multi"
            window-title="${this.pluginName}"
            window-resize="none"
            window-buttons="searchGrammarModal|fa-question|${this.i18n.t("grammar")};close|fa-times"
            hidden>
            <div>
                <form id="plugin-search-multi-form">
                    <input type="text">
                    <div class="plugin-search-multi-btn ${(this.config.CASE_SENSITIVE) ? "select" : ""}">
                        <svg class="icon"><use xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="#find-and-replace-icon-case"></use></svg>
                    </div>
                </form>
                <div class="plugin-search-multi-result plugin-common-hidden">
                    <div class="plugin-search-counter">${this.i18n.t("matchedFiles")}：<span>0</span></div>
                    <div class="plugin-search-files"></div>
                    <div class="plugin-search-highlights plugin-common-hidden"></div>
                </div>
                <div class="plugin-search-multi-searching plugin-common-hidden">
                    <div>${this.i18n.t("searching")}</div>
                    <div class="typora-search-spinner"><div class="rect1"></div><div class="rect2"></div><div class="rect3"></div><div class="rect4"></div><div class="rect5"></div></div>
                </div>
            </div>
        </fast-window>
    `

    hotkey = () => [{ hotkey: this.config.HOTKEY, callback: this.call }]

    init = () => {
        this.searcher = new Searcher(this)
        this.highlighter = new Highlighter(this)
        this.allowedExtensions = new Set(this.config.ALLOW_EXT.map(ext => {
            const prefix = (ext !== "" && !ext.startsWith(".")) ? "." : ""
            return prefix + ext.toLowerCase()
        }))
        this.entities = {
            window: document.querySelector("#plugin-search-multi"),
            form: document.querySelector("#plugin-search-multi-form"),
            input: document.querySelector("#plugin-search-multi-form input"),
            btn: document.querySelector(".plugin-search-multi-btn"),
            result: document.querySelector(".plugin-search-multi-result"),
            counter: document.querySelector(".plugin-search-counter span"),
            files: document.querySelector(".plugin-search-files"),
            highlights: document.querySelector(".plugin-search-highlights"),
            searching: document.querySelector(".plugin-search-multi-searching"),
        }
    }

    process = () => {
        this.searcher.process()
        this.highlighter.process()
        this.entities.files.addEventListener("click", ev => {
            const target = ev.target.closest(".plugin-search-item")
            if (target) {
                const filepath = target.dataset.path
                this.utils.openFile(filepath)
            }
        })
        this.entities.btn.addEventListener("click", () => {
            this.entities.btn.classList.toggle("select")
            this.config.CASE_SENSITIVE = !this.config.CASE_SENSITIVE
        })
        this.entities.window.addEventListener("btn-click", ev => {
            const { action } = ev.detail
            if (action === "searchGrammarModal") {
                this.searcher.showGrammar()
            } else if (action === "close") {
                this.hide()
            }
        })
        this.entities.form.addEventListener("submit", ev => {
            ev.preventDefault()
            this.run()
        })
        this.entities.input.addEventListener("keydown", ev => {
            if (ev.key === "ArrowUp" || ev.key === "ArrowDown") {
                this.utils.scrollActiveItem(this.entities.files, ".plugin-search-item.active", ev.key === "ArrowDown")
            } else if (ev.key === "Escape" || ev.key === "Backspace" && this.config.BACKSPACE_TO_HIDE && !this.entities.input.value) {
                this.hide()
            }
        })
    }

    run = async (rootPath = this.utils.getMountFolder(), input = this.entities.input.value) => {
        const ast = this.getAST(input)
        if (ast) {
            await this.searchByAST(rootPath, ast)
            this.highlightByAST(ast)
        }
    }

    getAST = (input = this.entities.input.value, optimize = this.config.OPTIMIZE_SEARCH) => {
        input = input.trim()
        if (!input) return

        try {
            const ast = this.searcher.parse(input, optimize)
            const explain = this.searcher.toExplain(ast)
            this.entities.input.setAttribute("title", explain)
            return ast
        } catch (e) {
            this.entities.input.removeAttribute("title")
            this.utils.notification.show(e.toString().slice(7), "error", 5000)
            console.error(e)
        }
    }

    highlightByAST = ast => {
        this.entities.highlights.innerHTML = ""
        try {
            ast = ast || this.getAST()
            this.utils.hide(this.entities.highlights)
            if (!ast) return
            const tokens = this.searcher.getContentTokens(ast).filter(Boolean)
            if (tokens.length === 0) return

            const hitGroups = this.highlighter.doSearch(tokens)
            const hint = this.i18n.t("highlightHint")
            const itemList = Object.entries(hitGroups).map(([cls, { name, hits }]) => {
                const div = document.createElement("div")
                div.className = `plugin-highlight-item ${cls}`
                div.dataset.pos = -1
                if (!this.config.REMOVE_BUTTON_HINT) {
                    div.setAttribute("ty-hint", hint)
                }
                div.appendChild(document.createTextNode(`${name} (${hits.length})`))
                return div
            })
            this.entities.highlights.append(...itemList)
            this.utils.show(this.entities.highlights)
        } catch (e) {
            console.error(e)
        }
    }

    searchByAST = async (rootPath, ast) => {
        this.utils.hide(this.entities.result)
        this.utils.show(this.entities.searching)
        this.entities.counter.textContent = 0
        this.entities.files.innerHTML = ""

        const { MAX_SIZE, IGNORE_FOLDERS } = this.config
        const { Path: { extname }, Fs: { promises: { readFile } } } = this.utils.Package

        const verifySize = 0 > MAX_SIZE
            ? () => true
            : stat => stat.size < MAX_SIZE
        const verifyExt = path => this.allowedExtensions.has(extname(path).toLowerCase())
        const fileFilter = (path, stat) => verifySize(stat) && verifyExt(path)
        const dirFilter = name => !IGNORE_FOLDERS.includes(name)

        const readFileScope = this.searcher.getReadFileScope(ast)
        const paramsBuilder = readFileScope.length !== 0
            ? async (path, file, dir, stats) => ({ path, file, stats, content: (await readFile(path)).toString() })
            : (path, file, dir, stats) => ({ path, file, stats })

        const matcher = source => this.searcher.match(ast, source)
        const callback = this._showSearchResult(rootPath, matcher)
        await this.utils.walkDir(rootPath, fileFilter, dirFilter, paramsBuilder, callback)

        this.utils.hide(this.entities.searching)
    }

    _showSearchResult = (rootPath, matcher) => {
        const newItem = (rootPath, filePath, stats) => {
            const { dir, base, name } = this.utils.Package.Path.parse(filePath)
            const dirPath = this.config.RELATIVE_PATH ? dir.replace(rootPath, ".") : dir

            const item = document.createElement("div")
            item.className = "plugin-search-item"
            item.dataset.path = filePath
            if (this.config.SHOW_MTIME) {
                const time = stats.mtime.toLocaleString(undefined, { hour12: false })
                item.setAttribute("ty-hint", time)
            }

            const title = document.createElement("div")
            title.className = "plugin-search-item-title"
            title.textContent = this.config.SHOW_EXT ? base : name

            const path = document.createElement("div")
            path.className = "plugin-search-item-path"
            path.textContent = dirPath + this.utils.separator

            item.append(title, path)
            return item
        }

        let index = 0
        const showResult = this.utils.once(() => this.utils.show(this.entities.result))
        return source => {
            if (matcher(source)) {
                index++
                this.entities.files.appendChild(newItem(rootPath, source.path, source.stats))
                this.entities.counter.textContent = index
                showResult()
            }
        }
    }

    hide = () => {
        this.entities.window.hide()
        this.utils.hide(this.entities.searching)
        this.highlighter.clearSearch()
    }

    show = () => {
        this.entities.window.show()
        setTimeout(() => this.entities.input.select())
    }

    call = () => {
        if (!this.entities.window.hidden) {
            this.hide()
        } else {
            this.show()
        }
    }
}

module.exports = {
    plugin: searchMultiPlugin
}
