class readOnlyPlugin extends BasePlugin {
    styleTemplate = () => true

    hotkey = () => [{hotkey: this.config.HOTKEY, callback: this.call}]

    process = () => {
        const write = document.getElementById("write");
        const forbiddenKeys = ["Enter", "Backspace", "Delete", " "];
        write.addEventListener("compositionstart", ev => File.isLocked && this.stop(ev), true);
        write.addEventListener("keydown", ev => File.isLocked && forbiddenKeys.includes(ev.key) && this.stop(ev), true);
        write.addEventListener("paste", ev => File.isLocked && this.stop(ev), true);

        if (this.config.READ_ONLY_DEFAULT) {
            this.utils.loopDetector(() => File && File.lock, this.call);
        }

        const setCheckbox = disabled => {
            const checkboxes = write.querySelectorAll(`input[type="checkbox"]`);
            checkboxes.forEach(input => {
                if (disabled) {
                    input.setAttribute("disabled", "true");
                } else {
                    input.removeAttribute("disabled");
                }
            });
        }
        const setInput = disabled => {
            if (!disabled) return;
            const inputs = [
                "#plugin-search-multi-input input",
                "#plugin-commander-form input",
                "#plugin-toolbar-input input",
                "#plugin-multi-highlighter-input input",
                "#typora-quick-open-input input"
            ]
            inputs.forEach(selector => {
                const input = document.querySelector(selector);
                input && input.removeAttribute("readonly");
            })
        }
        const setComponents = () => {
            setCheckbox(File.isLocked);
            setInput(File.isLocked);
        }
        this.utils.decorate(() => File, "freshLock", null, setComponents)
    }

    stop = ev => {
        File.lock();
        document.activeElement.blur();
        ev.preventDefault();
        ev.stopPropagation();
    }

    toggleMenu = () => {
        if (this.config.DISABLE_CONTEXT_MENU_WHEN_READ_ONLY) {
            const selector = `#context-menu > li:not([data-key="typora-plugin"]):not([data-key="dev-tool"])`;
            document.querySelectorAll(selector).forEach(ele => ele.classList.toggle("plu-disable-menu"));
        }
    }

    lock = span => {
        File.lock();
        document.activeElement.blur();
        span.setAttribute("data-value", this.config.SHOW_TEXT + String.fromCharCode(160).repeat(3));
        this.toggleMenu();
    }

    unlock = span => {
        File.unlock();
        span.setAttribute("data-value", "");
        this.toggleMenu();
    }

    call = () => {
        const span = document.getElementById("footer-word-count-label");
        if (File.isLocked) {
            this.unlock(span);
        } else {
            this.lock(span);
        }
    }
}

module.exports = {
    plugin: readOnlyPlugin,
};
