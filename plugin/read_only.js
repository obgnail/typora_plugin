class readOnlyPlugin extends BasePlugin {
    styleTemplate = () => true

    hotkey = () => [{hotkey: this.config.HOTKEY, callback: this.call}]

    process = () => {
        const write = document.getElementById("write");
        write.addEventListener("compositionstart", ev => (File.isLocked) && this.stop(ev), true);
        write.addEventListener("keydown", ev => {
            if (File.isLocked && (ev.key === "Enter" || ev.key === "Backspace" || ev.key === "Delete" || ev.key === ' ')) {
                this.stop(ev);
            }
        }, true);

        if (this.config.READ_ONLY_DEFAULT) {
            this.utils.loopDetector(() => File && File.lock, this.call);
        }

        const setCheckbox = disabled => {
            write.querySelectorAll(`input[type="checkbox"]`).forEach(input => {
                if (disabled) {
                    input.setAttribute("disabled", "true");
                } else {
                    input.removeAttribute("disabled");
                }
            });
        }
        const setInput = disabled => {
            if (disabled) {
                [
                    "#plugin-search-multi-input input", "#plugin-commander-form input", "#plugin-toolbar-input input",
                    "#plugin-multi-highlighter-input input", "#typora-quick-open-input input"
                ].forEach(selector => {
                    const input = document.querySelector(selector);
                    input && input.removeAttribute("readonly");
                })
            }
        }
        this.utils.decorate(() => File, "freshLock", null, () => {
            setCheckbox(File.isLocked);
            setInput(File.isLocked);
        })
    }

    stop = ev => {
        File.lock();
        document.activeElement.blur();
        ev.preventDefault();
        ev.stopPropagation();
    }

    call = () => {
        const span = document.getElementById("footer-word-count-label");
        if (File.isLocked) {
            File.unlock();
            span.setAttribute("data-value", "");
        } else {
            File.lock();
            document.activeElement.blur();
            span.setAttribute("data-value", this.config.SHOW_TEXT + String.fromCharCode(160).repeat(3));
        }
    }
}

module.exports = {
    plugin: readOnlyPlugin,
};
