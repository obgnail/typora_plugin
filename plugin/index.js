const start = () => {
  global.__typoraMacReportRuntime?.({ kind: "framework-stage", stage: "entrypoint-start" })
  const { dirname, __dirname, reqnode } = global
  const dir = dirname || __dirname
  const core = reqnode("path").join(dir, "./plugin/global/core")
  const entry = reqnode(core)
  Promise.resolve(entry()).catch(error => {
    console.error("[Typora Plugin] framework bootstrap failed", error)
  })
}

// A deferred script normally runs while readyState is "interactive", before
// the later load event. WKWebView may also evaluate an injected script after
// that event. The editor globals are already created by the preceding Typora
// script, so only the still-parsing state needs to wait.
if (document.readyState === "loading") window.addEventListener("DOMContentLoaded", start, { once: true })
else start()

module.exports = { start }

console.debug(`
  ______                        ___  __          _
 /_  __/_ _____  ___  _______ _/ _ \\/ /_ _____ _(_)__
  / / / // / _ \\/ _ \\/ __/ _ \`/ ___/ / // / _ \`/ / _ \\
 /_/  \\_, / .__/\\___/_/  \\_,_/_/  /_/\\_,_/\\_, /_/_//_/
     /___/_/                             /___/

       https://github.com/obgnail/typora_plugin
`)
