"use strict"

const test = require("node:test")
const assert = require("node:assert/strict")
const { buildPlist, xml } = require("../../plugin/macos/bin/write_launch_agent")

test("LaunchAgent generator escapes paths and grants write access only to configuration", () => {
  const plist = buildPlist({
    node: "/opt/Node & Tools/node",
    bridge: "/private/tmp/App <Beta>/bridge.js",
    token: "/Users/test/Library/Application Support/token",
    pluginRoot: "/private/tmp/App <Beta>/plugin",
    configRoot: "/Users/test/.config/typora_plugin",
    log: "/Users/test/Library/Application Support/bridge.log",
  })

  assert.match(plist, /Node &amp; Tools/)
  assert.match(plist, /App &lt;Beta&gt;/)
  assert.equal((plist.match(/<string>--write-root<\/string>/g) || []).length, 1)
  assert.equal((plist.match(/<string>--read-root<\/string>/g) || []).length, 2)
  assert.match(plist, /<key>Umask<\/key><integer>63<\/integer>/)
  assert.doesNotMatch(plist, /<string>--root<\/string>/)
})

test("XML escaping covers every plist metacharacter", () => {
  assert.equal(xml(`<>&'"`), "&lt;&gt;&amp;&apos;&quot;")
})
