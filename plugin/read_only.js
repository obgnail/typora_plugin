class ReadOnlyPlugin extends BasePlugin {
    styleTemplate = () => true

    hotkey = () => [{ hotkey: this.config.HOTKEY, callback: this.call }]

    process = () => {
        this.inReadOnlyMode = false
        this.eventHandlers = this._buildEventHandlers()
        this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.allPluginsHadInjected, () => {
            this.utils.decorate(() => File, "freshLock", null, this._afterFreshLock)
            if (this.config.READ_ONLY_DEFAULT) {
                this.utils.pollUntil(() => File?.lock, this.toggleLock)
            }
        })
    }

    _afterFreshLock = () => {
        const updateCheckbox = wantToLock => {
            const elements = this.utils.entities.querySelectorAllInWrite('input[type="checkbox"]')
            elements.forEach(box => box.toggleAttribute("disabled", wantToLock))
        }
        const updateInput = wantToLock => {
            if (!wantToLock) return
            const selectors = ["#typora-quick-open-input input", "#plugin-search-multi-form input", "#plugin-commander-form input", "#plugin-toolbar-form input", "#plugin-ripgrep-form input"]
            selectors.forEach(s => document.querySelector(s)?.removeAttribute("readonly"))
        }
        const updateReplaceButton = wantToLock => {
            const selectors = ["#search-panel-replace-btn", "#search-panel-replaceall-btn", "#search-panel-replace-input"]
            selectors.forEach(s => document.querySelector(s).toggleAttribute("disabled", wantToLock))
        }

        const wantToLock = File.isLocked
        updateCheckbox(wantToLock)
        updateInput(wantToLock)
        updateReplaceButton(wantToLock)
    }

    _buildEventHandlers = () => {
        const forbiddenKeys = ["Enter", "Backspace", "Delete", " "]
        const isInline = el => el.closest('#write span[md-inline="image"], #write span[md-inline="inline_math"]')
        const isLink = el => el.closest('#write span[md-inline="link"], #write .md-link')
        const stopEvent = ev => {
            if (File.isLocked) {
                File.lock()
                document.activeElement.blur()
                ev.preventDefault()
                ev.stopPropagation()
            }
        }
        const stopForbiddenKey = ev => {
            if (File.isLocked && forbiddenKeys.includes(ev.key)) stopEvent(ev)
        }
        const recoverExpand = ev => {
            if (!isInline(ev.target)) $(".md-expand").removeClass("md-expand")
        }
        const openHyperlink = ev => {
            if (this.config.NO_EXPAND_WHEN_READ_ONLY && isInline(ev.target)) {
                ev.stopPropagation()
                ev.preventDefault()
                return
            }
            if (this.config.CLICK_HYPERLINK_TO_OPEN_WHEN_READ_ONLY && isLink(ev.target) && !this.utils.metaKeyPressed(ev)) {
                ev.stopPropagation()
                ev.preventDefault()
                const dict = { ctrlKey: true, metaKey: true, bubbles: true, cancelable: true }
                ev.target.dispatchEvent(new MouseEvent("click", dict))
            }
        }

        const handlers = { keydown: stopForbiddenKey, compositionstart: stopEvent, paste: stopEvent }
        if (this.config.CLICK_HYPERLINK_TO_OPEN_WHEN_READ_ONLY || this.config.NO_EXPAND_WHEN_READ_ONLY) {
            handlers.click = openHyperlink
        }
        if (this.config.REMOVE_EXPAND_WHEN_READ_ONLY) {
            handlers.mousedown = recoverExpand
        }
        return handlers
    }

    _toggleLock = (wantToLock) => {
        const handleEvents = wantToLock => {
            File[wantToLock ? "lock" : "unlock"]()
            if (wantToLock) document.activeElement.blur()
            const fn = wantToLock ? "addEventListener" : "removeEventListener"
            for (const [ev, handler] of Object.entries(this.eventHandlers)) {
                this.utils.entities.eWrite[fn](ev, handler, true)
            }
        }
        const setLabel = wantToLock => {
            document.getElementById("footer-word-count-label").dataset.value = wantToLock ? this.config.SHOW_TEXT + String.fromCharCode(160).repeat(3) : ""
        }
        const toggleMenu = (wantToLock) => {
            if (this.config.DISABLE_CONTEXT_MENU_WHEN_READ_ONLY) {
                const exclude = "li" + this.config.REMAIN_AVAILABLE_MENU_KEY.map(key => `:not([data-key="${key}"])`).join("")
                document.querySelectorAll(`#context-menu > ${exclude}`).forEach(el => el.classList.toggle("plu-disable-menu", wantToLock))
            }
        }

        this.inReadOnlyMode = wantToLock
        handleEvents(wantToLock)
        setLabel(wantToLock)
        toggleMenu(wantToLock)
    }

    toggleLock = () => this._toggleLock(!File.isLocked)
    lock = () => this._toggleLock(true)
    unlock = () => this._toggleLock(false)

    call = () => {
        this.toggleLock()
        const msg = this.i18n.t(this.inReadOnlyMode ? "modeEnabled" : "modeDisabled")
        this.utils.notification.show(msg)
    }
}

module.exports = {
    plugin: ReadOnlyPlugin
}
