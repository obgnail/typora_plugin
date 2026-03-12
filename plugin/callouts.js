class CalloutsPlugin extends BasePlugin {
    styleTemplate = () => {
        const callouts = this.config.CALLOUTS.map(c => (
            `.plugin-callout[callout-type="${c.type}"] {
                --callout-bg-color: ${c.background_color};
                --callout-left-line-color: ${c.left_line_color};
                --callout-icon: "${c.icon}";
            }`
        )).join("\n")
        const hoverCss = `.callout-folded:hover :not(:first-child):not(.md-softbreak) { display: inherit !important; }`
        const colorCss = `.plugin-callout > p:first-child span:first-child { color: var(--callout-left-line-color); }
               .plugin-callout > p:first-child::before { color: var(--callout-left-line-color); }`
        const hover = this.config.HOVER_TO_SHOW_FOLD_CALLOUT ? hoverCss : ""
        const color = this.config.SET_TITLE_COLOR ? colorCss : ""
        return { callouts, hover, color }
    }

    hotkey = () => [{ hotkey: this.config.HOTKEY, callback: this.call }]

    process = () => {
        this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.allPluginsHadInjected, () => setTimeout(this.setCallouts, 100))
        this.utils.eventHub.addEventListener(this.utils.eventHub.eventType.fileEdited, this.setCallouts)
        this.utils.exportHelper.register(this.fixedName, this.beforeExport, this.afterExport)
    }

    setCallouts = () => {
        this.utils.entities.querySelectorAllInWrite("blockquote > p:first-child").forEach(p => {
            const blockquote = p.parentElement
            const result = p.textContent.match(/^\[!(?<type>\w+)\](?<fold>[+-]?)/)
            const ok = !!(result?.groups)
            blockquote.classList.toggle("plugin-callout", ok)
            if (ok) {
                const { type, fold } = result.groups
                // Add data-type attribute to spans containing [!type]
                p.querySelector("span:first-child")?.setAttribute("data-type", type)
                blockquote.setAttribute("callout-type", type.toLowerCase())
                blockquote.classList.toggle("callout-folded", fold === "-")
            }
        })
    }

    call = () => this.utils.insertText(null, this.config.TEMPLATE)

    check = args => {
        const isIgnoredExportType = args?.[0]?.type === "html-plain"
        const hasCallouts = this.utils.entities.querySelectorInWrite(".plugin-callout")
        return !isIgnoredExportType && hasCallouts
    }

    beforeExport = (...args) => {
        if (!this.check(args)) return

        const extra = `
            @font-face {
                font-family: "${this.config.FONT_FAMILY}";
                src: url("${this.config.NETWORK_ICON_URL}");
                font-weight: normal;
                font-style: normal;
            }`
        const css = this.utils.styleTemplater.getStyleContent(this.fixedName)
        return this.config.USE_NETWORK_ICON_WHEN_EXPORTING
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
