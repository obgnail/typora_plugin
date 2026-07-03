const Searcher = require("./searcher")
const Highlighter = require("./highlighter")
const { ExplainPresenter, GrammarPresenter } = require("./presenters")

class SearchExecutor {
  constructor({ config, utils, searcher }) {
    this.config = config
    this.utils = utils
    this.searcher = searcher
    this.taskRunner = this.utils.getSingleTaskRunner()
    this.allowedExtensions = new Set(this.config.ALLOW_EXT.map(ext => {
      const prefix = (ext !== "" && !ext.startsWith(".")) ? "." : ""
      return prefix + ext.toLowerCase()
    }))
  }

  abort = () => this.taskRunner.abort()

  execute = async (ast, rootPath, handlers) => {
    const { onEmpty, onStart, onItem, onSuccess, onError } = handlers
    const { MAX_SIZE, MAX_DEPTH, MAX_ENTITIES, TIMEOUT, TRAVERSE_STRATEGY, CONCURRENCY_LIMIT, IGNORE_FOLDERS, FOLLOW_SYMBOLIC_LINKS } = this.config

    this.abort()
    if (!ast) {
      onEmpty?.()
      return
    }

    await this.taskRunner.run(async signal => {
      try {
        onStart?.()

        const { extname } = this.utils.Package.Path
        const verifyExt = name => this.allowedExtensions.has(extname(name).toLowerCase())

        const matcher = this.searcher.compile(ast)
        await new Promise((resolve, reject) => {
          this.utils.walkDir({
            dir: rootPath,
            fileFilter: 0 > MAX_SIZE ? verifyExt : (name, path, stat) => stat.size < MAX_SIZE && verifyExt(name),
            dirFilter: name => !IGNORE_FOLDERS.includes(name),
            fileParamsGetter: this.searcher.getFileParamsProvider(ast),
            onFile: async source => (await matcher(source)) && onItem?.(source, signal),
            signal: TIMEOUT > 0 ? AbortSignal.any([signal, AbortSignal.timeout(TIMEOUT)]) : signal,
            semaphore: CONCURRENCY_LIMIT,
            maxEntities: MAX_ENTITIES,
            maxDepth: MAX_DEPTH,
            strategy: TRAVERSE_STRATEGY,
            followSymlinks: FOLLOW_SYMBOLIC_LINKS,
            onFinished: err => err && err.name !== "AbortError" ? reject(err) : resolve(),
          }).catch(reject)
        })
        if (!signal.aborted) onSuccess?.()
      } catch (err) {
        if (!signal.aborted && err.name !== "AbortError") onError?.(err)
      }
    })
  }
}

class SearchStateMachine {
  state = "idle"
  transitions = {
    idle: ["searching"],
    searching: ["done", "error", "abort"],
    done: ["idle", "searching"],
    error: ["idle", "searching"],
    abort: ["idle", "searching"],
  }

  constructor(hooks = {}) {
    this.hooks = hooks
  }

  dispatch = (nextState) => {
    if (this.state === nextState) return false
    if (!this.transitions[this.state].includes(nextState)) return false

    const prevState = this.state
    this.state = nextState
    this.hooks.onStateChange?.(nextState, prevState)
    const hookName = `onEnter${nextState.charAt(0).toUpperCase() + nextState.slice(1)}`
    this.hooks[hookName]?.(prevState)
    return true
  }

  start = () => this.dispatch("searching")
  success = () => this.dispatch("done")
  fail = () => this.dispatch("error")
  cancel = () => this.dispatch("abort")
  reset = () => this.dispatch("idle")

  isSearching = () => this.state === "searching"
}

class SearchMultiPlugin extends BasePlugin {
  ctx = { config: this.config, utils: this.utils, i18n: this.i18n }
  searcher = new Searcher(this.ctx)
  highlighter = new Highlighter(this.ctx)
  executor = new SearchExecutor({ ...this.ctx, searcher: this.searcher })
  explainPresenter = new ExplainPresenter({ ...this.ctx, searcher: this.searcher })
  grammarPresenter = new GrammarPresenter({ ...this.ctx, searcher: this.searcher })

  style = () => {
    const counter_prefix_text = this.i18n.t("matchedFiles") + "："
    const colors_style = this.config.HIGHLIGHT_COLORS
      .map((color, idx) => `.cm-plugin-highlight-hit-${idx} { background-color: ${color} !important; }`)
      .join("\n")
    return { counter_prefix_text, colors_style }
  }

