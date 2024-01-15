class callouts extends BaseCustomPlugin {
    styleTemplate = () => {
        const calloutList = this.config.list.map(callout => (
            `.plugin-callout[callout-type="${callout.type}"] {
                --callout-bg-color: ${callout.background_color};
                --callout-left-line-color: ${callout.left_line_color};
                --callout-icon: "${callout.icon}";
            }`
        ))
        const hoverCss = `.callout-folded:hover :not(:first-child):not(.md-softbreak) { display: inherit !important; }`
        const colorCss = `.plugin-callout > p:first-child span:first-child { color: var(--callout-left-line-color); }
               .plugin-callout > p:first-child::before { color: var(--callout-left-line-color); }`;

        const callouts = calloutList.join("\n");
        const hover = this.config.hover_to_show_fold_callout ? hoverCss : ""
        const color = this.config.set_title_color ? colorCss : ""
        return {callouts, hover, color}
    }

    process = () => {
        this.utils.addEventListener(this.utils.eventType.firstFileInit, this.range);
        this.utils.addEventListener(this.utils.eventType.fileEdited, this.range);
        const getExportStyle = () => document.querySelector("#write .plugin-callout") ? this.getStyleContent(true) : ""
        this.utils.registerExportHelper("callouts", getExportStyle, this.exportToHtml);
    }

    getStyleContent = (removeIcon = false) => {
        let result = this.utils.getStyleContent(this.fixedName);
        // icon需要用到font，但是导出时又没有font，因此只能移除
        if (removeIcon) {
            result = result.replace(/--callout-icon: ".*?";/g, "");
        }
        return result
    }

    range = () => {
        const pList = document.querySelectorAll("#write blockquote > p:first-child");
        pList.forEach(p => {
            const blockquote = p.parentElement;
            const result = p.textContent.match(/^\[!(?<type>\w+)\](?<fold>[+-]?)/);
            const ok = result && result.groups;
            blockquote.classList.toggle("plugin-callout", ok);
            if (ok) {
                const {type, fold} = result.groups;
                blockquote.setAttribute("callout-type", type.toLowerCase());
                blockquote.classList.toggle("callout-folded", fold === "-");
            }
        })
    }

    callback = anchorNode => this.utils.insertText(anchorNode, this.config.template)

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