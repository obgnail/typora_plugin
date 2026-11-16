#!/usr/bin/env node
"use strict"

const crypto = require("crypto")
const fs = require("fs")
const http = require("http")
const os = require("os")
const path = require("path")

const MAX_BODY = 1024 * 1024
const MAX_READ = 16 * 1024 * 1024
const METHODS = new Set(["fs.readFile", "fs.writeFile", "fs.exists", "fs.stat", "fs.readdir", "fs.mkdir", "os.homedir", "probe.report", "runtime.report", "runtime.getReports", "runtime.clearReports"])
const MAX_RUNTIME_REPORTS = 200

function isUtf8(encoding) {
  return encoding == null || /^utf-?8$/i.test(String(encoding))
}

function safeEqual(actual, expected) {
  const left = Buffer.from(String(actual || ""))
  const right = Buffer.from(String(expected || ""))
  return left.length === right.length && crypto.timingSafeEqual(left, right)
}

function normalizeRoots(roots) {
  return roots.map(root => {
    const logical = path.resolve(root)
    if (fs.lstatSync(logical).isSymbolicLink()) throw new Error("allowed root must not be a symlink")
    return { logical: logical, real: fs.realpathSync(logical) }
  })
}

function createPolicy(readRoots, writeRoots = readRoots) {
  const readable = normalizeRoots(readRoots)
  const writable = normalizeRoots(writeRoots)
  return function authorize(input, write = false) {
    if (typeof input !== "string" || input.indexOf("\0") >= 0) throw new Error("invalid path")
    const target = path.resolve(input)
    const allowed = write ? writable : readable
    const ok = allowed.some(root => target === root.logical || target.indexOf(root.logical + path.sep) === 0)
    if (!ok) throw new Error("path is outside allowed roots")
    let existing = target
    while (!fs.existsSync(existing)) {
      const parent = path.dirname(existing)
      if (parent === existing) break
      existing = parent
    }
    const relative = path.relative(allowed.find(root => target === root.logical || target.indexOf(root.logical + path.sep) === 0).logical, existing)
    let cursor = allowed.find(root => target === root.logical || target.indexOf(root.logical + path.sep) === 0).logical
    for (const part of relative.split(path.sep).filter(Boolean)) {
      cursor = path.join(cursor, part)
      if (fs.lstatSync(cursor).isSymbolicLink()) throw new Error("symlinks are not allowed in authorized paths")
    }
    const real = fs.realpathSync(existing)
    const realOk = allowed.some(root => real === root.real || real.indexOf(root.real + path.sep) === 0)
    if (!realOk) throw new Error("path escapes allowed roots through a symlink")
    return path.join(real, path.relative(existing, target))
  }
}

function createBridge(options) {
  const token = options.token
  const readRoots = options.readRoots || options.roots
  const writeRoots = options.writeRoots || options.roots
  const authorize = createPolicy(readRoots, writeRoots)
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
    const write = method === "fs.writeFile" || method === "fs.mkdir"
    const target = authorize(params[0], write)
    if (method === "fs.readFile") {
      const stat = await fs.promises.stat(target)
      if (stat.size > MAX_READ) throw new Error("file is too large")
      if (!isUtf8(params[1])) throw new Error("unsupported encoding")
      return fs.promises.readFile(target, "utf8")
    }
    if (method === "fs.writeFile") {
      if (!isUtf8(params[2])) throw new Error("unsupported encoding")
      const flags = fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_TRUNC | (fs.constants.O_NOFOLLOW || 0)
      const handle = await fs.promises.open(target, flags, 0o600)
      try { await handle.chmod(0o600); await handle.writeFile(params[1], "utf8") } finally { await handle.close() }
      return true
    }
    if (method === "fs.exists") return fs.existsSync(target)
    if (method === "fs.readdir") return fs.promises.readdir(target)
    if (method === "fs.mkdir") { await fs.promises.mkdir(target, { recursive: params[1] === true, mode: 0o700 }); return true }
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
      const details = safeEqual(req.headers["x-typora-plugin-token"], token)
        ? { rpcRequests: rpcRequests, probeReceived: probeReceived, probeSummary: probeSummary, nonHealthRequests: nonHealthRequests, preflightRequests: preflightRequests, lastRequest: lastRequest }
        : {}
      res.writeHead(200); return res.end(JSON.stringify({ ok: true, ...details }))
    }
    if (req.method !== "POST" || req.url !== "/v1/rpc") {
      res.writeHead(404); return res.end(JSON.stringify({ ok: false, error: "not found" }))
    }
    if (origin !== "null" && origin !== "file://") {
      res.writeHead(403); return res.end(JSON.stringify({ ok: false, error: "origin required" }))
    }
    if (!String(req.headers["content-type"] || "").toLowerCase().startsWith("application/json")) {
      res.writeHead(415); return res.end(JSON.stringify({ ok: false, error: "application/json required" }))
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
  }).setTimeout(10_000)
}

function parseArgs(argv) {
  const value = name => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : null }
  const readRoots = []
  const writeRoots = []
  argv.forEach((arg, i) => {
    if ((arg === "--root" || arg === "--read-root") && argv[i + 1]) readRoots.push(argv[i + 1])
    if ((arg === "--root" || arg === "--write-root") && argv[i + 1]) writeRoots.push(argv[i + 1])
  })
  return { host: "127.0.0.1", port: Number(value("--port") || 45678), tokenFile: value("--token-file"), readRoots: readRoots, writeRoots: writeRoots, home: value("--home") }
}

if (require.main === module) {
  const args = parseArgs(process.argv.slice(2))
  if (!args.tokenFile || !args.readRoots.length || !args.writeRoots.length) throw new Error("--token-file, --read-root, and --write-root are required")
  const token = fs.readFileSync(args.tokenFile, "utf8").trim()
  if (token.length < 32) throw new Error("bridge token is too short")
  const server = createBridge({ token: token, readRoots: args.readRoots, writeRoots: args.writeRoots, home: args.home })
  server.listen(args.port, args.host, function () { console.log(`typora-plugin bridge listening on ${args.host}:${args.port}`) })
}

module.exports = { MAX_BODY, MAX_READ, MAX_RUNTIME_REPORTS, createBridge, createPolicy, isUtf8, parseArgs, safeEqual }
