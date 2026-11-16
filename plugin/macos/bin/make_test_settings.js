#!/usr/bin/env node
"use strict"

const fs = require("fs")

const [sourceFile, pluginName, settingsFile, planFile, documentFile] = process.argv.slice(2)
if (!sourceFile || !pluginName || !settingsFile || !planFile) {
  console.error("usage: make_test_settings.js <settings.default.toml> <plugin> <settings.user.toml> <macos-runtime-test.json>")
  process.exit(64)
}

const source = fs.readFileSync(sourceFile, "utf8")
const sections = []
let section = null
for (const line of source.split(/\r?\n/)) {
  const heading = line.match(/^\[([^.[\]]+)]$/)
  if (heading) section = heading[1]
  if (section && /^ENABLE\s*=/.test(line) && !sections.includes(section)) sections.push(section)
}
if (!sections.includes(pluginName)) throw new Error(`unknown plugin: ${pluginName}`)

const content = sections.map(name => `[${name}]\nENABLE = ${name === "global" || name === pluginName}`).join("\n\n") + "\n"
fs.writeFileSync(settingsFile, content)
fs.writeFileSync(planFile, JSON.stringify({ plugin: pluginName, document: documentFile || undefined }, null, 2) + "\n")
