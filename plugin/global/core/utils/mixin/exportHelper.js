/**
 * Dynamically register additional actions on export.
 */
class exportHelper {
    constructor(utils) {
        this.utils = utils
        this.htmlHelpers = new Map()
        this.nativeHelpers = new Map()
        this.isAsync = undefined
    }

    /**
     * @param {string} name: Give it a name.
     * @param {function(exportOptions): string | null} beforeExportToHTML: If returns a string, it will be added to extraCSS.
     * @param {function(html, exportOptions): html | null} afterExportToHTML: If returns a string, it will replace the HTML.
     */
    register = (name, beforeExportToHTML, afterExportToHTML) => this.htmlHelpers.set(name, { beforeExportToHTML, afterExportToHTML })
    unregister = name => this.htmlHelpers.delete(name)

    /** Export using Pandoc. */
    registerNative = (name, beforeExportToNative, afterExportToNative) => this.nativeHelpers.set(name, { beforeExportToNative, afterExportToNative })
    unregisterNative = name => this.nativeHelpers.delete(name)

    check = args => {
        const { type } = args[0] || {}
        return type === "html" || type === "html-plain" || type === "pdf" || type === "image"
    }

    processExportHTML = () => {
        const beforeFn = (...args) => {
            if (!this.utils.isObject(args[0])) return

            for (const h of this.htmlHelpers.values()) {
                if (!h.beforeExportToHTML) continue
                try {
                    const css = h.beforeExportToHTML(...args)
                    if (css && typeof css === "string") {
                        args[0].extraCss = (args[0].extraCss || "") + css
                    }
                } catch (e) {
                    console.error("beforeExportToHTML Error:", e)
                }
            }
        }
        const afterFn = async (exportResult, ...args) => {
            if (!this.check(args)) return exportResult

            let html = await exportResult
            for (const h of this.htmlHelpers.values()) {
                if (!h.afterExportToHTML) continue
                try {
                    const newHtml = await h.afterExportToHTML(html, ...args)
                    if (newHtml && typeof newHtml === "string") {
                        html = newHtml
                    }
                } catch (e) {
                    console.error("afterExportToHTML Error:", e)
                }
            }
            return html
        }
        const afterFnSync = (exportResult, ...args) => {
            if (!this.check(args)) return exportResult

            let html = exportResult
            for (const h of this.htmlHelpers.values()) {
                if (!h.afterExportToHTML) continue
                try {
                    const newHtml = h.afterExportToHTML(html, ...args)
                    if (newHtml && !this.utils.isPromise(newHtml)) {
                        html = newHtml
                    }
                } catch (e) {
                    console.error("afterExportToHTMLSync Error:", e)
                }
            }
            return html
        }

        // The exportToHTML function in older versions of Typora is not an AsyncFunction.
        // Make every effort to be compatible with older versions.
        const callback = () => {
            this.isAsync = this.utils.isAsyncFunction(File.editor.export.exportToHTML)
            const after = this.isAsync ? afterFn : afterFnSync
            this.utils.decorate(() => File.editor.export, "exportToHTML", beforeFn, after, true)
        }
        this.utils.loopDetector(() => File && File.editor && File.editor.export && File.editor.export.exportToHTML, callback)
    }

    processExportToNative = () => {
        const getLifeCycleFn = fnName => (...args) => {
            for (const h of this.nativeHelpers.values()) {
                const fn = h[fnName]
                if (!fn) continue
                try {
                    fn(...args)
                } catch (e) {
                    console.error(`${fnName} Error:`, e)
                }
            }
        }
        const beforeFn = getLifeCycleFn("beforeExportToNative")
        const afterFn = getLifeCycleFn("afterExportToNative")
        const callback = () => this.utils.decorate(() => File.editor.export, "exportToNative", beforeFn, afterFn)
        this.utils.loopDetector(() => File && File.editor && File.editor.export && File.editor.export.exportToNative, callback)
    }

    process = () => {
        this.processExportHTML()
        this.processExportToNative()
    }
}

module.exports = {
    exportHelper
}
