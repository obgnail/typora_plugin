"use strict"

const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const test = require("node:test")
const vm = require("node:vm")

test("probe records WKWebView capabilities without privileged access", () => {
  const source = fs.readFileSync(path.join(__dirname, "../../plugin/macos/probe.js"), "utf8")
  const attributes = {}
  const window = {
    File: { editor: {}, getMountFolder() {} },
    JSBridge: { invoke() {} },
    SystemJS: { import() {} },
    _options: { appVersion: "1.14.15" },
  }
  const context = {
    window,
    document: { readyState: "interactive", documentElement: { setAttribute(name, value) { attributes[name] = value } } },
    navigator: { userAgent: "WKWebView test" },
    location: { protocol: "file:" },
    console: { info() {} },
    Date,
  }
  vm.runInNewContext(source, context)
  assert.equal(window.__typoraMacProbe.typoraVersion, "1.14.15")
  assert.equal(window.__typoraMacProbe.capabilities.jsBridgeInvoke, true)
  assert.equal(window.__typoraMacProbe.capabilities.reqnode, false)
  assert.equal(attributes["data-typora-macos-probe"], "loaded")
})

test("runtime and bridge do not expose shell execution or wildcard CORS", () => {
  const bridge = fs.readFileSync(path.join(__dirname, "../../plugin/macos/bridge.js"), "utf8")
  const loader = fs.readFileSync(path.join(__dirname, "../../plugin/macos/loader.js"), "utf8")
  assert.doesNotMatch(bridge, /child_process|execSync|spawnSync|Access-Control-Allow-Origin["']\s*[:,]\s*["']\*/)
  assert.doesNotMatch(loader, /reqnode\(["']child_process/)
  assert.match(loader, /%%TYPORA_MACOS_BRIDGE_TOKEN%%/)
  assert.doesNotThrow(() => new vm.Script(loader))
  assert.doesNotMatch(loader, /window\.require\s*=/)
})

test("WKWebView adapter supplies safe process and buffer compatibility shims", () => {
  const loader = fs.readFileSync(path.join(__dirname, "../../plugin/macos/loader.js"), "utf8")
  assert.match(loader, /request === "buffer"/)
  assert.match(loader, /request === "process"/)
  assert.match(loader, /id === "buffer"\) return \{ Buffer: window\.Buffer \}/)
  assert.match(loader, /id === "process"\) return window\.process/)
  assert.match(loader, /readdir: fs\.promises\.readdir/)
  assert.doesNotMatch(loader, /require\(["']buffer["']\)/)
})

test("WKWebView module directory fallback does not throw an expected load error", () => {
  const loader = fs.readFileSync(path.join(__dirname, "../../plugin/macos/loader.js"), "utf8")
  assert.match(loader, /readBundle\(id, true\)/)
  assert.match(loader, /if \(allowMissing\) return null/)
  assert.doesNotMatch(loader, /catch \(firstError\)/)
})

test("macOS scripts detect platform and protect the production app", () => {
  const installer = fs.readFileSync(path.join(__dirname, "../../plugin/bin/install_macos.sh"), "utf8")
  assert.match(installer, /uname -s/)
  assert.match(installer, /--allow-production/)
  assert.match(installer, /fileprovider/)
  assert.match(installer, /CONFIG_ROOT="\$HOME\/\.config\/typora_plugin"/)
  assert.match(installer, /SUPPORTED_VERSION="1\.14\.15"/)
  assert.match(installer, /\/private\/tmp\/Typora-Plugin-Beta\.app/)
})
