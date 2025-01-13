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
                // 为包含 [!type] 的 span 添加 data-type 属性
                const firstSpan = p.querySelector('span:first-child');
                // 设置为 type 标题
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

    // icon需要用到font，但是导出时又没有font，因此只能移除
    beforeExport = (...args) => {
        if (this.check(args)) {
            return this.utils.styleTemplater.getStyleContent(this.fixedName).replace(/--callout-icon: ".*?";/g, "");
        }
    }

    afterExport = (html, ...args) => {
        if (!this.check(args)) return;

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
