class PreferencesPlugin extends BasePlugin {
  FALLBACK_MENU = "global"
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
            <div id="plugin-preferences-search"><i class="ion-search"></i><input type="text" placeholder="${this.i18n.t("search")}"><i class="ion-close-round clear-btn"></i></div>
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
    this.SCHEMAS = this._getSchemas()
    this.META = this._getMeta()
  }

  process = () => {
    const searchInDialog = () => {
      const matchSchemas = (query) => {
        if (!query) return []
        return Object.keys(this.SCHEMAS).filter(name =>
          this.SCHEMAS[name].some(box =>
            box.title?.toLowerCase().includes(query) ||
            box.fields?.some(field => field.label?.toLowerCase().includes(query)),
          ),
        )
      }
      const filterMenuItems = (query) => {
        const hitSchemas = matchSchemas(query)
        const regex = query ? new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi") : null
        this.entities.menu.querySelectorAll(".plugin-preferences-menu-item").forEach(el => {
          const name = el.textContent
          const isHit = hitSchemas.includes(el.dataset.plugin) || name.toLowerCase().includes(query)
          this.utils.toggleInvisible(el, Boolean(query && !isHit))
          el.innerHTML = (query && isHit) ? name.replace(regex, "<div class='plugin-preferences-highlight'>$1</div>") : name
        })
      }
      const highlightForm = (query) => this.entities.form.getApi("highlight")?.highlight(query)
      const scroll = () => this.entities.menu.querySelector(".plugin-preferences-menu-item.active")?.scrollIntoView({ block: "center" })
      this.utils.createSmartInputHandler(this.entities.searchInput, (query) => {
        filterMenuItems(query)
        highlightForm(query)
        if (!query) scroll()
      })
      this.entities.searchClear.addEventListener("click", () => {
        const inputEl = this.entities.searchInput
        inputEl.value = ""
        inputEl.dispatchEvent(new Event("input", { bubbles: true }))
        inputEl.focus()
      })
    }
    const onEvents = () => {
      this.entities.close.addEventListener("click", () => this.call())
      this.entities.menu.addEventListener("click", async ev => {
        const menu = ev.target.closest(".plugin-preferences-menu-item")?.dataset.plugin
        if (menu) await this.switchMenu(menu)
      })
      this.entities.form.addEventListener("form-crud", async ev => {
        const { key, value, type } = ev.detail
        const handleProperty = this.utils.nestedPropertyHelpers[type]
        if (!handleProperty) return

        const { fixedName, settings } = await this.getCurrent()
        handleProperty(settings, key, value)
        await this.utils.settings.handle(fixedName, (_, allSettings) => allSettings[fixedName] = settings)

        this._setDialogState(true)
      })
    }

    searchInDialog()
    onEvents()
  }

  call = async () => {
    if (this.utils.isShown(this.entities.mask)) {
      this.entities.searchInput.value = ""
      this.utils.hide(this.entities.mask)
      if (this._hasDialogChanged()) {
        this._setDialogState(false)
        this.utils.notification.show(this.i18n.t("takesEffectAfterRestart"))
      }
    } else {
      const menu = (this.config.DEFAULT_MENU === "__LAST__") ? this.menuStorage.get() : this.config.DEFAULT_MENU
      await this.showDialog(menu)
      this.utils.show(this.entities.mask)
    }
  }

  showDialog = async (fixedName) => {
    const plugins = this._getAllPlugins()
    this._fillMenu(plugins)
    const menu = Object.hasOwn(plugins, fixedName) ? fixedName : this.FALLBACK_MENU
    await this.switchMenu(menu, true)
  }

  switchMenu = async (fixedName, scrollMenuIntoView = false, scrollMainToTop = true) => {
    if (this.config.HIDE_MENUS.includes(fixedName)) {
      fixedName = this.FALLBACK_MENU
    }

    const options = await this._getFormOptions(fixedName)
    if (!options) return

    this.entities.form.dataset.plugin = fixedName
    this.entities.form.render(options)
    this.entities.menu.querySelectorAll(".plugin-preferences-menu-item").forEach(e => e.classList.toggle("active", e.dataset.plugin === fixedName))
    this.entities.title.textContent = this.entities.menu.querySelector(`.plugin-preferences-menu-item[data-plugin="${fixedName}"]`).textContent
    this.menuStorage.set(fixedName)

    if (scrollMainToTop) {
      $(this.entities.main).animate({ scrollTop: 0 }, 300)
    }
    if (scrollMenuIntoView) {
      requestAnimationFrame(() => this.entities.menu.querySelector(".plugin-preferences-menu-item.active").scrollIntoView({ block: "center" }))
    }
  }

  renewMenu = async (renewFn) => {
    const fixedName = this._getCurrentPlugin()
    await renewFn(fixedName)
    await this.switchMenu(fixedName)
    this._setDialogState(true)
  }

  getCurrent = async () => {
    const fixedName = this._getCurrentPlugin()
    const settings = await this._getSettings(fixedName)
    return { fixedName, settings }
  }

  _fillMenu = (plugins) => {
    this.entities.menu.innerHTML = Object.entries(plugins)
      .filter(([name]) => !this.config.HIDE_MENUS.includes(name))
      .map(([name, pluginName]) => `<div class="plugin-preferences-menu-item" data-plugin="${name}">${this.utils.escape(pluginName)}</div>`)
      .join("")
  }

  _getFormOptions = async (fixedName) => {
    const schema = this.SCHEMAS[fixedName]
    if (!schema) return

    const data = await this._preprocess(fixedName)
    return this.applyOptions({
      schema,
      data,
      actions: this.ACTIONS,
      meta: this.META,
      rules: this.RULES[fixedName] || {},
      watchers: this.WATCHERS[fixedName] || {},
      controlOptions: { object: { format: this.config.OBJECT_SETTINGS_FORMAT } },
      fieldDependencyUnmetAction: this.config.DEPENDENCIES_FAILURE_BEHAVIOR,
      boxDependencyUnmetAction: this.config.DEPENDENCIES_FAILURE_BEHAVIOR,
      collapsibleBox: this.config.COLLAPSIBLE_BOX,
      highlight: this._getSearchValue(),
    }, fixedName)
  }

  _getAllPlugins = () => {
    const basePlugins = Object.keys(this.utils.getAllBasePluginSettings())
    const customPlugins = Object.keys(this.utils.getAllCustomPluginSettings())
    const plugins = ["global", ...basePlugins, ...customPlugins]
      .filter(name => Object.hasOwn(this.SCHEMAS, name))
      .map(name => {
        const pluginName = this.utils.tryGetPlugin(name)?.pluginName ?? this.i18n._t(name, "pluginName")
        return [name, pluginName]
      })
    return Object.fromEntries(plugins)
  }

  _getSettings = async (fixedName) => {
    const isBase = this.utils.getBasePluginSetting(fixedName)
    const fn = isBase ? "readBase" : "readCustom"
    const settings = await this.utils.settings[fn]()
    return settings[fixedName]
  }

  _preprocess = async (fixedName) => {
    const data = await this._getSettings(fixedName)
    const pp = this.PREPROCESSORS[fixedName]
    const promises = this.SCHEMAS[fixedName].flatMap(box => {
      return box.fields
        .filter(field => field.key && pp?.[field.key])
        .map(async field => await pp[field.key](field, data, box))
    })
    await Promise.all(promises)
    return data
  }

  _getSchemas = () => {
    const compile = require("./schemas.js")
    return compile(this.entities.form.dsl, this.i18n.allData)
  }

  _getMeta = () => ({
    $isBetaTypora: () => this.utils.isBetaVersion,
  })

  _setDialogState = (changed = true) => this.entities.dialog.toggleAttribute("has-changed", changed)
  _hasDialogChanged = () => this.entities.dialog.hasAttribute("has-changed")
  _getCurrentPlugin = () => this.entities.form.dataset.plugin
  _getSearchValue = () => this.entities.searchInput.value.trim()
}

module.exports = {
  plugin: PreferencesPlugin,
}
