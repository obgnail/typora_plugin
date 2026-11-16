#!/usr/bin/env node
"use strict"

const fs = require("fs")

const xml = value => String(value).replace(/[<>&'\"]/g, char => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '\"': "&quot;" })[char])
const buildPlist = ({ node, bridge, token, pluginRoot, configRoot, log }) => {
  const args = [node, bridge, "--token-file", token, "--read-root", pluginRoot, "--read-root", configRoot, "--write-root", configRoot]
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>io.typora.plugin.macos-bridge</string>
<key>ProgramArguments</key><array>${args.map(value => `<string>${xml(value)}</string>`).join("")}</array>
<key>RunAtLoad</key><true/><key>KeepAlive</key><false/>
<key>ProcessType</key><string>Background</string><key>Umask</key><integer>63</integer>
<key>StandardOutPath</key><string>${xml(log)}</string><key>StandardErrorPath</key><string>${xml(log)}</string>
</dict></plist>
`
}

if (require.main === module) {
  const [output, node, bridge, token, pluginRoot, configRoot, log] = process.argv.slice(2)
  if (![output, node, bridge, token, pluginRoot, configRoot, log].every(Boolean)) {
    console.error("usage: write_launch_agent.js <output> <node> <bridge> <token> <plugin-root> <config-root> <log>")
    process.exit(64)
  }
  fs.writeFileSync(output, buildPlist({ node, bridge, token, pluginRoot, configRoot, log }), { mode: 0o600 })
}

module.exports = { buildPlist, xml }
