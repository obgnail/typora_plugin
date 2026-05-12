class MenuManager {
  second = null
  third = null
  firstItem = null
  secondItem = null
  clearAll = () => {
    this.third?.classList.remove("show")
    this.secondItem?.classList.remove("active")
    this.second?.classList.remove("show")
    this.firstItem?.classList.remove("active")
    this.second = null
    this.third = null
    this.firstItem = null
    this.secondItem = null
  }
  clearThirdMenu = () => {
    this.third?.classList.remove("show")
    this.third = null
  }
  setThirdMenu = (menuEl, triggerEl) => {
    if (this.secondItem && this.secondItem !== triggerEl) {
      this.secondItem.classList.remove("active")
    }
    this.third = menuEl
    this.secondItem = triggerEl
    triggerEl?.classList.add("active")
    menuEl?.classList.add("show")
  }
  clearSecondItem = () => {
    this.secondItem?.classList.remove("active")
    this.secondItem = null
  }
  isDifferentSecond = (idx) => this.second && this.second.dataset.idx !== String(idx)
  setSecondMenu = (menuEl, triggerEl) => {
    this.second = menuEl
    this.firstItem = triggerEl
    triggerEl?.classList.add("active")
    menuEl?.classList.add("show")
  }
}

class RightClickMenuPlugin extends BasePlugin {
  groupName = "typora-plugin"
  noExtraMenuGroupName = "typora-plugin-no-extra"
  dividerValue = "---"
  unavailableActValue = "__not_available__"
  unavailableActName = this.i18n.t("act.disabled")
  defaultDisableHint = this.i18n.t("actHint.disabled")
  supportShortcut = !!document.querySelector(".ty-menu-shortcut")
  menuManager = new MenuManager()

  style = () => ({
    menu_min_width: this.config.MENU_MIN_WIDTH,
    menu_option_display: this.config.HIDE_OTHER_OPTIONS ? "none" : "",
  })

