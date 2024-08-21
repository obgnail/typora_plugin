/**
 * 动态注册导出时的额外操作
 */
class exportHelper {
    constructor(utils) {
        this.utils = utils;
        this.helpers = new Map();
        this.isAsync = undefined;
    }

    /**
     * @param {string} name: 取个名字
     * @param {function(exportOptions): string | null} beforeExport: 如果返回string，将加入到extraCSS
     * @param {function(html, exportOptions): html | null} afterExport: 如果返回string，将替换HTML
     */
    register = (name, beforeExport, afterExport) => this.helpers.set(name, { beforeExport, afterExport });
    unregister = name => this.helpers.delete(name);

    beforeExport = (...args) => {
        for (const h of this.helpers.values()) {
            if (h.beforeExport) {
                const css = h.beforeExport(...args) || "";
                args[0].extraCss = (args[0].extraCss || "") + css;
            }
        }
    }

    check = args => {
        const { type } = args[0] || {};
        return type === "html" || type === "html-plain" || type === "pdf"
    }

    afterExport = async (exportResult, ...args) => {
        if (!this.check(args)) return exportResult

        let html = await exportResult;
        for (const h of this.helpers.values()) {
            if (h.afterExport) {
                const newHtml = await h.afterExport(html, ...args);
                if (newHtml) {
                    html = newHtml;
                }
            }
        }
        return html;
    }

    afterExportSync = (exportResult, ...args) => {
        if (!this.check(args)) return exportResult

        let html = exportResult;
        for (const h of this.helpers.values()) {
            if (h.afterExport) {
                const newHtml = h.afterExport(html, ...args);
                if (newHtml && !this.utils.isPromise(newHtml)) {
                    html = newHtml;
                }
            }
        }
        return html
    }

    process = () => {
        // 旧版本的Typora的export函数不是AsyncFunction，尽最大努力兼容旧版本
        const until = () => File && File.editor && File.editor.export && File.editor.export.exportToHTML
        const callback = () => {
            this.isAsync = this.utils.isAsyncFunction(File.editor.export.exportToHTML);
            const after = this.isAsync ? this.afterExport : this.afterExportSync
            this.utils.decorate(() => File && File.editor && File.editor.export, "exportToHTML", this.beforeExport, after, true)
        }
        this.utils.loopDetector(until, callback);
    }
}

module.exports = {
    exportHelper
}