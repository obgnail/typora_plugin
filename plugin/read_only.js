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

    init = () => {
        this.lastClickTime = 0;
        this.inComposition = false;
    }

    process = () => {
        this.init();

        const write = document.getElementById("write");
        write.addEventListener("keydown", this.stopKeyboard, true);
        write.addEventListener("mousedown", this.stopMouse, true);
        write.addEventListener("click", this.stopMouse, true);

        if (this.config.READ_ONLY_DEFAULT) {
            this.utils.loopDetector(() => !!File, this.call);
        }

        const that = this;
        write.addEventListener("compositionstart", ev => {
            that.inComposition = true;
            (File.isLocked) && that.stop(ev);
        });
        write.addEventListener("compositionend", () => that.inComposition = false);

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

    stopMouse = ev => {
        if (!File.isLocked) return;

        const target = ev.target.closest('.footnotes, figure[mdtype="table"], .md-task-list-item, .md-image, .ty-cm-lang-input, input[type="checkbox"]');
        // const target = ev.target.closest('.md-image');
        if (target) {
            ev.preventDefault();
            ev.stopPropagation();
        }
    }

    stopKeyboard = ev => {
        if (!File.isLocked) return;

        if (ev.timeStamp - this.lastClickTime > this.config.CLICK_CHECK_INTERVAL) {
            File.lock();
        }

        // File.isLocked 也挡不住回车键 :(
        if ((ev.key === "Enter") && this.inComposition) {
            stop(ev);
        }
    }

    stop = ev => {
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