  html = () =>
    `<fast-window
      id="plugin-search-multi"
      hidden
      window-title="${this.pluginName}"
      window-resize="none"
      window-buttons="showGrammar|fa-question|${this.i18n.t("grammar")};close|fa-times">
      <div class="plugin-search-multi-header ${this.config.EXPLAIN_TRIGGER.map(t => `trigger-${t}`).join(" ")}">
        <form id="plugin-search-multi-form">
          <input type="text">
          <div class="plugin-search-multi-btn${(this.config.CASE_SENSITIVE) ? " select" : ""}">
            <svg class="icon"><use xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="#find-and-replace-icon-case"></use></svg>
          </div>
        </form>
        <div class="plugin-search-multi-explain"></div>
      </div>
      <div class="plugin-search-multi-result is-idle">
        <div class="plugin-search-counter"></div>
        <div class="plugin-search-files"></div>
        <div class="plugin-search-highlights"></div>
        <div class="plugin-search-multi-searching">
          <div>${this.i18n.t("searching")}</div>
          <div class="typora-search-spinner"><div class="rect1"></div><div class="rect2"></div><div class="rect3"></div><div class="rect4"></div><div class="rect5"></div></div>
        </div>
      </div>
    </fast-window>`

  hotkey = () => [{ hotkey: this.config.HOTKEY, callback: this.call }]

  init = () => {
    this.entities = {
      panel: document.querySelector("#plugin-search-multi"),
      header: document.querySelector(".plugin-search-multi-header"),
      form: document.querySelector("#plugin-search-multi-form"),
      input: document.querySelector("#plugin-search-multi-form input"),
      btn: document.querySelector(".plugin-search-multi-btn"),
      explain: document.querySelector(".plugin-search-multi-explain"),
      result: document.querySelector(".plugin-search-multi-result"),
      counter: document.querySelector(".plugin-search-counter"),
      files: document.querySelector(".plugin-search-files"),
      highlights: document.querySelector(".plugin-search-highlights"),
    }

    const resetUI = (isSearching = false) => {
      this.entities.counter.textContent = isSearching ? "0" : ""
      this.entities.files.innerHTML = ""
      this.entities.highlights.innerHTML = ""
    }
    this.fsm = new SearchStateMachine({
      onStateChange: (newState, oldState) => {
        this.entities.result.classList.remove(`is-${oldState}`)
        this.entities.result.classList.add(`is-${newState}`)
      },
      onEnterIdle: () => resetUI(false),
      onEnterSearching: () => resetUI(true),
    })
  }

  process = () => {
    this.searcher.process()
    this.highlighter.process()

    this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.fileContentLoaded, () => this.resetHighlight())
    this.utils.createSmartInputHandler(this.entities.input, () => this._updateExplain(true))

