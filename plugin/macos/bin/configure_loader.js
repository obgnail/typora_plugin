#!/usr/bin/env node
"use strict"

const fs = require("fs")

const sourceFile = process.argv[2]
const tokenFile = process.argv[3]
const outputFile = process.argv[4]
if (!sourceFile || !tokenFile || !outputFile) {
  console.error("usage: configure_loader.js <loader.js> <token-file> <output-loader.js>")
  process.exit(64)
}

const token = fs.readFileSync(tokenFile, "utf8").trim()
if (!/^[0-9a-f]{64}$/.test(token)) throw new Error("bridge token must be 32 random bytes encoded as lowercase hex")
const source = fs.readFileSync(sourceFile, "utf8")
const marker = "%%TYPORA_MACOS_BRIDGE_TOKEN%%"
if (source.split(marker).length !== 2) throw new Error("loader token marker is missing or duplicated")
fs.writeFileSync(outputFile, source.replace(marker, token), { mode: 0o600 })
