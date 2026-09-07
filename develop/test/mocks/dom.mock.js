const { JSDOM } = require("jsdom")

const root = `
<!DOCTYPE html>
<html>
<body>
  <div id="test-container"></div>
  <div id="typora-quick-open"></div>
  <content>
    <div id="write"></div>
  </content>
</body>
</html>
`

const dom = new JSDOM(root, { url: "http://localhost/", runScripts: "dangerously" })

// setupGlobalVars
global.window = dom.window
global.document = dom.window.document
global.navigator = { userAgent: "node.js" }
global.requestAnimationFrame = async (fn) => Promise.resolve(fn)

Object.defineProperty(dom.window.Element.prototype, "scrollIntoView", {
  value: () => undefined,
  configurable: true,
  enumerable: false,
  writable: true,
})

const globalsToForceOverwrite = ["Event", "CustomEvent", "HTMLElement", "customElements", "Node"]
globalsToForceOverwrite.forEach(key => {
  global[key] = dom.window[key]
})
Object.getOwnPropertyNames(dom.window).forEach(key => {
  if (typeof global[key] === "undefined") {
    global[key] = dom.window[key]
  }
})

module.exports = dom
