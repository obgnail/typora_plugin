class PreferencesPlugin extends BasePlugin {
  searcher = getSearcher(this)
  menuStorage = this.utils.getStorage(`${this.fixedName}.menu`)
  applyOptions = (() => {
    const hook = this.utils.safeEval(this.config.FORM_RENDERING_HOOK)
    return (typeof hook === "function") ? hook : this.utils.identity
  })()

  hotkey = () => [{ hotkey: this.config.HOTKEY, callback: this.call }]

  style = () => true

  html = () =>
    `<div class="plugin-preferences-mask plugin-common-hidden">
      <div class="plugin-preferences-dialog">
        <div class="plugin-preferences-content">
          <div class="plugin-preferences-left">
            <div id="plugin-preferences-search"><input type="text" placeholder="${this.i18n.t("search")}"><i class="ion-close-round clear-btn"></i></div>
            <div class="plugin-preferences-menu"></div>
          </div>
          <div class="plugin-preferences-right">
            <div class="plugin-preferences-header">
              <div class="plugin-preferences-title"></div>
              <div class="plugin-preferences-close ion-close-round"></div>
            </div>
            <div class="plugin-preferences-main">
              <fast-form class="plugin-preferences-form" data-plugin="global"></fast-form>
            </div>
          </div>
        </div>
      </div>
    </div>`

  init = () => {
    this.entities = {
      mask: document.querySelector(".plugin-preferences-mask"),
      dialog: document.querySelector(".plugin-preferences-dialog"),
      menu: document.querySelector(".plugin-preferences-menu"),
      title: document.querySelector(".plugin-preferences-title"),
      form: document.querySelector(".plugin-preferences-form"),
      main: document.querySelector(".plugin-preferences-main"),
      searchInput: document.querySelector("#plugin-preferences-search input"),
      searchClear: document.querySelector("#plugin-preferences-search .clear-btn"),
      close: document.querySelector(".plugin-preferences-close"),
    }
    this.RULES = require("./rules.js")
    this.WATCHERS = require("./watchers.js")(this)
    this.ACTIONS = require("./actions.js")(this)
    this.PREPROCESSORS = require("./preprocessors.js")(this)
    this.SCHEMAS = require("./schemas.js")(this.entities.form.dsl, this.i18n.allData)
    this.META = { $isBetaTypora: () => this.utils.isBetaVersion }
  }

  process = () => {
    this.utils.eventHub.on(this.utils.eventHub.eventType.allPluginsHadInjected, () => {
      this.entities.menu.innerHTML = [...new Set(["global", ...Object.keys(this.utils.getAllSettings())])]
        .filter(name => this._hasPlugin(name))
        .map(name => this.searcher.menuItemHTML(name, this._getPluginName(name)))
        .join("")
    })

    this.entities.close.addEventListener("click", () => this.close())
    this.entities.menu.addEventListener("click", async ev => {
      const item = ev.target.closest(".plugin-preferences-menu-item")
      if (item) await this._switchMenu(item.dataset.plugin)
    })
    this.entities.form.addEventListener("form-crud", async ev => {
      const { key, value } = ev.detail
      const { fixedName, settings } = await this.getCurrent()
      this.utils.nestedPropertyHelpers.set(settings, key, value)
      await this.utils.settings.handle(fixedName, (_, allSettings) => allSettings[fixedName] = settings)
      this._setDialogState(true)
    })

    this.utils.createSmartInputHandler(this.entities.searchInput, query => {
      this.searcher.applyToMenu(this.entities.menu, query)
      this._applySearch()
      if (!query) this._scrollMenuIntoView()
    })
    this.entities.searchClear.addEventListener("click", () => {
      this._resetSearch()
      this.entities.searchInput.focus()
    })
  }

  call = async () => {
    if (this.utils.isShown(this.entities.mask)) {
      this.close()
    } else {
      await this.open()
    }
  }

  open = async (fixedName, revealKey) => {
    fixedName = this._normalizeFixedName(fixedName ?? this.menuStorage.get())
    this.utils.show(this.entities.mask)
    this._resetSearch()
    if (!await this._switchMenu(fixedName)) return
    if (revealKey) {
      $(this.entities.main).stop()
      if (this._reveal([revealKey]) === 0) console.warn(`key "${revealKey}" not found in "${fixedName}"`)
    }
    requestAnimationFrame(this._scrollMenuIntoView)
  }

  close = () => {
    if (!this.utils.isShown(this.entities.mask)) return
    this._resetSearch()
    this.utils.hide(this.entities.mask)
    if (this._hasDialogChanged()) {
      this._setDialogState(false)
      this.utils.notification.show(this.i18n.t("takesEffectAfterRestart"))
    }
  }

  renewMenu = async (renewFn) => {
    const fixedName = this._getCurrentPlugin()
    await renewFn(fixedName)
    await this._switchMenu(fixedName)
    this._setDialogState(true)
  }

  getCurrent = async () => {
    const fixedName = this._getCurrentPlugin()
    const settings = await this._getSettings(fixedName)
    return { fixedName, settings }
  }

  _switchMenu = async (fixedName) => {
    const options = await this._getFormOptions(fixedName)
    if (!options) return false

    this.entities.form.dataset.plugin = fixedName
    this.entities.form.render(options)
    this.entities.title.textContent = this._getPluginName(fixedName)
    this.entities.menu.querySelectorAll(".plugin-preferences-menu-item").forEach(e => e.classList.toggle("active", e.dataset.plugin === fixedName))
    this.menuStorage.set(fixedName)

    if (this._applySearch() === 0) this._scrollMainToTop()
    return true
  }

  _applySearch = () => {
    const plugin = this._getCurrentPlugin()
    const query = this.entities.searchInput.value.trim()
    this._highlight(query)
    return this._reveal(this.searcher.keysOf(plugin, query))
  }

  _resetSearch = () => {
    this.entities.searchInput.value = ""
    this.entities.searchInput.dispatchEvent(new Event("input", { bubbles: true }))
  }

  _reveal = (keys) => this.entities.form.getApi("reveal")?.reveal(keys) ?? 0
  _highlight = (kw) => this.entities.form.getApi("highlight")?.highlight(kw).count ?? 0

  _getFormOptions = async (fixedName) => {
    const schema = this.SCHEMAS[fixedName]
    if (!schema) return

    const data = await this._preprocess(fixedName)
    return this.applyOptions({
      schema,
      data,
      actions: this.ACTIONS,
      meta: this.META,
      rules: this.RULES[fixedName] ?? {},
      watchers: this.WATCHERS[fixedName] ?? {},
      controlOptions: { object: { format: this.config.OBJECT_SETTINGS_FORMAT } },
      fieldDependencyUnmetAction: this.config.DEPENDENCIES_FAILURE_BEHAVIOR,
      boxDependencyUnmetAction: this.config.DEPENDENCIES_FAILURE_BEHAVIOR,
      collapsibleBox: this.config.COLLAPSIBLE_BOX,
      historyEnabled: true,
    }, fixedName)
  }

  _preprocess = async (fixedName) => {
    const data = await this._getSettings(fixedName)
    const pp = this.PREPROCESSORS[fixedName]
    const promises = this.SCHEMAS[fixedName].flatMap(box => {
      return box.fields
        .filter(field => field.key && pp?.[field.key])
        .map(field => pp[field.key](field, data, box))
    })
    await Promise.all(promises)
    return data
  }

  _normalizeFixedName = (fixedName) => {
    if (this._hasPlugin(fixedName)) return fixedName
    if (fixedName) console.warn(`Unknown plugin "${fixedName}", fallback to "global"`)
    return "global"
  }

  _getPluginName = (fixedName) => this.utils.getPlugin(fixedName)?.pluginName ?? this.i18n._t(fixedName, "pluginName")

  _getSettings = async (fixedName) => {
    const settings = await this.utils.settings.read()
    return settings[fixedName] ?? {}
  }

  _hasPlugin = (fixedName) => Object.hasOwn(this.SCHEMAS, fixedName)
  _setDialogState = (changed = true) => this.entities.dialog.toggleAttribute("has-changed", changed)
  _hasDialogChanged = () => this.entities.dialog.hasAttribute("has-changed")
  _getCurrentPlugin = () => this.entities.form.dataset.plugin
  _scrollMainToTop = () => $(this.entities.main).animate({ scrollTop: 0 }, 300)
  _scrollMenuIntoView = () => this.entities.menu.querySelector(".plugin-preferences-menu-item.active")?.scrollIntoView({ block: "center" })
}

