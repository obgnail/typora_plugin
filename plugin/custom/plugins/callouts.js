class calloutsPlugin extends BaseCustomPlugin {
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
        return { callouts, hover, color }
    }

    process = () => {
        const { eventHub, exportHelper } = this.utils;
        eventHub.addEventListener(eventHub.eventType.firstFileInit, this.range);
        eventHub.addEventListener(eventHub.eventType.fileEdited, this.range);
        exportHelper.register("callouts", this.beforeExport, this.AfterExport);
    }

    range = () => {
        const pList = this.utils.entities.querySelectorAllInWrite("blockquote > p:first-child");
        pList.forEach(p => {
            const blockquote = p.parentElement;
            const result = p.textContent.match(/^\[!(?<type>\w+)\](?<fold>[+-]?)/);
            const ok = result && result.groups;
            blockquote.classList.toggle("plugin-callout", ok);
            if (ok) {
                const { type, fold } = result.groups;
                blockquote.setAttribute("callout-type", type.toLowerCase());
                blockquote.classList.toggle("callout-folded", fold === "-");
            }
        })
    }

    callback = anchorNode => this.utils.insertText(anchorNode, this.config.template)

    isIgnoreType = args => args && args[0] && args[0].type === "html-plain"

    beforeExport = (...args) => {
        if (!this.isIgnoreType(args) && this.utils.entities.querySelectorInWrite(".plugin-callout")) {
            // icon需要用到font，但是导出时又没有font，因此只能移除
            return this.utils.styleTemplater.getStyleContent(this.fixedName).replace(/--callout-icon: ".*?";/g, "");
        }
    }

    AfterExport = (html, ...args) => {
        if (this.isIgnoreType(args)) return;

        const regex = new RegExp("<blockquote>", "g");
        const count = (html.match(regex) || []).length;
        const quotes = Array.from(this.utils.entities.querySelectorAllInWrite("blockquote"));
        if (count !== quotes.length) return html;

        let idx = -1;
        return html.replace(regex, origin => {
            idx++;
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
    plugin: calloutsPlugin,
};