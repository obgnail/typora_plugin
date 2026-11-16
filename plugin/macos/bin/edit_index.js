#!/usr/bin/env node
"use strict"

const fs = require("fs")
const { inject, remove } = require("../lib/html")

const mode = process.argv[2]
const file = process.argv[3]
if (!file || (mode !== "inject" && mode !== "remove")) {
  console.error("usage: edit_index.js <inject|remove> <index.html>")
  process.exit(64)
}

const original = fs.readFileSync(file, "utf8")
const updated = mode === "inject" ? inject(original) : remove(original)
if (updated !== original) fs.writeFileSync(file, updated, "utf8")
console.log(updated === original ? "unchanged" : "updated")