function getSearcher(plugin) {
  const { utils } = plugin
  const SELECTOR = {
    ITEM: ".plugin-preferences-menu-item",
    LABEL: ".plugin-preferences-menu-item-label",
    KEYS: ".plugin-preferences-menu-item-keys",
    FIXEDNAME: ".plugin-preferences-menu-item-fixedname",
  }
  const UNSEARCHABLE_TYPES = new Set(["action", "static", "hint", "divider"])
  const MATCHERS = {
    BOX: [box => box.title],
    FIELD: [field => field.key, field => field.label, field => field.explain],
  }

  const escapeRegExp = str => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

  const menuItemHTML = (fixedName, displayName) =>
    `<div class="${SELECTOR.ITEM.slice(1)}" data-plugin="${fixedName}">
      <div class="${SELECTOR.LABEL.slice(1)}">${utils.escape(displayName)}</div>
      <div class="${SELECTOR.FIXEDNAME.slice(1)}"></div>
      <div class="${SELECTOR.KEYS.slice(1)}"></div>
    </div>`

  const match = ({ fixedName, name, query }) => {
    query = query.trim().toLowerCase()
    if (!query) return { nameHit: false, fixedNameHit: false, matchedKeys: [] }

    const isHit = cnt => typeof cnt === "string" && cnt.toLowerCase().includes(query)
    const matchedKeys = (plugin.SCHEMAS[fixedName] ?? []).flatMap(box => {
      const boxHit = MATCHERS.BOX.some(get => isHit(get(box)))
      return (box.fields ?? [])
        .filter(field => field.key && !UNSEARCHABLE_TYPES.has(field.type) && (boxHit || MATCHERS.FIELD.some(get => isHit(get(field)))))
        .map(field => field.key)
    })
    return { nameHit: isHit(name), fixedNameHit: isHit(fixedName), matchedKeys: [...new Set(matchedKeys)] }
  }

  const markEl = (text) => Object.assign(document.createElement("span"), { className: "plugin-preferences-highlight", textContent: text })
  const textNodes = (text, regex) => regex ? text.split(regex).map((part, i) => i % 2 ? markEl(part) : part) : [text]
  const chipEls = (keys, regex) => keys.map(key => {
    const el = document.createElement("div")
    el.replaceChildren(...textNodes(key, regex))
    return el
  })

  const applyToMenu = (menuEl, query) => {
    query = query.trim().toLowerCase()
    const regex = query ? new RegExp(`(${escapeRegExp(query)})`, "gi") : null
    menuEl.querySelectorAll(SELECTOR.ITEM).forEach(itemEl => {
      const labelEl = itemEl.querySelector(SELECTOR.LABEL)
      const keysEl = itemEl.querySelector(SELECTOR.KEYS)
      const fixedNameEl = itemEl.querySelector(SELECTOR.FIXEDNAME)
      if (!labelEl || !keysEl || !fixedNameEl) return
      const name = labelEl.textContent
      const fixedName = itemEl.dataset.plugin
      const { nameHit, fixedNameHit, matchedKeys } = match({ fixedName, name, query })
      utils.toggleInvisible(itemEl, Boolean(query && !nameHit && !fixedNameHit && !matchedKeys.length))
      labelEl.replaceChildren(...textNodes(name, nameHit ? regex : null))
      fixedNameEl.replaceChildren(...(fixedNameHit ? textNodes(fixedName, regex) : []))
      keysEl.replaceChildren(...chipEls(matchedKeys, regex))
    })
  }

  const keysOf = (fixedName, query) => match({ fixedName, query }).matchedKeys

  return { menuItemHTML, applyToMenu, keysOf }
}

module.exports = {
  plugin: PreferencesPlugin,
}
