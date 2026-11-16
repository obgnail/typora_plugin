"use strict"

const assert = require("node:assert/strict")
const fs = require("node:fs")
const http = require("node:http")
const os = require("node:os")
const path = require("node:path")
const test = require("node:test")
const { MAX_RUNTIME_REPORTS, createBridge, createPolicy, parseArgs, safeEqual } = require("../../plugin/macos/bridge")

function request(port, options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port, ...options }, res => {
      let data = ""
      res.on("data", chunk => { data += chunk })
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: data && JSON.parse(data) }))
    })
    req.on("error", reject)
    if (body) req.end(JSON.stringify(body)); else req.end()
  })
}

test("bridge authenticates requests and restricts origins and paths", async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "typora-bridge-root-"))
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "typora-bridge-outside-"))
  fs.writeFileSync(path.join(root, "ok.txt"), "safe")
  fs.symlinkSync(outside, path.join(root, "escape"))
  const token = "a".repeat(64)
  const server = createBridge({ token, roots: [root] })
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve))
  t.after(() => server.close())
  const port = server.address().port

  const health = await request(port, { method: "GET", path: "/health" })
  assert.deepEqual(health.body, { ok: true })
  assert.equal(JSON.stringify(health.body).includes(token), false)

  const detailedHealth = await request(port, { method: "GET", path: "/health", headers: { "X-Typora-Plugin-Token": token } })
  assert.equal(detailedHealth.body.rpcRequests, 0)
  assert.equal(detailedHealth.body.probeReceived, false)

  const unauthorized = await request(port, { method: "POST", path: "/v1/rpc", headers: { Origin: "null", "Content-Type": "application/json" } }, { method: "fs.readFile", params: [path.join(root, "ok.txt")] })
  assert.equal(unauthorized.status, 401)

  const rejected = await request(port, { method: "POST", path: "/v1/rpc", headers: { Origin: "https://evil.invalid", "X-Typora-Plugin-Token": token } }, {})
  assert.equal(rejected.status, 403)

  const missingOrigin = await request(port, { method: "POST", path: "/v1/rpc", headers: { "Content-Type": "application/json", "X-Typora-Plugin-Token": token } }, { method: "fs.readFile", params: [path.join(root, "ok.txt")] })
  assert.equal(missingOrigin.status, 403)

  const badType = await request(port, { method: "POST", path: "/v1/rpc", headers: { Origin: "file://", "Content-Type": "text/plain", "X-Typora-Plugin-Token": token } }, { method: "fs.readFile", params: [path.join(root, "ok.txt")] })
  assert.equal(badType.status, 415)

  const allowed = await request(port, { method: "POST", path: "/v1/rpc", headers: { Origin: "null", "Content-Type": "application/json", "X-Typora-Plugin-Token": token } }, { method: "fs.readFile", params: [path.join(root, "ok.txt"), "utf-8"] })
  assert.equal(allowed.status, 200)
  assert.equal(allowed.body.result, "safe")
  assert.equal(allowed.headers["access-control-allow-origin"], "null")

  const escaped = await request(port, { method: "POST", path: "/v1/rpc", headers: { Origin: "null", "Content-Type": "application/json", "X-Typora-Plugin-Token": token } }, { method: "fs.writeFile", params: [path.join(root, "escape", "bad.txt"), "bad"] })
  assert.equal(escaped.status, 400)
  assert.match(escaped.body.error, /symlink|outside/)
  assert.equal(fs.existsSync(path.join(outside, "bad.txt")), false)
})

test("bridge helpers enforce stable configuration", () => {
  assert.equal(safeEqual("same", "same"), true)
  assert.equal(safeEqual("same", "other"), false)
  const args = parseArgs(["--token-file", "/tmp/token", "--read-root", "/tmp/read", "--write-root", "/tmp/write"])
  assert.equal(args.tokenFile, "/tmp/token")
  assert.deepEqual(args.readRoots, ["/tmp/read"])
  assert.deepEqual(args.writeRoots, ["/tmp/write"])
  assert.equal(parseArgs(["--home", "/tmp/home", "--root", "/tmp/root"]).home, "/tmp/home")
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "typora-policy-"))
  const authorize = createPolicy([root])
  assert.equal(authorize(path.join(root, "new.txt")), path.join(fs.realpathSync(root), "new.txt"))
  assert.throws(() => authorize("/etc/passwd"), /outside/)
})

test("bridge enforces read-only plugin roots and rejects every symlink component", async t => {
  const pluginRoot = fs.mkdtempSync(path.join(os.tmpdir(), "typora-bridge-plugin-"))
  const configRoot = fs.mkdtempSync(path.join(os.tmpdir(), "typora-bridge-config-"))
  fs.writeFileSync(path.join(pluginRoot, "plugin.js"), "safe")
  fs.writeFileSync(path.join(configRoot, "settings.toml"), "safe")
  fs.symlinkSync(path.join(configRoot, "settings.toml"), path.join(configRoot, "alias.toml"))
  const token = "c".repeat(64)
  const server = createBridge({ token, readRoots: [pluginRoot, configRoot], writeRoots: [configRoot] })
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve))
  t.after(() => server.close())
  const port = server.address().port
  const headers = { Origin: "file://", "Content-Type": "application/json", "X-Typora-Plugin-Token": token }

  const pluginWrite = await request(port, { method: "POST", path: "/v1/rpc", headers }, { method: "fs.writeFile", params: [path.join(pluginRoot, "plugin.js"), "bad"] })
  assert.equal(pluginWrite.status, 400)
  assert.equal(fs.readFileSync(path.join(pluginRoot, "plugin.js"), "utf8"), "safe")

  const symlinkWrite = await request(port, { method: "POST", path: "/v1/rpc", headers }, { method: "fs.writeFile", params: [path.join(configRoot, "alias.toml"), "bad"] })
  assert.equal(symlinkWrite.status, 400)
  assert.match(symlinkWrite.body.error, /symlink/)
  assert.equal(fs.readFileSync(path.join(configRoot, "settings.toml"), "utf8"), "safe")

  const configWrite = await request(port, { method: "POST", path: "/v1/rpc", headers }, { method: "fs.writeFile", params: [path.join(configRoot, "settings.toml"), "updated"] })
  assert.equal(configWrite.status, 200)
  assert.equal(fs.readFileSync(path.join(configRoot, "settings.toml"), "utf8"), "updated")
  assert.equal(fs.statSync(path.join(configRoot, "settings.toml")).mode & 0o077, 0)
})

test("bridge keeps authenticated, bounded runtime diagnostics", async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "typora-bridge-reports-"))
  const token = "b".repeat(64)
  const server = createBridge({ token, roots: [root] })
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve))
  t.after(() => server.close())
  const port = server.address().port
  const headers = { Origin: "file://", "Content-Type": "application/json", "X-Typora-Plugin-Token": token }

  for (let i = 0; i <= MAX_RUNTIME_REPORTS; i++) {
    const response = await request(port, { method: "POST", path: "/v1/rpc", headers }, { method: "runtime.report", params: [{ sequence: i }] })
    assert.equal(response.status, 200)
  }
  const reports = await request(port, { method: "POST", path: "/v1/rpc", headers }, { method: "runtime.getReports", params: [] })
  assert.equal(reports.body.result.length, MAX_RUNTIME_REPORTS)
  assert.equal(reports.body.result[0].sequence, 1)
  assert.equal(JSON.stringify(reports.body).includes(token), false)
})
