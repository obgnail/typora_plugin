const fs = require("node:fs/promises")
const toml = require("../../../plugin/global/core/lib/smol-toml.js")

const load = async () => {
  const file = await fs.readFile("../plugin/global/settings/settings.default.toml", "utf-8")
  return toml.parse(file)
}

module.exports = { load }
