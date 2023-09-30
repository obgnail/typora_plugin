class callouts extends BaseCustomPlugin {
    style = () => {
        const callouts = this.config.list.map(callout => {
            return `.plugin-callout[callout-type="${callout.type}"] {
                --callout-bg-color: ${callout.background_color};
                --callout-left-line-color: ${callout.left_line_color};
                --callout-icon: "${callout.icon}";
            }`
        }).join("\n");

        const hover = (!this.config.hover_to_show_fold_callout) ? "" :
            `.callout-folded:hover :not(:first-child):not(.md-softbreak) { display: inherit !important; }`;

        const color = (!this.config.set_title_color) ? "" : `
            .plugin-callout > p:first-child span:first-child { color: var(--callout-left-line-color); }
            .plugin-callout > p:first-child::before { color: var(--callout-left-line-color); }`;

        return `
            .plugin-callout {
                background-color: var(--callout-bg-color);
                border-left: 4px solid var(--callout-left-line-color);
                padding: 10px 10px 10px 15px;
                box-shadow: 0 0.2rem 0.5rem #0000000d, 0 0 0.05rem #0000001a;
                overflow: hidden;
            }
            
            .plugin-callout[callout-type] {
                --callout-bg-color: ${this.config.default_background_color};
                --callout-left-line-color: ${this.config.default_left_line_color};
                --callout-icon: "${this.config.default_icon}";
            }
            
            .plugin-callout > p:first-child {
                margin: -10px -10px -10px -15px;
                padding: 10px 10px 10px 15px;
                letter-spacing: 1px;
            }
            
            .plugin-callout > p:first-child::before {
                font-family: ${this.config.font_family};
                content: var(--callout-icon);
                margin-right: 0.5em;
            }
            
            .callout-folded > p:first-child :not(:first-child) { display: none; }
            .callout-folded > p:not(:first-child) { display: none; }
            
            .callout-folded:has(.md-focus) :not(:first-child):not(.md-softbreak) { display: inherit !important; }
            ${hover}
            ${color}
            ${callouts}
        `
    }

    process = () => {
        this.utils.addEventListener(this.utils.eventType.firstFileInit, this.range);

        const write = document.querySelector("#write");
        this.utils.registerExportHelper(
            "callouts",
            () => (write.querySelector(".plugin-callout")) ? this.style() : "",
            this.exportToHtml
        )

        const debounceRange = this.utils.debounce(this.range, 500);
        new MutationObserver(mutationList => {
            if (mutationList.some(m => m.type === "characterData")
                || mutationList.length && mutationList[0].addedNodes.length && mutationList[0].removedNodes.length) {
                debounceRange();
            }
        }).observe(write, {characterData: true, childList: true, subtree: true});
    }

    range = () => {
        const pList = document.querySelectorAll("#write blockquote > p:first-child");
        pList.forEach(p => {
            const blockquote = p.parentElement;
            const result = p.textContent.match(/^\[!(?<type>\w+)\](?<fold>[+-]?)/);
            if (result && result.groups) {
                blockquote.classList.add("plugin-callout");
                blockquote.setAttribute("callout-type", result.groups.type.toLowerCase());
                if (result.groups.fold === "-") {
                    blockquote.classList.add("callout-folded");
                } else {
                    blockquote.classList.remove("callout-folded");
                }
            } else {
                blockquote.classList.remove("plugin-callout");
            }
        })
    }

    callback = anchorNode => this.utils.insertFence(anchorNode, this.config.template)

    exportToHtml = (html, writeIdx) => {
        const regex = new RegExp("<blockquote>", "g");
        const count = (html.match(regex) || []).length;
        const quotes = Array.from(document.querySelectorAll("#write blockquote"));
        if (count !== quotes.length) return html;

        let idx = -1;
        return html.replace(regex, (origin, src, srcIdx) => {
            idx++;
            if (srcIdx < writeIdx) return origin;
            let result = origin;

            const quote = quotes[idx];
            if (quote && quote.classList.length) {
                const type = quote.getAttribute("callout-type");
                result = `<blockquote class="${quote.className}" callout-type="${type}">`;
            }
            return result;
        })
    }
}

module.exports = {
    plugin: callouts,
};