class ExportHelper {
  htmlHelpers = new Map()
  nativeHelpers = new Map()
  isAsync = undefined

  constructor(utils) {
    this.utils = utils
  }

  /**
   * @param name {string}: Give it a name.
   * @param beforeExportToHTML {function(exportOptions): string | null}: If returns a string, it will be added to extraCSS.
   * @param afterExportToHTML {function(html, exportOptions): html | null}: If returns a string, it will replace the HTML.
   */
  register = (name, beforeExportToHTML, afterExportToHTML) => this.htmlHelpers.set(name, { beforeExportToHTML, afterExportToHTML })
  unregister = name => this.htmlHelpers.delete(name)

  /** Export using Pandoc. */
  registerNative = (name, beforeExportToNative, afterExportToNative) => this.nativeHelpers.set(name, { beforeExportToNative, afterExportToNative })
  unregisterNative = name => this.nativeHelpers.delete(name)

  check = args => ["html", "html-plain", "pdf", "image"].includes(args?.[0]?.type)

  processExportHTML = () => {
    const before = (...args) => {
      if (args[0] == null || typeof args[0] !== "object") return

      for (const helper of this.htmlHelpers.values()) {
        if (!helper.beforeExportToHTML) continue
        try {
          const css = helper.beforeExportToHTML(...args)
          if (css && typeof css === "string") {
            args[0].extraCss = (args[0].extraCss || "") + css
          }
        } catch (e) {
          console.error("beforeExportToHTML Error:", e)
        }
      }
    }
    const afterAsync = async (exportResult, ...args) => {
      if (!this.check(args)) return exportResult

      let html = await exportResult
      for (const helper of this.htmlHelpers.values()) {
        if (!helper.afterExportToHTML) continue
        try {
          const newHtml = await helper.afterExportToHTML(html, ...args)
          if (newHtml && typeof newHtml === "string") {
            html = newHtml
          }
        } catch (e) {
          console.error("afterExportToHTML Error:", e)
        }
      }
      return html
    }
    const afterSync = (exportResult, ...args) => {
      if (!this.check(args)) return exportResult

      let html = exportResult
      for (const helper of this.htmlHelpers.values()) {
        if (!helper.afterExportToHTML) continue
        try {
          const newHtml = helper.afterExportToHTML(html, ...args)
          if (newHtml && typeof newHtml.then !== "function") {
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
    this.utils.waitUntil(() => File?.editor?.export?.exportToHTML).then(fn => {
      this.isAsync = fn.constructor.name === "AsyncFunction"
      const after = this.isAsync ? afterAsync : afterSync
      this.utils.decorator.decorate(() => File.editor.export, "exportToHTML", { before, after, modifyResult: true })
    })
  }

  processExportToNative = () => {
    const hook = fnName => (...args) => {
      for (const helper of this.nativeHelpers.values()) {
        const fn = helper[fnName]
        if (!fn) continue
        try {
          fn(...args)
        } catch (e) {
          console.error(`${fnName} Error:`, e)
        }
      }
    }
    const before = hook("beforeExportToNative")
    const after = hook("afterExportToNative")
    this.utils.decorator.decorate(() => File?.editor?.export, "exportToNative", { before, after })
  }

  process = () => {
    this.processExportHTML()
    this.processExportToNative()
  }
}

module.exports = ExportHelper
