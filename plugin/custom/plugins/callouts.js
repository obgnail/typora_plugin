class calloutsPlugin extends BaseCustomPlugin {
    styleTemplate = () => {
        const { list, hover_to_show_fold_callout, set_title_color } = this.config;
        const callouts = list.map(c => (
            `.plugin-callout[callout-type="${c.type}"] {
                --callout-bg-color: ${c.background_color};
                --callout-left-line-color: ${c.left_line_color};
                --callout-icon: "${c.icon}";
            }`
        )).join("\n");
        const hoverCss = `.callout-folded:hover :not(:first-child):not(.md-softbreak) { display: inherit !important; }`
        const colorCss = `.plugin-callout > p:first-child span:first-child { color: var(--callout-left-line-color); }
               .plugin-callout > p:first-child::before { color: var(--callout-left-line-color); }`;
        const hover = hover_to_show_fold_callout ? hoverCss : ""
        const color = set_title_color ? colorCss : ""
        return { callouts, hover, color }
    }

    process = () => {
        const { eventHub, exportHelper } = this.utils;
        eventHub.addEventListener(eventHub.eventType.firstFileInit, this.range);
        eventHub.addEventListener(eventHub.eventType.fileEdited, this.range);
        exportHelper.register("callouts", this.beforeExport, this.afterExport);
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
                // Add data-type attribute to spans containing [!type]
                const firstSpan = p.querySelector('span:first-child');
                if (firstSpan) {
                    firstSpan.setAttribute('data-type', type);
                }
                blockquote.setAttribute("callout-type", type.toLowerCase());
                blockquote.classList.toggle("callout-folded", fold === "-");
            }
        })
    }

    callback = anchorNode => this.utils.insertText(anchorNode, this.config.template)

    check = args => {
        const isIgnoreType = args && args[0] && args[0].type === "html-plain";
        const hasCallout = this.utils.entities.querySelectorInWrite(".plugin-callout");
        return !isIgnoreType && hasCallout
    }

    // The icon needs font, but there is no font when exporting, so it can only be removed.
    beforeExport = (...args) => {
        if (this.check(args)) {
            const css = this.utils.styleTemplater.getStyleContent(this.fixedName)
            return css.replace(/--callout-icon: ".*?";/g, "")
        }
    }

    afterExport = (html, ...args) => {
        if (!this.check(args)) return

        const quotesInPage = [...this.utils.entities.querySelectorAllInWrite("blockquote")]
        if (quotesInPage.length === 0) return

        const doc = new DOMParser().parseFromString(html, "text/html")
        const quotesInHTML = [...doc.querySelectorAll("blockquote")]
        if (quotesInHTML.length !== quotesInPage.length) return

        const zipArray = this.utils.zip(quotesInPage, quotesInHTML)
        for (const [quoteInPage, quoteInHTML] of zipArray) {
            if (quoteInPage.classList.length) {
                quoteInHTML.className = "plugin-callout"

                const calloutType = quoteInPage.getAttribute("callout-type")
                quoteInHTML.setAttribute("callout-type", calloutType)

                const span = quoteInHTML.querySelector(":scope > p:first-child > span:first-child")
                if (span) {
                    span.setAttribute("data-type", calloutType.toUpperCase())
                }
            }
        }
        return `<!DOCTYPE HTML>\n${doc.documentElement.outerHTML}`
    }
}

module.exports = {
    plugin: calloutsPlugin,
}
