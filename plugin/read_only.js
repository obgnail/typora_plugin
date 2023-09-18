class readOnlyPlugin extends global._basePlugin {
    style = () => `#footer-word-count-label::before {content: attr(data-value) !important}`

    hotkey = () => {
        return [{
            hotkey: this.config.HOTKEY,
            callback: this.call,
        }]
    }

    process = () => {
        const that = this;

        const write = document.getElementById("write");
        write.addEventListener("compositionstart", ev => (File.isLocked) && that.stop(ev), true);
        write.addEventListener("keydown", ev => {
            if (File.isLocked && (ev.key === "Enter" || ev.key === "Backspace" || ev.key === "Delete" || ev.key === ' ')) {
                that.stop(ev);
            }
        }, true);

        if (this.config.READ_ONLY_DEFAULT) {
            this.utils.loopDetector(() => !!File, this.call);
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

        this.utils.decorate(
            () => (File && File.freshLock),
            "File.freshLock",
            null,
            () => {
                setCheckbox(File.isLocked);
                if (File.isLocked) {
                    ["#plugin-search-multi-input input", "#plugin-commander-form input",
                        "#plugin-multi-highlighter-input input", "#typora-quick-open-input input"].forEach(selector => {
                        const input = document.querySelector(selector);
                        input && input.removeAttribute("readonly");
                    })
                }
            }
        )
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
            span.setAttribute("data-value", "ReadOnly" + String.fromCharCode(160).repeat(3));
        }
    }
}

module.exports = {
    plugin: readOnlyPlugin,
};