  process = () => {
    this.utils.settings.autoSave(this)
    this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.allPluginsHadInjected, () => {
      setTimeout(() => {
        this.insertLevel1()  // The 1st level menus group all plugins
        this.insertLevel2()  // The 2nd level menus display grouped plugins
        this.insertLevel3()  // The 3rd level menus display the actions of the plugin
        this.listen()
      }, 500)
    })
  }

  insertLevel1 = () => {
    const items = this.config.MENUS.map(({ NAME, LIST = [] }, idx) => {
      if (LIST.length === 0) {
        return ""
      }
      const name = this.i18n._t("settings", NAME)
      const noExtraMenu = LIST.length === 1
      const caret = noExtraMenu ? "" : `<i class="fa fa-caret-right"></i>`
      const a = `<a role="menuitem"><span data-lg="Menu" data-localize="${name}">${name}</span>${caret}</a>`
      return noExtraMenu
        ? `<li data-key="${this.noExtraMenuGroupName}" data-value="${LIST[0]}" data-idx="${idx}">${a}</li>`
        : `<li class="has-extra-menu" data-key="${this.groupName}" data-idx="${idx}">${a}</li>`
    })
    const html = `<li class="divider"></li>` + items.join("")
    document.querySelector("#context-menu").insertAdjacentHTML("beforeend", html)
  }

  insertLevel2 = () => {
    const findLostPluginsIfNeed = () => {
      if (!this.config.FIND_LOST_PLUGINS) return
      const plugins = new Map(Object.entries(this.utils.getAllBasePlugins()))
      this.config.MENUS.forEach(menu => menu.LIST.forEach(p => plugins.delete(p)))
      const lostPlugins = [...plugins.values()].map(p => p.fixedName)
      this.config.MENUS.at(-1).LIST.push(...lostPlugins)
    }
    const LiWithAction = (plugin, action) => {
      const name = plugin.staticActions.find(act => act.act_value === action)?.act_name || plugin.pluginName
      return `
        <li class="plugin-menu-item" data-key="${plugin.fixedName}" data-value="${action}">
          <a role="menuitem" data-lg="Menu" data-localize="${name}">${name}</a>
        </li>`
    }
    const Li = plugin => {
      const hasAction = plugin.staticActions || plugin.getDynamicActions
      const extraClass = hasAction ? "has-extra-menu" : ""
      const clickable = hasAction || this.utils.hasOverrideBasePluginFn(plugin, "call")
      const style = clickable ? "" : `style="opacity: 0.5; pointer-events: none;"`
      const liAttrs = `class="plugin-menu-item ${extraClass}" ${style}`
      return this._liTemplate(plugin.fixedName, plugin.pluginName, plugin.config.HOTKEY, hasAction, "", liAttrs)
    }

    findLostPluginsIfNeed()
    const className = "plugin-menu-second dropdown-menu context-menu ext-context-menu"
    const html = this.config.MENUS.map(({ LIST = [] }, idx) => {
      const children = LIST.map(item => {
        if (item === this.dividerValue) return `<li class="divider"></li>`
        const [fixedName, action] = item.split(".")
        const plugin = this.utils.getBasePlugin(fixedName)
        if (!plugin) return ""
        return action ? LiWithAction(plugin, action) : Li(plugin)
      })
      return `<ul role="menu" data-idx="${idx}" class="${className}">${children.join("")}</ul>`
    })
    this.utils.entities.eContent.insertAdjacentHTML("beforeend", html.join(""))
  }

  insertLevel3 = () => {
    const className = "plugin-menu-third dropdown-menu context-menu ext-context-menu"
    const html = this.config.MENUS.flatMap(({ LIST = [] }, idx) => {
      return LIST
        .filter(item => item !== this.dividerValue)
        .map(item => this.utils.getBasePlugin(item))
        .filter(plugin => plugin && (plugin.staticActions || plugin.getDynamicActions))
        .map(plugin => {
          const children = (plugin.staticActions || []).map(act => this._thirdLiTemplate(act)).join("")
          return `<ul role="menu" data-idx="${idx}" data-plugin="${plugin.fixedName}" class="${className}">${children}</ul>`
        })
    })
    this.utils.entities.eContent.insertAdjacentHTML("beforeend", html.join(""))
  }

  _thirdLiTemplate = (act, dynamic) => {
    if (act.act_disabled && !act.act_hint) {
      act.act_hint = this.defaultDisableHint
    }
    const classList = ["plugin-menu-item"]
    if (dynamic) classList.push("plugin-dynamic-act")
    if (act.act_hidden) classList.push("plugin-common-hidden")
    if (act.act_disabled) classList.push("disabled")

    const liExtraAttrs = act.act_hint
      ? `ty-hint="${act.act_hint}" class="${classList.join(" ")}"`
      : `class="${classList.join(" ")}"`

    const state = (this.config.SHOW_ACTION_OPTIONS_ICON && act.act_state === undefined)
      ? "state-run"
      : Boolean(act.act_state) ? "state-on" : "state-off"

    return this._liTemplate(act.act_value, act.act_name, act.act_hotkey, false, state, liExtraAttrs)
  }

  _liTemplate = (key, showName, shortcut, hasExtraMenu, aClassName = "", liExtraAttrs = "") => {
    shortcut = this._cleanShortcut(shortcut)
    const hasShortcut = this.supportShortcut && this.config.SHOW_PLUGIN_HOTKEY && shortcut
    let innerHTML = ""
    let aAttrs = `data-lg="Menu"`
    if (hasExtraMenu) {
      innerHTML = `<span data-lg="Menu" data-localize="${showName}">${showName}</span><i class="fa fa-caret-right"></i>`
    } else if (hasShortcut) {
      innerHTML = `<span data-localize="${showName}">${showName}</span><span class="ty-menu-shortcut">${shortcut}</span>`
    } else {
      innerHTML = showName
      aAttrs += ` data-localize="${showName}"`
    }
    return `<li data-key="${key}" ${liExtraAttrs.trim()}><a role="menuitem" class="${aClassName}" ${aAttrs}>${innerHTML}</a></li>`.trim()
  }

  _cleanShortcut = shortcut => {
    if (Array.isArray(shortcut)) {
      shortcut = shortcut[0]
    }
    if (shortcut && typeof shortcut === "string") {
      shortcut = this.utils.hotkeyHub.capitalize(shortcut)
    }
    return shortcut
  }

  showMenuItem = (after, before) => {
    const margin = 6
    const { left, top, width, height } = before.getBoundingClientRect()
    let afterTop = top - height
    let afterLeft = left + width + margin

    const footer = document.querySelector("footer")
    const footerHeight = footer ? footer.getBoundingClientRect().height : 0

    const { height: afterHeight, width: afterWidth } = after.getBoundingClientRect()
    afterTop = Math.min(afterTop, window.innerHeight - afterHeight - footerHeight)
    afterLeft = afterLeft + afterWidth < window.innerWidth ? afterLeft : Math.max(0, left - afterWidth - margin)
    after.style.top = afterTop + "px"
    after.style.left = afterLeft + "px"
  }

  listen = () => {
    const self = this
    const { menuManager } = this

    // Click on the first level menu
    $("#context-menu").on("click", `[data-key="${this.noExtraMenuGroupName}"]`, function () {
      const [fixedName, action] = (this.dataset.value || "").split(".")
      if (!fixedName || !action) {
        return false
      }
      self.utils.updatePluginDynamicActions(fixedName)
      self.callPluginDynamicAction(fixedName, action)
      self.hideMenuIfNeed()
      // Display the second level menu
    }).on("mouseenter", "[data-key]", function () {
      if (self.groupName === this.dataset.key) {
        const idx = this.dataset.idx
        if (menuManager.isDifferentSecond(idx)) {
          menuManager.clearAll()
        }
        const secondMenu = document.querySelector(`.plugin-menu-second[data-idx="${idx}"]`)
        menuManager.setSecondMenu(secondMenu, this)
        self.showMenuItem(secondMenu, this)
      } else {
        menuManager.clearAll()
      }
    })

    // Display the third level menu
    $(".plugin-menu-second").on("mouseenter", "[data-key]", function () {
      menuManager.clearThirdMenu()
      document.querySelectorAll(".plugin-dynamic-act").forEach(el => el.remove())
      const fixedName = this.dataset.key
      const third = document.querySelector(`.plugin-menu-third[data-plugin="${fixedName}"]`)
      const noStaticActions = third && third.children.length === 0
      let dynamicActions = self.utils.updatePluginDynamicActions(fixedName)
      const noDynamicActions = !dynamicActions || dynamicActions.length === 0
      if (noDynamicActions && noStaticActions) {
        dynamicActions = [{ act_name: self.unavailableActName, act_value: self.unavailableActValue, act_disabled: true }]
      }
      if (dynamicActions && third) {
        const html = dynamicActions.map(act => self._thirdLiTemplate(act, true)).join("")
        third.insertAdjacentHTML("beforeend", html)
      }
      if (this.querySelector(`span[data-lg="Menu"]`)) {
        menuManager.setThirdMenu(third, this)
        self.showMenuItem(third, this)
      } else {
        menuManager.clearSecondItem()
      }
      // Call plugins in the second level menu
    }).on("click", "[data-key]", function () {
      const fixedName = this.dataset.key
      const action = this.dataset.value
      if (action) {
        self.callPluginDynamicAction(fixedName, action)
      } else {
        const plugin = self.utils.getBasePlugin(fixedName)
        // If there is a third level menu, clicking the second level menu is not allowed.
        if (!plugin || plugin.staticActions || plugin.getDynamicActions) {
          return false
        }
        plugin.call?.()
      }
      self.hideMenuIfNeed()
    })

    // Call plugins in the third level menu
    $(".plugin-menu-third").on("click", "[data-key]", function () {
      // Click on the disabled option
      if (this.classList.contains("disabled")) {
        return false
      }
      const action = this.dataset.key
      const fixedName = this.parentElement.dataset.plugin
      self.callPluginDynamicAction(fixedName, action)
      self.hideMenuIfNeed(fixedName)
    })
  }

  callPluginDynamicAction = (fixedName, action) => {
    if (action !== this.unavailableActValue) {
      this.utils.callPluginDynamicAction(fixedName, action)
    }
  }

  hideMenuIfNeed = key => {
    if (!this.config.DO_NOT_HIDE) {
      File.editor.contextMenu.hide()
      this.menuManager.clearAll()
      return
    }
    if (key) {
      $(`.plugin-menu-item[data-key="${key}"]`).trigger("mouseenter") // refresh third menu
    }
  }

  getDynamicActions = () => this.i18n.fillActions([
    { act_value: "do_not_hide", act_state: this.config.DO_NOT_HIDE, act_hint: this.i18n.t("actHint.do_not_hide") },
    { act_value: "toggle_hotkey", act_state: this.config.SHOW_PLUGIN_HOTKEY, act_hidden: !this.supportShortcut },
    { act_value: "hide_other_options", act_state: this.config.HIDE_OTHER_OPTIONS },
  ])

  call = async action => {
    const fns = {
      do_not_hide: () => this.config.DO_NOT_HIDE = !this.config.DO_NOT_HIDE,
      hide_other_options: async () => {
        this.config.HIDE_OTHER_OPTIONS = !this.config.HIDE_OTHER_OPTIONS
        await this.utils.styleManager.reset(this.fixedName, this.style())
      },
      toggle_hotkey: () => {
        this.config.SHOW_PLUGIN_HOTKEY = !this.config.SHOW_PLUGIN_HOTKEY
        const toggle = el => el.classList.toggle("plugin-common-hidden", !this.config.SHOW_PLUGIN_HOTKEY)
        document.querySelectorAll(".plugin-menu-second .ty-menu-shortcut, .plugin-menu-third .ty-menu-shortcut").forEach(toggle)
      },
    }
    const fn = fns[action]
    if (fn) {
      await fn()
    }
  }
}

module.exports = {
  plugin: RightClickMenuPlugin,
}