    this.entities.files.addEventListener("click", ev => {
      const path = ev.target.closest(".plugin-search-item")?.dataset.path
      if (path) this.utils.openFile(path)
    })
    this.entities.btn.addEventListener("click", () => {
      this.entities.btn.classList.toggle("select")
      this.config.CASE_SENSITIVE = !this.config.CASE_SENSITIVE
      this._updateExplain(true)
    })
    this.entities.panel.addEventListener("btn-click", ev => {
      if (ev.detail.action === "showGrammar") {
        this.grammarPresenter.show()
      } else if (ev.detail.action === "close") {
        this.hide()
      }
    })
    this.entities.form.addEventListener("submit", ev => {
      ev.preventDefault()
      this.search()
    })
    this.entities.input.addEventListener("keydown", ev => {
      if (ev.key === "ArrowUp" || ev.key === "ArrowDown") {
        ev.preventDefault()
        this.utils.scrollActiveItem(this.entities.files, ".plugin-search-item.active", ev.key === "ArrowDown")
      } else if (ev.key === "Escape" || ev.key === "Backspace" && this.config.BACKSPACE_TO_HIDE && !this.entities.input.value) {
        this.hide()
      }
    })
  }

  search = async (rootPath = this.utils.getMountFolder(), input = this.entities.input.value) => {
    if (this.fsm.isSearching()) this.fsm.cancel()

    const ast = this.getAST(input)
    this._updateExplain(!ast)

    await this.executor.execute(ast, rootPath, {
      onEmpty: () => this.fsm.reset(),
      onStart: () => this.fsm.start(),
      onItem: this._createResultAppender(rootPath),
      onSuccess: () => this.fsm.success() && this.highlightByAST(ast),
      onError: (err) => {
        const msg = err.name === "TimeoutError" ? this.i18n.t("error.timeout") : err.toString()
        this.utils.notification.show(msg, "error")
        this.fsm.fail()
        console.error(err)
      },
    })
  }

  getAST = (input = this.entities.input.value, optimize = this.config.OPTIMIZE_SEARCH) => {
    input = input.trim()
    if (!input) return
    try {
      return this.searcher.parse(input, optimize)
    } catch (e) {
      this.utils.notification.show(e.message || e.toString(), "error", 5000)
      console.error(e)
    }
  }

  getHighlightHits = (ast) => {
    const tokens = this.searcher.getPositiveContentTokens(ast)
    return tokens.length === 0 ? null : this.highlighter.doSearch(tokens)
  }

  highlightByAST = (ast = this.getAST()) => {
    this.entities.highlights.innerHTML = ""
    if (!ast) return

    try {
      const hitGroups = this.getHighlightHits(ast)
      if (!hitGroups) return

      const hint = this.i18n.t("highlightHint")
      const items = Object.entries(hitGroups).map(([cls, { name, hits }]) => {
        const item = document.createElement("div")
        item.className = `plugin-highlight-item ${cls}`
        item.dataset.pos = -1
        item.textContent = `${name} (${hits.length})`
        if (this.config.SHOW_HIGHLIGHT_HINT) item.setAttribute("ty-hint", hint)
        return item
      })
      this.entities.highlights.append(...items)
    } catch (e) {
      this.utils.notification.show(e.toString(), "error")
      console.error(e)
    }
  }

  resetHighlight = () => !this.entities.panel.hidden && this.highlightByAST()

  _updateExplain = (show = true) => {
    this.entities.header.classList.toggle("show-bubble", show)
    if (!show) return

    const expl = this.entities.explain
    const val = this.entities.input.value.trim()
    if (!val) {
      expl.innerHTML = ""
      expl.classList.remove("is-error")
      return
    }
    try {
      const ast = this.searcher.parse(val, false)
      this.explainPresenter.render(expl, ast)
      expl.classList.remove("is-error")
    } catch (e) {
      this.explainPresenter.renderError(expl, e)
      expl.classList.add("is-error")
      this.entities.header.classList.add("show-bubble")
    }
  }

  _createResultAppender = (rootPath) => {
    const newItem = (rootPath, filePath, stats) => {
      const { dir, base, name } = this.utils.Package.Path.parse(filePath)
      const dirPath = this.config.RELATIVE_PATH ? dir.replace(rootPath, ".") : dir

      const item = document.createElement("div")
      item.className = "plugin-search-item"
      item.dataset.path = filePath
      if (this.config.SHOW_MTIME) {
        item.setAttribute("ty-hint", stats.mtime.toLocaleString(undefined, { hour12: false }))
      }

      const itemTitle = document.createElement("div")
      itemTitle.className = "plugin-search-item-title"
      itemTitle.textContent = this.config.SHOW_EXT ? base : name

      const itemPath = document.createElement("div")
      itemPath.className = "plugin-search-item-path"
      itemPath.textContent = dirPath + this.utils.separator

      item.append(itemTitle, itemPath)
      return item
    }

    let index = 0
    const rafManager = this.utils.getRafManager()
    const fragment = document.createDocumentFragment()
    return (source, signal) => {
      index++
      fragment.appendChild(newItem(rootPath, source.path, source.stats))
      rafManager.schedule(() => {
        if (signal?.aborted) return
        this.entities.files.appendChild(fragment)
        this.entities.counter.textContent = index
      })
    }
  }

  hide = () => {
    this.entities.panel.hide()
    this.highlighter.clearSearch()
    if (this.config.STOP_SEARCHING_ON_HIDING) {
      this.executor.abort()
      this.fsm.cancel()
    }
  }

  show = () => {
    this.entities.panel.show()
    requestAnimationFrame(() => this.entities.input.select())
  }

  call = () => {
    if (this.entities.panel.hidden) {
      this.show()
    } else {
      this.hide()
    }
  }
}

module.exports = {
  plugin: SearchMultiPlugin,
}
