"use strict"

const START = "<!-- typora-plugin-macos:start -->"
const END = "<!-- typora-plugin-macos:end -->"
const BLOCK = `${START}\n<script src="./plugin/macos/loader.js" defer></script>\n${END}`

function inject(html) {
  if (typeof html !== "string") throw new TypeError("html must be a string")
  const starts = html.split(START).length - 1
  const ends = html.split(END).length - 1
  if (starts || ends) {
    if (starts === 1 && ends === 1 && html.indexOf(START) < html.indexOf(END)) return html
    throw new Error("malformed or duplicate macOS loader markers")
  }
  const body = html.lastIndexOf("</body>")
  if (body < 0) throw new Error("index.html does not contain </body>")
  return `${html.slice(0, body)}${BLOCK}\n${html.slice(body)}`
}

function remove(html) {
  if (typeof html !== "string") throw new TypeError("html must be a string")
  const start = html.indexOf(START)
  const end = html.indexOf(END)
  if (start < 0 && end < 0) return html
  if (start < 0 || end < start) throw new Error("malformed macOS loader markers")
  const after = end + END.length
  return html.slice(0, start) + html.slice(after).replace(/^\r?\n/, "")
}

module.exports = { START, END, BLOCK, inject, remove }
