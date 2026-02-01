const path = require("node:path")
const fs = require("node:fs")

module.exports = Object.fromEntries(
    fs.readdirSync(path.resolve(__dirname, "../../../plugin/global/locales"), { withFileTypes: true, recursive: false })
        .filter(file => file.isFile() && path.extname(file.name).toLowerCase() === ".json")
        .map(file => {
            const key = file.name.replace(/\.json$/, "")
            const p = path.join(file.path, file.name)
            const val = {
                name: key,
                path: p,
                obj: require(p),
            }
            return [key, val]
        })
)
