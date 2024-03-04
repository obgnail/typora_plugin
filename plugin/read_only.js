class readOnlyPlugin extends BasePlugin {
    styleTemplate = () => true

    hotkey = () => [{hotkey: this.config.HOTKEY, callback: this.call}]

    process = () => {
        this.inReadOnlyMode = false;
        this.forbiddenKeys = ["Enter", "Backspace", "Delete", " "];
        this.utils.addEventListener(this.utils.eventType.allPluginsHadInjected, () => {
            this.utils.decorate(() => File, "freshLock", null, this.afterFreshLock);
            if (this.config.READ_ONLY_DEFAULT) {
                this.utils.loopDetector(() => File && File.lock, this.toggleLock);
            }
        })
    }

    afterFreshLock = () => {
        if (!this.inReadOnlyMode) return;

        const setCheckbox = disabled => document.querySelectorAll('#write input[type="checkbox"]').forEach(box => box.toggleAttribute("disabled", disabled))
        const setInput = disabled => {
            if (!disabled) return;
            [
                "#plugin-search-multi-input input", "#plugin-commander-form input", "#plugin-toolbar-input input",
                "#plugin-multi-highlighter-input input", "#typora-quick-open-input input",
            ].forEach(selector => {
                const input = document.querySelector(selector);
                input && input.removeAttribute("readonly");
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
    _stopEvent = ev => File.isLocked && this.stop(ev)
    _stopKeydown = ev => File.isLocked && this.forbiddenKeys.includes(ev.key) && this.stop(ev)

    extraOperation = lock => {
        const write = document.getElementById("write");
        const func = lock ? "addEventListener" : "removeEventListener";
        const map = {keydown: this._stopKeydown, compositionstart: this._stopEvent, paste: this._stopEvent};
        for (const [ev, callback] of Object.entries(map)) {
            write[func](ev, callback, true);
        }
    }
    setLabel = value => document.getElementById("footer-word-count-label").setAttribute("data-value", value);
    toggleMenu = () => {
        if (this.config.DISABLE_CONTEXT_MENU_WHEN_READ_ONLY) {
            const selector = '#context-menu > li:not([data-key="typora-plugin"]):not([data-key="dev-tool"])';
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

    call = () => this.toggleLock()
}

module.exports = {
    plugin: readOnlyPlugin,
};
