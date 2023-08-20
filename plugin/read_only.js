class readOnlyPlugin extends global._basePlugin {
    style = () => {
        const textID = "plugin-read-only-style";
        const text = `#footer-word-count-label::before {content: attr(data-value) !important}`;
        return {textID, text}
    }

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
        write.addEventListener("keydown", ev => (File.isLocked && ev.key === "Enter") && that.stop(ev), true);

        if (this.config.READ_ONLY_DEFAULT) {
            this.utils.loopDetector(() => !!File, this.call);
        }
        this.utils.decorate(
            () => (File && File.freshLock),
            "File.freshLock",
            null,
            () => {
                if (!File.isLocked) return;
                [
                    "#typora-search-multi-input input",
                    "#typora-commander-form input",
                    "#plugin-multi-highlighter-input input",
                    "#typora-quick-open-input input",
                ].forEach(selector => {
                    const input = document.querySelector(selector);
                    input && input.removeAttribute("readonly");
                })
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
