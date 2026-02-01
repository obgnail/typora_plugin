const test = require("node:test")
const assert = require("node:assert")

let basePluginSettings
let customPluginSettings

test.before(async () => {
    ({ base: basePluginSettings, custom: customPluginSettings } = await require("./fixtures/settings.js").getMerged())
})

test("all plugin settings should has required attributes", async t => {
    await t.test("all base plugin settings should has attributes 'ENABLE' and 'NAME'", () => {
        Object.entries(basePluginSettings).forEach(([fixedName, s]) => {
            assert.ok(
                typeof s.ENABLE === "boolean" && (typeof s.NAME === "string" || fixedName === "global"),
                `[Error Base Plugin Settings] Found ${fixedName} missing attributes`
            )
        })
    })

    await t.test("all custom plugin settings should has attributes 'enable', 'name', 'hide' and 'order'", () => {
        Object.entries(customPluginSettings).forEach(([fixedName, s]) => {
            assert.ok(
                typeof s.enable === "boolean" && typeof s.name === "string" && typeof s.hide === "boolean" && typeof s.order === "number",
                `[Error Custom Plugin Settings] Found ${fixedName} missing attributes`
            )
        })
    })
})
