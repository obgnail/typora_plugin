/**
 * **Core Mechanism: Microtask Reactive Restoration**
 * Typora natively resets `File.isLocked` during core I/O operations or AST updates.
 * Violently blocking this setter would cause fatal parser crashes. Instead, this plugin
 * intercepts `isLocked` via `Object.defineProperty`, permits the host's synchronous
 * assignments to execute safely, and stealthily re-applies the lock via `queueMicrotask`
 * before the next render frame.
 */
class ReadOnlyPlugin extends BasePlugin {
  _isActive = false
  _teardowns = []
  _eventHandlers = (() => {
    const forbiddenKeys = ["Enter", "Backspace", "Delete", " "]
    const isInline = el => el.closest(`#write span[md-inline="image"], #write span[md-inline="inline_math"]`)
    const isLink = el => el.closest(`#write .md-link, #write span[md-inline="link"]`)
    const stopIfLocked = (ev) => {
      if (!File.isLocked) return false
      document.activeElement?.blur()
      ev.preventDefault()
      ev.stopPropagation()
      File.lock()
      return true
    }

    return {
      keydown: (ev) => forbiddenKeys.includes(ev.key) && stopIfLocked(ev),
      compositionstart: stopIfLocked,
      compositionend: stopIfLocked,
      paste: stopIfLocked,
      mousedown: (ev) => {
        if (this.config.AUTO_COLLAPSE_WHEN_READ_ONLY && !isInline(ev.target)) {
          $(".md-expand").removeClass("md-expand")
        }
      },
      click: (ev) => {
        if (this.config.DISABLE_EXPAND_WHEN_READ_ONLY && isInline(ev.target)) {
          ev.stopPropagation()
          ev.preventDefault()
          return
        }
        if (this.config.CLICK_HYPERLINK_TO_OPEN_WHEN_READ_ONLY && !this.utils.metaKeyPressed(ev) && isLink(ev.target)) {
          ev.stopPropagation()
          ev.preventDefault()
          ev.target.dispatchEvent(new MouseEvent("click", { ctrlKey: true, metaKey: true, bubbles: true, cancelable: true }))
        }
      },
    }
  })()

  style = () => `
#footer-word-count-label::before { content: attr(data-value) !important }
.plu-disable-menu { color: rgb(196, 198, 204); pointer-events: none; }`

  hotkey = () => [{ hotkey: this.config.HOTKEY, callback: this.call }]

  process = () => {
    this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.allPluginsHadInjected, () => {
      this._injectReactiveLockObserver()
      this.utils.decorator.afterCall(() => File, "freshLock", this._syncDOMState)
      if (this.config.READ_ONLY_DEFAULT) {
        this.utils.waitUntil(() => File?.lock).then(() => this._toggle(true))
      }
    })
  }

  _injectReactiveLockObserver = () => {
    const targetObj = File
    const propKey = "isLocked"
    const originDescriptor = Object.getOwnPropertyDescriptor(targetObj, propKey)
    let hostValue = targetObj[propKey]

    Object.defineProperty(targetObj, propKey, {
      configurable: true,
      enumerable: true,
      get: () => originDescriptor?.get ? originDescriptor.get.call(targetObj) : hostValue,
      set: (val) => {
        if (originDescriptor?.set) {
          originDescriptor.set.call(targetObj, val)
        } else {
          hostValue = val
        }
        if (!val && this._isActive) {
          queueMicrotask(() => {
            if (this._isActive && !targetObj[propKey]) {
              targetObj.lock()
              this._syncDOMState()
            }
          })
        }
      },
    })

    this._teardowns.push(() => {
      if (originDescriptor) {
        Object.defineProperty(targetObj, propKey, originDescriptor)
      } else {
        delete targetObj[propKey]
        targetObj[propKey] = hostValue
      }
    })
  }

  _syncDOMState = () => {
    const isLocked = File.isLocked

    // update checkboxes
    this.utils.entities.querySelectorAllInWrite(`input[type="checkbox"]`).forEach(box => box.toggleAttribute("disabled", isLocked))

    // update inputs
    const inputSelectors = [
      "#typora-quick-open-input input", "#plugin-search-multi-form input", "#plugin-commander-form textarea",
      "#plugin-command-palette-input", "#plugin-ripgrep-form input", "#plugin-preferences-search input",
    ]
    inputSelectors.forEach(s => {
      const el = document.querySelector(s)
      if (el) isLocked ? el.setAttribute("readonly", "true") : el.removeAttribute("readonly")
    })

    // update replace buttons
    const btnSelectors = ["#search-panel-replace-btn", "#search-panel-replaceall-btn", "#search-panel-replace-input"]
    btnSelectors.forEach(s => document.querySelector(s)?.toggleAttribute("disabled", isLocked))

    // update show text
    if (this.config.SHOW_TEXT) {
      const labelEl = document.getElementById("footer-word-count-label")
      if (labelEl) labelEl.dataset.value = isLocked ? this.config.SHOW_TEXT + "\u00A0\u00A0\u00A0" : ""
    }

    // update menu items
    if (this.config.DISABLE_CONTEXT_MENU_WHEN_READ_ONLY) {
      const excludeSelectors = this.config.REMAIN_AVAILABLE_MENU_KEY.map(key => `:not([data-key="${key}"])`).join("")
      document.querySelectorAll(`#context-menu > li${excludeSelectors}`)
        .forEach(el => el.classList.toggle("plu-disable-menu", isLocked))
    }
  }

  _syncEventListeners = (wantToListen) => {
    const action = wantToListen ? "addEventListener" : "removeEventListener"
    for (const [eventName, handler] of Object.entries(this._eventHandlers)) {
      this.utils.entities.eWrite[action](eventName, handler, true)
    }
  }

  _toggle = (forceIntent) => {
    this._isActive = forceIntent !== undefined ? forceIntent : !this._isActive
    if (this._isActive) {
      File.lock()
      document.activeElement?.blur()
    } else {
      File.unlock()
    }
    this._syncDOMState()
    this._syncEventListeners(this._isActive)
  }

  isActive = () => Boolean(this._isActive)
  toggleLock = () => this._toggle()
  lock = () => this._toggle(true)
  unlock = () => this._toggle(false)
  destroy = () => {
    if (this._isActive) {
      this._syncEventListeners(false)
    }
    this._teardowns.forEach(fn => fn())
    this._teardowns = []
  }

  call = () => {
    this.toggleLock()
    const msg = this.i18n.t(this._isActive ? "modeEnabled" : "modeDisabled")
    this.utils.notification.show(msg)
  }
}

module.exports = {
  plugin: ReadOnlyPlugin,
}
