class CalloutsPlugin extends BaseCustomPlugin {
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
        this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.fileEdited, this.setCallouts)
        this.utils.exportHelper.register("callouts", this.beforeExport, this.afterExport)
    }

    setCallouts = () => {
        this.utils.entities.querySelectorAllInWrite("blockquote > p:first-child").forEach(p => {
            const blockquote = p.parentElement;
            const result = p.textContent.match(/^\[!(?<type>\w+)\](?<fold>[+-]?)/);
            const ok = !!(result?.groups)
            blockquote.classList.toggle("plugin-callout", ok);
            if (ok) {
                const { type, fold } = result.groups;
                // Add data-type attribute to spans containing [!type]
                p.querySelector("span:first-child")?.setAttribute("data-type", type)
                blockquote.setAttribute("callout-type", type.toLowerCase());
                blockquote.classList.toggle("callout-folded", fold === "-");
            }
        })
    }

    callback = anchorNode => this.utils.insertText(anchorNode, this.config.template)

    check = args => {
        const isIgnoreType = args?.[0]?.type === "html-plain"
        const hasCallout = this.utils.entities.querySelectorInWrite(".plugin-callout")
        return !isIgnoreType && hasCallout
    }

    beforeExport = (...args) => {
        if (!this.check(args)) return

        const extra = `
            @font-face {
                font-family: "${this.config.font_family}";
                src: url("${this.config.network_icon_url}");
                font-weight: normal;
                font-style: normal;
            }`
        const css = this.utils.styleTemplater.getStyleContent(this.fixedName)
        return this.config.use_network_icon_when_exporting
            ? extra + css
            : css.replace(/--callout-icon: ".*?";/g, "")
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
                span?.setAttribute("data-type", calloutType.toUpperCase())
            }
        }
        return `<!DOCTYPE HTML>\n${doc.documentElement.outerHTML}`
    }
}

module.exports = {
    plugin: CalloutsPlugin
}
