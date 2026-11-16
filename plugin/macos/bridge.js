#!/usr/bin/env node
"use strict"

const crypto = require("crypto")
const fs = require("fs")
const http = require("http")
const os = require("os")
const path = require("path")

const MAX_BODY = 1024 * 1024
const METHODS = new Set(["fs.readFile", "fs.writeFile", "fs.exists", "fs.stat", "fs.readdir", "fs.mkdir", "os.homedir", "probe.report", "runtime.report", "runtime.getReports", "runtime.clearReports"])
const MAX_RUNTIME_REPORTS = 200

function safeEqual(actual, expected) {
  const left = Buffer.from(String(actual || ""))
  const right = Buffer.from(String(expected || ""))
  return left.length === right.length && crypto.timingSafeEqual(left, right)
}

function createPolicy(roots) {
  const allowed = roots.map(root => {
    const logical = path.resolve(root)
    return { logical: logical, real: fs.realpathSync(logical) }
  })
  return function authorize(input) {
    if (typeof input !== "string" || input.indexOf("\0") >= 0) throw new Error("invalid path")
    const target = path.resolve(input)
    const ok = allowed.some(root => target === root.logical || target.indexOf(root.logical + path.sep) === 0)
    if (!ok) throw new Error("path is outside allowed roots")
    let existing = target
    while (!fs.existsSync(existing)) {
      const parent = path.dirname(existing)
      if (parent === existing) break
      existing = parent
    }
    const real = fs.realpathSync(existing)
    const realOk = allowed.some(root => real === root.real || real.indexOf(root.real + path.sep) === 0)
    if (!realOk) throw new Error("path escapes allowed roots through a symlink")
    return target
  }
}

function createBridge(options) {
  const token = options.token
  const authorize = createPolicy(options.roots)
  const home = path.resolve(options.home || os.homedir())
  let rpcRequests = 0
  let probeReceived = false
  let probeSummary = null
  let nonHealthRequests = 0
  let preflightRequests = 0
  let lastRequest = null
  const runtimeReports = []

  function normalizeReport(value) {
    if (!value || Object.prototype.toString.call(value) !== "[object Object]") throw new Error("invalid runtime report")
    const json = JSON.stringify(value)
    if (Buffer.byteLength(json, "utf8") > 16 * 1024) throw new Error("runtime report is too large")
    return JSON.parse(json)
  }

  async function invoke(method, params) {
    if (!METHODS.has(method) || !Array.isArray(params)) throw new Error("unsupported request")
    if (method === "probe.report") {
      if (!params[0] || Object.prototype.toString.call(params[0]) !== "[object Object]") throw new Error("invalid probe report")
      probeReceived = true
      if (params[0].objects && params[0].capabilities) {
        probeSummary = {
          documentReadyState: String(params[0].documentReadyState || ""),
          typoraVersion: params[0].typoraVersion == null ? null : String(params[0].typoraVersion),
          objects: params[0].objects,
          capabilities: params[0].capabilities,
        }
      }
      return true
    }
    if (method === "runtime.report") {
      runtimeReports.push({ timestamp: new Date().toISOString(), ...normalizeReport(params[0]) })
      if (runtimeReports.length > MAX_RUNTIME_REPORTS) runtimeReports.shift()
      return true
    }
    if (method === "runtime.getReports") return runtimeReports.slice()
    if (method === "runtime.clearReports") { runtimeReports.length = 0; return true }
    if (method === "os.homedir") return home
    const target = authorize(params[0])
    if (method === "fs.readFile") return fs.promises.readFile(target, params[1] || "utf8")
    if (method === "fs.writeFile") { await fs.promises.writeFile(target, params[1], params[2] || "utf8"); return true }
    if (method === "fs.exists") return fs.existsSync(target)
    if (method === "fs.readdir") return fs.promises.readdir(target)
    if (method === "fs.mkdir") { await fs.promises.mkdir(target, { recursive: params[1] === true }); return true }
    const stat = await fs.promises.stat(target)
    return { type: stat.isFile() ? "file" : stat.isDirectory() ? "directory" : "other", size: stat.size, mtimeMs: stat.mtimeMs }
  }

  return http.createServer(function (req, res) {
    if (req.url !== "/health") lastRequest = { method: req.method, url: req.url, origin: req.headers.origin || null }
    if (req.url !== "/health") nonHealthRequests++
    if (req.method === "OPTIONS") preflightRequests++
    res.setHeader("Content-Type", "application/json; charset=utf-8")
    res.setHeader("Cache-Control", "no-store")
    const origin = req.headers.origin
    if (origin === "null" || origin === "file://") {
      res.setHeader("Access-Control-Allow-Origin", origin)
      res.setHeader("Vary", "Origin")
    } else if (origin) {
      res.writeHead(403); return res.end(JSON.stringify({ ok: false, error: "origin rejected" }))
    }
    if (req.method === "OPTIONS") {
      res.setHeader("Access-Control-Allow-Methods", "POST")
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Typora-Plugin-Token")
      res.writeHead(204); return res.end()
    }
    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200); return res.end(JSON.stringify({ ok: true, rpcRequests: rpcRequests, probeReceived: probeReceived, probeSummary: probeSummary, nonHealthRequests: nonHealthRequests, preflightRequests: preflightRequests, lastRequest: lastRequest }))
    }
    if (req.method !== "POST" || req.url !== "/v1/rpc") {
      res.writeHead(404); return res.end(JSON.stringify({ ok: false, error: "not found" }))
    }
    if (!safeEqual(req.headers["x-typora-plugin-token"], token)) {
      res.writeHead(401); return res.end(JSON.stringify({ ok: false, error: "unauthorized" }))
    }
    rpcRequests++
    let size = 0
    let tooLarge = false
    const chunks = []
    req.on("data", function (chunk) {
      size += chunk.length
      if (size > MAX_BODY) tooLarge = true
      else chunks.push(chunk)
    })
    req.on("end", async function () {
      try {
        if (tooLarge) { res.writeHead(413); return res.end(JSON.stringify({ ok: false, error: "request too large" })) }
        const body = JSON.parse(Buffer.concat(chunks).toString("utf8"))
        const result = await invoke(body.method, body.params)
        res.writeHead(200); res.end(JSON.stringify({ ok: true, result: result }))
      } catch (error) {
        res.writeHead(400); res.end(JSON.stringify({ ok: false, error: error.message }))
      }
    })
  })
}

function parseArgs(argv) {
  const value = name => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : null }
  const roots = []
  argv.forEach((arg, i) => { if (arg === "--root" && argv[i + 1]) roots.push(argv[i + 1]) })
  return { host: "127.0.0.1", port: Number(value("--port") || 45678), tokenFile: value("--token-file"), roots: roots, home: value("--home") }
}

if (require.main === module) {
  const args = parseArgs(process.argv.slice(2))
  if (!args.tokenFile || !args.roots.length) throw new Error("--token-file and at least one --root are required")
  const token = fs.readFileSync(args.tokenFile, "utf8").trim()
  if (token.length < 32) throw new Error("bridge token is too short")
  const server = createBridge({ token: token, roots: args.roots, home: args.home })
  server.listen(args.port, args.host, function () { console.log(`typora-plugin bridge listening on ${args.host}:${args.port}`) })
}

module.exports = { MAX_BODY, MAX_RUNTIME_REPORTS, createBridge, createPolicy, parseArgs, safeEqual }
