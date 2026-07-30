const path = require("node:path")
const fs = require("node:fs/promises")
const TOML = require("../../../plugin/global/core/lib/smol-toml.js")

const getFile = f => fs.readFile(path.join("../plugin/global/settings", f), "utf-8")

const merge = (source, other) => {
  const isObject = value => {
    const type = typeof value
    return value != null && (type === "object" || type === "function")
  }
  if (!isObject(source) || !isObject(other)) {
    return other === undefined ? source : other
  }
  return Object.keys({ ...source, ...other }).reduce((obj, key) => {
    const isArray = Array.isArray(source[key]) && Array.isArray(other[key])
    obj[key] = isArray ? other[key] : merge(source[key], other[key])
    return obj
  }, Array.isArray(source) ? [] : {})
}

const getDefaults = async () => {
  const file = await getFile("settings.default.toml")
  return TOML.parse(file)
}

const getMerged = async () => {
  const tomlFiles = await Promise.all(["settings.default.toml", "settings.user.toml"].map(getFile))
  const tomlObjs = tomlFiles.map(f => TOML.parse(f))
  return merge(...tomlObjs)
}

module.exports = {
  getDefaults,
  getMerged,
}
