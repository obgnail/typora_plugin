class readOnlyPlugin extends BasePlugin {
    styleTemplate = () => true

    hotkey = () => [{ hotkey: this.config.HOTKEY, callback: this.call }]

    process = () => {
        this.inReadOnlyMode = false;
        this.forbiddenKeys = ["Enter", "Backspace", "Delete", " "];
        this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.allPluginsHadInjected, () => {
            this.utils.decorate(() => File, "freshLock", null, this.afterFreshLock);
            if (this.config.READ_ONLY_DEFAULT) {
                this.utils.loopDetector(() => File && File.lock, this.toggleLock);
            }
        })
    }

    afterFreshLock = () => {
        const setCheckbox = disabled => this.utils.entities.querySelectorAllInWrite('input[type="checkbox"]').forEach(box => box.toggleAttribute("disabled", disabled))
        const setInput = disabled => {
            if (!disabled) return;
            [
                "#plugin-search-multi-form input",
                "#plugin-commander-form input",
                "#plugin-toolbar-form input",
                "#plugin-ripgrep-form input",
                "#typora-quick-open-input input",
            ].forEach(selector => {
                const input = document.querySelector(selector)
                if (input) input.removeAttribute("readonly")
            })
        }
        const setReplaceButton = disabled => {
            const elements = ["#search-panel-replace-btn", "#search-panel-replaceall-btn", "#search-panel-replace-input"];
            elements.forEach(selector => document.querySelector(selector).toggleAttribute("disabled", disabled));
        }

        const disabled = File.isLocked;
        setCheckbox(disabled);
        setInput(disabled);
        setReplaceButton(disabled);
    }

    stop = ev => {
        File.lock();
        document.activeElement.blur();
        ev.preventDefault();
        ev.stopPropagation();
    }
    _isInline = ele => ele.closest('#write span[md-inline="image"], #write span[md-inline="inline_math"]')
    _isLink = ele => ele.closest('#write span[md-inline="link"], #write .md-link')
    _stopEvent = ev => File.isLocked && this.stop(ev)
    _stopKeydown = ev => File.isLocked && this.forbiddenKeys.includes(ev.key) && this.stop(ev)
    _recoverExpand = ev => {
        if (!this._isInline(ev.target)) {
            $(".md-expand").removeClass("md-expand");
        }
    }
    _openHyperlink = ev => {
        if (this.config.NO_EXPAND_WHEN_READ_ONLY && this._isInline(ev.target)) {
            ev.stopPropagation();
            ev.preventDefault();
            return;
        }
        if (this.config.CLICK_HYPERLINK_TO_OPEN_WHEN_READ_ONLY && this._isLink(ev.target) && !this.utils.metaKeyPressed(ev)) {
            ev.stopPropagation();
            ev.preventDefault();
            const dict = { ctrlKey: true, metaKey: true, bubbles: true, cancelable: true };
            ev.target.dispatchEvent(new MouseEvent("click", dict));
        }
    }

    extraOperation = lock => {
        const write = this.utils.entities.eWrite;
        const func = lock ? "addEventListener" : "removeEventListener";
        const map = { keydown: this._stopKeydown, compositionstart: this._stopEvent, paste: this._stopEvent };
        if (this.config.CLICK_HYPERLINK_TO_OPEN_WHEN_READ_ONLY || this.config.NO_EXPAND_WHEN_READ_ONLY) {
            map.click = this._openHyperlink;
        }
        if (this.config.REMOVE_EXPAND_WHEN_READ_ONLY) {
            map.mousedown = this._recoverExpand;
        }
        for (const [ev, callback] of Object.entries(map)) {
            write[func](ev, callback, true);
        }
    }
    setLabel = value => document.getElementById("footer-word-count-label").setAttribute("data-value", value);
    toggleMenu = () => {
        if (this.config.DISABLE_CONTEXT_MENU_WHEN_READ_ONLY) {
            const exclude = "li" + this.config.REMAIN_AVAILABLE_MENU_KEY.map(key => `:not([data-key="${key}"])`).join("");
            const selector = `#context-menu > ${exclude}`;
            document.querySelectorAll(selector).forEach(ele => ele.classList.toggle("plu-disable-menu"));
        }
    }

    lock = () => {
        this.inReadOnlyMode = true;
        File.lock();
        document.activeElement.blur();
        this.extraOperation(true);
        this.setLabel(this.config.SHOW_TEXT + String.fromCharCode(160).repeat(3));
        this.toggleMenu();
    }

    unlock = () => {
        this.inReadOnlyMode = false;
        File.unlock();
        this.extraOperation(false);
        this.setLabel("");
        this.toggleMenu();
    }

    toggleLock = () => (File.isLocked ? this.unlock : this.lock)()

    call = () => {
        this.toggleLock()
        const msg = this.i18n.t(this.inReadOnlyMode ? "modeEnabled" : "modeDisabled")
        this.utils.notification.show(msg)
    }
}

module.exports = {
    plugin: readOnlyPlugin,
}
