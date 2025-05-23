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
        <div id="plugin-search-multi-playground" class="plugin-common-hidden"></div>
        <div id="plugin-search-multi" class="plugin-common-modal plugin-common-hidden">
            <div id="plugin-search-multi-input">
                <input type="text" placeholder="${this.pluginName}">
                <div class="plugin-search-multi-btn-group">
                    <span class="option-btn" action="searchGrammarModal" ty-hint="${this.i18n.t('grammar')}">
                        <div class="ion-help-circled"></div>
                    </span>
                    <span class="option-btn ${(this.config.CASE_SENSITIVE) ? "select" : ""}" action="toggleCaseSensitive" ty-hint="${this.i18n.t('caseSensitive')}">
                        <svg class="icon"><use xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="#find-and-replace-icon-case"></use></svg>
                    </span>
                </div>
            </div>

            <div class="plugin-highlight-multi-result plugin-common-hidden"></div>

            <div class="plugin-search-multi-result plugin-common-hidden">
                <div class="search-result-title">${this.i18n.t('matchedFiles')}：<span>0</span></div>
                <div class="search-result-list"></div>
            </div>

            <div class="plugin-search-multi-info-item plugin-common-hidden">
                <div class="plugin-search-multi-info" data-lg="Front">${this.i18n.t('searching')}</div>
                <div class="typora-search-spinner">
                    <div class="rect1"></div><div class="rect2"></div><div class="rect3"></div><div class="rect4"></div><div class="rect5"></div>
                </div>
            </div>
        </div>
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
            modal: document.querySelector("#plugin-search-multi"),
            input: document.querySelector("#plugin-search-multi-input input"),
            buttonGroup: document.querySelector(".plugin-search-multi-btn-group"),
            highlightResult: document.querySelector(".plugin-highlight-multi-result"),
            result: document.querySelector(".plugin-search-multi-result"),
            resultCounter: document.querySelector(".plugin-search-multi-result .search-result-title span"),
            resultList: document.querySelector(".plugin-search-multi-result .search-result-list"),
            info: document.querySelector(".plugin-search-multi-info-item"),
        }
    }

    process = () => {
        this.searcher.process()
        this.highlighter.process()
        if (this.config.ALLOW_DRAG) {
            this.utils.dragFixedModal(this.entities.input, this.entities.modal)
        }
        this.entities.resultList.addEventListener("click", ev => {
            const target = ev.target.closest(".plugin-search-multi-item")
            if (!target) return
            const filepath = target.dataset.path
            this.utils.openFile(filepath)
            if (this.config.AUTO_HIDE) {
                this.utils.hide(this.entities.modal)
            }
        })
        this.entities.buttonGroup.addEventListener("click", ev => {
            const btn = ev.target.closest(".option-btn")
            if (!btn) return
            const action = btn.getAttribute("action")
            if (action === "searchGrammarModal") {
                this.searcher.showGrammar()
            } else if (action === "toggleCaseSensitive") {
                btn.classList.toggle("select")
                this.config.CASE_SENSITIVE = !this.config.CASE_SENSITIVE
            }
        })
        this.entities.input.addEventListener("keydown", ev => {
            switch (ev.key) {
                case "Enter":
                    if (!this.utils.metaKeyPressed(ev)) {
                        this.searchMulti()
                        return
                    }
                    const select = this.entities.resultList.querySelector(".plugin-search-multi-item.active")
                    if (!select) return
                    this.utils.openFile(select.dataset.path)
                    this.entities.input.focus()
                    break
                case "Escape":
                case "Backspace":
                    if (ev.key === "Escape" || ev.key === "Backspace" && this.config.BACKSPACE_TO_HIDE && !this.entities.input.value) {
                        this.hide()
                    }
                    break
                case "ArrowUp":
                case "ArrowDown":
                    ev.stopPropagation()
                    ev.preventDefault()
                    this.utils.scrollActiveItem(this.entities.resultList, ".plugin-search-multi-item.active", ev.key === "ArrowDown")
                    break
            }
        })
    }

    searchMulti = async (rootPath = this.utils.getMountFolder(), input = this.entities.input.value) => {
        const ast = this.getAST(input)
        if (!ast) return

        this.utils.hide(this.entities.result)
        this.utils.show(this.entities.info)
        this.entities.resultList.innerHTML = ""
        await this.searchMultiByAST(rootPath, ast)
        this.highlightMultiByAST(ast)
        this.utils.hide(this.entities.info)
    }

    getAST = (input = this.entities.input.value, optimize = this.config.OPTIMIZE_SEARCH) => {
        input = input.trim()
        if (!input) return

        try {
            const ast = this.searcher.parse(input, optimize)
            const explain = this.searcher.toExplain(ast)
            this.entities.input.setAttribute("title", explain)
            this.utils.notification.hide()
            return ast
        } catch (e) {
            this.entities.input.removeAttribute("title")
            this.utils.notification.show(e.toString().slice(7), "error", 7000)
            console.error(e)
        }
    }

    highlightMultiByAST = ast => {
        try {
            ast = ast || this.getAST()
            this.utils.hide(this.entities.highlightResult)
            if (!ast) return
            const tokens = this.searcher.getContentTokens(ast).filter(Boolean)
            if (tokens.length === 0) return

            const hitGroups = this.highlighter.doSearch(tokens)
            const hint = this.i18n.t("highlightHint")
            const itemList = Object.entries(hitGroups).map(([cls, { name, hits }]) => {
                const div = document.createElement("div")
                div.className = `plugin-highlight-multi-result-item ${cls}`
                div.dataset.pos = -1
                if (!this.config.REMOVE_BUTTON_HINT) {
                    div.setAttribute("ty-hint", hint)
                }
                div.appendChild(document.createTextNode(`${name} (${hits.length})`))
                return div
            })
            this.entities.highlightResult.innerHTML = ""
            this.entities.highlightResult.append(...itemList)
            this.utils.show(this.entities.highlightResult)
        } catch (e) {
            console.error(e)
        }
    }

    searchMultiByAST = async (rootPath, ast) => {
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
    }

    _showSearchResult = (rootPath, matcher) => {
        const newItem = (rootPath, filePath, stats) => {
            const { dir, base, name } = this.utils.Package.Path.parse(filePath)
            const dirPath = this.config.RELATIVE_PATH ? dir.replace(rootPath, ".") : dir

            const item = document.createElement("div")
            item.className = "plugin-search-multi-item"
            item.dataset.path = filePath
            if (this.config.SHOW_MTIME) {
                const time = stats.mtime.toLocaleString(undefined, { hour12: false })
                item.setAttribute("ty-hint", time)
            }

            const title = document.createElement("div")
            title.className = "plugin-search-multi-item-title"
            title.textContent = this.config.SHOW_EXT ? base : name

            const path = document.createElement("div")
            path.className = "plugin-search-multi-item-path"
            path.textContent = dirPath + this.utils.separator

            item.append(title, path)
            return item
        }

        let index = 0
        const showResult = this.utils.once(() => this.utils.show(this.entities.result))
        return source => {
            if (matcher(source)) {
                index++
                this.entities.resultList.appendChild(newItem(rootPath, source.path, source.stats))
                this.entities.resultCounter.textContent = index
                showResult()
            }
        }
    }

    isModalHidden = () => this.utils.isHidden(this.entities.modal)

    hide = () => {
        this.utils.hide(this.entities.modal)
        this.utils.hide(this.entities.info)
        this.highlighter.clearSearch()
    }

    show = () => {
        this.utils.show(this.entities.modal)
        setTimeout(() => this.entities.input.select())
    }

    call = () => {
        if (!this.isModalHidden()) {
            this.hide()
        } else {
            this.show()
        }
    }
}

module.exports = {
    plugin: searchMultiPlugin
}
