const test = require("node:test")
const assert = require("node:assert")
const path = require("node:path")
const fs = require("node:fs")

let i18nFiles

test.before(() => {
    const dir = path.resolve(__dirname, "../../plugin/global/locales")
    i18nFiles = Object.fromEntries(
        fs.readdirSync(dir, { withFileTypes: true, recursive: false })
            .filter(file => file.isFile() && path.extname(file.name).toLowerCase() === ".json")
            .map(file => {
                const key = file.name.replace(/\.json$/, "")
                const p = path.join(file.path, file.name)
                const val = {
                    name: key,
                    path: p,
                    obj: JSON.parse(fs.readFileSync(p, "utf-8"))
                }
                return [key, val]
            })
    )
})

test("i18n testing suite", (t) => {
    t.test("should have the same structure", () => {
        const getStructure = (data) => {
            return typeof data === "object" && data !== null && !Array.isArray(data)
                ? Object.fromEntries(Object.keys(data).map(key => [key, getStructure(data[key])]))
                : ""
        }

        Object.values(i18nFiles)
            .map(val => ({
                name: val.name,
                obj: JSON.stringify(getStructure(val.obj)),
            }))
            .reduce((pre, cur) => {
                assert.strictEqual(pre.obj, cur.obj, `${pre.name} should equal to ${cur.name}`)
                return cur
            })
    })
})
