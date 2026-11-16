/* WKWebView capability probe. No filesystem or network access. */
(function () {
  "use strict"

  function type(name) {
    return typeof window[name]
  }

  var file = window.File
  var report = {
    capturedAt: new Date().toISOString(),
    documentReadyState: document.readyState,
    userAgent: navigator.userAgent,
    locationProtocol: location.protocol,
    typoraVersion: window._options && window._options.appVersion || null,
    objects: {
      File: type("File"),
      JSBridge: type("JSBridge"),
      SystemJS: type("SystemJS"),
      require: type("require"),
      global: type("global"),
      process: type("process"),
    },
    capabilities: {
      fileEditor: !!(file && file.editor),
      fileMountFolder: !!(file && typeof file.getMountFolder === "function"),
      jsBridgeInvoke: !!(window.JSBridge && typeof window.JSBridge.invoke === "function"),
      systemJSImport: !!(window.SystemJS && typeof window.SystemJS.import === "function"),
      reqnode: !!(window.global && typeof window.global.reqnode === "function"),
      nodeVersions: !!(window.process && window.process.versions),
    },
  }

  window.__typoraMacProbe = report
  document.documentElement.setAttribute("data-typora-macos-probe", "loaded")
  console.info("[typora-macos-probe]", report)
  if (typeof window.__typoraMacReportProbe === "function") {
    try { window.__typoraMacReportProbe(report) } catch (error) { console.error("[typora-macos-probe] report failed", error) }
  }
}())
