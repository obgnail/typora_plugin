// Generate the public, argument-free symbol portion of the completion catalog.
// MathJax's character maps are parser data, so keep the source helper's
// hand-written templates in commands.original.json and render-check additions.
const fs = require("node:fs")
const path = require("node:path")
const { mathjax } = require("mathjax-full/js/mathjax.js")
const { TeX } = require("mathjax-full/js/input/tex.js")
const { SVG } = require("mathjax-full/js/output/svg.js")
const { liteAdaptor } = require("mathjax-full/js/adaptors/liteAdaptor.js")
const { RegisterHTMLHandler } = require("mathjax-full/js/handlers/html.js")
const { MapHandler } = require("mathjax-full/js/input/tex/MapHandler.js")
require("mathjax-full/js/input/tex/AllPackages.js")
require("mathjax-full/js/input/tex/base/BaseMappings.js")
require("mathjax-full/js/input/tex/ams/AmsMappings.js")

const root = path.resolve(__dirname, "../..")
const file = path.join(root, "plugin/latex_completion/commands.json")
const existing = JSON.parse(fs.readFileSync(path.join(root, "plugin/latex_completion/commands.original.json"), "utf8"))
const seen = new Set(existing.map(item => item.key))
const adaptor = liteAdaptor()
RegisterHTMLHandler(adaptor)
const document = mathjax.document("", { InputJax: new TeX({ packages: ["base", "ams"] }), OutputJax: new SVG({ fontCache: "none" }) })
const sources = [
  ["mathchar0mi", "base", "symbol"],
  ["mathchar0mo", "base", "symbol"],
  ["mathchar7", "base", "symbol"],
  ["AMSmath-mathchar0mo", "ams", "symbol"],
  ["AMSsymbols-mathchar0mi", "ams", "symbol"],
  ["AMSsymbols-mathchar0mo", "ams", "symbol"],
]
const excluded = []
const added = []
const standalone = ["arg", "cosh", "coth", "deg", "dim", "gcd", "hom", "inf", "ker", "liminf", "limsup", "max", "min", "Pr", "sinh", "tanh", "bmod", "iff", "TeX", "LaTeX", "injlim", "projlim", "varliminf", "varlimsup", "varinjlim", "varprojlim", "implies", "impliedby"]
for (const name of standalone) {
  const key = `\\${name}`
  if (seen.has(key)) continue
  const markup = adaptor.outerHTML(document.convert(key))
  if (markup.includes("data-mjx-error")) throw new Error(`Invalid standalone command: ${key}`)
  const dependency = MapHandler.getMap("macros").contains(name) ? "base" : "ams"
  added.push({ key, snippet: `${key} `, cursorOffset: 0, category: "symbol", kind: "operator", package: dependency })
  seen.add(key)
}
const templates = [
  ["dfrac", "\\dfrac{}{}", -3, "ams"],
  ["tfrac", "\\tfrac{}{}", -3, "ams"],
  ["binom", "\\binom{}{}", -3, "ams"],
  ["widehat", "\\widehat{}", -1, "base"],
  ["widetilde", "\\widetilde{}", -1, "base"],
  ["overbrace", "\\overbrace{}", -1, "base"],
  ["underbrace", "\\underbrace{}", -1, "base"],
  ["overset", "\\overset{}{}", -3, "ams"],
  ["underset", "\\underset{}{}", -3, "ams"],
  ["operatorname", "\\operatorname{}", -1, "ams"],
  ["bra", "\\bra{}", -1, "braket"],
  ["ket", "\\ket{}", -1, "braket"],
  ["braket", "\\braket{}{}", -3, "braket"],
  ["cancel", "\\cancel{}", -1, "cancel"],
  ["textrm", "\\textrm{}", -1, "base"],
  ["textbf", "\\textbf{}", -1, "base"],
  ["textit", "\\textit{}", -1, "base"],
  ["overrightarrow", "\\overrightarrow{}", -1, "base"],
  ["overleftarrow", "\\overleftarrow{}", -1, "base"],
  ["overleftrightarrow", "\\overleftrightarrow{}", -1, "base"],
  ["xrightarrow", "\\xrightarrow{}", -1, "ams"],
  ["xleftarrow", "\\xleftarrow{}", -1, "ams"],
  ["phantom", "\\phantom{}", -1, "base"],
  ["hphantom", "\\hphantom{}", -1, "base"],
  ["vphantom", "\\vphantom{}", -1, "base"],
  ["acute", "\\acute{}", -1, "base"],
  ["grave", "\\grave{}", -1, "base"],
  ["breve", "\\breve{}", -1, "base"],
  ["check", "\\check{}", -1, "base"],
  ["mathring", "\\mathring{}", -1, "base"],
  ["tbinom", "\\tbinom{}{}", -3, "ams"],
  ["dbinom", "\\dbinom{}{}", -3, "ams"],
]
for (const [name, snippet, cursorOffset, dependency] of templates) {
  const key = `\\${name}`
  if (!seen.has(key)) {
    const validation = mathjax.document("", { InputJax: new TeX({ packages: ["base", "ams", dependency] }), OutputJax: new SVG({ fontCache: "none" }) })
    const markup = adaptor.outerHTML(validation.convert(snippet.replace(/\{\}/g, "{x}")))
    if (markup.includes("data-mjx-error")) throw new Error(`Invalid template: ${key}`)
    added.push({ key, snippet, cursorOffset, category: "original", kind: "template", package: dependency })
    seen.add(key)
  }
}
for (const [mapName, dependency, category] of sources) {
  const map = MapHandler.getMap(mapName)
  for (const [name, symbol] of map.map) {
    const key = `\\${name}`
    if (!/^\\[A-Za-z]+$/.test(key) || seen.has(key)) continue
    try {
      const node = document.convert(key)
      const markup = adaptor.outerHTML(node)
      if (markup.includes("data-mjx-error")) throw new Error("render error")
      const glyph = symbol.char || ""
      added.push({ key, snippet: `${key} `, cursorOffset: 0, category, kind: "symbol", package: dependency, glyph })
      seen.add(key)
    } catch (error) {
      excluded.push({ key, reason: `MathJax render failed: ${error.message}` })
    }
  }
}
for (const item of existing) {
  item.category ||= "original"
  item.kind ||= item.snippet.includes("{") ? "template" : "symbol"
  item.package ||= "base"
}
const begin = existing.find(item => item.key === "\\begin")
begin.snippet = "\\begin{}\n\n\\end{}"
begin.cursorOffset = -9
const beg = existing.find(item => item.key === "\\beg")
beg.snippet = "\\begin{}\n\n\\end{}"
beg.cursorOffset = -9
for (const mapName of ["macros", "AMSmath-macros", "AMSsymbols-macros"]) {
  const map = MapHandler.getMap(mapName)
  for (const name of map.map.keys()) {
    const key = `\\${name}`
    if (/^\\[A-Za-z]+$/.test(key) && !seen.has(key)) excluded.push({ key, reason: "Requires arguments or parsing context; no validated insertion template" })
  }
}
fs.writeFileSync(file, JSON.stringify([...existing, ...added], null, 2) + "\n")
fs.writeFileSync(path.join(root, "plugin/latex_completion/catalog-exclusions.json"), JSON.stringify(excluded, null, 2) + "\n")
console.log(`Preserved ${existing.length}, added ${added.length}, excluded ${excluded.length}`)
