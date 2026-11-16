#!/usr/bin/env node
"use strict"

const fs = require("fs")
const http = require("http")

const [tokenFile, command = "get"] = process.argv.slice(2)
if (!tokenFile || !["get", "clear"].includes(command)) {
  console.error("usage: runtime_reports.js <token-file> [get|clear]")
  process.exit(64)
}
const token = fs.readFileSync(tokenFile, "utf8").trim()
if (!/^[0-9a-f]{64}$/.test(token)) throw new Error("invalid bridge token")
const method = command === "clear" ? "runtime.clearReports" : "runtime.getReports"
const body = JSON.stringify({ method, params: [] })
const req = http.request({
  host: "127.0.0.1",
  port: 45678,
  path: "/v1/rpc",
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
    "X-Typora-Plugin-Token": token,
  },
}, response => {
  let data = ""
  response.on("data", chunk => { data += chunk })
  response.on("end", () => {
    const parsed = JSON.parse(data)
    if (response.statusCode !== 200 || !parsed.ok) throw new Error(parsed.error || `HTTP ${response.statusCode}`)
    process.stdout.write(JSON.stringify(parsed.result, null, 2) + "\n")
  })
})
req.on("error", error => { throw error })
req.end(body)
