class searchMultiPlugin extends BasePlugin {
    styleTemplate = () => {
        const colors_style = this.config.STYLE_COLOR
            .map((color, idx) => `.cm-plugin-highlight-hit-${idx} { background-color: ${color} !important; }`)
            .join("\n")
        return { colors_style }
    }

    html = () => `
        <div id="plugin-search-multi" class="plugin-common-modal plugin-common-hidden">
            <div id="plugin-search-multi-input">
                <input type="text" placeholder="多元文件搜索">
                <div class="plugin-search-multi-btn-group">
                    <span class="option-btn" action="searchGrammarModal" ty-hint="搜索语法">
                        <div class="ion-information-circled"></div>
                    </span>
                    <span class="option-btn ${(this.config.CASE_SENSITIVE) ? "select" : ""}" action="toggleCaseSensitive" ty-hint="区分大小写">
                        <svg class="icon"><use xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="#find-and-replace-icon-case"></use></svg>
                    </span>
                </div>
            </div>

            <div class="plugin-highlight-multi-result plugin-common-hidden"></div>

            <div class="plugin-search-multi-result plugin-common-hidden">
                <div class="search-result-title">匹配的文件：<span>0</span></div>
                <div class="search-result-list"></div>
            </div>

            <div class="plugin-search-multi-info-item plugin-common-hidden">
                <div class="plugin-search-multi-info" data-lg="Front">Searching</div>
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
            const itemList = Object.entries(hitGroups).map(([cls, { name, hits }]) => {
                const div = document.createElement("div")
                div.className = `plugin-highlight-multi-result-item ${cls}`
                div.dataset.pos = -1
                div.setAttribute("ty-hint", "左键下一个；右键上一个")
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
            ? async (path, file, stats) => ({ path, file, stats, content: (await readFile(path)).toString() })
            : (path, file, stats) => ({ path, file, stats })

        const matcher = source => this.searcher.match(ast, source)
        const callback = this._showSearchResult(rootPath, matcher)

        await this._walkDir(rootPath, fileFilter, dirFilter, paramsBuilder, callback)
    }

    _showSearchResult = (rootPath, matcher) => {
        const newItem = (rootPath, filePath, stats) => {
            const { dir, base, name } = this.utils.Package.Path.parse(filePath)
            const dirPath = this.config.RELATIVE_PATH ? dir.replace(rootPath, ".") : dir

            const item = document.createElement("div")
            item.className = "plugin-search-multi-item"
            item.dataset.path = filePath
            if (this.config.SHOW_MTIME) {
                const time = stats.mtime.toLocaleString("chinese", { hour12: false })
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

    _walkDir = async (dir, fileFilter, dirFilter, paramsBuilder, callback) => {
        const { Fs: { promises: { readdir, stat } }, Path } = this.utils.Package

        async function walk(dir) {
            const files = await readdir(dir)
            const promises = files.map(async file => {
                const path = Path.join(dir, file)
                const stats = await stat(path)
                if (stats.isFile()) {
                    if (fileFilter(path, stats)) {
                        const params = await paramsBuilder(path, file, stats)
                        callback(params)
                    }
                } else if (stats.isDirectory()) {
                    if (dirFilter(file)) {
                        await walk(path)
                    }
                }
            })
            await Promise.all(promises)
        }

        await walk(dir)
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

class QualifierMixin {
    static _normalizeDate = date => new Date(date).setHours(0, 0, 0, 0)

    static OPERATOR = {
        ":": (a, b) => a.includes(b),
        "=": (a, b) => a === b,
        "!=": (a, b) => a !== b,
        ">=": (a, b) => a >= b,
        "<=": (a, b) => a <= b,
        ">": (a, b) => a > b,
        "<": (a, b) => a < b,
    }

    static OPERATOR_NAME = {
        ":": "包含",
        "=": "为",
        "!=": "不为",
        ">=": "大于等于",
        "<=": "小于等于",
        ">": "大于",
        "<": "小于",
    }

    static UNITS = {
        k: 1 << 10,
        m: 1 << 20,
        g: 1 << 30,
        kb: 1 << 10,
        mb: 1 << 20,
        gb: 1 << 30,
    }

    static PREPROCESS = {
        noop: (scope, operator, operand, operandType) => operand,
        resolveNumber: (scope, operator, operand, operandType) => {
            if (operandType === "REGEXP") {
                return operand
            }
            return operand.replace(/[_,]/g, "")  // supports thousands separator
        },
        resolveBoolean: (scope, operator, operand, operandType) => {
            if (operandType === "REGEXP") {
                return operand
            }
            switch (operand.toLowerCase()) {
                case "yes":
                    return "true"
                case "no":
                    return "false"
                default:
                    return operand
            }
        },
        resolveDate: (scope, operator, operand, operandType) => {
            if (operandType === "REGEXP") {
                return operand
            }
            const oneDay = 24 * 60 * 60 * 1000
            const today = new Date()
            const tomorrow = new Date(today.getTime() + oneDay)
            const yesterday = new Date(today.getTime() - oneDay)
            const predefined = { today, tomorrow, yesterday }
            const replacement = predefined[operand.toLowerCase()]
            return replacement ? replacement.toISOString().slice(0, 10) : operand
        },
    }

    static VALIDATE = {
        isStringOrRegexp: (scope, operator, operand, operandType) => {
            if (operandType === "REGEXP") {
                if (operator !== ":") {
                    throw new Error(`In ${scope}: Regex operands only support the ":" operator`)
                }
                try {
                    new RegExp(operand)
                } catch (e) {
                    throw new Error(`In ${scope}: Invalid regex: "${operand}"`)
                }
            }
            if (operator !== ":" && operator !== "=" && operator !== "!=") {
                throw new Error(`In ${scope}: Only supports "=", "!=", and ":" operators`)
            }
        },
        isComparable: (scope, operator, operand, operandType) => {
            if (operandType === "REGEXP") {
                throw new Error(`In ${scope}: Regex operands are not valid for numerical comparisons`)
            }
            if (operator === ":") {
                throw new Error(`In ${scope}: The ":" operator is not valid for numerical comparisons`)
            }
        },
        isBoolean: (scope, operator, operand, operandType) => {
            if (operator !== "=" && operator !== "!=") {
                throw new Error(`In ${scope}: Only supports "=" and "!=" operators for logical comparisons`)
            }
            if (operandType === "REGEXP") {
                throw new Error(`In ${scope}: Regex operands are not valid for logical comparisons`)
            }
            if (operand !== "true" && operand !== "false") {
                throw new Error(`In ${scope}: Operand must be "true" or "false"`)
            }
        },
        isSize: (scope, operator, operand, operandType) => {
            this.VALIDATE.isComparable(scope, operator, operand, operandType)
            const units = [...Object.keys(this.UNITS)].sort((a, b) => b.length - a.length).join("|")
            const regex = new RegExp(`^\\d+(\\.\\d+)?(${units})$`, "i")
            if (!regex.test(operand)) {
                throw new Error(`In ${scope}: Operand must be a number followed by a unit: ${units}`)
            }
        },
        isNumber: (scope, operator, operand, operandType) => {
            this.VALIDATE.isComparable(scope, operator, operand, operandType)
            if (isNaN(operand)) {
                throw new Error(`In ${scope}: Operand must be a valid number`)
            }
        },
        isDate: (scope, operator, operand, operandType) => {
            this.VALIDATE.isComparable(scope, operator, operand, operandType)
            if (isNaN(new Date(operand).getTime())) {
                throw new Error(`In ${scope}: Operand must be a valid date string`)
            }
        },
    }

    static CAST = {
        toStringOrRegexp: (operand, operandType) => operandType === "REGEXP" ? new RegExp(operand) : operand.toString(),
        toNumber: operand => Number(operand),
        toBoolean: operand => operand.toLowerCase() === "true",
        toBytes: operand => {
            const units = [...Object.keys(this.UNITS)].sort((a, b) => b.length - a.length).join("|")
            const match = operand.match(/^(\d+(\.\d+)?)([a-z]+)$/i)
            if (!match) {
                throw new Error(`Operand must be a number followed by a unit: ${units}`)
            }
            const unit = match[3].toLowerCase()
            if (!this.UNITS.hasOwnProperty(unit)) {
                throw new Error(`Only supports unit: ${units}`)
            }
            return parseFloat(match[1]) * this.UNITS[unit]
        },
        toDate: this._normalizeDate,
    }

    static QUERY = {
        normalizeDate: this._normalizeDate,
    }

    static MATCH = {
        primitiveCompare: (scope, operator, operand, queryResult) => this.OPERATOR[operator](queryResult, operand),
        stringRegexp: (scope, operator, operand, queryResult) => operand.test(queryResult),
        arrayCompare: (scope, operator, operand, queryResult) => queryResult.some(data => this.OPERATOR[operator](data, operand)),
        arrayRegexp: (scope, operator, operand, queryResult) => queryResult.some(data => operand.test(data)),
    }
}

/**
 * The matching process consists of the following steps: (Steps 1-4 are executed once; steps 5-6 are executed repeatedly)
 *   1. Parse:      Parses the input to generate an Abstract Syntax Tree (AST)
 *   2. Preprocess: Convert certain specific, predefined, and special meaning vocabulary (e.g. converting 'today' in 'mtime=today' to '2024-01-01')
 *   3. Validate:   Validates the AST for correctness
 *   4. Cast:       Converts operand within the AST nodes into a usable format (e.g. converting '2024-01-01' in 'mtime=2024-01-01' to a timestamp for easier matching). The result is `castResult`
 *   5. Query:      Retrieves file data, resulting in `queryResult`
 *   6. Match:      Matches `castResult` (from step 4) with `queryResult` (from step 5)
 *
 * A qualifier has the following attributes:
 *   {string}   scope:         The query scope
 *   {string}   name:          A descriptive name for explanation purposes
 *   {boolean}  is_meta:       Indicates if the qualifier scope is a metadata property
 *   {boolean}  read_file:     Determines if the qualifier needs to read file content
 *   {number}   cost:          The performance cost associated with the `query` function. 1: Read file stats;  2: Read file content;  3: Parse file content;  Plus 0.5 when the user input is a regex
 *   {function} preprocess:    Convert certain specific, predefined, and special meaning vocabulary from the user input. Defaults to `QualifierMixin.PREPROCESS.noop`
 *   {function} validate:      Checks user input and obtain `validateError`. Defaults to `QualifierMixin.VALIDATE.isStringOrRegexp`
 *   {function} cast:          Converts user input for easier matching and obtain `castResult`. Defaults to `QualifierMixin.CAST.toStringOrRegexp`
 *   {function} query:         Retrieves data from source and obtain `queryResult`
 *   {function} match_keyword: Matches `castResult` with `queryResult` when the user input is a keyword. Defaults to `QualifierMixin.MATCH.compare`
 *   {function} match_phrase:  Matches `castResult` with `queryResult` when the user input is a phrase. Behaves the same as `match_keyword` by default
 *   {function} match_regexp:  Matches `castResult` with `queryResult` when the user input is a regexp. Defaults to `QualifierMixin.MATCH.regexp`
 */
class Searcher {
    constructor(plugin) {
        this.MIXIN = QualifierMixin
        this.config = plugin.config
        this.utils = plugin.utils
        this.parser = plugin.utils.searchStringParser
        this.qualifiers = new Map()
    }

    process() {
        const qualifiers = [...this.buildBaseQualifiers(), ...this.buildMarkdownQualifiers()]
        qualifiers.forEach(q => {
            q.preprocess = q.preprocess || this.MIXIN.PREPROCESS.noop
            q.validate = q.validate || this.MIXIN.VALIDATE.isStringOrRegexp
            q.cast = q.cast || this.MIXIN.CAST.toStringOrRegexp
            q.KEYWORD = q.match_keyword || this.MIXIN.MATCH.primitiveCompare
            q.PHRASE = q.match_phrase || q.KEYWORD
            q.REGEXP = q.match_regexp || this.MIXIN.MATCH.stringRegexp
            this.qualifiers.set(q.scope, q)
        })
        this.parser.setQualifier(qualifiers.map(q => q.scope), [...Object.keys(this.MIXIN.OPERATOR)])
    }

    buildBaseQualifiers() {
        const {
            PREPROCESS: { resolveDate, resolveNumber, resolveBoolean },
            VALIDATE: { isSize, isDate, isNumber, isBoolean },
            CAST: { toBytes, toDate, toNumber, toBoolean },
            MATCH: { arrayCompare, arrayRegexp },
            QUERY: { normalizeDate },
        } = this.MIXIN
        const { splitFrontMatter, Package: { Path } } = this.utils
        const QUERY = {
            default: ({ path, file, stats, content }) => `${content}\n${path}`,
            path: ({ path, file, stats, content }) => path,
            dir: ({ path, file, stats, content }) => Path.dirname(path),
            file: ({ path, file, stats, content }) => file,
            name: ({ path, file, stats, content }) => Path.parse(file).name,
            ext: ({ path, file, stats, content }) => Path.extname(file),
            size: ({ path, file, stats, content }) => stats.size,
            atime: ({ path, file, stats, content }) => normalizeDate(stats.atime),
            mtime: ({ path, file, stats, content }) => normalizeDate(stats.mtime),
            birthtime: ({ path, file, stats, content }) => normalizeDate(stats.birthtime),
            content: ({ path, file, stats, content }) => content,
            linenum: ({ path, file, stats, content }) => content.split("\n").length,
            charnum: ({ path, file, stats, content }) => content.length,
            crlf: ({ path, file, stats, content }) => content.includes("\r\n"),
            hasimage: ({ path, file, stats, content }) => /!\[.*?\]\(.*\)|<img.*?src=".*?"/.test(content),
            haschinese: ({ path, file, stats, content }) => /\p{sc=Han}/gu.test(content),
            hasinvisiblechar: ({ path, file, stats, content }) => /[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200D\uFEFF]/.test(content),
            line: ({ path, file, stats, content }) => content.split("\n").map(e => e.trim()),
            frontmatter: ({ path, file, stats, content }) => {
                const { yamlObject } = splitFrontMatter(content)
                return yamlObject ? JSON.stringify(yamlObject) : ""
            },
            chinesenum: ({ path, file, stats, content }) => {
                let count = 0
                for (const _ of content.matchAll(/\p{sc=Han}/gu)) {
                    count++
                }
                return count
            },
        }
        const PROCESS = {
            date: { preprocess: resolveDate, validate: isDate, cast: toDate },
            number: { preprocess: resolveNumber, validate: isNumber, cast: toNumber },
            boolean: { preprocess: resolveBoolean, validate: isBoolean, cast: toBoolean },
            stringArray: { match_keyword: arrayCompare, match_regexp: arrayRegexp },
        }
        const qualifiers = [
            { scope: "default", name: "内容或路径", is_meta: false, read_file: true, cost: 2 },
            { scope: "path", name: "路径", is_meta: true, read_file: false, cost: 1 },
            { scope: "dir", name: "文件所属目录", is_meta: true, read_file: false, cost: 1 },
            { scope: "file", name: "文件名", is_meta: true, read_file: false, cost: 1 },
            { scope: "name", name: "文件名(无扩展名)", is_meta: true, read_file: false, cost: 1 },
            { scope: "ext", name: "扩展名", is_meta: true, read_file: false, cost: 1 },
            { scope: "content", name: "内容", is_meta: false, read_file: true, cost: 2 },
            { scope: "frontmatter", name: "FrontMatter", is_meta: false, read_file: true, cost: 3 },
            { scope: "size", name: "文件大小", is_meta: true, read_file: false, cost: 1, validate: isSize, cast: toBytes },
            { scope: "birthtime", name: "创建时间", is_meta: true, read_file: false, cost: 1, ...PROCESS.date },
            { scope: "mtime", name: "修改时间", is_meta: true, read_file: false, cost: 1, ...PROCESS.date },
            { scope: "atime", name: "访问时间", is_meta: true, read_file: false, cost: 1, ...PROCESS.date },
            { scope: "linenum", name: "行数", is_meta: true, read_file: true, cost: 2, ...PROCESS.number },
            { scope: "charnum", name: "字符数", is_meta: true, read_file: true, cost: 2, ...PROCESS.number },
            { scope: "chinesenum", name: "中文字符数", is_meta: true, read_file: true, cost: 2, ...PROCESS.number },
            { scope: "crlf", name: "换行符为CRLF", is_meta: true, read_file: true, cost: 2, ...PROCESS.boolean },
            { scope: "hasimage", name: "包含图片", is_meta: true, read_file: true, cost: 2, ...PROCESS.boolean },
            { scope: "haschinese", name: "包含中文字符", is_meta: true, read_file: true, cost: 2, ...PROCESS.boolean },
            { scope: "hasinvisiblechar", name: "包含不可见字符", is_meta: true, read_file: true, cost: 2, ...PROCESS.boolean },
            { scope: "line", name: "某行", is_meta: false, read_file: true, cost: 2, ...PROCESS.stringArray },
        ]
        return qualifiers.map(q => ({ ...q, query: QUERY[q.scope] }))
    }

    buildMarkdownQualifiers() {
        // Prevent re-parsing of the same file in a SINGLE query
        const cache = fn => {
            let cached, result
            return arg => {
                if (arg !== cached) {
                    result = fn(arg)
                    cached = arg
                }
                return result
            }
        }

        const PARSER = {
            inline: cache(this.utils.parseMarkdownInline),
            block: cache(this.utils.parseMarkdownBlock),
        }

        const FILTER = {
            is: type => node => node.type === type,
            wrappedBy: type => {
                const openType = `${type}_open`
                const closeType = `${type}_close`
                let balance = 0
                return node => {
                    if (node.type === openType) {
                        balance++
                    } else if (node.type === closeType) {
                        balance--
                    }
                    return balance > 0
                }
            },
            wrappedByTag: (type, tag) => {
                const openType = `${type}_open`
                const closeType = `${type}_close`
                let balance = 0
                return node => {
                    if (node.type === openType && node.tag === tag) {
                        balance++
                    } else if (node.type === closeType && node.tag === tag) {
                        balance--
                    }
                    return balance > 0
                }
            },
            wrappedByMulti: (...types) => {
                let wrapped = false
                const balances = new Uint8Array(types.length).fill(0)
                const flags = new Map(
                    types.flatMap((type, idx) => [
                        [`${type}_open`, [idx, 1]],
                        [`${type}_close`, [idx, -1]],
                    ])
                )
                return node => {
                    const hit = flags.get(node.type)
                    if (hit) {
                        const [idx, addend] = hit
                        balances[idx] += addend
                        balances.fill(0, idx + 1)
                        wrapped = balances.every(val => val > 0)
                    }
                    return wrapped
                }
            }
        }

        const TRANSFORMER = {
            content: node => node.content,
            info: node => node.info,
            infoAndContent: node => `${node.info}\n${node.content}`,
            attrAndContent: node => {
                const attrs = node.attrs || []
                const attrContent = attrs.map(l => l[l.length - 1]).join(" ")
                return `${attrContent}${node.content}`
            },
            regexpContent: regex => {
                return node => {
                    const content = node.content.trim()
                    const result = [...content.matchAll(regex)]
                    return result.map(([_, text]) => text).join(" ")
                }
            },
            contentLine: node => node.content.split("\n"),
            taskContent: (selectType = 0) => {
                const regexp = /^\[(x|X| )\]\s+(.+)/
                return node => {
                    const content = node.content.trim()
                    const hit = content.match(regexp)
                    if (!hit) {
                        return ""
                    }
                    const [_, selectText, taskText] = hit
                    // 0:both, 1:selected, -1:unselected
                    switch (selectType) {
                        case 0:
                            return taskText
                        case 1:
                            return (selectText === "x" || selectText === "X") ? taskText : ""
                        case -1:
                            return selectText === " " ? taskText : ""
                        default:
                            return ""
                    }
                }
            },
        }

        const preorder = (ast = [], filter) => {
            const output = []
            const recurse = ast => {
                for (const node of ast) {
                    if (filter(node)) {
                        output.push(node)
                    }
                    const c = node.children
                    if (c && c.length) {
                        recurse(c)
                    }
                }
            }
            recurse(ast)
            return output
        }

        const buildQuery = (parser, filter, transformer) => {
            return source => {
                const ast = parser(source.content)
                const nodes = preorder(ast, filter)
                return nodes.flatMap(transformer).filter(Boolean)
            }
        }

        const buildQualifier = (scope, name, parser, filter, transformer) => ({
            scope,
            name,
            is_meta: false,
            read_file: true,
            cost: 3,
            preprocess: this.MIXIN.PREPROCESS.noop,
            validate: this.MIXIN.VALIDATE.isStringOrRegexp,
            cast: this.MIXIN.CAST.toStringOrRegexp,
            match_keyword: this.MIXIN.MATCH.arrayCompare,
            match_phrase: this.MIXIN.MATCH.arrayCompare,
            match_regexp: this.MIXIN.MATCH.arrayRegexp,
            query: buildQuery(parser, filter, transformer),
        })

        return [
            buildQualifier("blockcode", "代码块", PARSER.block, FILTER.is("fence"), TRANSFORMER.infoAndContent),
            buildQualifier("blockcodelang", "代码块语言", PARSER.block, FILTER.is("fence"), TRANSFORMER.info),
            buildQualifier("blockcodebody", "代码块内容", PARSER.block, FILTER.is("fence"), TRANSFORMER.content),
            buildQualifier("blockcodeline", "代码块的某行", PARSER.block, FILTER.is("fence"), TRANSFORMER.contentLine),
            buildQualifier("blockhtml", "HTML块", PARSER.block, FILTER.is("html_block"), TRANSFORMER.content),
            buildQualifier("blockquote", "引用块", PARSER.block, FILTER.wrappedBy("blockquote"), TRANSFORMER.content),
            buildQualifier("table", "表格", PARSER.block, FILTER.wrappedBy("table"), TRANSFORMER.content),
            buildQualifier("thead", "表头", PARSER.block, FILTER.wrappedBy("thead"), TRANSFORMER.content),
            buildQualifier("tbody", "表体", PARSER.block, FILTER.wrappedBy("tbody"), TRANSFORMER.content),
            buildQualifier("ol", "有序列表", PARSER.block, FILTER.wrappedBy("ordered_list"), TRANSFORMER.content),
            buildQualifier("ul", "无序列表", PARSER.block, FILTER.wrappedBy("bullet_list"), TRANSFORMER.content),
            buildQualifier("task", "任务列表", PARSER.block, FILTER.wrappedByMulti("bullet_list", "list_item", "paragraph"), TRANSFORMER.taskContent(0)),
            buildQualifier("taskdone", "已完成任务", PARSER.block, FILTER.wrappedByMulti("bullet_list", "list_item", "paragraph"), TRANSFORMER.taskContent(1)),
            buildQualifier("tasktodo", "未完成任务", PARSER.block, FILTER.wrappedByMulti("bullet_list", "list_item", "paragraph"), TRANSFORMER.taskContent(-1)),
            buildQualifier("head", "标题", PARSER.block, FILTER.wrappedBy("heading"), TRANSFORMER.content),
            buildQualifier("h1", "一级标题", PARSER.block, FILTER.wrappedByTag("heading", "h1"), TRANSFORMER.content),
            buildQualifier("h2", "二级标题", PARSER.block, FILTER.wrappedByTag("heading", "h2"), TRANSFORMER.content),
            buildQualifier("h3", "三级标题", PARSER.block, FILTER.wrappedByTag("heading", "h3"), TRANSFORMER.content),
            buildQualifier("h4", "四级标题", PARSER.block, FILTER.wrappedByTag("heading", "h4"), TRANSFORMER.content),
            buildQualifier("h5", "五级标题", PARSER.block, FILTER.wrappedByTag("heading", "h5"), TRANSFORMER.content),
            buildQualifier("h6", "六级标题", PARSER.block, FILTER.wrappedByTag("heading", "h6"), TRANSFORMER.content),
            buildQualifier("highlight", "高亮文字", PARSER.block, FILTER.is("text"), TRANSFORMER.regexpContent(/==(.+)==/g)),
            buildQualifier("image", "图片", PARSER.inline, FILTER.is("image"), TRANSFORMER.attrAndContent),
            buildQualifier("code", "代码", PARSER.inline, FILTER.is("code_inline"), TRANSFORMER.content),
            buildQualifier("link", "链接", PARSER.inline, FILTER.wrappedBy("link"), TRANSFORMER.attrAndContent),
            buildQualifier("strong", "加粗文字", PARSER.inline, FILTER.wrappedBy("strong"), TRANSFORMER.content),
            buildQualifier("em", "斜体文字", PARSER.inline, FILTER.wrappedBy("em"), TRANSFORMER.content),
            buildQualifier("del", "删除线文字", PARSER.inline, FILTER.wrappedBy("s"), TRANSFORMER.content),
        ]
    }

    parse(input, optimize) {
        input = this.config.CASE_SENSITIVE ? input : input.toLowerCase()
        const ast = this.parser.parse(input)
        this.postParse(ast)
        return optimize ? this.optimize(ast) : ast
    }

    postParse(ast) {
        const { REGEXP } = this.parser.TYPE
        this.parser.walk(ast, node => {
            const qualifier = this.qualifiers.get(node.scope.toLowerCase())
            node.operand = qualifier.preprocess(node.scope, node.operator, node.operand, node.type)
            node.validateError = qualifier.validate(node.scope.toUpperCase(), node.operator, node.operand, node.type)
            node.cost = qualifier.cost + (node.type === REGEXP ? 0.5 : 0)
            node.castResult = qualifier.cast(node.operand, node.type)
        })
        return ast
    }

    /**
     * Process OR/AND nodes by:
     *   1. Gathering data child nodes into `dataNodes`
     *   2. Sorting `dataNodes` by `cost`
     *   3. Rebuilding the subtree based on `dataNodes` to favor low-cost operations
     */
    optimize(ast) {
        if (!ast) return

        const { OR, AND } = this.parser.TYPE
        const setCost = node => {
            if (!node) return

            setCost(node.left)
            setCost(node.right)

            const rootCost = node.cost || 1
            const leftCost = (node.left && node.left.cost) || 1
            const rightCost = (node.right && node.right.cost) || 1
            node.cost = Math.max(rootCost, leftCost, rightCost)
        }
        const getDataNodes = (cur, root, dataNodes = []) => {
            if (cur.type === root.type) {
                if (cur.right) {
                    getDataNodes(cur.right, root, dataNodes)
                }
                if (cur.left) {
                    getDataNodes(cur.left, root, dataNodes)
                }
            } else {
                dataNodes.push(cur)
            }
            return dataNodes
        }
        const rebuild = node => {
            if (!node) return

            if (node.type === OR || node.type === AND) {
                const dataNodes = getDataNodes(node, node)
                if (dataNodes.length > 1) {
                    dataNodes.sort((a, b) => a.cost - b.cost)
                    let newNode = dataNodes.shift()
                    while (dataNodes.length) {
                        const right = dataNodes.shift()
                        newNode = { type: node.type, left: newNode, right: right, cost: right.cost }
                    }
                    node.left = newNode.left
                    node.right = newNode.right
                    node.cost = newNode.cost
                }
            }

            rebuild(node.right)
            rebuild(node.left)
        }

        setCost(ast)
        rebuild(ast)
        return ast
    }

    match(ast, source) {
        return this.parser.evaluate(ast, node => this._match(node, source))
    }

    _match(node, source) {
        const { scope, operator, castResult, type } = node
        const qualifier = this.qualifiers.get(scope)
        let queryResult = qualifier.query(source)
        if (!this.config.CASE_SENSITIVE) {
            if (typeof queryResult === "string") {
                queryResult = queryResult.toLowerCase()
            } else if (Array.isArray(queryResult) && typeof queryResult[0] === "string") {
                queryResult = queryResult.map(s => s.toLowerCase())
            }
        }
        return qualifier[type](scope, operator, castResult, queryResult)
    }

    getReadFileScope(ast) {
        const scope = new Set()
        const needRead = new Set([...this.qualifiers.values()].filter(q => q.read_file).map(q => q.scope))
        this.parser.walk(ast, node => {
            if (needRead.has(node.scope)) {
                scope.add(node.scope)
            }
        })
        return [...scope]
    }

    getContentTokens(ast) {
        const { KEYWORD, PHRASE, REGEXP, OR, AND, NOT } = this.parser.TYPE
        const isMeta = new Set([...this.qualifiers.values()].filter(q => q.is_meta).map(q => q.scope))
        const contentNodes = new Set()
        const _eval = (node, negated) => {
            const { type, left, right, scope } = node
            switch (type) {
                case KEYWORD:
                case PHRASE:
                case REGEXP:
                    if (!isMeta.has(scope)) {
                        node._negated = negated
                        contentNodes.add(node)
                    }
                    break
                case OR:
                case AND:
                    _eval(left, negated)
                    _eval(right, negated)
                    break
                case NOT:
                    if (left) {
                        _eval(left, negated)
                    }
                    _eval(right, !negated)
                    break
                default:
                    throw new Error(`Unknown AST node「${type}」`)
            }
        }

        _eval(ast)
        return [...contentNodes]
            .filter(n => !n._negated)
            .map(n => {
                const operand = n.operand
                return n.type === REGEXP ? operand : operand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
            })
    }

    // Converts to a mermaid graph. However, the generated graph is too large and there is no place to put it, so it is not used for now.
    toMermaid(ast) {
        let idx = 0
        const { KEYWORD, PHRASE, REGEXP, OR, AND, NOT } = this.parser.TYPE

        function getName(node) {
            if (node._shortName) {
                return node._shortName
            }
            node._shortName = "T" + ++idx
            const prefix = node.negated ? "-" : ""
            const operand = node.type === REGEXP ? `/${node.operand}/` : node.operand
            return `${node._shortName}("${prefix}${node.scope}${node.operator} ${operand}")`
        }

        function link(left, right) {
            return left.tail.flatMap(t => right.head.map(h => `${getName(t)} --> ${getName(h)}`))
        }

        function _eval(node, negated) {
            let left, right
            switch (node.type) {
                case AND:
                    left = _eval(node.left, negated)
                    right = _eval(node.right, negated)
                    node.head = left.head
                    node.tail = right.tail
                    node.result = [...left.result, ...link(left, right), ...right.result]
                    return node
                case OR:
                    left = _eval(node.left, negated)
                    right = _eval(node.right, negated)
                    node.head = [...left.head, ...right.head]
                    node.tail = [...left.tail, ...right.tail]
                    node.result = [...left.result, ...right.result]
                    return node
                case NOT:
                    left = node.left ? _eval(node.left, negated) : { result: [], head: [], tail: [] }
                    right = _eval(node.right, !negated)
                    node.head = node.left ? left.head : right.head
                    node.tail = right.tail
                    node.result = [...left.result, ...link(left, right), ...right.result]
                    return node
                case KEYWORD:
                case PHRASE:
                case REGEXP:
                    node.negated = negated
                    node.head = [node]
                    node.tail = [node]
                    node.result = []
                    return node
                default:
                    throw new Error(`Unknown node type: ${node.type}`)
            }
        }

        ast = JSON.parse(JSON.stringify(ast))  // deep copy
        const { head, tail, result } = _eval(ast)
        const start = head.map(h => `S --> ${getName(h)}`)
        const end = tail.map(t => `${getName(t)} --> E`)
        return ["graph LR", "S(Start)", "E(End)", ...result, ...start, ...end].join("\n")
    }

    toExplain(ast) {
        const { KEYWORD, PHRASE, REGEXP, OR, AND, NOT } = this.parser.TYPE

        const getName = node => {
            const name = this.qualifiers.get(node.scope).name
            const negated = node.negated ? "不" : ""
            const operator = node.type === REGEXP ? "匹配正则" : this.MIXIN.OPERATOR_NAME[node.operator]
            const operand = node.type === REGEXP ? `/${node.operand}/` : node.operand
            return `「${name}${negated}${operator}${operand}」`
        }

        const link = (left, right) => {
            return left.result.flatMap(lPath => right.result.map(rPath => [...lPath, ...rPath]))
        }

        const _eval = (node, negated) => {
            let left, right
            switch (node.type) {
                case AND:
                    left = _eval(node.left, negated)
                    right = _eval(node.right, negated)
                    node.result = link(left, right)
                    return node
                case OR:
                    left = _eval(node.left, negated)
                    right = _eval(node.right, negated)
                    node.result = [...left.result, ...right.result]
                    return node
                case NOT:
                    left = node.left ? _eval(node.left, negated) : { result: [[]], head: [], tail: [] }
                    right = _eval(node.right, !negated)
                    node.result = link(left, right)
                    return node
                case KEYWORD:
                case PHRASE:
                case REGEXP:
                    node.negated = negated
                    node.result = [[node]]
                    return node
                default:
                    throw new Error(`Unknown node type: ${node.type}`)
            }
        }

        ast = JSON.parse(JSON.stringify(ast))  // deep copy
        const { result } = _eval(ast)
        const content = result
            .map(path => path.map(getName).join("且"))
            .map((path, idx) => `${idx + 1}. ${path}`)
            .join("\n")
        return "搜索满足如下任意一个要求的文件：\n" + content
    }

    showGrammar() {
        const operator = [...Object.keys(this.MIXIN.OPERATOR)]
        const scope = [...this.qualifiers.values()]
        const metaScope = scope.filter(s => s.is_meta)
        const contentScope = scope.filter(s => !s.is_meta)

        const genScope = scopes => scopes.map(e => `<code title="${e.name}">${e.scope}</code>`).join("、")
        const genOperator = (...operators) => operators.map(operator => `<code>${operator}</code>`).join("、")
        const genUL = (...li) => `<ul style="padding-left: 1em; word-break: break-word;">${li.map(e => `<li>${e}</li>`).join("")}</ul>`
        const scopeDesc = genUL(
            `搜索文件元数据：${genScope(metaScope)}`,
            `搜索文件内容：${genScope(contentScope)}`,
            `默认值 default = path + content（路径+文件内容）`,
        )
        const operatorDesc = genUL(
            `${genOperator(":")}表示文本包含或正则匹配`,
            `${genOperator("=", "!=")}表示文本、数值、布尔的严格相等/不相等`,
            `${genOperator(">", "<", ">=", "<=")}表示数值比较`,
        )

        const genInfo = title => `<span class="modal-label-info ion-information-circled" title="${title}"></span>`
        const agreement = genInfo("查询表达式以斜体表示")
        const diffInfo = genInfo("注意区分：\nhead=plugin 表示标题为 plugin\nhead:plugin 表示标题包含 plugin")
        const scopeInfo = genInfo(`1. 为了简化搜索，可以同时省略搜索范围和运算符，此时搜索范围默认为 default，运算符默认为 :
2. 搜索范围 default 表示路径（path）和文件内容（content），运算符 : 表示文本包含
3. 也就是说，pear 等价于 default:pear ，也等价于 path:pear OR content:pear
4. 其含义为：搜索「文件路径或文件内容包含 pear」的文件`)

        const keywordDesc = `
<table>
    <tr><th>关键字</th><th>说明</th></tr>
    <tr><td>空格</td><td>连接两个查询条件，表示逻辑与。文档应该同时满足空格左右两侧的查询条件，等价于 AND</td></tr>
    <tr><td>|</td><td>连接两个查询条件，表示逻辑或。文档应该满足 | 左右两侧中至少一个查询条件，等价于 OR</td></tr>
    <tr><td>-</td><td>后接一个查询条件，表示逻辑非。文档不可满足 - 右侧的查询条件，等价于 NOT</td></tr>
    <tr><td>""</td><td>引号包裹文本，表示词组</td></tr>
    <tr><td>/regex/</td><td>JavaScript 风格的正则表达式</td></tr>
    <tr><td>scope</td><td>搜索范围，规定在哪个属性上搜索${scopeDesc}</td></tr>
    <tr><td>operator</td><td>运算符，用于连接搜索范围和关键词，表示二者的匹配关系${operatorDesc}</td></tr>
    <tr><td>()</td><td>小括号，用于调整运算优先级</td></tr>
</table>`

        const example = `
<table>
    <tr><th>示例${agreement}</th><th>搜索文件</th></tr>
    <tr><td><em>pear</em></td><td>包含 pear。等价于 <em>default:pear</em> ${scopeInfo}</td></tr>
    <tr><td><em>-pear</em></td><td>不含 pear。等价于 <em>NOT pear</em></td></tr>
    <tr><td><em>sour pear</em></td><td>包含 sour 和 pear。等价于 <em>sour AND pear</em></td></tr>
    <tr><td><em>sour | pear</em></td><td>包含 sour 或 pear。等价于 <em>sour OR pear</em></td></tr>
    <tr><td><em>"sour pear"</em></td><td>包含 sour pear 这一词组</td></tr>
    <tr><td><em>/\\bsour\\b/ pear mtime<2024-05-16</em></td><td>匹配正则 \\bsour\\b（全字匹配 sour），且包含 pear，且文件的修改时间早于 2024-05-16</td></tr>
    <tr><td><em>frontmatter:dev | head=plugin | strong:MIT</em></td><td>YAML Front Matter 包含 dev，或标题内容为 plugin，或加粗文字包含 MIT ${diffInfo}</td></tr>
    <tr><td><em>size>10kb (linenum>=1000 | hasimage=true)</em></td><td>文件大小超过 10KB，并且文件要么至少有 1000 行，要么包含图片</td></tr>
    <tr><td><em>path:(info | warn | err) -ext:md</em></td><td>文件路径包含 info 或 warn 或 err，且扩展名不含 md</td></tr>
    <tr><td><em>thead:k8s h2:prometheus blockcode:"kubectl apply"</em></td><td>表头包含 k8s，且二级标题包含 prometheus，且代码块内容包含 kubectl apply</td></tr>
</table>`

        const content = `
<query> ::= <expression>
<expression> ::= <term> ( <or> <term> )*
<term> ::= <factor> ( <conjunction> <factor> )*
<factor> ::= <qualifier>? <match>
<qualifier> ::= <scope> <operator>
<match> ::= <keyword> | '"'<keyword>'"' | '/'<regex>'/' | '('<expression>')'
<conjunction> ::= <and> | <not>
<or> ::= 'OR' | '|'
<and> ::= 'AND' | ' '
<not> ::= 'NOT' | '-'
<keyword> ::= [^\\s"()|]+
<regex> ::= [^/]+
<operator> ::= ${operator.map(s => `'${s}'`).join(" | ")}
<scope> ::= ${[...metaScope, ...contentScope].map(s => `'${s.scope}'`).join(" | ")}`

        const desc = `<b>多元文件搜索通过组合不同的条件来精确查找文本文件。</b>
每个条件由三部分组成：搜索范围(scope)、运算符(operator)、关键词(operand)，如 <em>size>2kb</em>（含义：文件尺寸大于 2KB）、<em>ext:txt</em>（含义：文件扩展名包含 txt）、<em>content:/\\d{8}/</em>（含义：文件内容能匹配正则 \\d{8}）<br />
条件之间用 AND 连接，表示必须满足所有条件。如 <em>size>2kb AND ext:txt</em><br />
条件之间用 OR 连接，表示至少满足其中一个条件。如 <em>size>2kb OR ext:txt</em><br />
在条件前面添加 NOT，表示不可满足此条件。如 <em>NOT size>2kb</em>`
        const components = [
            { label: desc, type: "blockquote", tabIndex: 0 },
            { label: example, type: "p" },
            { label: "具体用法", type: "p" },
            { label: keywordDesc, type: "p" },
            { label: "形式文法", type: "p" },
            { label: "", type: "textarea", rows: 20, content },
        ]
        this.utils.dialog.modal({ title: "多元文件搜索", width: "600px", components })
    }
}

class Highlighter {
    constructor(plugin) {
        this.plugin = plugin
        this.utils = plugin.utils
        this.config = plugin.config
        this._resetStatus()
    }

    process = () => {
        this._polyfill()

        this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.afterAddCodeBlock, (cid, fence) => {
            if (this.searchStatus.futureCM.has(cid)) {
                this._searchOnCM(fence)
            }
        }, 999)

        this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.otherFileOpened, this.utils.debounce(() => {
            const isShow = this.utils.isShow(this.plugin.entities.modal)
            if (isShow) {
                this.plugin.highlightMultiByAST()
            }
        }, 1000))

        this.utils.entities.eContent.addEventListener("mousedown", ev => {
            const shouldClear = this.searchStatus.hits.length && !ev.target.closest("#plugin-search-multi")
            if (shouldClear) {
                this.clearSearch()
            }
        }, true)

        document.querySelector(".plugin-highlight-multi-result").addEventListener("mousedown", ev => {
            const target = ev.target.closest(".plugin-highlight-multi-result-item")
            if (!target) return
            const className = [...target.classList.values()].find(e => e.startsWith("cm-plugin-highlight-hit"))
            if (!className) return

            if (this.isClosed()) {
                this.doSearch()
            }

            const { name, hits } = this.searchStatus.hitGroups[className]
            if (hits.length === 0) return

            const beforePos = parseInt(target.dataset.pos)
            const currentPos = this.highlightNext(className, beforePos, ev.button === 0)
            target.dataset.pos = currentPos
            target.innerText = `${name} (${currentPos + 1}/${hits.length})`
        })
    }

    doSearch = (searchGroup = this.searchStatus.searchGroup, caseSensitive = this.config.CASE_SENSITIVE) => {
        this.clearSearch()
        if (!searchGroup || searchGroup.length === 0) {
            return this.searchStatus.hitGroups
        }

        this.searchStatus.searchGroup = searchGroup
        this.searchStatus.regexp = this._createRegExp(searchGroup, caseSensitive)
        this.searchStatus.hitGroups = Object.fromEntries(searchGroup.map((name, idx) => [`cm-plugin-highlight-hit-${idx}`, { name, hits: [] }]))
        this.searchStatus.fenceOverlay = { searchExpression: this.searchStatus.regexp, token: this._overlayToken }

        const inSourceMode = File.editor.sourceView.inSourceMode
        if (inSourceMode) {
            this._handleCodeBlock(File.editor.sourceView.cm)
        } else {
            let node = File.editor.nodeMap.getFirst()
            while (node) {
                this._handleNode(node)
                node = node.get("after")
                const ok = this._checkHits()
                if (!ok) break
            }
        }
        return this.searchStatus.hitGroups
    }

    highlightNext = (cls, beforePos, increment) => {
        const { hits } = this.searchStatus.hitGroups[cls]
        const beforeHit = this.searchStatus.curSelection || hits[0]
        let currentPos = increment ? beforePos + 1 : beforePos - 1
        if (isNaN(+currentPos) || currentPos >= hits.length) {
            currentPos = 0
        } else if (currentPos < 0) {
            currentPos = hits.length - 1
        }
        let targetHit = hits[currentPos]

        if (beforeHit.isCm) {
            beforeHit.isCm.execCommand(increment ? "goDocStart" : "goDocEnd")
        }

        $(".md-focus").removeClass("md-focus")

        const isFutureCM = targetHit.cid && this.searchStatus.futureCM.has(targetHit.cid)
        if (isFutureCM) {
            const cm = File.editor.fences.addCodeBlock(targetHit.cid)
            this.searchStatus.hits.filter(hit => hit.cid === targetHit.cid).forEach(hit => hit.isCm = cm)
            this.searchStatus.futureCM.delete(targetHit.cid)
        }

        this.searchStatus.curSelection = targetHit
        if (targetHit.isCm) {
            const cm = targetHit.isCm
            cm.doc.setSelection(cm.posFromIndex(targetHit.start), cm.posFromIndex(targetHit.end))
            const scroller = cm.getScrollerElement()
            if (scroller) {
                targetHit = scroller.querySelector(".CodeMirror-selectedtext")
                $(scroller).closest("[cid]").addClass("md-focus")
            }
        } else {
            $(targetHit).closest("[cid]").addClass("md-focus")
        }
        if (targetHit) {
            this.utils.scroll(targetHit)
            this._highlightMarker(targetHit)
        }
        return currentPos
    }

    _highlightMarker = marker => {
        document.querySelectorAll(".plugin-highlight-multi-outline").forEach(ele => ele.classList.remove("plugin-highlight-multi-outline"))
        marker.classList.add("plugin-highlight-multi-outline")

        const writeRect = this.utils.entities.eWrite.getBoundingClientRect()
        const markerRect = marker.getBoundingClientRect()
        const bar = document.createElement("div")
        bar.className = "plugin-highlight-multi-bar"
        bar.style.height = markerRect.height + "px"
        bar.style.width = writeRect.width + "px"
        marker.appendChild(bar)
        setTimeout(() => this.utils.removeElement(bar), 3000)
    }

    clearSearch = () => {
        if (this.isClosed()) return

        console.debug("clear search")
        this.utils.entities.querySelectorAllInWrite(".plugin-highlight-multi-bar").forEach(e => this.utils.removeElement(e))
        if (File.editor.sourceView.inSourceMode) {
            if (this.searchStatus && this.searchStatus.hits.length) {
                File.editor.fences.clearSearchAll()
                File.editor.sourceView.cm.focus()
            }
        } else {
            File.editor.mathInline.renderAll(false)
            File.editor.searchPanel.searchStatus = this.searchStatus
            File.editor.searchPanel.clearSearch()
            File.editor.fences.clearSearchAll()
            this.utils.entities.querySelectorAllInWrite('[class*="cm-plugin-highlight-hit"]').forEach(e => File.editor.EditHelper.unmarkSpan(e))
        }
        this._resetStatus()
    }

    isClosed = () => this.searchStatus.regexp == null
    _resetStatus = () => this.searchStatus = { ...this.searchStatus, regexp: null, hits: [], hitGroups: {}, futureCM: new Set() }
    _resetRegexpLastIndex = (lastIndex = 0) => this.searchStatus.regexp.lastIndex = lastIndex

    _pushHit = (hit, highlightCls) => {
        this.searchStatus.hits.push(hit)
        this.searchStatus.hitGroups[highlightCls].hits.push(hit)
    }

    _handleNode = node => {
        const children = node.get("children")
        if (children.length) {
            children.sortedForEach(child => this._handleNode(child))
        } else if (NodeDef.isType(node, NodeDef.TYPE.fences)) {
            this._handleFences(node)
        } else if (NodeDef.isType(node, NodeDef.TYPE.math_block)) {
            this._handleMathBlock(node)
        } else if (NodeDef.isType(node, NodeDef.TYPE.html_block)) {
            this._handleHTMLBlock(node)
        } else if (NodeDef.isType(node, NodeDef.TYPE.toc, NodeDef.TYPE.hr)) {

        } else {
            this._handleOtherNode(node)
        }
    }

    _handleCodeBlock = cm => {
        this._resetRegexpLastIndex()

        let hasMatch = false
        const value = cm.getValue()
        const matches = value.matchAll(this.searchStatus.regexp)
        for (const match of matches) {
            hasMatch = true
            const matchString = match[0]
            const start = match.index
            const end = start + matchString.length
            const highlightCls = this._getHighlightClass(match)

            if (start === end) continue

            const hit = { isCm: cm, cid: cm.cid, start, end, highlightCls }
            this._pushHit(hit, highlightCls)
            const ok = this._checkHits()
            if (!ok) break
        }

        if (hasMatch) {
            this._searchOnCM(cm)
        }
    }

    _handleOtherNode = (node, isFutureCm = false) => {
        this._resetRegexpLastIndex()
        const nodeElement = File.editor.findElemById(node.cid)[0]
        if (!nodeElement) {
            console.error(`Cannot find element for [${node.get("type")}] from [${node.get("parent").get("type")}]`)
            return
        }

        let offsetAdjust = 0
        let rawText = $(nodeElement).rawText()
        const fullText = node.getText().replace(/\r?\n/g, File.useCRLF ? "\r\n" : "\n")
        if (NodeDef.isType(node, NodeDef.TYPE.heading)) {
            const headingPrefix = "#".repeat(node.get("depth") || 1) + " "
            rawText = headingPrefix + rawText
            offsetAdjust = headingPrefix.length
        }

        const matches = [...(isFutureCm ? fullText : rawText).matchAll(this.searchStatus.regexp)]
        for (const match of matches) {
            const hit = {
                cid: node.cid,
                containerNode: nodeElement,
                start: Math.max(0, match.index - offsetAdjust),
                end: match.index + match[0].length - offsetAdjust,
                highlightCls: this._getHighlightClass(match),
            }

            if (hit.start === hit.end) continue

            if (isFutureCm) {
                this._pushHit(hit, hit.highlightCls)
                this.searchStatus.futureCM.add(node.cid)
            } else {
                const range = File.editor.selection.rangy.createRange()
                range.moveToBookmark(hit)
                const highlight = this._markRange(range, hit.highlightCls)
                const $highlight = $(highlight)
                const isMetaContent = $highlight.closest(".md-meta, .md-content, script").length
                    || $highlight.hasClass("md-meta")
                    || $highlight.hasClass("md-content")
                    || ($highlight[0] && $highlight[0].tagName === "script")
                if (isMetaContent) {
                    this._expandInlineElement($highlight)
                } else {
                    highlight.querySelectorAll(".md-meta, .md-content, script").forEach(e => this._expandInlineElement($(e)))
                }
                this._pushHit(highlight, hit.highlightCls)
            }
            const ok = this._checkHits()
            if (!ok) break
        }
    }

    _expandInlineElement = e => e.closest("[md-inline]").addClass("md-search-expand")

    _handleFences = node => {
        this._resetRegexpLastIndex()
        const cm = File.editor.fences.queue[node.cid]
        if (cm) {
            this._handleCodeBlock(cm)
            return
        }
        try {
            this._handleOtherNode(node, true)
        } catch (error) {
            console.error(error)
        }
    }

    _handleMathBlock = node => {
        this._resetRegexpLastIndex()
        const currentCm = File.editor.mathBlock.currentCm
        const mathBlockCM = (currentCm || {}).cid === node.cid
        if (mathBlockCM) {
            this._clearSearchOnCM(currentCm)
            this._handleCodeBlock(currentCm)
        }
    }

    _handleHTMLBlock = node => {
        this._resetRegexpLastIndex()
        const currentCm = File.editor.mathBlock.currentCm
        const htmlBlockCM = (currentCm || {}).cid === node.cid
        if (htmlBlockCM) {
            this._clearSearchOnCM(currentCm)
            this._handleCodeBlock(currentCm)
            return
        }

        const nodeElement = File.editor.findElemById(node.cid)[0].querySelector(".md-htmlblock-container")
        const textContent = nodeElement.textContent
        const matches = textContent.matchAll(this.searchStatus.regexp)
        for (const match of matches) {
            const hit = {
                cid: node.cid,
                containerNode: nodeElement,
                start: match.index,
                end: match.index + match[0].length,
                highlightCls: this._getHighlightClass(match),
            }

            if (hit.start === hit.end) continue

            const range = File.editor.selection.rangy.createRange()
            range.moveToBookmark(hit)
            if (range.commonAncestorContainer.nodeType === document.TEXT_NODE) {
                const highlight = this._markRange(range, hit.highlightCls)
                this._pushHit(highlight, hit.highlightCls)
                const ok = this._checkHits()
                if (!ok) break
            }
        }
    }

    _createRegExp = (group, caseSensitive) => {
        if (!caseSensitive) {
            group = group.map(e => e.toLowerCase())
        }
        const pattern = group.map((r, idx) => `(?<m_${idx}>${r})`).join("|")
        const flag = caseSensitive ? "g" : "gi"
        return new RegExp(pattern, flag)
    }

    _getHighlightClass = (match, prefix = true) => {
        const groupNamePrefixLength = 2 // m_
        const matchGroup = Object.entries(match.groups).find(([_, value]) => value)
        const idx = matchGroup[0].slice(groupNamePrefixLength)
        const prefix_ = prefix ? "cm-" : ""
        return `${prefix_}plugin-highlight-hit-${idx}`
    }

    _markRange = (range, cls = "cm-plugin-highlight-hit-0") => File.editor.EditHelper.markRange(range, cls)

    _overlayToken = state => {
        const regexp = this.searchStatus.regexp
        regexp.lastIndex = state.pos
        const match = regexp.exec(state.string)
        if (match && match.index === state.pos) {
            state.pos += match[0].length || 1
            return this._getHighlightClass(match, false)
        } else {
            if (match) {
                state.pos = match.index
            } else {
                state.skipToEnd()
            }
            return null
        }
    }

    _searchOnCM = cm => {
        const fences = File.editor.fences
        fences.searchStatus = fences.searchStatus || {}
        fences.searchStatus.overlay = fences.searchStatus.overlay || {}
        fences.searchStatus.queue = fences.searchStatus.queue || []

        const editorId = cm.cid || "source"
        fences.searchStatus.overlay[editorId] = this.searchStatus.fenceOverlay
        cm.addOverlay(fences.searchStatus.overlay[editorId])
        fences.searchStatus.queue.push(cm)
    }

    _clearSearchOnCM = cm => {
        const fence = File.editor.fences
        if (fence.searchStatus) {
            const cid = cm.cid || "source"
            cm.removeOverlay(this.searchStatus.overlay[cid])
            fence.searchStatus.queue.remove(cm)
        }
    }

    _checkHits = () => this.searchStatus.hits.length <= this.config.MAX_HITS

    _polyfill = () => {
        if (!global.NodeDef) {
            global.NodeDef = global.Node
        }
    }
}

module.exports = {
    plugin: searchMultiPlugin
}
